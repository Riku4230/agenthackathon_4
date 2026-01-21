import { GoogleGenerativeAI } from '@google/generative-ai';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { functionDeclarations, systemPrompt } from './function-tools.js';
import { CodeGenerator } from './code-generator.js';
import type { ExtractUIRequirementParams, Requirement, ComponentType } from '../types/index.js';

interface LiveAPIEvents {
  transcript: (text: string, isFinal: boolean) => void;
  requirement: (requirement: Omit<Requirement, 'id' | 'createdAt' | 'status'>) => void;
  codeGeneration: (artifactId: string, chunk: string) => void;
  codeComplete: (artifactId: string, code: string) => void;
  error: (error: Error) => void;
}

export class GeminiLiveAPIClient extends EventEmitter {
  private genAI: GoogleGenerativeAI;
  private model;
  private chat;
  private codeGenerator: CodeGenerator;
  private conversationHistory: string[] = [];
  private audioBuffer: Int16Array[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(apiKey: string) {
    super();
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations }],
    });
    this.chat = this.model.startChat();
    this.codeGenerator = new CodeGenerator(apiKey);
  }

  on<K extends keyof LiveAPIEvents>(event: K, listener: LiveAPIEvents[K]): this {
    return super.on(event, listener);
  }

  emit<K extends keyof LiveAPIEvents>(event: K, ...args: Parameters<LiveAPIEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Process incoming audio data
   * In a production system, this would stream to Gemini's audio API
   * For MVP, we'll batch process and use speech-to-text simulation
   */
  processAudioData(audioData: ArrayBuffer): void {
    // Buffer the audio data
    const int16Data = new Int16Array(audioData);
    this.audioBuffer.push(int16Data);

    // In a real implementation, you'd stream this to Gemini Live API
    // For now, we'll process periodically
  }

  /**
   * Start processing audio
   */
  startProcessing(): void {
    // Process buffered audio every 5 seconds
    this.processingInterval = setInterval(() => {
      this.processBufferedAudio();
    }, 5000);
  }

  /**
   * Stop processing audio
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Process buffered audio - in production, this would use Gemini's audio capabilities
   */
  private async processBufferedAudio(): Promise<void> {
    if (this.audioBuffer.length === 0) return;

    // For MVP, we'll clear the buffer and wait for text input
    // In production, you'd send this to Gemini's audio API
    this.audioBuffer = [];
  }

  /**
   * Process a text message (either from chat or transcribed audio)
   */
  async processText(text: string): Promise<void> {
    try {
      // Add to conversation history
      this.conversationHistory.push(text);

      // Emit transcript (simulating real-time transcription)
      this.emit('transcript', text, true);

      // Send to Gemini with function calling enabled
      const result = await this.chat.sendMessage(text);
      const response = result.response;

      // Check for function calls
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          await this.handleFunctionCall(call.name, call.args as Record<string, unknown>);
        }
      }

      // Also check the text response for any additional context
      const textResponse = response.text();
      if (textResponse) {
        console.log('[Gemini] Response:', textResponse);
      }
    } catch (error) {
      console.error('[GeminiLiveAPI] Error processing text:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Handle function calls from Gemini
   */
  private async handleFunctionCall(name: string, args: Record<string, unknown>): Promise<void> {
    console.log(`[Gemini] Function call: ${name}`, args);

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
        } catch (error) {
          console.error('[Gemini] Code generation error:', error);
          this.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
        break;
      }

      default:
        console.warn(`[Gemini] Unknown function: ${name}`);
    }
  }

  /**
   * Manually trigger code generation for pending requirements
   */
  async generateCodeForRequirements(requirements: Requirement[]): Promise<void> {
    if (requirements.length === 0) return;

    const artifactId = uuidv4();

    try {
      const code = await this.codeGenerator.generateCode(requirements, (chunk) => {
        this.emit('codeGeneration', artifactId, chunk);
      });

      this.emit('codeComplete', artifactId, code);
    } catch (error) {
      console.error('[Gemini] Code generation error:', error);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get conversation summary
   */
  getConversationSummary(): string {
    return this.conversationHistory.join('\n');
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    this.chat = this.model.startChat();
  }
}
