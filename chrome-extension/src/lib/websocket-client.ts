type EventCallback = (event: string, data: unknown) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private messageCallbacks: EventCallback[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected to backend');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Connection closed');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WebSocket] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      setTimeout(() => {
        this.connect().catch(() => {
          // Will retry on next attempt
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private handleMessage(message: { event: string; data: unknown }): void {
    this.messageCallbacks.forEach((callback) => {
      callback(message.event, message.data);
    });
  }

  onMessage(callback: EventCallback): void {
    this.messageCallbacks.push(callback);
  }

  private send(event: string, data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  sendAudioData(data: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send audio data as binary with a type header
      const header = new TextEncoder().encode('audio:stream');
      const combined = new Uint8Array(header.length + 1 + data.byteLength);
      combined.set(header, 0);
      combined[header.length] = 0; // Null separator
      combined.set(new Uint8Array(data), header.length + 1);
      this.ws.send(combined);
    }
  }

  sendSessionStart(data: { meetingId?: string }): void {
    this.send('session:start', data);
  }

  sendSessionEnd(): void {
    this.send('session:end', {});
  }

  sendChatMessage(text: string): void {
    this.send('chat:message', { text });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageCallbacks = [];
  }
}
