import type { Socket } from 'socket.io';
import { sessionManager } from '../session/session-manager.js';
import { GeminiMultimodalLiveClient } from '../gemini/multimodal-live-client.js';
import type { Requirement } from '../types/index.js';

interface ClientState {
  sessionId: string | null;
  geminiClient: GeminiMultimodalLiveClient | null;
}

const clientStates = new Map<string, ClientState>();

export function handleClientConnection(socket: Socket, apiKey: string): void {
  console.log(`[WebSocket] Client connected: ${socket.id}`);

  // Initialize client state
  clientStates.set(socket.id, {
    sessionId: null,
    geminiClient: null,
  });

  // Handle session start
  socket.on('session:start', async (data: { meetingId?: string }) => {
    const state = clientStates.get(socket.id);
    if (!state) return;

    // Create new session
    const session = sessionManager.createSession(data.meetingId);
    state.sessionId = session.id;

    // Initialize Gemini Multimodal Live client
    state.geminiClient = new GeminiMultimodalLiveClient(apiKey);

    // Set up Gemini event handlers
    setupGeminiHandlers(socket, state.geminiClient, session.id);

    try {
      // Connect to Gemini Live API
      await state.geminiClient.connect();

      // Notify client
      socket.emit('session:connected', { sessionId: session.id });
      console.log(`[WebSocket] Session started with Gemini Live API: ${session.id}`);
    } catch (error) {
      console.error('[WebSocket] Failed to connect to Gemini Live API:', error);
      socket.emit('error', {
        message: 'Failed to connect to Gemini Live API',
        code: 'GEMINI_CONNECTION_ERROR',
      });
    }
  });

  // Handle audio stream
  let audioCount = 0;
  socket.on('audio:stream', (data: { data: ArrayBuffer; timestamp: number }) => {
    const state = clientStates.get(socket.id);
    if (!state?.geminiClient) {
      console.log('[WebSocket] No gemini client for audio data');
      return;
    }

    audioCount++;
    if (audioCount % 50 === 1) {
      console.log(`[WebSocket] Received audio chunk #${audioCount}, size: ${data.data?.byteLength || 'undefined'}`);
    }

    // Send audio directly to Gemini Live API
    state.geminiClient.sendAudio(data.data);
  });

  // Handle binary audio data
  socket.on('message', (data: Buffer) => {
    // Check if it's audio data (starts with 'audio:stream' header)
    const headerEnd = data.indexOf(0); // Null separator
    if (headerEnd > 0) {
      const header = data.subarray(0, headerEnd).toString();
      if (header === 'audio:stream') {
        const audioData = data.subarray(headerEnd + 1);
        const state = clientStates.get(socket.id);
        if (state?.geminiClient) {
          state.geminiClient.sendAudio(audioData.buffer as ArrayBuffer);
        }
      }
    }
  });

  // Handle chat message
  socket.on('chat:message', async (data: { text: string }) => {
    const state = clientStates.get(socket.id);
    if (!state?.geminiClient || !state.sessionId) return;

    console.log(`[WebSocket] Chat message: ${data.text}`);

    // Send text to Gemini Live API
    state.geminiClient.sendText(data.text);
  });

  // Handle generate request
  socket.on('generate:request', async (data: { requirementIds?: string[] }) => {
    const state = clientStates.get(socket.id);
    if (!state?.geminiClient || !state.sessionId) return;

    // Get pending requirements
    let requirements: Requirement[];
    if (data.requirementIds && data.requirementIds.length > 0) {
      const allRequirements = sessionManager.getRequirements(state.sessionId);
      requirements = allRequirements.filter(r => data.requirementIds!.includes(r.id));
    } else {
      requirements = sessionManager.getPendingRequirements(state.sessionId);
    }

    if (requirements.length === 0) {
      socket.emit('error', {
        message: 'No requirements to generate',
        code: 'NO_REQUIREMENTS',
      });
      return;
    }

    // Update status to generating
    requirements.forEach(r => {
      sessionManager.updateRequirementStatus(state.sessionId!, r.id, 'generating');
    });

    // Send generate request to Gemini
    const requirementsSummary = requirements
      .map(r => `- ${r.componentType}: ${r.description}`)
      .join('\n');

    state.geminiClient.sendText(
      `Please generate UI code for the following requirements:\n${requirementsSummary}`
    );
  });

  // Handle session end
  socket.on('session:end', () => {
    cleanupClient(socket.id);
    console.log(`[WebSocket] Session ended by client: ${socket.id}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    cleanupClient(socket.id);
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });
}

function setupGeminiHandlers(
  socket: Socket,
  geminiClient: GeminiMultimodalLiveClient,
  sessionId: string
): void {
  // Handle Gemini connection
  geminiClient.on('connected', () => {
    console.log(`[GeminiLive] Connected for session: ${sessionId}`);
  });

  geminiClient.on('disconnected', () => {
    console.log(`[GeminiLive] Disconnected for session: ${sessionId}`);
    socket.emit('gemini:disconnected');
  });

  // Handle transcript updates
  geminiClient.on('transcript', (text, isFinal) => {
    sessionManager.addTranscript(sessionId, text, isFinal);
    socket.emit('transcript:update', { text, isFinal });
  });

  // Handle requirement detection
  geminiClient.on('requirement', (requirement) => {
    const fullRequirement = sessionManager.addRequirement(sessionId, requirement);
    socket.emit('requirement:detected', { requirement: fullRequirement });
  });

  // Handle code generation streaming
  geminiClient.on('codeGeneration', (artifactId, chunk) => {
    socket.emit('artifact:stream', { artifactId, chunk });
  });

  // Handle code generation complete
  geminiClient.on('codeComplete', (artifactId, code) => {
    const state = Array.from(clientStates.entries()).find(
      ([, s]) => s.geminiClient === geminiClient
    );
    if (state) {
      const [, clientState] = state;
      if (clientState.sessionId) {
        const pendingRequirements = sessionManager.getPendingRequirements(clientState.sessionId);
        const requirementIds = pendingRequirements.map(r => r.id);
        sessionManager.addArtifact(clientState.sessionId, code, 'react', requirementIds);
      }
    }

    socket.emit('artifact:update', { artifactId, code, isComplete: true });
  });

  // Handle errors
  geminiClient.on('error', (error) => {
    socket.emit('error', {
      message: error.message,
      code: 'GEMINI_ERROR',
    });
  });
}

function cleanupClient(socketId: string): void {
  const state = clientStates.get(socketId);
  if (state) {
    if (state.geminiClient) {
      state.geminiClient.disconnect();
    }
    if (state.sessionId) {
      sessionManager.endSession(state.sessionId);
    }
    clientStates.delete(socketId);
  }
}
