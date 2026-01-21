import { WebSocketClient } from '../lib/websocket-client';
import { AudioCapture } from '../lib/audio-capture';

interface SessionState {
  isActive: boolean;
  tabId: number | null;
  agentTabId: number | null;
  websocket: WebSocketClient | null;
  audioCapture: AudioCapture | null;
}

const state: SessionState = {
  isActive: false,
  tabId: null,
  agentTabId: null,
  websocket: null,
  audioCapture: null,
};

const BACKEND_URL = 'ws://localhost:3001';
const AGENT_UI_URL = 'http://localhost:3000';

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_AGENT':
      handleStartAgent(sender.tab?.id)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
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

  // Open Agent UI in new tab
  const agentTab = await chrome.tabs.create({
    url: `${AGENT_UI_URL}?meetTabId=${meetTabId}`,
    active: false,
  });
  state.agentTabId = agentTab.id ?? null;

  // Connect to backend WebSocket
  state.websocket = new WebSocketClient(BACKEND_URL);
  await state.websocket.connect();

  // Start audio capture
  state.audioCapture = new AudioCapture(meetTabId);
  await state.audioCapture.start((audioData: ArrayBuffer) => {
    if (state.websocket) {
      state.websocket.sendAudioData(audioData);
    }
  });

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

async function handleStopAgent(): Promise<void> {
  if (state.audioCapture) {
    state.audioCapture.stop();
    state.audioCapture = null;
  }

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
