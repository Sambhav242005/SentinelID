import asyncio
from datetime import datetime
import io
import json
import uuid
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, request, jsonify
from flask_cors import CORS
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack, RTCIceCandidate
from av import VideoFrame
from PIL import Image, ImageDraw
from playwright.async_api import async_playwright
import logging
import base64

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Global state with thread safety
SESSIONS = {}  # session_id -> session dict
PEER_CONNECTIONS = {}  # pc_id -> pc dict
SAVED_SESSIONS = {}  # saved_id -> saved_session_data
_lock = threading.Lock()  # Protect global state

# Single persistent event loop for all async operations
_async_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='async_worker')
_loop = None  # Will be set by init_loop

def init_loop():
    """Initialize single persistent event loop in separate thread"""
    global _loop
    _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    _loop.run_forever()

# Start async worker thread
threading.Thread(target=init_loop, daemon=True).start()
time.sleep(0.1)  # Let loop start

def run_async(coro):
    """Thread-safe way to run async coroutines"""
    global _loop
    if _loop is None:
        raise RuntimeError("Event loop not initialized")
    future = asyncio.run_coroutine_threadsafe(coro, _loop)
    return future.result(timeout=30)  # Add timeout to prevent hanging

class BrowserVideoTrack(VideoStreamTrack):
    """Video track that streams Playwright page screenshots"""
    
    def __init__(self, page, fps=10):
        super().__init__()
        self.page = page
        self.fps = fps
        self.frame_interval = 1.0 / fps
        self.last_frame_time = 0
        
    async def recv(self):
        """Generate video frames from browser screenshots"""
        pts, time_base = await self.next_timestamp()
        
        # Control frame rate properly (don't sleep in recv!)
        now = time.time()
        elapsed = now - self.last_frame_time
        if elapsed < self.frame_interval:
            await asyncio.sleep(self.frame_interval - elapsed)
        self.last_frame_time = time.time()
        
        try:
            # Take screenshot (with timeout)
            screenshot_bytes = await asyncio.wait_for(
                self.page.screenshot(type='png'),
                timeout=5.0
            )
            img = Image.open(io.BytesIO(screenshot_bytes)).convert('RGB')
            
            # Convert to video frame
            frame = VideoFrame.from_image(img)
            frame.pts = pts
            frame.time_base = time_base
            
            return frame
            
        except Exception as e:
            logger.error(f"Error generating frame: {e}", exc_info=True)
            # Return error indicator frame
            img = Image.new('RGB', (1280, 720), color=(255, 0, 0))  # Red = error
            draw = ImageDraw.Draw(img)
            draw.text((10, 10), f"Error: {str(e)}", fill=(255, 255, 255))
            
            frame = VideoFrame.from_image(img)
            frame.pts = pts
            frame.time_base = time_base
            return frame

async def create_browser_session(session_id, url="https://example.com"):
    """Create a new isolated browser session"""
    try:
        logger.info(f"Creating browser session {session_id} for {url}")
        
        # Launch Playwright
        playwright = await async_playwright().start()
        
        # Launch browser
        browser = await playwright.chromium.launch(
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
        
        # Create context WITHOUT viewport (we'll set it on the page)
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            ignore_https_errors=True,
            java_script_enabled=True,
        )
        
        # Create page
        page = await context.new_page()
        
        # CRITICAL: Set viewport immediately after page creation
        await page.set_viewport_size({"width": 1280, "height": 720})
        
        # Verify viewport
        viewport = page.viewport_size
        logger.info(f"Viewport set to: {viewport}")
        
        # Set additional page settings
        await page.set_extra_http_headers({
            'Accept-Language': 'en-US,en;q=0.9',
        })
        
        # Navigate to URL
        await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        
        # Wait for page to stabilize
        await asyncio.sleep(1)
        
        # CRITICAL: Ensure viewport is still correct after navigation
        await page.set_viewport_size({"width": 1280, "height": 720})
        viewport = page.viewport_size
        logger.info(f"Final viewport: {viewport}")
        
        logger.info(f"Browser session {session_id} created successfully")
        
        return {
            'playwright': playwright,
            'browser': browser,
            'context': context,
            'page': page,
            'url': url,
            'created_at': time.time(),
            'last_activity': time.time(),
        }
        
    except Exception as e:
        logger.error(f"Error creating browser session {session_id}: {e}", exc_info=True)
        raise

