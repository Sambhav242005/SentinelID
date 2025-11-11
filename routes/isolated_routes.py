
from flask import Blueprint, jsonify, request
from playwright.async_api import async_playwright
import uuid
import os
import base64
import tempfile
import shutil
import json

isolated_bp = Blueprint("isolated", __name__)
browser_sessions = {}

@isolated_bp.route("/start", methods=["GET"])
async def start_isolated_session():
    session_id = str(uuid.uuid4())
    temp_dir = tempfile.mkdtemp(prefix=f"browser_session_{session_id}_")
    
    browser_sessions[session_id] = {
        "temp_dir": temp_dir,
        "active": True,
        "playwright": None,
        "context": None,
        "page": None,
        "current_url": None
    }
    
    try:
        print(f"[{session_id}] Starting Playwright...")
        playwright = await async_playwright().start()
        
        print(f"[{session_id}] Launching persistent context...")
        context = await playwright.chromium.launch_persistent_context(
            user_data_dir=temp_dir,
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],
            viewport={"width": 1280, "height": 720},
            ignore_https_errors=True
        )
        
        print(f"[{session_id}] Creating new page...")
        page = await context.new_page()
        
        # ✅ DEBUG: Check if the page object is valid
        if page is None:
            raise Exception("Playwright's context.new_page() returned None")

        print(f"[{session_id}] Storing objects in session. Page object type: {type(page)}")
        browser_sessions[session_id]["playwright"] = playwright
        browser_sessions[session_id]["context"] = context
        browser_sessions[session_id]["page"] = page
        
        print(f"[{session_id}] Session started successfully.")
        return jsonify({
            "session_id": session_id,
            "message": "Isolated browser session started"
        }), 201
        
    except Exception as e:
        print(f"[{session_id}] ERROR during startup: {str(e)}")
        if session_id in browser_sessions:
            shutil.rmtree(browser_sessions[session_id]["temp_dir"], ignore_errors=True)
            del browser_sessions[session_id]
        return jsonify({"error": f"Failed to start browser: {str(e)}"}), 500

@isolated_bp.route("/navigate", methods=["POST"])
async def navigate_to_url():
    data = request.get_json()
    if not data or "session_id" not in data or "url" not in data:
        return jsonify({"error": "session_id and url are required"}), 400
    
    session_id = data["session_id"]
    url = data["url"]
    
    print(f"--- [NAVIGATE] Request for session: {session_id} ---")
    print(f"Active sessions: {list(browser_sessions.keys())}")

    if session_id not in browser_sessions:
        print(f"[{session_id}] ERROR: Session ID not found in dictionary.")
        return jsonify({"error": "Invalid session"}), 404

    session = browser_sessions[session_id]
    page = session.get("page")

    # ✅ DEBUG: Check the page object before using it
    print(f"[{session_id}] Retrieved page object. Type: {type(page)}, Value: {page}")
    if page is None:
        print(f"[{session_id}] CRITICAL ERROR: Page object is None in session!")
        return jsonify({"error": "Page object is None. Was the session started correctly?"}), 500

    try:
        print(f"[{session_id}] Navigating to: {url}")
        response = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        
        html_content = await page.content()
        title = await page.title()
        session["current_url"] = url
        
        screenshot = await page.screenshot()
        screenshot_base64 = base64.b64encode(screenshot).decode("utf-8")
        
        print(f"[{session_id}] Navigation successful.")
        return jsonify({
            "html": html_content,
            "title": title,
            "url": page.url,
            "screenshot": f"data:image/png;base64,{screenshot_base64}"
        }), 200
        
    except Exception as e:
        print(f"[{session_id}] ERROR during navigation: {str(e)}")
        return jsonify({"error": f"Failed to navigate: {str(e)}"}), 500


@isolated_bp.route("/interact", methods=["POST"])
async def interact_with_page():  # <-- Changed to async def
    """Process user interactions on the page and return updated HTML."""
    data = request.get_json()
    if not data or "session_id" not in data or "actions" not in data:
        return jsonify({"error": "session_id and actions are required"}), 400
    
    session_id = data["session_id"]
    actions = data["actions"]
    
    # Check if session exists
    if session_id not in browser_sessions or not browser_sessions[session_id]["active"]:
        return jsonify({"error": "Invalid or inactive session"}), 404
    
    try:
        page = browser_sessions[session_id]["page"]
        
        # Process each action
        for action in actions:
            action_type = action.get("type")
            
            if action_type == "click":
                selector = action.get("selector")
                if selector:
                    await page.click(selector)  # <-- Use await
            
            elif action_type == "type":
                selector = action.get("selector")
                text = action.get("text", "")
                if selector:
                    await page.fill(selector, text)  # <-- Use await
            
            elif action_type == "scroll":
                x = action.get("x", 0)
                y = action.get("y", 0)
                await page.evaluate(f"window.scrollTo({x}, {y})") # <-- Use await
            
            elif action_type == "keypress":
                key = action.get("key")
                if key:
                    await page.keyboard.press(key) # <-- Use await
        
        # Wait for any navigation or network activity to complete
        await page.wait_for_load_state("domcontentloaded", timeout=5000) # <-- Use await
        
        # Get the updated HTML content
        html_content = await page.content() # <-- Use await
        
        # Take a screenshot for reference (optional)
        screenshot = await page.screenshot() # <-- Use await
        screenshot_base64 = base64.b64encode(screenshot).decode("utf-8")
        
        return jsonify({
            "html": html_content,
            "url": page.url,
            "screenshot": f"data:image/png;base64,{screenshot_base64}"
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to process interaction: {str(e)}"}), 500

@isolated_bp.route("/close", methods=["POST"])
async def close_session():  # <-- Changed to async def
    """Close an isolated browser session and clean up resources."""
    data = request.get_json()
    if not data or "session_id" not in data:
        return jsonify({"error": "session_id is required"}), 400
    
    session_id = data["session_id"]
    
    if session_id not in browser_sessions:
        return jsonify({"error": "Invalid session"}), 404
    
    try:
        session = browser_sessions[session_id]
        
        # Close the context and stop playwright
        if session.get("context"):
            await session["context"].close()  # <-- Use await
        if session.get("playwright"):
            await session["playwright"].stop()  # <-- Use await
        
        # Clean up temporary directory
        if session.get("temp_dir") and os.path.exists(session["temp_dir"]):
            shutil.rmtree(session["temp_dir"], ignore_errors=True)
        
        # Remove session from active sessions
        del browser_sessions[session_id]
        
        return jsonify({"message": "Session closed successfully"}), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to close session: {str(e)}"}), 500