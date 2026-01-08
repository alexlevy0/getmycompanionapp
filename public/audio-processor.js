// AudioWorklet processor for microphone input
// Captures audio, applies anti-aliasing filter, downsamples to 16kHz, and converts to Int16

class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
    this.targetSampleRate = 16000;
    
    // Low-pass filter coefficients for anti-aliasing (simple moving average)
    this.filterBuffer = new Float32Array(4);
    this.filterIndex = 0;
  }

  // Simple low-pass filter to prevent aliasing
  lowPassFilter(sample) {
    this.filterBuffer[this.filterIndex] = sample;
    this.filterIndex = (this.filterIndex + 1) % this.filterBuffer.length;
    
    let sum = 0;
    for (let i = 0; i < this.filterBuffer.length; i++) {
      sum += this.filterBuffer[i];
    }
    return sum / this.filterBuffer.length;
  }

  // Linear interpolation for smoother resampling
  interpolate(buffer, index) {
    const floor = Math.floor(index);
    const ceil = Math.min(floor + 1, buffer.length - 1);
    const fraction = index - floor;
    return buffer[floor] * (1 - fraction) + buffer[ceil] * fraction;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const inputData = input[0]; // Float32Array at source sample rate
    const sourceSampleRate = sampleRate; // Global from AudioWorklet
    
    // Accumulate samples into buffer
    const newBuffer = new Float32Array(this.buffer.length + inputData.length);
    newBuffer.set(this.buffer);
    newBuffer.set(inputData, this.buffer.length);
    this.buffer = newBuffer;

    // Process chunks of 20ms at 16kHz = 320 samples
    const outputChunkSize = 320; // 20ms at 16kHz
    const ratio = sourceSampleRate / this.targetSampleRate;
    const inputChunkSize = Math.ceil(outputChunkSize * ratio);
    
    while (this.buffer.length >= inputChunkSize) {
      // Extract chunk for processing
      const chunk = this.buffer.slice(0, inputChunkSize);
      this.buffer = this.buffer.slice(inputChunkSize);
      
      // Apply low-pass filter and resample
      const output = new Int16Array(outputChunkSize);
      
      for (let i = 0; i < outputChunkSize; i++) {
        const sourceIndex = i * ratio;
        
        // Interpolate for smoother resampling
        let sample = this.interpolate(chunk, sourceIndex);
        
        // Apply low-pass filter
        sample = this.lowPassFilter(sample);
        
        // Clamp and convert to Int16
        sample = Math.max(-1, Math.min(1, sample));
        output[i] = Math.round(sample * 32767);
      }
      
      // Send to main thread
      this.port.postMessage(output.buffer, [output.buffer]);
    }

    return true;
  }
}

registerProcessor('mic-processor', MicProcessor);
