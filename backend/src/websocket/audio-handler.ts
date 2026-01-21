/**
 * Audio processing utilities for handling audio streams from Chrome extension
 */

interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

const DEFAULT_CONFIG: AudioConfig = {
  sampleRate: 16000,  // 16kHz as expected by Gemini
  channels: 1,         // Mono
  bitsPerSample: 16,   // 16-bit PCM
};

/**
 * Convert raw PCM data to WAV format for debugging/storage
 */
export function pcmToWav(pcmData: Int16Array, config: AudioConfig = DEFAULT_CONFIG): Buffer {
  const byteRate = config.sampleRate * config.channels * (config.bitsPerSample / 8);
  const blockAlign = config.channels * (config.bitsPerSample / 8);
  const dataSize = pcmData.length * (config.bitsPerSample / 8);

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);           // Chunk size
  buffer.writeUInt16LE(1, 20);            // Audio format (PCM)
  buffer.writeUInt16LE(config.channels, 22);
  buffer.writeUInt32LE(config.sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(config.bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write PCM data
  for (let i = 0; i < pcmData.length; i++) {
    buffer.writeInt16LE(pcmData[i], 44 + i * 2);
  }

  return buffer;
}

/**
 * Merge multiple audio chunks into one
 */
export function mergeAudioChunks(chunks: Int16Array[]): Int16Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Int16Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

/**
 * Calculate audio duration in seconds
 */
export function calculateDuration(
  samples: number,
  sampleRate: number = DEFAULT_CONFIG.sampleRate
): number {
  return samples / sampleRate;
}

/**
 * Detect if audio contains speech (simple VAD)
 * Returns true if the audio likely contains speech
 */
export function detectSpeech(pcmData: Int16Array, threshold: number = 500): boolean {
  // Calculate RMS (Root Mean Square) energy
  let sumSquares = 0;
  for (let i = 0; i < pcmData.length; i++) {
    sumSquares += pcmData[i] * pcmData[i];
  }
  const rms = Math.sqrt(sumSquares / pcmData.length);

  return rms > threshold;
}

/**
 * Normalize audio to a target level
 */
export function normalizeAudio(pcmData: Int16Array, targetLevel: number = 0.9): Int16Array {
  // Find peak value
  let peak = 0;
  for (let i = 0; i < pcmData.length; i++) {
    const abs = Math.abs(pcmData[i]);
    if (abs > peak) peak = abs;
  }

  if (peak === 0) return pcmData;

  // Calculate normalization factor
  const maxValue = 32767; // Max value for 16-bit audio
  const factor = (targetLevel * maxValue) / peak;

  // Apply normalization
  const normalized = new Int16Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    normalized[i] = Math.round(pcmData[i] * factor);
  }

  return normalized;
}
