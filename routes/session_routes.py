# session_bp.py
import asyncio
import io
import json
import threading
import time
import uuid
import base64
import logging
from datetime import datetime
from typing import Dict, Any

from flask import Blueprint, request, jsonify, render_template

# optional DB models (safe import)
try:
    from models import db, Session as DBSession
    _HAS_DB = True
except Exception:
    _HAS_DB = False

from playwright.async_api import async_playwright
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack, RTCIceCandidate
from av import VideoFrame
from PIL import Image, ImageDraw

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

session_bp = Blueprint("session", __name__)

# Configuration constants
SESSION_TIMEOUT = 3600  # 1 hour
IDLE_TIMEOUT = 1800     # 30 minutes
CLEANUP_INTERVAL = 60   # 1 minute
FPS = 15
VIEWPORT_WIDTH = 1280
VIEWPORT_HEIGHT = 720

# In-memory stores (thread-safe)
SESSIONS: Dict[str, Dict[str, Any]] = {}        # session_id -> {playwright,browser,context,page,url,created_at,last_activity}
PEER_CONNECTIONS: Dict[str, Dict[str, Any]] = {}  # pc_id -> {'pc': pc, 'session_id': session_id, 'created_at': ...}
SAVED_SESSIONS: Dict[str, Dict[str, Any]] = {}  # saved_id -> saved_session_dict
_lock = threading.Lock()

# Persistent async loop in its own thread
_loop = None

def init_loop():
    global _loop
    _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    _loop.run_forever()

threading.Thread(target=init_loop, daemon=True).start()
time.sleep(0.05)

def run_async(coro, timeout=30):
    global _loop
    if _loop is None:
        raise RuntimeError("Async loop not initialized")
    fut = asyncio.run_coroutine_threadsafe(coro, _loop)
    return fut.result(timeout=timeout)

# ----- Video track -----
class BrowserVideoTrack(VideoStreamTrack):
    def __init__(self, page, fps=None):
        super().__init__()
        self.page = page
        self.fps = fps or FPS
        self.frame_interval = 1.0 / self.fps
        self._last = 0.0

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        now = time.time()
        elapsed = now - self._last
        if elapsed < self.frame_interval:
            await asyncio.sleep(self.frame_interval - elapsed)
        self._last = time.time()

        try:
            screenshot_bytes = await asyncio.wait_for(self.page.screenshot(type='png'), timeout=5.0)
            img = Image.open(io.BytesIO(screenshot_bytes)).convert('RGB')
            frame = VideoFrame.from_image(img)
            frame.pts = pts
            frame.time_base = time_base
            return frame
        except Exception as e:
            logger.exception("Error generating frame")
            img = Image.new('RGB', (VIEWPORT_WIDTH, VIEWPORT_HEIGHT), (255, 0, 0))
            draw = ImageDraw.Draw(img)
            draw.text((10, 10), f"Error: {str(e)}", fill=(255, 255, 255))
            frame = VideoFrame.from_image(img)
            frame.pts = pts
            frame.time_base = time_base
            return frame

