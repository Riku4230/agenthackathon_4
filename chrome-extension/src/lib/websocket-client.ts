import { io, Socket } from 'socket.io-client';

type EventCallback = (event: string, data: unknown) => void;

export class WebSocketClient {
  private socket: Socket | null = null;
  private url: string;
  private messageCallbacks: EventCallback[] = [];

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.url, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        this.socket.on('connect', () => {
          console.log('[WebSocket] Connected to backend');
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('[WebSocket] Connection error:', error);
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[WebSocket] Connection closed:', reason);
        });

        // Listen for backend events
        this.socket.on('session:connected', (data) => {
          this.handleMessage('session:connected', data);
        });

        this.socket.on('transcript:update', (data) => {
          this.handleMessage('transcript:update', data);
        });

        this.socket.on('requirement:detected', (data) => {
          this.handleMessage('requirement:detected', data);
        });

        this.socket.on('artifact:stream', (data) => {
          this.handleMessage('artifact:stream', data);
        });

        this.socket.on('artifact:update', (data) => {
          this.handleMessage('artifact:update', data);
        });

        this.socket.on('error', (data) => {
          this.handleMessage('error', data);
        });

        this.socket.on('gemini:disconnected', () => {
          this.handleMessage('gemini:disconnected', {});
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(event: string, data: unknown): void {
    this.messageCallbacks.forEach((callback) => {
      callback(event, data);
    });
  }

  onMessage(callback: EventCallback): void {
    this.messageCallbacks.push(callback);
  }

  sendAudioData(data: ArrayBuffer): void {
    if (this.socket?.connected) {
      this.socket.emit('audio:stream', {
        data: data,
        timestamp: Date.now(),
      });
    }
  }

  sendSessionStart(data: { meetingId?: string }): void {
    if (this.socket?.connected) {
      this.socket.emit('session:start', data);
    }
  }

  sendSessionEnd(): void {
    if (this.socket?.connected) {
      this.socket.emit('session:end', {});
    }
  }

  sendChatMessage(text: string): void {
    if (this.socket?.connected) {
      this.socket.emit('chat:message', { text });
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.messageCallbacks = [];
  }
}
