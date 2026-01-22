import { GoogleGenAI, Modality, Session, LiveConnectConfig, LiveServerMessage } from '@google/genai';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { CodeGenerator } from './code-generator.js';
import { systemPrompt, functionDeclarations } from './function-tools.js';
import type { ExtractUIRequirementParams, Requirement, ComponentType } from '../types/index.js';

interface LiveAPIEvents {
  transcript: (text: string, isFinal: boolean) => void;
  requirement: (requirement: Omit<Requirement, 'id' | 'createdAt' | 'status'>) => void;
  codeGeneration: (artifactId: string, chunk: string) => void;
  codeComplete: (artifactId: string, code: string) => void;
  error: (error: Error) => void;
  connected: () => void;
  disconnected: () => void;
}

export class GeminiMultimodalLiveClient extends EventEmitter {
  private ai: GoogleGenAI;
  private session: Session | null = null;
  private codeGenerator: CodeGenerator;
  private isConnected = false;
  private currentTranscript = '';
  private pendingFunctionCalls: Map<string, { name: string; args: Record<string, unknown> }> = new Map();

  constructor(apiKey: string) {
    super();
    this.ai = new GoogleGenAI({ apiKey });
    this.codeGenerator = new CodeGenerator(apiKey);
  }

  on<K extends keyof LiveAPIEvents>(event: K, listener: LiveAPIEvents[K]): this {
    return super.on(event, listener);
  }

