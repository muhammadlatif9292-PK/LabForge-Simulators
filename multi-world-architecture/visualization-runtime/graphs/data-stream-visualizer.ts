// visualization-runtime/graphs/data-stream-visualizer.ts
/**
 * Data Stream Visualizer
 * 
 * Responsibilities:
 * - Accept live data streams from instruments and simulations
 * - Smooth and decimate data for display
 * - Manage multiple streaming series per graph
 * - Provide controls for pause, resume, and export of streaming data
 * - Optimize for high-frequency data (e.g., 1000 Hz oscilloscope)
 * 
 * Owned state:
 * - streams: Map<GraphId, Map<ChartSeriesId, DataStreamConfig>>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - ScientificGraphRuntime (to push data points)
 * 
 * Event emissions: "stream.data.received", "stream.buffer.overflow"
 * Event subscriptions:
 * - "instrument.measurement.recorded" (continuous measurement)
 * - "simulation.data.stream" (simulation output)
 * 
 * Synchronization: per-stream; ring buffer for high-frequency
 * Recovery: stream buffers lost on crash (acceptable)
 * Telemetry: stream frequency, buffer size
 * Diagnostics: active streams, dropped samples
 * Accessibility: provide numeric readout alongside graph
 * Performance: ring buffer for O(1) append; decimate for display
 * Forbidden: unbounded buffer growth; blocking UI with high-frequency updates
 */

import type { GraphId, ChartSeriesId, DataPoint } from '../contracts/visualization-contracts';
import type { ScientificGraphRuntime } from './scientific-graph-runtime';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface DataStreamConfig {
  maxFrequency: number;       // max display Hz
  ringBufferSize: number;
  displayDecimation: number;  // show every Nth point
}

export class DataStreamVisualizer {
  private ringBuffers: Map<string, DataPoint[]> = new Map();
  private sampleCounts: Map<string, number> = new Map();
  private readonly DEFAULT_BUFFER = 10_000;

  constructor(
    private graphRuntime: ScientificGraphRuntime,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  startStream(graphId: GraphId, seriesId: ChartSeriesId, config?: Partial<DataStreamConfig>): void {
    const key = `${graphId}:${seriesId}`;
    if (!this.ringBuffers.has(key)) {
      this.ringBuffers.set(key, []);
      this.sampleCounts.set(key, 0);
    }
    this.logger.debug(`Data stream started: ${key}`);
  }

  pushSample(graphId: GraphId, seriesId: ChartSeriesId, sample: DataPoint): void {
    const key = `${graphId}:${seriesId}`;
    let buffer = this.ringBuffers.get(key);
    if (!buffer) {
      buffer = [];
      this.ringBuffers.set(key, buffer);
      this.sampleCounts.set(key, 0);
    }
    buffer.push(sample);
    const count = (this.sampleCounts.get(key) ?? 0) + 1;
    this.sampleCounts.set(key, count);

    // Trim buffer if needed
    if (buffer.length > this.DEFAULT_BUFFER) {
      buffer = buffer.slice(-this.DEFAULT_BUFFER / 2); // keep recent half
      this.ringBuffers.set(key, buffer);
      this.meter.incrementCounter('visualization.stream.buffer_overflow');
    }

    // Push to graph every Nth sample (decimation for display)
    const DECIMATION = 10;
    if (count % DECIMATION === 0) {
      this.graphRuntime.appendDataPoint(graphId, seriesId, sample);
    }
  }

  stopStream(graphId: GraphId, seriesId: ChartSeriesId): void {
    const key = `${graphId}:${seriesId}`;
    this.ringBuffers.delete(key);
    this.sampleCounts.delete(key);
  }

  getBufferSize(graphId: GraphId, seriesId: ChartSeriesId): number {
    return this.ringBuffers.get(`${graphId}:${seriesId}`)?.length ?? 0;
  }

  stopAll(): void {
    this.ringBuffers.clear();
    this.sampleCounts.clear();
  }
}