// Offscreen document for audio capture in Manifest V3

let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
let source: MediaStreamAudioSourceNode | null = null;

// Listen for messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  switch (message.type) {
    case 'START_CAPTURE':
      startCapture(message.streamId)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'STOP_CAPTURE':
      stopCapture();
      sendResponse({ success: true });
      return false;
  }
});

async function startCapture(streamId: string): Promise<void> {
  console.log('[Offscreen] startCapture called with streamId:', streamId);
  try {
    // Get media stream using the stream ID from tabCapture
    console.log('[Offscreen] Calling getUserMedia...');
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // @ts-ignore - mandatory is used for tab capture
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    console.log('[Offscreen] Got media stream, tracks:', mediaStream.getTracks().length);
    setupAudioProcessing();
    console.log('[Offscreen] Audio capture started successfully');
  } catch (error) {
    console.error('[Offscreen] Failed to start capture:', error);
    throw error;
  }
}

function setupAudioProcessing(): void {
  if (!mediaStream) return;

  // Create audio context with 16kHz sample rate for Gemini
  audioContext = new AudioContext({ sampleRate: 16000 });
  source = audioContext.createMediaStreamSource(mediaStream);

  // Use ScriptProcessorNode for raw audio data
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  let audioChunkCount = 0;
  processor.onaudioprocess = (event) => {
    const inputData = event.inputBuffer.getChannelData(0);
    const pcmData = float32ToInt16(inputData);

    audioChunkCount++;
    if (audioChunkCount % 50 === 1) {
      console.log('[Offscreen] Sending audio chunk #', audioChunkCount, 'samples:', pcmData.length);
    }

    // Send audio data to service worker
    chrome.runtime.sendMessage({
      type: 'AUDIO_DATA',
      data: Array.from(pcmData),
    });
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
}

function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return int16Array;
}

function stopCapture(): void {
  if (processor) {
    processor.disconnect();
    processor = null;
  }

  if (source) {
    source.disconnect();
    source = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  console.log('[Offscreen] Audio capture stopped');
}
