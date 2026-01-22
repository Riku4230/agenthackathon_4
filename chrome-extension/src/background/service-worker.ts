import { WebSocketClient } from '../lib/websocket-client';

interface SessionState {
  isActive: boolean;
  tabId: number | null;
  agentTabId: number | null;
  websocket: WebSocketClient | null;
  offscreenCreated: boolean;
}

const state: SessionState = {
  isActive: false,
  tabId: null,
  agentTabId: null,
  websocket: null,
  offscreenCreated: false,
};

const BACKEND_URL = 'http://localhost:3001';
const AGENT_UI_URL = 'http://localhost:3000';

// Handle messages from content script, popup, and offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_AGENT':
      handleStartAgent(sender.tab?.id)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'START_AGENT_FROM_POPUP':
      // Start agent with tab ID provided from popup
      console.log('[ServiceWorker] START_AGENT_FROM_POPUP received, tabId:', message.tabId);
      handleStartAgent(message.tabId)
        .then(() => {
          console.log('[ServiceWorker] Agent started successfully');
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('[ServiceWorker] Failed to start agent:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'STOP_AGENT':
      handleStopAgent()
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_STATUS':
      sendResponse({
        isActive: state.isActive,
        tabId: state.tabId,
      });
      return false;

    case 'CHAT_MESSAGE':
      if (state.websocket) {
        state.websocket.sendChatMessage(message.text);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Not connected' });
      }
      return false;

    case 'AUDIO_DATA':
      // Received audio data from offscreen document
      if (state.websocket && message.data) {
        const int16Array = new Int16Array(message.data);
        console.log('[ServiceWorker] Received audio data, samples:', int16Array.length);
        state.websocket.sendAudioData(int16Array.buffer);
      }
      return false;
  }
});

async function handleStartAgent(meetTabId?: number): Promise<void> {
  if (state.isActive) {
    throw new Error('Agent is already active');
  }

  if (!meetTabId) {
    throw new Error('No Meet tab found');
  }

  state.tabId = meetTabId;

  // Connect to backend WebSocket
  state.websocket = new WebSocketClient(BACKEND_URL);
  await state.websocket.connect();

  // Start audio capture using Offscreen API
  await startAudioCapture(meetTabId);

  // Open Agent UI in new tab
  const agentTab = await chrome.tabs.create({
    url: `${AGENT_UI_URL}?meetTabId=${meetTabId}`,
    active: false,
  });
  state.agentTabId = agentTab.id ?? null;

  // Send session start event
  state.websocket.sendSessionStart({ meetingId: `meet-${meetTabId}` });

  // Forward messages from backend to Agent UI
  state.websocket.onMessage((event, data) => {
    if (state.agentTabId) {
      chrome.tabs.sendMessage(state.agentTabId, {
        type: 'BACKEND_EVENT',
        event,
        data,
      }).catch(() => {
        // Tab might be closed
      });
    }
  });

  state.isActive = true;

  // Notify content script
  chrome.tabs.sendMessage(meetTabId, {
    type: 'AGENT_STARTED',
    agentTabId: state.agentTabId,
  });
}

async function startAudioCapture(tabId: number): Promise<void> {
  console.log('[ServiceWorker] Starting audio capture for tab:', tabId);

  // Get stream ID using tabCapture.getMediaStreamId
  const streamId = await new Promise<string>((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId(
      { targetTabId: tabId },
      (streamId) => {
        if (chrome.runtime.lastError) {
          console.error('[ServiceWorker] tabCapture error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!streamId) {
          reject(new Error('Failed to get media stream ID'));
          return;
        }
        console.log('[ServiceWorker] Got stream ID:', streamId);
        resolve(streamId);
      }
    );
  });

  // Create offscreen document if not exists
  if (!state.offscreenCreated) {
    try {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification: 'Capturing audio from Google Meet tab',
      });
      state.offscreenCreated = true;
    } catch (error) {
      // Document might already exist
      if (!(error instanceof Error && error.message.includes('already exists'))) {
        throw error;
      }
      state.offscreenCreated = true;
    }
  }

  // Send message to offscreen document to start capture
  await chrome.runtime.sendMessage({
    target: 'offscreen',
    type: 'START_CAPTURE',
    streamId: streamId,
  });
}

async function stopAudioCapture(): Promise<void> {
  // Send message to offscreen document to stop capture
  try {
    await chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'STOP_CAPTURE',
    });
  } catch {
    // Offscreen document might not exist
  }

  // Close offscreen document
  if (state.offscreenCreated) {
    try {
      await chrome.offscreen.closeDocument();
      state.offscreenCreated = false;
    } catch {
      // Document might not exist
    }
  }
}

async function handleStopAgent(): Promise<void> {
  await stopAudioCapture();

  if (state.websocket) {
    state.websocket.sendSessionEnd();
    state.websocket.disconnect();
    state.websocket = null;
  }

  if (state.tabId) {
    chrome.tabs.sendMessage(state.tabId, {
      type: 'AGENT_STOPPED',
    }).catch(() => {
      // Tab might be closed
    });
  }

  state.isActive = false;
  state.tabId = null;
  state.agentTabId = null;
}

// Clean up when Meet tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === state.tabId || tabId === state.agentTabId) {
    handleStopAgent();
  }
});
