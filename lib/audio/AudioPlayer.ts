// ============================================
// AudioPlayer: Smooth Web Audio Playback
// ============================================

/**
 * Manages queued audio playback with proper timing.
 * Buffers audio chunks and schedules them for gapless playback.
 */
export class AudioPlayer {
  private audioContext: AudioContext;
  private sampleRate: number;
  private bufferQueue: Float32Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;

  constructor(audioContext: AudioContext, sampleRate = 24000) {
    this.audioContext = audioContext;
    this.sampleRate = sampleRate;
  }

  /**
   * Queue audio samples for playback.
   * @param samples - Float32Array of audio samples (-1 to 1 range)
   */
  play(samples: Float32Array): void {
    this.bufferQueue.push(samples);
    this.scheduleBuffers();
  }

  private scheduleBuffers(): void {
    if (this.bufferQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    const currentTime = this.audioContext.currentTime;

    // Initialize start time if not playing
    if (!this.isPlaying || this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.05; // 50ms buffer for smooth start
      this.isPlaying = true;
    }

    // Schedule all pending buffers
    while (this.bufferQueue.length > 0) {
      const samples = this.bufferQueue.shift()!;

      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(
        1,
        samples.length,
        this.sampleRate
      );
      audioBuffer.getChannelData(0).set(samples);

      // Create source and connect
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      // Schedule playback
      source.start(this.nextStartTime);

      // Update next start time
      this.nextStartTime += samples.length / this.sampleRate;
    }
  }

  /**
   * Stop all queued and playing audio.
   */
  stop(): void {
    this.bufferQueue = [];
    this.isPlaying = false;
  }

  /**
   * Convert Int16 PCM to Float32 samples.
   */
  static int16ToFloat32(arrayBuffer: ArrayBuffer): Float32Array {
    const int16Array = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16Array.length);

    for (let i = 0; i < int16Array.length; i++) {
      float32[i] = int16Array[i] / 32768;
    }

    return float32;
  }
}