  emit<K extends keyof LiveAPIEvents>(event: K, ...args: Parameters<LiveAPIEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  async connect(): Promise<void> {
    console.log('[GeminiLive] Connecting to Live API...');

    const config: LiveConnectConfig = {
      responseModalities: [Modality.TEXT],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      tools: [{ functionDeclarations: functionDeclarations as any }],
    };

    try {
      this.session = await this.ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        config,
        callbacks: {
          onopen: () => {
            console.log('[GeminiLive] Connected to Gemini Live API');
            this.isConnected = true;
            this.emit('connected');
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleServerMessage(message);
          },
          onerror: (e: ErrorEvent) => {
            console.error('[GeminiLive] Error:', e.message);
            this.emit('error', new Error(e.message));
          },
          onclose: (e: CloseEvent) => {
            console.log('[GeminiLive] Connection closed:', e.reason || 'unknown');
            this.isConnected = false;
            this.emit('disconnected');
          },
        },
      });

      console.log('[GeminiLive] Session created successfully');
    } catch (error) {
      console.error('[GeminiLive] Failed to connect:', error);
      throw error;
    }
  }

  private handleServerMessage(message: LiveServerMessage): void {
    // Handle tool calls
    if (message.toolCall) {
      const functionCalls = message.toolCall.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name && call.args) {
            const callId = call.id || uuidv4();
            console.log(`[GeminiLive] Function call: ${call.name}`, call.args);
            this.pendingFunctionCalls.set(callId, { name: call.name, args: call.args as Record<string, unknown> });
            this.handleFunctionCall(callId, call.name, call.args as Record<string, unknown>);
          }
        }
      }
      return;
    }

    // Handle server content (transcripts and responses)
    if (message.serverContent) {
      const { modelTurn, turnComplete } = message.serverContent;

      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          // Handle text response
          if (part.text) {
            this.currentTranscript += part.text;
            this.emit('transcript', part.text, false);
          }

          // Handle function calls in model turn
          if (part.functionCall && part.functionCall.name && part.functionCall.args) {
            const callId = part.functionCall.id || uuidv4();
            console.log(`[GeminiLive] Function call in turn: ${part.functionCall.name}`, part.functionCall.args);
            this.pendingFunctionCalls.set(callId, {
              name: part.functionCall.name,
              args: part.functionCall.args as Record<string, unknown>,
            });
            this.handleFunctionCall(callId, part.functionCall.name, part.functionCall.args as Record<string, unknown>);
          }
        }
      }

      // Turn complete - emit final transcript
      if (turnComplete && this.currentTranscript) {
        this.emit('transcript', this.currentTranscript, true);
        this.currentTranscript = '';
      }
    }
  }

  private async handleFunctionCall(id: string, name: string, args: Record<string, unknown>): Promise<void> {
    console.log(`[GeminiLive] Processing function: ${name}`);

    let response: Record<string, unknown> = { success: true };

    try {
      switch (name) {
        case 'extract_ui_requirement': {
          const params = args as unknown as ExtractUIRequirementParams;
          const requirement: Omit<Requirement, 'id' | 'createdAt' | 'status'> = {
            componentType: params.component_type as ComponentType,
            description: params.description,
            priority: params.priority || 'medium',
            context: params.context || '',
          };
          this.emit('requirement', requirement);
          response = { success: true, message: 'Requirement extracted' };
          break;
        }

        case 'generate_ui_code': {
          const componentName = (args.component_name as string) || 'GeneratedComponent';
          const requirementsSummary = (args.requirements_summary as string) || '';

          const artifactId = uuidv4();

          try {
            const code = await this.codeGenerator.generateFromDescription(
              componentName,
              requirementsSummary,
              (chunk) => {
                this.emit('codeGeneration', artifactId, chunk);
              }
            );

            this.emit('codeComplete', artifactId, code);
            response = { success: true, artifactId, message: 'Code generated' };
          } catch (error) {
            console.error('[GeminiLive] Code generation error:', error);
            this.emit('error', error instanceof Error ? error : new Error(String(error)));
            response = { success: false, error: String(error) };
          }
          break;
        }

        default:
          console.warn(`[GeminiLive] Unknown function: ${name}`);
          response = { success: false, error: 'Unknown function' };
      }
    } catch (error) {
      console.error(`[GeminiLive] Error in function ${name}:`, error);
      response = { success: false, error: String(error) };
    }

    // Send function response back to Gemini
    this.sendFunctionResponse(id, name, response);
    this.pendingFunctionCalls.delete(id);
  }

  private sendFunctionResponse(id: string, name: string, response: Record<string, unknown>): void {
    if (!this.session) return;

    try {
      this.session.sendToolResponse({
        functionResponses: [
          {
            id,
            name,
            response,
          },
        ],
      });
    } catch (error) {
      console.error('[GeminiLive] Failed to send tool response:', error);
    }
  }

  /**
   * Send audio data to Gemini
   * @param audioData PCM 16-bit audio data
   */
  private audioChunkCount = 0;
  sendAudio(audioData: ArrayBuffer): void {
    if (!this.session || !this.isConnected) {
      console.warn('[GeminiLive] Not connected, cannot send audio');
      return;
    }

    if (!audioData) {
      console.warn('[GeminiLive] No audio data received');
      return;
    }

    try {
      // Handle different data formats from Socket.IO
      let buffer: Buffer;
      if (audioData instanceof ArrayBuffer) {
        buffer = Buffer.from(audioData);
      } else if (ArrayBuffer.isView(audioData)) {
        const view = audioData as ArrayBufferView;
        buffer = Buffer.from(view.buffer, view.byteOffset, view.byteLength);
      } else if (typeof audioData === 'object' && audioData !== null) {
        // Socket.IO may send as object with numeric keys
        buffer = Buffer.from(Object.values(audioData) as number[]);
      } else {
        console.warn('[GeminiLive] Unknown audio data type:', typeof audioData);
        return;
      }

      this.audioChunkCount++;
      if (this.audioChunkCount % 50 === 1) {
        console.log(`[GeminiLive] Sending audio chunk #${this.audioChunkCount}, size: ${buffer.length} bytes`);
      }

      const base64Audio = buffer.toString('base64');

      this.session.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    } catch (error) {
      console.error('[GeminiLive] Failed to send audio:', error);
    }
  }

  /**
   * Send text message to Gemini
   */
  sendText(text: string): void {
    if (!this.session || !this.isConnected) {
      console.warn('[GeminiLive] Not connected, cannot send text');
      return;
    }

    console.log(`[GeminiLive] Sending text: ${text}`);

    try {
      this.session.sendClientContent({
        turns: [
          {
            role: 'user',
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      });
    } catch (error) {
      console.error('[GeminiLive] Failed to send text:', error);
    }
  }

  /**
   * Disconnect from the API
   */
  disconnect(): void {
    if (this.session) {
      try {
        this.session.close();
      } catch (error) {
        console.error('[GeminiLive] Error closing session:', error);
      }
      this.session = null;
    }
    this.isConnected = false;
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }
}
