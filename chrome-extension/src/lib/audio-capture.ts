type AudioDataCallback = (data: ArrayBuffer) => void;

export class AudioCapture {
  private tabId: number;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(tabId: number) {
    this.tabId = tabId;
  }

  async start(onAudioData: AudioDataCallback): Promise<void> {
    return new Promise((resolve, reject) => {
      // Request tab capture
      chrome.tabCapture.capture(
        {
          audio: true,
          video: false,
        },
        (stream) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!stream) {
            reject(new Error('Failed to capture audio stream'));
            return;
          }

          this.mediaStream = stream;
          this.setupAudioProcessing(stream, onAudioData);
          resolve();
        }
      );
    });
  }

  private setupAudioProcessing(stream: MediaStream, onAudioData: AudioDataCallback): void {
    // Create audio context with specific sample rate for Gemini
    this.audioContext = new AudioContext({
      sampleRate: 16000, // Gemini expects 16kHz audio
    });

    this.source = this.audioContext.createMediaStreamSource(stream);

    // Use ScriptProcessorNode for raw audio data access
    // Buffer size of 4096 gives us ~256ms of audio at 16kHz
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);

      // Convert Float32Array to Int16Array (PCM 16-bit)
      const pcmData = this.float32ToInt16(inputData);

      // Send as ArrayBuffer
      onAudioData(pcmData.buffer as ArrayBuffer);
    };

    // Connect the nodes
    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp the value to [-1, 1] and convert to 16-bit integer
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return int16Array;
  }

  stop(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }
}
