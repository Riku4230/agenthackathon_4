import type { Socket } from 'socket.io';
import { sessionManager } from '../session/session-manager.js';
import { GeminiLiveAPIClient } from '../gemini/live-api-client.js';
import type { Session, Requirement } from '../types/index.js';

interface ClientState {
  sessionId: string | null;
  geminiClient: GeminiLiveAPIClient | null;
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
  socket.on('session:start', (data: { meetingId?: string }) => {
    const state = clientStates.get(socket.id);
    if (!state) return;

    // Create new session
    const session = sessionManager.createSession(data.meetingId);
    state.sessionId = session.id;

    // Initialize Gemini client
    state.geminiClient = new GeminiLiveAPIClient(apiKey);

    // Set up Gemini event handlers
    setupGeminiHandlers(socket, state.geminiClient, session.id);

    // Start processing
    state.geminiClient.startProcessing();

    // Notify client
    socket.emit('session:connected', { sessionId: session.id });

    console.log(`[WebSocket] Session started: ${session.id}`);
  });

  // Handle audio stream
  socket.on('audio:stream', (data: { data: ArrayBuffer; timestamp: number }) => {
    const state = clientStates.get(socket.id);
    if (!state?.geminiClient) return;

    state.geminiClient.processAudioData(data.data);
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
          state.geminiClient.processAudioData(audioData.buffer as ArrayBuffer);
        }
      }
    }
  });

  // Handle chat message
  socket.on('chat:message', async (data: { text: string }) => {
    const state = clientStates.get(socket.id);
    if (!state?.geminiClient || !state.sessionId) return;

    console.log(`[WebSocket] Chat message: ${data.text}`);

    // Process through Gemini
    await state.geminiClient.processText(data.text);
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

    // Generate code
    await state.geminiClient.generateCodeForRequirements(requirements);
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
  geminiClient: GeminiLiveAPIClient,
  sessionId: string
): void {
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
    const state = clientStates.get(socket.id);
    if (state?.sessionId) {
      const pendingRequirements = sessionManager.getPendingRequirements(state.sessionId);
      const requirementIds = pendingRequirements.map(r => r.id);
      sessionManager.addArtifact(state.sessionId, code, 'react', requirementIds);
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
      state.geminiClient.stopProcessing();
    }
    if (state.sessionId) {
      sessionManager.endSession(state.sessionId);
    }
    clientStates.delete(socketId);
  }
}