# ----- Playwright session creation / cleanup -----
async def create_browser_session_async(session_id, url="https://example.com"):
    logger.info(f"Creating browser session {session_id} -> {url}")
    p = await async_playwright().start()
    browser = await p.chromium.launch(
        headless=True,
        args=[
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
        ]
    )

    context = await browser.new_context(
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ignore_https_errors=True,
        java_script_enabled=True,
    )

    page = await context.new_page()
    await page.set_viewport_size({"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT})
    await page.set_extra_http_headers({'Accept-Language': 'en-US,en;q=0.9'})
    await page.goto(url, wait_until='domcontentloaded', timeout=30000)
    await asyncio.sleep(0.5)
    await page.set_viewport_size({"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT})
    logger.info(f"Browser session {session_id} created")
    return {
        'playwright': p,
        'browser': browser,
        'context': context,
        'page': page,
        'url': url,
        'created_at': time.time(),
        'last_activity': time.time(),
    }

async def cleanup_session_async(session_id):
    with _lock:
        session = SESSIONS.pop(session_id, None)
    if not session:
        return
    try:
        logger.info(f"Cleaning up session {session_id}")
        await session['context'].close()
        await session['browser'].close()
        await session['playwright'].stop()
        logger.info(f"Cleaned up {session_id}")
    except Exception:
        logger.exception("Error cleaning up session")

# ----- WebRTC helpers -----
async def setup_webrtc_connection(pc, session_id, offer_sdp, offer_type):
    session = SESSIONS.get(session_id)
    if not session:
        raise ValueError("Session not found")

    page = session['page']
    offer = RTCSessionDescription(sdp=offer_sdp, type=offer_type)
    await pc.setRemoteDescription(offer)

    video_track = BrowserVideoTrack(page, fps=FPS)
    pc.addTrack(video_track)

    @pc.on("datachannel")
    def on_datachannel(channel):
        logger.info(f"Data channel opened: {channel.label}")

        @channel.on("message")
        async def on_message(message):
            await handle_interaction(message, session_id, channel)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        state = pc.connectionState
        logger.info(f"Connection state: {state}")
        if state in ("failed", "closed"):
            pc_id = None
            with _lock:
                for pid, entry in list(PEER_CONNECTIONS.items()):
                    if entry['pc'] == pc:
                        pc_id = pid
                        break
                if pc_id:
                    del PEER_CONNECTIONS[pc_id]
            await pc.close()

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    return pc.localDescription.sdp, pc.localDescription.type

async def add_ice_candidate_async(pc, candidate_data):
    if isinstance(candidate_data, dict) and 'candidate' in candidate_data:
        try:
            candidate = RTCIceCandidate(**candidate_data)
            await pc.addIceCandidate(candidate)
        except Exception:
            logger.exception("Failed to add ICE candidate")

# ----- Interaction handler (ported from your original) -----
async def handle_interaction(message, session_id, channel):
    try:
        data = json.loads(message)
        session = SESSIONS.get(session_id)
        if not session:
            if channel and getattr(channel, "readyState", None) == "open":
                channel.send(json.dumps({
                    'type': 'click_response',
                    'success': False,
                    'error': 'Session not found',
                    'clickId': data.get('id', 'unknown')
                }))
            return

        session['last_activity'] = time.time()
        page = session['page']
        event_type = data.get('type')

        logger.info(f"Handling interaction: {event_type}")

        if event_type == 'click':
            click_id = data.get('id', 'unknown')
            x = int(data['x'])
            y = int(data['y'])

            try:
                await page.wait_for_load_state('domcontentloaded', timeout=5000)
                await page.set_viewport_size({"width": 1280, "height": 720})
                viewport = page.viewport_size
                if not viewport:
                    error_msg = "Failed to get viewport size"
                    if channel and getattr(channel, "readyState", None) == "open":
                        channel.send(json.dumps({'type': 'click_response','success': False,'error': error_msg,'clickId': click_id}))
                    return
                vw, vh = viewport['width'], viewport['height']
                if x < 0 or x > vw or y < 0 or y > vh:
                    error_msg = f"Coordinates ({x},{y}) outside viewport ({vw}x{vh})"
                    if channel and getattr(channel, "readyState", None) == "open":
                        channel.send(json.dumps({'type': 'click_response','success': False,'error': error_msg,'clickId': click_id}))
                    return

                element_info = await page.evaluate("""
                    (data) => {
                        const x = data.x, y = data.y;
                        const el = document.elementFromPoint(x, y);
                        if (!el) return { found: false, message: 'No element at position' };
                        const rect = el.getBoundingClientRect();
                        return { found:true, tagName: el.tagName, id: el.id||'', className: el.className||'', rect: {left: rect.left, top: rect.top, width: rect.width, height: rect.height} };
                    }
                """, {"x": x, "y": y})

                if not element_info.get('found'):
                    if channel and getattr(channel, "readyState", None) == "open":
                        channel.send(json.dumps({'type': 'click_response','success': False,'error': 'No element found','clickId': click_id}))
                    return

                try:
                    await page.mouse.move(x, y)
                    await asyncio.sleep(0.05)
                    await page.mouse.click(x, y, button='left', click_count=1)
                    if channel and getattr(channel, "readyState", None) == "open":
                        channel.send(json.dumps({'type':'click_response','success': True,'clickId': click_id,'element': element_info}))
                except Exception as click_error:
                    if channel and getattr(channel, "readyState", None) == "open":
                        channel.send(json.dumps({'type':'click_response','success': False,'error': str(click_error),'clickId': click_id}))
            except Exception as e:
                logger.exception("Error in click handler")
                if channel and getattr(channel, "readyState", None) == "open":
                    channel.send(json.dumps({'type':'click_response','success': False,'error': str(e),'clickId': click_id}))

        elif event_type == 'type':
            await page.keyboard.type(data.get('text', ''))
            if channel and getattr(channel, "readyState", None) == "open":
                channel.send(json.dumps({'type': 'ack', 'event': 'type'}))

        elif event_type == 'scroll':
            delta_y = int(data.get('deltaY', 0))
            await page.evaluate(f"window.scrollBy(0, {delta_y})")
            if channel and getattr(channel, "readyState", None) == "open":
                channel.send(json.dumps({'type':'ack','event':'scroll'}))

        elif event_type == 'navigate':
            url = data.get('url')
            await page.goto(url, wait_until='domcontentloaded')
            session['url'] = url
            if channel and getattr(channel, "readyState", None) == "open":
                channel.send(json.dumps({'type':'ack','event':'navigate'}))

        elif event_type == 'screenshot':
            screenshot = await page.screenshot(type='png')
            filename = f"session_{session_id}_{int(time.time())}.png"
            with open(filename, 'wb') as f:
                f.write(screenshot)
            if channel and getattr(channel, "readyState", None) == "open":
                channel.send(json.dumps({'type': 'screenshot_saved', 'filename': filename}))

    except Exception:
        logger.exception("Error handling interaction")
        try:
            if channel and getattr(channel, "readyState", None) == "open":
                channel.send(json.dumps({'type':'error','message':'internal error'}))
        except Exception as e:
            logger.warning(f"Error sending error message: {e}")

# ----- Cleanup task -----
async def cleanup_old_sessions():
    """Background task to clean up old sessions and peer connections."""
    while True:
        try:
            now = time.time()
            to_cleanup = []
            with _lock:
                for sid, sess in list(SESSIONS.items()):
                    age = now - sess['created_at']
                    idle = now - sess.get('last_activity', sess['created_at'])
                    if age > SESSION_TIMEOUT or idle > IDLE_TIMEOUT:
                        to_cleanup.append(sid)
            for sid in to_cleanup:
                logger.info(f"Auto-cleanup {sid}")
                await cleanup_session_async(sid)

            with _lock:
                dead = [pcid for pcid, entry in PEER_CONNECTIONS.items() if entry['pc'].connectionState in ('failed','closed')]
                for pcid in dead:
                    del PEER_CONNECTIONS[pcid]
        except Exception:
            logger.exception("Error in cleanup loop")
        await asyncio.sleep(CLEANUP_INTERVAL)

# start cleanup
try:
    run_async(cleanup_old_sessions())
except Exception:
    pass

# ----- Routes (match original / endpoints exactly) -----

@session_bp.route("/sessions", methods=["POST"])
def create_session():
    """Create a new browser session.
    
    Accepts JSON payload with optional 'url' field.
    Returns a UUID session_id for the created session.
    
    Request body: {"url": "https://example.com"} (optional)
    Response: {"session_id": "uuid", "url": "url", "status": "created"}
    
    Returns:
        tuple: (response_dict, status_code)
    """
    data = request.get_json() or {}
    url = data.get('url', 'https://example.com')
    session_id = str(uuid.uuid4())

    try:
        session = run_async(create_browser_session_async(session_id, url))
        with _lock:
            SESSIONS[session_id] = session

        # Optionally create DB record if models available (non-fatal)
        if _HAS_DB:
            try:
                user_id = getattr(data, "user_id", None)
                if user_id is not None:
                    db_s = DBSession(user_id=int(user_id), start_time=datetime.utcnow())
                    db.session.add(db_s)
                    db.session.commit()
            except Exception:
                logger.exception("Optional DB session creation failed; continuing.")

        return jsonify({'session_id': session_id, 'url': url, 'status': 'created'}), 201
    except Exception:
        logger.exception("Error creating session")
        return jsonify({'error': 'failed to create session'}), 500

@session_bp.route("/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id):
    """Delete a browser session by session_id.
    
    Args:
        session_id: UUID of the session to delete
        
    Returns:
        tuple: ({"status": "deleted"}, 200) on success
               ({"error": "failed to delete session"}, 500) on failure
    """
    try:
        run_async(cleanup_session_async(session_id))
        return jsonify({'status': 'deleted'}), 200
    except Exception:
        logger.exception("Error deleting session")
        return jsonify({'error': 'failed to delete session'}), 500

@session_bp.route("/sessions", methods=["GET"])
def list_sessions():
    """List all active browser sessions.
    
    Returns:
        tuple: ({"sessions": [list_of_sessions]}, 200)
        
    Each session contains:
        - session_id: UUID of the session
        - url: URL the session is currently on
        - title: Page title
        - created_at: ISO timestamp of creation
        - last_activity: ISO timestamp of last activity
        - screenshot: Base64 encoded screenshot (optional)
        - is_isolated: Always True for this implementation
        - status: Always 'active'
    """
    out = []
    with _lock:
        for sid, sess in SESSIONS.items():
            try:
                title = run_async(sess['page'].title())
            except Exception:
                title = "unknown"
            screenshot_b64 = None
            try:
                sb = run_async(sess['page'].screenshot(type='png', full_page=False))
                screenshot_b64 = base64.b64encode(sb).decode('utf-8') if sb else None
            except Exception:
                pass
            out.append({
                'session_id': sid,
                'url': sess.get('url'),
                'title': title,
                'created_at': datetime.utcfromtimestamp(sess['created_at']).isoformat() + 'Z',
                'last_activity': datetime.utcfromtimestamp(sess.get('last_activity', sess['created_at'])).isoformat() + 'Z',
                'screenshot': screenshot_b64,
                'is_isolated': True,
                'status': 'active'
            })
    return jsonify({'sessions': out}), 200

@session_bp.route("/sessions/<session_id>/save", methods=["POST"])
def save_session(session_id):
    try:
        with _lock:
            sess = SESSIONS.get(session_id)
        if not sess:
            return jsonify({'error': 'Session not found'}), 404
        screenshot_bytes = run_async(sess['page'].screenshot(type='png'))
        saved_id = str(uuid.uuid4())
        saved = {
            'id': saved_id,
            'name': request.json.get('name', sess.get('url')) if request.json else sess.get('url'),
            'url': sess.get('url'),
            'title': run_async(sess['page'].title()),
            'saved_at': time.time(),
            'screenshot': base64.b64encode(screenshot_bytes).decode('utf-8') if screenshot_bytes else None
        }
        SAVED_SESSIONS[saved_id] = saved
        logger.info(f"Saved session {session_id} as {saved_id}")
        return jsonify({'status': 'saved', 'saved_id': saved_id, 'saved_at': saved['saved_at']}), 200
    except Exception:
        logger.exception("Error saving session")
        return jsonify({'error': 'failed to save session'}), 500

@session_bp.route("/sessions/saved", methods=["GET"])
def list_saved():
    out = []
    for sid, s in SAVED_SESSIONS.items():
        out.append({'id': sid, 'name': s['name'], 'url': s['url'], 'title': s['title'], 'saved_at': s['saved_at'], 'screenshot': s.get('screenshot')})
    return jsonify({'saved_tabs': out}), 200

@session_bp.route("/sessions/<saved_id>/restore", methods=["POST"])
def restore_saved(saved_id):
    try:
        saved = SAVED_SESSIONS.get(saved_id)
        if not saved:
            return jsonify({'error': 'Saved session not found'}), 404
        session_id = str(uuid.uuid4())
        sess = run_async(create_browser_session_async(session_id, saved['url']))
        with _lock:
            SESSIONS[session_id] = sess
        logger.info(f"Restored {saved_id} -> {session_id}")
        return jsonify({'status': 'restored', 'session_id': session_id, 'url': saved['url']}), 200
    except Exception:
        logger.exception("Error restoring saved session")
        return jsonify({'error': 'failed to restore saved session'}), 500

@session_bp.route("/webrtc/offer", methods=["POST"])
def handle_offer():
    data = request.get_json() or {}
    offer_sdp = data.get('sdp')
    offer_type = data.get('type')
    session_id = data.get('session_id')
    if not all([offer_sdp, offer_type, session_id]):
        return jsonify({'error': 'Missing required fields'}), 400
    with _lock:
        if session_id not in SESSIONS:
            return jsonify({'error': 'Invalid session_id'}), 400

    pc = RTCPeerConnection()
    pc_id = str(uuid.uuid4())
    with _lock:
        PEER_CONNECTIONS[pc_id] = {'pc': pc, 'session_id': session_id, 'created_at': time.time()}

    try:
        answer_sdp, answer_type = run_async(setup_webrtc_connection(pc, session_id, offer_sdp, offer_type))
        return jsonify({'sdp': answer_sdp, 'type': answer_type, 'pc_id': pc_id}), 200
    except Exception:
        logger.exception("Error handling offer")
        return jsonify({'error': 'failed to handle offer'}), 500

@session_bp.route("/webrtc/candidate", methods=["POST"])
def handle_candidate():
    data = request.get_json() or {}
    pc_id = data.get('pc_id')
    candidate = data.get('candidate')
    if not pc_id or candidate is None:
        return jsonify({'error': 'Missing pc_id or candidate'}), 400
    with _lock:
        entry = PEER_CONNECTIONS.get(pc_id)
    if not entry:
        return jsonify({'status': 'ignored'}), 200
    try:
        run_async(add_ice_candidate_async(entry['pc'], candidate))
        return jsonify({'status': 'added'}), 200
    except Exception:
        logger.exception("Error adding candidate")
        return jsonify({'error': 'failed to add candidate'}), 500

@session_bp.route("/health", methods=["GET"])
def health():
    with _lock:
        return jsonify({
            'status': 'healthy',
            'sessions': len(SESSIONS),
            'connections': len(PEER_CONNECTIONS),
            'saved_sessions': len(SAVED_SESSIONS),
            'async_thread_alive': _loop is not None and _loop.is_running()
        }), 200

# small convenience isolated session (keeps original template flavor)
@session_bp.route("/session/isolated_session", methods=["GET"])
def isolated_session_template():
    from playwright.sync_api import sync_playwright
    import os
    temp_dir = "temp_sessions"
    os.makedirs(temp_dir, exist_ok=True)
    storage_state_path = os.path.join(temp_dir, "storage_state.json")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        if os.path.exists(storage_state_path):
            context = browser.new_context(storage_state=storage_state_path)
        else:
            context = browser.new_context()
        page = context.new_page()
        page.goto("http://127.0.0.1:5000/api/sessions/isolated_session_page")
        context.storage_state(path=storage_state_path)
        browser.close()
    return render_template("isolated_session.html")

@session_bp.route("/sessions/isolated_session_page", methods=["GET"])
def isolated_session_page():
    return "<html><body><h1>Isolated Page</h1></body></html>"
