// packages/scientific-core/runtime/signal-processing-runtime.ts
/**
 * Signal Processing Runtime
 * 
 * Responsibilities:
 * - Process time-series measurement data (filtering, FFT, smoothing)
 * - Implement common DSP algorithms for scientific analysis
 * - Handle real-time and batch processing with configurable windows
 * - Ensure deterministic results for replay
 * - Support multi-channel data
 * 
 * Owned state:
 * - buffers: Map<string, SignalSample[]> (per channel)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - PrecisionMathRuntime (to reduce floating-point error)
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: per-channel, single-threaded processing
 * Recovery: buffers are transient; no recovery needed
 * Telemetry: processing time per algorithm, buffer sizes
 * Diagnostics: current buffer statistics
 * Accessibility: N/A
 * Performance: use typed arrays for heavy computation; offline FFT via Web Workers for large datasets
 * Forbidden: blocking the main thread with long computations; non-deterministic windowing
 */

import type { SignalSample } from '../contracts/scientific-core-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import { PrecisionMathRuntime } from './precision-math-runtime';

export class SignalProcessingRuntime {
  private buffers: Map<string, SignalSample[]> = new Map();
  private math: PrecisionMathRuntime;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.math = new PrecisionMathRuntime(10);
  }

  pushSample(channelId: string, sample: SignalSample): void {
    let buffer = this.buffers.get(channelId);
    if (!buffer) {
      buffer = [];
      this.buffers.set(channelId, buffer);
    }
    buffer.push(sample);
    // Keep last N samples (e.g., 8192 for FFT)
    const MAX_SAMPLES = 16384;
    if (buffer.length > MAX_SAMPLES) {
      buffer.splice(0, buffer.length - MAX_SAMPLES);
    }
  }

  getSamples(channelId: string, windowSize?: number): SignalSample[] {
    const buffer = this.buffers.get(channelId);
    if (!buffer) return [];
    if (windowSize && buffer.length > windowSize) {
      return buffer.slice(-windowSize);
    }
    return [...buffer];
  }

  movingAverage(channelId: string, windowSize: number): number[] {
    const samples = this.getSamples(channelId, windowSize);
    if (samples.length < windowSize) return samples.map(s => s.value);
    const result: number[] = [];
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum = this.math.add(sum, samples[i].value);
      if (i >= windowSize) {
        sum = this.math.subtract(sum, samples[i - windowSize].value);
      }
      if (i >= windowSize - 1) {
        result.push(this.math.divide(sum, windowSize));
      }
    }
    return result;
  }

  lowPassFilter(channelId: string, alpha: number): number {
    const buffer = this.buffers.get(channelId);
    if (!buffer || buffer.length < 1) return 0;
    let filtered = buffer[0].value;
    for (let i = 1; i < buffer.length; i++) {
      filtered = this.math.add(
        this.math.multiply(alpha, buffer[i].value),
        this.math.multiply(this.math.subtract(1, alpha), filtered)
      );
    }
    return filtered;
  }

  // Simple DFT for small windows; production would use FFT via worker
  computeDFT(channelId: string, windowSize: number): { frequencies: number[]; magnitudes: number[] } {
    const samples = this.getSamples(channelId, windowSize).map(s => s.value);
    const N = samples.length;
    const frequencies: number[] = [];
    const magnitudes: number[] = [];
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += samples[n] * Math.cos(angle);
        imag += samples[n] * Math.sin(angle);
      }
      frequencies.push(k);
      magnitudes.push(Math.sqrt(real * real + imag * imag) / N);
    }
    return { frequencies, magnitudes };
  }

  clearChannel(channelId: string): void {
    this.buffers.delete(channelId);
  }
}