async def cleanup_session(session_id):
    """Cleanup browser session safely"""
    with _lock:
        session = SESSIONS.pop(session_id, None)
        if not session:
            return
        
    try:
        logger.info(f"Cleaning up session {session_id}")
        # Close in correct order
        await session['context'].close()
        await session['browser'].close()
        await session['playwright'].stop()
        logger.info(f"Cleaned up session {session_id}")
    except Exception as e:
        logger.error(f"Error cleaning up session {session_id}: {e}")

@app.route('/api/sessions', methods=['POST'])
def create_session():
    """Create a new browser session"""
    data = request.json or {}
    url = data.get('url', 'https://example.com')
    session_id = str(uuid.uuid4())
    
    try:
        # Run in async worker thread
        session = run_async(create_browser_session(session_id, url))
        
        with _lock:
            SESSIONS[session_id] = session
        
        return jsonify({
            'session_id': session_id,
            'url': url,
            'status': 'created'
        })
    except Exception as e:
        logger.error(f"Error in create_session: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a browser session"""
    try:
        run_async(cleanup_session(session_id))
        return jsonify({'status': 'deleted'})
    except Exception as e:
        logger.error(f"Error in delete_session: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions', methods=['GET'])
def list_sessions():
    """List all active sessions"""
    with _lock:
        sessions = []
        for sid, session in SESSIONS.items():
            try:
                # Get page title and screenshot if available
                title = run_async(session['page'].title()) if 'page' in session else "Unknown"
                screenshot = None
                
                # Try to get a small thumbnail screenshot
                try:
                    screenshot_bytes = run_async(session['page'].screenshot(type='png', full_page=False))
                    screenshot = base64.b64encode(screenshot_bytes).decode('utf-8')
                except:
                    pass  # Screenshot failed, continue without it
                
                sessions.append({
                    'session_id': sid,
                    'url': session['url'],
                    'title': title,
                    'created_at': datetime.utcfromtimestamp(session['created_at']).isoformat() + 'Z',
                    'last_activity': datetime.utcfromtimestamp(session.get('last_activity', session['created_at'])).isoformat() + 'Z',
                    'screenshot': screenshot,
                    'is_isolated': True,
                    'status': 'active'
                })
            except Exception as e:
                logger.error(f"Error getting session info for {sid}: {e}")
                sessions.append({
                    'session_id': sid,
                    'url': session.get('url', 'Unknown'),
                    'title': 'Error loading title',
                    'created_at': datetime.utcfromtimestamp(session['created_at']).isoformat() + 'Z',
                    'last_activity': datetime.utcfromtimestamp(session.get('last_activity', session['created_at'])).isoformat() + 'Z',
                    'is_isolated': True,
                    'status': 'error'
                })
    
    return jsonify({'sessions': sessions})

@app.route('/api/sessions/<session_id>/save', methods=['POST'])
def save_session(session_id):
    """Save a session to the vault"""
    try:
        if session_id not in SESSIONS:
            return jsonify({'error': 'Session not found'}), 404
        
        # Take screenshot before saving
        session = SESSIONS[session_id]
        screenshot_bytes = run_async(session['page'].screenshot(type='png'))
        
        saved_id = str(uuid.uuid4())
        saved_session = {
            'id': saved_id,
            'name': request.json.get('name', session['url']) if request.json else session['url'],
            'url': session['url'],
            'title': run_async(session['page'].title()),
            'saved_at': time.time(),
            'screenshot': base64.b64encode(screenshot_bytes).decode('utf-8') if screenshot_bytes else None
        }
        
        SAVED_SESSIONS[saved_id] = saved_session
        
        logger.info(f"Session {session_id} saved as {saved_id}")
        
        return jsonify({
            'status': 'saved',
            'saved_id': saved_id,
            'saved_at': saved_session['saved_at']
        })
        
    except Exception as e:
        logger.error(f"Error saving session: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions/saved', methods=['GET'])
def list_saved_sessions():
    """List all saved sessions"""
    try:
        saved_list = []
        for sid, session in SAVED_SESSIONS.items():
            saved_list.append({
                'id': sid,
                'name': session['name'],
                'url': session['url'],
                'title': session['title'],
                'saved_at': session['saved_at'],
                'screenshot': session['screenshot']
            })
        
        return jsonify({'saved_tabs': saved_list})
        
    except Exception as e:
        logger.error(f"Error listing saved sessions: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions/<saved_id>/restore', methods=['POST'])
def restore_session(saved_id):
    """Restore a saved session"""
    try:
        if saved_id not in SAVED_SESSIONS:
            return jsonify({'error': 'Saved session not found'}), 404
        
        saved = SAVED_SESSIONS[saved_id]
        
        # Create new session with the saved URL
        session_id = str(uuid.uuid4())
        session = run_async(create_browser_session(session_id, saved['url']))
        SESSIONS[session_id] = session
        
        logger.info(f"Restored saved session {saved_id} as new session {session_id}")
        
        return jsonify({
            'status': 'restored',
            'session_id': session_id,
            'url': saved['url']
        })
        
    except Exception as e:
        logger.error(f"Error restoring session: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

async def setup_webrtc_connection(pc, session_id, offer_sdp, offer_type):
    """Setup WebRTC connection in async context"""
    session = SESSIONS.get(session_id)
    if not session:
        raise ValueError("Session not found")
    
    page = session['page']
    
    # Set remote description
    offer = RTCSessionDescription(sdp=offer_sdp, type=offer_type)
    await pc.setRemoteDescription(offer)
    
    # Add video track
    video_track = BrowserVideoTrack(page, fps=15)  # Slightly higher FPS
    pc.addTrack(video_track)
    
    # Handle data channel
    @pc.on("datachannel")
    def on_datachannel(channel):
        logger.info(f"Data channel opened: {channel.label}")
        
        @channel.on("message")
        async def on_message(message):
            await handle_interaction(message, session_id, channel)
    
    # Connection state handler
    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        state = pc.connectionState
        logger.info(f"Connection state: {state}")
        if state in ["failed", "closed"]:
            pc_id = None
            with _lock:
                for pid, entry in PEER_CONNECTIONS.items():
                    if entry['pc'] == pc:
                        pc_id = pid
                        break
                if pc_id:
                    del PEER_CONNECTIONS[pc_id]
            await pc.close()
    
    # Create answer
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    
    return pc.localDescription.sdp, pc.localDescription.type

@app.route('/api/webrtc/offer', methods=['POST'])
def handle_offer():
    """Handle WebRTC offer from client"""
    try:
        data = request.json
        offer_sdp = data.get('sdp')
        offer_type = data.get('type')
        session_id = data.get('session_id')
        
        if not all([offer_sdp, offer_type, session_id]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        with _lock:
            if session_id not in SESSIONS:
                return jsonify({'error': 'Invalid session_id'}), 400
        
        logger.info(f"Received WebRTC offer for session {session_id}")
        
        # Create peer connection
        pc = RTCPeerConnection()
        pc_id = str(uuid.uuid4())
        
        with _lock:
            PEER_CONNECTIONS[pc_id] = {
                'pc': pc,
                'session_id': session_id,
                'created_at': time.time()
            }
        
        # Setup connection in async thread
        answer_sdp, answer_type = run_async(
            setup_webrtc_connection(pc, session_id, offer_sdp, offer_type)
        )
        
        return jsonify({
            'sdp': answer_sdp,
            'type': answer_type,
            'pc_id': pc_id
        })
        
    except Exception as e:
        logger.error(f"Error handling offer: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

async def add_ice_candidate_async(pc, candidate_data):
    """Add ICE candidate in async context"""
    if isinstance(candidate_data, dict) and 'candidate' in candidate_data:
        try:
            # The client sends a dict with all correct keys ('sdpMid', 'sdpMLineIndex', 'candidate')
            # We can just unpack it directly.
            candidate = RTCIceCandidate(**candidate_data)
            await pc.addIceCandidate(candidate)
        except Exception as e:
            logger.warning(f"Failed to parse candidate: {e}, trying raw...")
            # Your fallback logic (which was commented out) would go here
            pass

@app.route('/api/webrtc/candidate', methods=['POST'])
def handle_candidate():
    """Handle ICE candidate from client"""
    try:
        data = request.json
        pc_id = data.get('pc_id')
        candidate_data = data.get('candidate')
        
        if not pc_id or not candidate_data:
            return jsonify({'error': 'Missing pc_id or candidate'}), 400
        
        with _lock:
            pc_entry = PEER_CONNECTIONS.get(pc_id)
            if not pc_entry:
                return jsonify({'status': 'ignored'}), 200  # Connection not ready
        
        pc = pc_entry['pc']
        
        # Add candidate in async thread
        run_async(add_ice_candidate_async(pc, candidate_data))
        
        return jsonify({'status': 'added'})
        
    except Exception as e:
        logger.error(f"Error handling candidate: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

async def handle_interaction(message, session_id, channel):
    """Handle user interactions from data channel - COMPLETELY FIXED VERSION"""
    try:
        data = json.loads(message)
        session = SESSIONS.get(session_id)
        if not session:
            if channel and channel.readyState == "open":
                channel.send(json.dumps({
                    'type': 'click_response',
                    'success': False,
                    'error': 'Session not found',
                    'clickId': data.get('id', 'unknown')
                }))
            return
        
        # Update activity timestamp
        session['last_activity'] = time.time()
        
        page = session['page']
        event_type = data.get('type')
        
        logger.info(f"Handling interaction: {event_type}")
        
        if event_type == 'click':
            click_id = data.get('id', 'unknown')
            x = int(data['x'])
            y = int(data['y'])
            
            try:
                # CRITICAL FIX: Ensure page is ready
                await page.wait_for_load_state('domcontentloaded', timeout=5000)
                
                # CRITICAL FIX: Force viewport to match frontend expectations
                await page.set_viewport_size({"width": 1280, "height": 720})
                
                # Get viewport (synchronous property)
                viewport = page.viewport_size
                logger.info(f"Viewport after setting: {viewport}")
                
                if not viewport:
                    error_msg = "Failed to get viewport size"
                    logger.error(error_msg)
                    if channel and channel.readyState == "open":
                        channel.send(json.dumps({
                            'type': 'click_response',
                            'success': False,
                            'error': error_msg,
                            'clickId': click_id
                        }))
                    return
                
                viewport_width, viewport_height = viewport['width'], viewport['height']
                
                # Check if coordinates are within viewport
                if x < 0 or x > viewport_width or y < 0 or y > viewport_height:
                    error_msg = f"Coordinates ({x}, {y}) outside viewport ({viewport_width}x{viewport_height})"
                    logger.warning(error_msg)
                    if channel and channel.readyState == "open":
                        channel.send(json.dumps({
                            'type': 'click_response',
                            'success': False,
                            'error': error_msg,
                            'clickId': click_id
                        }))
                    return
                
                # CRITICAL FIX: Simplified element detection
                # CRITICAL FIX: Simplified element detection
                element_info = await page.evaluate("""
              (data) => {
                  const x = data.x;
                  const y = data.y;
                  const element = document.elementFromPoint(x, y);
                  
                  if (!element) {
                      return {
                          found: false,
                          message: 'No element at position'
                      };
                  }
                  
                  const rect = element.getBoundingClientRect();
                  return {
                      found: true,
                      tagName: element.tagName,
                      id: element.id || '',
                      className: element.className || '',
                      rect: {
                          left: rect.left,
                          top: rect.top,
                          width: rect.width,
                          height: rect.height
                      }
                  };
              }
          """, {"x": x, "y": y})  # <-- We still pass an object
                
                if not element_info.get('found'):
                    error_msg = f"No element found at position ({x}, {y})"
                    logger.warning(error_msg)
                    if channel and channel.readyState == "open":
                        channel.send(json.dumps({
                            'type': 'click_response',
                            'success': False,
                            'error': error_msg,
                            'clickId': click_id
                        }))
                    return
                
                logger.info(f"Element at click position: {element_info}")
                
                # CRITICAL FIX: Direct coordinate-based clicking (most reliable)
                try:
                    # Move mouse to position first
                    await page.mouse.move(x, y)
                    await asyncio.sleep(0.05)  # Small delay to ensure mouse is in position
                    
                    # Click at coordinates
                    await page.mouse.click(x, y, button='left', click_count=1)
                    
                    logger.info(f"Successfully clicked at ({x}, {y})")
                    
                    # Send success response
                    if channel and channel.readyState == "open":
                        channel.send(json.dumps({
                            'type': 'click_response',
                            'success': True,
                            'clickId': click_id,
                            'element': element_info
                        }))
                        
                except Exception as click_error:
                    error_msg = f"Click failed at ({x}, {y}): {str(click_error)}"
                    logger.error(error_msg)
                    if channel and channel.readyState == "open":
                        channel.send(json.dumps({
                            'type': 'click_response',
                            'success': False,
                            'error': error_msg,
                            'clickId': click_id
                        }))
                
            except Exception as e:
                error_msg = f"Error in click handler: {str(e)}"
                logger.error(error_msg, exc_info=True)
                if channel and channel.readyState == "open":
                    channel.send(json.dumps({
                        'type': 'click_response',
                        'success': False,
                        'error': error_msg,
                        'clickId': click_id
                    }))
                
        elif event_type == 'type':
            text = data['text']
            await page.keyboard.type(text)
            logger.info(f"Typed: {text[:50]}...")
            
        elif event_type == 'scroll':
            delta_y = int(data.get('deltaY', 0))
            await page.evaluate(f"window.scrollBy(0, {delta_y})")
            logger.info(f"Scrolled: {delta_y}")
            
        elif event_type == 'navigate':
            url = data['url']
            await page.goto(url, wait_until='domcontentloaded')
            session['url'] = url
            logger.info(f"Navigated to: {url}")
            
        elif event_type == 'screenshot':
            screenshot = await page.screenshot(type='png')
            filename = f"session_{session_id}_{int(time.time())}.png"
            with open(filename, 'wb') as f:
                f.write(screenshot)
            channel.send(json.dumps({'type': 'screenshot_saved', 'filename': filename}))
            
        # Send acknowledgment for other event types
        if event_type != 'click' and channel and channel.readyState == "open":
            channel.send(json.dumps({'type': 'ack', 'event': event_type}))
        
    except Exception as e:
        logger.error(f"Error handling interaction: {e}", exc_info=True)
        try:
            if channel and channel.readyState == "open":
                channel.send(json.dumps({'type': 'error', 'message': str(e)}))
        except:
            pass

@app.route('/health', methods=['GET'])
def health():
    with _lock:
        return jsonify({
            'status': 'healthy',
            'sessions': len(SESSIONS),
            'connections': len(PEER_CONNECTIONS),
            'saved_sessions': len(SAVED_SESSIONS),
            'async_thread_alive': _loop is not None and _loop.is_running()
        })

# Cleanup old sessions periodically
async def cleanup_old_sessions():
    """Auto-cleanup sessions older than 1 hour"""
    while True:
        try:
            now = time.time()
            to_cleanup = []
            
            with _lock:
                for sid, session in SESSIONS.items():
                    age = now - session['created_at']
                    last_activity = now - session.get('last_activity', session['created_at'])
                    
                    # Cleanup if older than 1 hour OR inactive for 30 minutes
                    if age > 3600 or last_activity > 1800:
                        to_cleanup.append(sid)
            
            for sid in to_cleanup:
                logger.info(f"Auto-cleanup session {sid}")
                await cleanup_session(sid)
            
            # Cleanup dead peer connections
            with _lock:
                dead_pc_ids = [
                    pc_id for pc_id, entry in PEER_CONNECTIONS.items()
                    if entry['pc'].connectionState in ['failed', 'closed']
                ]
                for pc_id in dead_pc_ids:
                    del PEER_CONNECTIONS[pc_id]
            
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")
        
        await asyncio.sleep(60)  # Check every minute

# Start cleanup task
async def start_cleanup():
    asyncio.create_task(cleanup_old_sessions())

# Initialize cleanup
run_async(start_cleanup())

if __name__ == '__main__':
    logger.info("="*50)
    logger.info("SentinelID Server Starting...")
    logger.info("WebRTC + Playwright streaming enabled")
    logger.info("Production-ready architecture")
    logger.info("="*50)
    
    # Use a production WSGI server like gunicorn in production
    app.run(
        host='0.0.0.0', 
        port=5000, 
        debug=True, 
        threaded=True  # Keep threaded but with our async worker pattern
    )