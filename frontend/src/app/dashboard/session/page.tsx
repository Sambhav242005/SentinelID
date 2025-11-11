"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { 
  Loader2, 
  Shield, 
  Terminal, 
  ArrowRight, 
  Wifi, 
  WifiOff, 
  Activity,
  RefreshCw,
  Save,
  Trash2,
  Play,
  Monitor,
  MousePointer,
  Keyboard,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

// Enhanced types for session-based architecture
interface Session {
  session_id: string;
  url: string;
  title: string;
  status: string;
  created_at: string;
  last_activity: string;
  screenshot?: string;
  is_isolated: boolean;
}

interface SavedSession {
  id: string;
  name: string;
  url: string;
  title: string;
  saved_at: string;
  screenshot?: string;
}

interface WebRTCConfig {
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  sessionId: string | null;
  reconnectAttempts: number;
}

interface DebugLog {
  type: 'log' | 'error' | 'warn';
  message: string;
  timestamp: Date;
}

interface ClickIndicator {
  id: string;
  x: number;
  y: number;
  timestamp: number;
}

// Debounce utility
function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export default function TabManager() {
  // State management
  const [sessions, setSessions] = useState<Session[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamQuality, setStreamQuality] = useState<{ fps: number; bitrate: number }>({ fps: 0, bitrate: 0 });
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [clickIndicators, setClickIndicators] = useState<ClickIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // WebRTC refs with enhanced tracking
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const webrtcRef = useRef<WebRTCConfig>({
    pc: null,
    dc: null,
    sessionId: null,
    reconnectAttempts: 0
  });
  
  const pendingCandidatesRef = useRef<any[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const headers = useMemo(() => ({
    "x-api-key": API_KEY,
    "Content-Type": "application/json"
  }), [API_KEY]);

  // Debug logging
  const addDebugLog = useCallback((type: DebugLog['type'], message: string) => {
    setDebugLogs(prev => [...prev.slice(-49), { type, message, timestamp: new Date() }]);
    console.log(`[${type.toUpperCase()}] ${message}`);
  }, []);

  // Health check with polling
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/health`, { headers, timeout: 5000 });
        console.log(res.data)
        const isHealthy = res.data.status === 'healthy';
        setIsBackendConnected(isHealthy);
        addDebugLog('log', `Backend health check: ${isHealthy ? 'Connected' : 'Disconnected'}`);
      } catch (err) {
        setIsBackendConnected(false);
        addDebugLog('error', `Backend health check failed: ${err}`);
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, [headers, addDebugLog]);

  const DebugOverlay = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scaledPos, setScaledPos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (videoRef.current) {
        const rect = videoRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const scaledX = Math.round(x * (1280 / rect.width));
        const scaledY = Math.round(y * (720 / rect.height));
        
        setMousePos({ x: Math.round(x), y: Math.round(y) });
        setScaledPos({ x: scaledX, y: scaledY });
      }
    };
    
    const video = videoRef.current;
    if (video) {
      video.addEventListener('mousemove', handleMouseMove);
      return () => video.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);
  
  return (
    <div className="absolute top-4 left-4 bg-black/80 text-white text-xs p-2 rounded font-mono z-50">
      <div>Mouse: ({mousePos.x}, {mousePos.y})</div>
      <div>Scaled: ({scaledPos.x}, {scaledPos.y})</div>
    </div>
  );
};

  // Session management
  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      addDebugLog('log', 'Fetching sessions...');
      const res = await axios.get(`${API_BASE}/api/sessions`, { headers });
      const payload = res.data;

      // Handle both direct array and wrapped object
      const sessionsArray =
        Array.isArray(payload) ? payload :
        Array.isArray(payload.sessions) ? payload.sessions :
        [];

      if (sessionsArray.length === 0) {
        addDebugLog('warn', "No sessions found in API response");
      }

      setSessions(sessionsArray);
      addDebugLog('log', `Fetched ${sessionsArray.length} sessions`);
    } catch (err) {
      addDebugLog('error', `Failed to fetch sessions: ${err}`);
      toast.error("Failed to fetch sessions");
    } finally {
      setIsLoading(false);
    }
  }, [headers, addDebugLog]);

  const fetchSavedSessions = useCallback(async () => {
    try {
      addDebugLog('log', 'Fetching saved sessions...');
      const res = await axios.get<{ saved_tabs: SavedSession[] }>(
        `${API_BASE}/api/sessions/saved`,
        { 
          headers,
          timeout: 5000
        }
      );
      
      const savedTabs = res.data.saved_tabs || res.data || [];
      setSavedSessions(savedTabs);
      addDebugLog('log', `Fetched ${savedTabs.length} saved sessions`);
      
    } catch (err: any) {
      addDebugLog('error', `Failed to fetch saved sessions: ${err}`);
      
      if (err.response?.status === 405) {
        toast.error("Backend endpoint not implemented. Please update the server.");
      } else if (err.response?.status === 404) {
        toast.error("Saved sessions endpoint not found. Check server routes.");
      } else if (err.code === 'ECONNABORTED') {
        toast.error("Request timed out. Backend may be down.");
      } else {
        toast.error("Failed to fetch saved sessions");
      }
      
      setSavedSessions([]);
    }
  }, [headers, addDebugLog]);

  useEffect(() => {
    fetchSessions();
    fetchSavedSessions();
  }, [fetchSessions, fetchSavedSessions]);

  // Enhanced WebRTC configuration for pixel streaming
  const createPeerConnection = useCallback((sessionId: string) => {
    addDebugLog('log', `Creating peer connection for session ${sessionId}`);
    
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      sdpSemantics: "unified-plan",
      encodedInsertableStreams: false
    });

    // Prefer H.264 for hardware acceleration
    pc.addTransceiver('video', { 
      direction: 'recvonly',
      sendEncodings: [{ maxBitrate: 8000000 }]
    });

    // Add data channel for controls
    const dc = pc.createDataChannel("controls", {
      ordered: true,
      maxRetransmits: 3,
      protocol: "json"
    });

    dc.onopen = () => {
      addDebugLog('log', "Data channel opened successfully");
      toast.success("🔗 Control channel established");
      setIsStreaming(true);
      webrtcRef.current.reconnectAttempts = 0;
      
      // Send a test message to verify the channel works
      dc.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
    };

    dc.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "pong") {
          addDebugLog('log', "Data channel ping-pong successful");
        } else if (data.type === 'click_response') {
          if (data.success) {
            addDebugLog('log', `Click successful: ${data.clickId}`);
            toast.success("✓ Click successful", { id: data.clickId });
          } else {
            addDebugLog('error', `Click failed: ${data.clickId} - ${data.error}`);
            toast.error(`✗ Click failed: ${data.error}`, { id: data.clickId });
          }
        }
      } catch (err) {
        addDebugLog('error', `Error parsing data channel message: ${err}`);
      }
    };

    dc.onclose = () => {
      addDebugLog('warn', "Data channel closed");
      toast.error("Control channel closed");
      setIsStreaming(false);
      
      // Auto-reconnect logic
      if (webrtcRef.current.reconnectAttempts < 3) {
        reconnectTimeoutRef.current = setTimeout(() => {
          webrtcRef.current.reconnectAttempts++;
          toast.info(`Attempting to reconnect... (${webrtcRef.current.reconnectAttempts}/3)`);
          startStream(sessionId);
        }, 2000 * webrtcRef.current.reconnectAttempts);
      } else {
        toast.error("Failed to reconnect after multiple attempts");
      }
    };

    dc.onerror = (err) => {
      addDebugLog('error', `Data channel error: ${err}`);
      toast.error("Control channel error");
    };

    return { pc, dc };
  }, [addDebugLog]);

  // Optimized stream start with error recovery
  const startStream = useCallback(async (sessionId: string) => {
    if (!isBackendConnected) {
      toast.error("Backend not connected");
      return;
    }

    try {
      addDebugLog('log', `Starting stream for session ${sessionId}`);
      
      // Cleanup existing connection
      stopStream();

      // Create new peer connection
      const { pc, dc } = createPeerConnection(sessionId);
      webrtcRef.current = { pc, dc, sessionId, reconnectAttempts: 0 };

      // Setup video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Collect ICE candidates
      pendingCandidatesRef.current = [];
      pc.onicecandidate = (ev) => {
        if (ev.candidate && (pc as any)._pcId) {
          axios.post(
            `${API_BASE}/api/webrtc/candidate`, 
            { 
              pc_id: (pc as any)._pcId,
              candidate: ev.candidate.toJSON() 
            }, 
            { headers }
          ).catch(err => addDebugLog('error', `Failed to send ICE candidate: ${err}`));
        } else if (ev.candidate) {
          pendingCandidatesRef.current.push(ev.candidate.toJSON());
        }
      };

      // Handle incoming track
      pc.ontrack = (ev) => {
        if (videoRef.current && ev.streams[0]) {
          videoRef.current.srcObject = ev.streams[0];
          addDebugLog('log', 'Video track received');
          
          // Monitor stream quality
          statsIntervalRef.current = setInterval(async () => {
            if (pc && videoRef.current?.srcObject) {
              const stats = await pc.getStats();
              stats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                  setStreamQuality({
                    fps: report.framesPerSecond || 0,
                    bitrate: Math.round(report.bytesReceived * 8 / 1000)
                  });
                }
              });
            }
          }, 2000);
        }
      };

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        addDebugLog('log', `Connection state: ${state}`);
        
        if (state === 'connected') {
          toast.success("🎥 Streaming connected");
        } else if (state === 'failed') {
          toast.error("Streaming failed");
          stopStream();
        } else if (state === 'disconnected') {
          toast.warning("Streaming disconnected");
        }
      };

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false
      });
      await pc.setLocalDescription(offer);

      // Exchange SDP with backend
      const res = await axios.post(
        `${API_BASE}/api/webrtc/offer`,
        {
          sdp: offer.sdp,
          type: offer.type,
          session_id: sessionId
        },
        { headers }
      );

      if (res.data.error) throw new Error(res.data.error);

      // Store PC ID for candidate routing
      (pc as any)._pcId = res.data.pc_id;

      // Send pending ICE candidates
      for (const cand of pendingCandidatesRef.current) {
        await axios.post(
          `${API_BASE}/api/webrtc/candidate`,
          { pc_id: res.data.pc_id, candidate: cand },
          { headers }
        ).catch(err => addDebugLog('error', `Failed to send pending candidate: ${err}`));
      }
      pendingCandidatesRef.current = [];

      // Set remote description
      await pc.setRemoteDescription({
        type: res.data.type,
        sdp: res.data.sdp
      });

    } catch (err) {
      addDebugLog('error', `Failed to start stream: ${err}`);
      toast.error(`Failed to start stream: ${err instanceof Error ? err.message : 'Unknown error'}`);
      stopStream();
    }
  }, [createPeerConnection, headers, isBackendConnected, addDebugLog]);

  // Cleanup with proper resource release
  const stopStream = useCallback(() => {
    addDebugLog('log', 'Stopping stream');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    const { pc, dc } = webrtcRef.current;
    
    try {
      if (dc) {
        dc.close();
      }
      
      if (pc) {
        pc.close();
      }

      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    } catch (e) {
      addDebugLog('warn', `stopStream cleanup warning: ${e}`);
    }

    webrtcRef.current = { pc: null, dc: null, sessionId: null, reconnectAttempts: 0 };
    setIsStreaming(false);
    setStreamQuality({ fps: 0, bitrate: 0 });
  }, [addDebugLog]);

  // Auto-start/stop stream on session selection
  useEffect(() => {
    if (selectedSession) {
      startStream(selectedSession);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [selectedSession, startStream, stopStream]);

  // Tab management functions
  const createSession = useCallback(async () => {
    if (!newUrl.trim() || !isBackendConnected) {
      toast.error("Please enter a URL and ensure backend is connected");
      return;
    }

    const urlToCreate = newUrl;
    setNewUrl("");
    setIsLoading(true);

    try {
      addDebugLog('log', `Creating new session for ${urlToCreate}`);
      const res = await axios.post<{ session_id: string }>(
        `${API_BASE}/api/sessions`,
        { url: urlToCreate },
        { headers }
      );
      
      const newSessionId = res.data.session_id;

      // Create a placeholder session immediately
      const placeholderSession: Session = {
        session_id: newSessionId,
        url: urlToCreate,
        title: "Loading title...",
        status: "created",
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        is_isolated: true,
      };

      setSessions(prevSessions => [...prevSessions, placeholderSession]);
      setSelectedSession(newSessionId);
      toast.success("New isolated session created");
      addDebugLog('log', `Session created: ${newSessionId}`);
      
      // Fetch the full list to update the placeholder with real data
      await fetchSessions();
    
    } catch (err) {
      addDebugLog('error', `Failed to create session: ${err}`);
      toast.error("Failed to create session");
    } finally {
      setIsLoading(false);
    }
  }, [newUrl, headers, isBackendConnected, fetchSessions, addDebugLog]);

  const saveSession = useCallback(async (sessionId: string) => {
    try {
      addDebugLog('log', `Saving session ${sessionId}`);
      await axios.post(`${API_BASE}/api/sessions/${sessionId}/save`, {}, { headers });
      toast.success("Session saved to encrypted vault");
      await fetchSavedSessions();
    } catch (err) {
      addDebugLog('error', `Failed to save session: ${err}`);
      toast.error("Failed to save session");
    }
  }, [headers, fetchSavedSessions, addDebugLog]);

  const closeSession = useCallback(async (sessionId: string) => {
    try {
      addDebugLog('log', `Closing session ${sessionId}`);
      await axios.delete(`${API_BASE}/api/sessions/${sessionId}`, { headers });
      toast("Session closed");
      if (selectedSession === sessionId) setSelectedSession(null);
      await fetchSessions();
    } catch (err) {
      addDebugLog('error', `Failed to close session: ${err}`);
      toast.error("Failed to close session");
    }
  }, [headers, selectedSession, fetchSessions, addDebugLog]);

  const restoreSession = useCallback(async (savedId: string) => {
    try {
      addDebugLog('log', `Restoring saved session ${savedId}`);
      const res = await axios.post<{ session_id: string }>(
        `${API_BASE}/api/sessions/${savedId}/restore`, 
        {}, 
        { headers }
      );
      toast.info("Session restored from vault");
      await fetchSessions();
      setSelectedSession(res.data.session_id);
    } catch (err) {
      addDebugLog('error', `Failed to restore session: ${err}`);
      toast.error("Failed to restore session");
    }
  }, [headers, fetchSessions, addDebugLog]);

  // Enhanced click handler with visual feedback
  const handleVideoClick = useCallback((e: React.MouseEvent<HTMLVideoElement>) => {
    const { dc } = webrtcRef.current;
    if (!dc || dc.readyState !== "open") {
      toast.error("Control channel not ready");
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (1280 / rect.width));
    const y = Math.round((e.clientY - rect.top) * (720 / rect.height));
    
    // Generate a unique ID for this click to track it
    const clickId = `click-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Add visual feedback
    const indicatorId = `indicator-${Date.now()}`;
    const indicator = {
      id: indicatorId,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      timestamp: Date.now()
    };
    
    setClickIndicators(prev => [...prev, indicator]);
    
    // Remove the indicator after animation
    setTimeout(() => {
      setClickIndicators(prev => prev.filter(i => i.id !== indicatorId));
    }, 1000);
    
    // Send the click with ID
    dc.send(JSON.stringify({ 
      type: "click", 
      x, 
      y,
      id: clickId,
      timestamp: Date.now()
    }));
    
    addDebugLog('log', `Click sent: ${clickId} at (${x}, ${y})`);
  }, [addDebugLog]);

  // Debounced interaction handlers
  const sendScroll = useCallback(
    debounce((dy: number) => {
      const { dc } = webrtcRef.current;
      if (!dc || dc.readyState !== "open") {
        toast.error("Control channel not ready");
        return;
      }
      dc.send(JSON.stringify({ type: "scroll", deltaY: dy }));
      addDebugLog('log', `Scroll sent: ${dy}`);
    }, 100),
    [addDebugLog]
  );

  const sendType = useCallback((text: string) => {
    const { dc } = webrtcRef.current;
    if (!dc || dc.readyState !== "open") {
      toast.error("Control channel not ready");
      return;
    }
    dc.send(JSON.stringify({ type: "type", text }));
    addDebugLog('log', `Type sent: ${text.substring(0, 50)}...`);
  }, [addDebugLog]);

  const selected = useMemo(
    () => sessions.find((s) => s.session_id === selectedSession),
    [sessions, selectedSession]
  );

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-gray-100 p-6 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute w-[40rem] h-[40rem] bg-blue-600/20 blur-3xl rounded-full top-[-10rem] left-[-5rem] animate-pulse" />
        <div className="absolute w-[40rem] h-[40rem] bg-indigo-600/20 blur-3xl rounded-full bottom-[-10rem] right-[-5rem] animate-[pulse_8s_infinite_alternate]" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between mb-8 bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-blue-500" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            SentinelID — Isolated Tab Streaming
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="https://example.com"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createSession()}
            className="bg-slate-800/60 border border-slate-700 rounded px-3 py-2 text-sm w-80 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={createSession}
            disabled={!isBackendConnected || !newUrl.trim() || isLoading}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-4 py-2 rounded text-white font-medium flex items-center gap-2 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Open Isolated Tab</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Connection status */}
          <div className="flex items-center gap-2 ml-4">
            {isBackendConnected ? (
              <>
                <Wifi className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-emerald-400">Backend Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-xs text-red-400">Backend Disconnected</span>
              </>
            )}
          </div>

          {/* Stream quality indicator */}
          {isStreaming && (
            <div className="flex items-center gap-2 ml-4">
              <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
              <span className="text-xs text-blue-400">
                {streamQuality.fps}fps • {streamQuality.bitrate}kbps
              </span>
            </div>
          )}

          {/* Debug toggle */}
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-gray-400 hover:text-gray-300 ml-4"
          >
            {showDebug ? 'Hide' : 'Show'} Debug
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Active Sessions */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-md">
            <h2 className="font-semibold mb-3 flex items-center justify-between">
              <span>Active Sessions ({sessions.length})</span>
              <button
                onClick={fetchSessions}
                disabled={isLoading}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Refresh
              </button>
            </h2>
            <div className="space-y-2 max-h-[60vh] overflow-auto pr-2">
              {sessions.map((session) => (
                <div
                  key={session.session_id}
                  onClick={() => setSelectedSession(session.session_id)}
                  className={`flex items-center gap-3 p-3 border border-slate-800 rounded-lg bg-slate-900/40 hover:bg-slate-800/60 transition-all cursor-pointer ${
                    selectedSession === session.session_id
                      ? "border-blue-500/60 bg-slate-800/80 ring-1 ring-blue-500/30"
                      : ""
                  }`}
                >
                  <img
                    src={
                      session.screenshot
                        ? `data:image/png;base64,${session.screenshot}`
                        : "/placeholder.png"
                    }
                    className="w-16 h-10 object-cover rounded border border-slate-700"
                    alt="session thumbnail"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {session.title || "Untitled"}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {session.url}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {session.is_isolated ? "🔒 Isolated" : "Standard"} • 
                      {Math.floor((Date.now() - new Date(session.last_activity).getTime()) / 60000)} min ago
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        saveSession(session.session_id);
                      }}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded flex items-center gap-1"
                    >
                      <Save className="h-3 w-3" />
                      Save
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeSession(session.session_id);
                      }}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      Close
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Sessions */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 backdrop-blur-md">
            <h2 className="font-semibold mb-3 flex items-center justify-between">
              <span>Saved Sessions ({savedSessions.length})</span>
              <button
                onClick={fetchSavedSessions}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </h2>
            <div className="space-y-2 max-h-[40vh] overflow-auto pr-2">
              {savedSessions.map((saved) => (
                <div
                  key={saved.id}
                  className="flex items-center gap-2 border border-slate-800 rounded-lg p-2 bg-slate-950/40"
                >
                  <img
                    src={
                      saved.screenshot
                        ? `data:image/png;base64,${saved.screenshot}`
                        : "/placeholder.png"
                    }
                    className="w-12 h-8 object-cover rounded border border-slate-700"
                    alt="saved thumbnail"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {saved.name || saved.title}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {saved.url}
                    </div>
                  </div>
                  <button
                    onClick={() => restoreSession(saved.id)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main preview area */}
        <main className="md:col-span-2">
          {selected ? (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
              {/* Session info header */}
              <div className="mb-4">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    {isStreaming ? (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    ) : null}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${
                      isStreaming ? "bg-emerald-500" : "bg-gray-500"
                    }`}></span>
                  </span>
                  Isolated Tab Preview
                </h2>
                <div className="text-sm text-gray-400 mt-1">
                  <span className="font-medium text-gray-300">{selected.title}</span> • {selected.url}
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Video stream */}
                <div className="md:col-span-2">
                  <div 
                    ref={videoContainerRef}
                    className="border-2 border-slate-800 rounded-lg overflow-hidden bg-black relative"
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      onClick={handleVideoClick}
                      onWheel={(e) => {
                        e.preventDefault();
                        sendScroll(e.deltaY);
                      }}
                      className="w-full h-[500px] object-contain cursor-crosshair"
                      title="Click to interact • Scroll to navigate"
                    />

                    <DebugOverlay />
                    
                    {/* Click indicators */}
                    {clickIndicators.map(indicator => (
                      <div
                        key={indicator.id}
                        className="absolute pointer-events-none"
                        style={{
                          left: `${indicator.x}px`,
                          top: `${indicator.y}px`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <div className="w-5 h-5 rounded-full bg-blue-500/50 border-2 border-blue-500 animate-ping" />
                        <div className="absolute inset-0 w-5 h-5 rounded-full bg-blue-500/30 animate-ping animation-delay-200" />
                      </div>
                    ))}
                    
                    {/* Overlay controls */}
                    {!isStreaming && selectedSession && (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                        <button
                          onClick={() => startStream(selectedSession)}
                          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium flex items-center gap-2"
                        >
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Connecting...
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Stream controls */}
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => saveSession(selected.session_id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50 flex items-center gap-2"
                      disabled={!isStreaming}
                    >
                      <Save className="h-4 w-4" />
                      Save Session
                    </button>
                    <button
                      onClick={() => closeSession(selected.session_id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Close Session
                    </button>
                    <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
                      <span>Quality:</span>
                      <span className="text-emerald-400">{streamQuality.fps}fps</span>
                      <span>•</span>
                      <span className="text-blue-400">{streamQuality.bitrate}kbps</span>
                    </div>
                  </div>
                </div>

                {/* Interaction panel */}
                <div className="space-y-4">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-blue-400" />
                      Interaction Log
                    </h3>
                    <div className="font-mono text-xs text-blue-400 space-y-1 h-32 overflow-auto">
                      <p>[{new Date().toLocaleTimeString()}] 🔒 Isolated session active</p>
                      <p>[{new Date().toLocaleTimeString()}] 🎥 Video stream established</p>
                      <p>[{new Date().toLocaleTimeString()}] 🖱️ Click interaction enabled</p>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                    <h3 className="font-medium mb-3">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => sendScroll(-400)}
                        className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded flex items-center gap-1"
                      >
                        <MousePointer className="h-3 w-3" />
                        Scroll Up
                      </button>
                      <button
                        onClick={() => sendScroll(400)}
                        className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded flex items-center gap-1"
                      >
                        <MousePointer className="h-3 w-3" />
                        Scroll Down
                      </button>
                      <button
                        onClick={() => {
                          const text = prompt("Enter text to type:");
                          if (text) sendType(text);
                        }}
                        className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded col-span-2 flex items-center gap-1"
                      >
                        <Keyboard className="h-3 w-3" />
                        Type Text
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 text-xs text-gray-400">
                    <p className="mb-2"><strong>Session ID:</strong></p>
                    <p className="font-mono break-all text-blue-400">{selected.session_id}</p>
                    <p className="mt-2"><strong>Created:</strong> {new Date(selected.created_at).toLocaleString()}</p>
                    <p className="mt-1"><strong>Isolated:</strong> {selected.is_isolated ? "✅ Yes" : "⚠️ No"}</p>
                  </div>

                  {/* Debug Panel */}
                  {showDebug && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-400" />
                        Debug Logs
                      </h3>
                      <div className="h-32 overflow-auto space-y-1 font-mono text-xs">
                        {debugLogs.map((log, i) => (
                          <div 
                            key={i} 
                            className={`${
                              log.type === 'error' ? 'text-red-400' : 
                              log.type === 'warn' ? 'text-yellow-400' : 
                              'text-gray-400'
                            }`}
                          >
                            <span className="text-gray-500">[{log.timestamp.toLocaleTimeString()}]</span> {log.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-12 text-center text-gray-400">
              <Monitor className="h-12 w-12 mx-auto mb-4 text-blue-400" />
              <h3 className="text-lg font-medium mb-2">No Session Selected</h3>
              <p>Select a session from the sidebar to start streaming the isolated browser tab.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}