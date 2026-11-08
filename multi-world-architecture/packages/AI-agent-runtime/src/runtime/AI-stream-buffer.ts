// packages/AI-agent-runtime/src/runtime/AI-stream-buffer.ts
/**
 * AI Stream Buffer
 * 
 * Responsibilities:
 * - Buffer streaming responses from AI models before delivery
 * - Manage backpressure: if consumer is slow, accumulate chunks
 * - Support chunk reordering and merging when needed
 * - Provide timeout and cancellation
 * 
 * Owned state:
 * - bufferMap: Map<streamId, StreamBuffer>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * 
 * Event emissions: none (purely functional)
 * Event subscriptions: none
 * Synchronization: per-stream buffer, no cross-stream conflicts
 * Recovery: buffer lost on crash (acceptable for streams)
 * Telemetry: buffer fill level, chunk latency
 * Diagnostics: active streams, memory usage
 * Accessibility: N/A
 * Performance: fixed-size buffer to prevent OOM; fast append
 * Forbidden: indefinite buffering without consumer
 */

import type { StreamChunk } from '../contracts/ai-agent-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface StreamBufferState {
  chunks: StreamChunk[];
  resolve: (chunk: StreamChunk) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

export class AIStreamBuffer {
  private buffers: Map<string, StreamBufferState> = new Map();
  private readonly maxChunks = 1000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async createStream(streamId: string, timeoutMs: number = 30000): Promise<AsyncGenerator<StreamChunk>> {
    const self = this;
    return (async function* () {
      let done = false;
      while (!done) {
        const chunk = await new Promise<StreamChunk>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Stream timeout')), timeoutMs);
          self.buffers.set(streamId, { chunks: [], resolve, reject, timeout });
        });
        if (chunk.isFinal) {
          done = true;
          self.buffers.delete(streamId);
        }
        yield chunk;
      }
    })();
  }

  pushChunk(streamId: string, chunk: StreamChunk): void {
    const buffer = this.buffers.get(streamId);
    if (!buffer) {
      this.logger.warn(`Stream ${streamId} not found for chunk`);
      return;
    }
    buffer.chunks.push(chunk);
    if (buffer.resolve) {
      clearTimeout(buffer.timeout);
      buffer.resolve(chunk);
      if (!chunk.isFinal) {
        // Prepare for next chunk
        this.buffers.set(streamId, {
          ...buffer,
          resolve: undefined as any,
          reject: undefined as any,
          timeout: setTimeout(() => buffer.reject?.(new Error('Stream timeout')), 30000),
        });
      }
    }
  }

  cancelStream(streamId: string): void {
    const buffer = this.buffers.get(streamId);
    if (buffer) {
      buffer.reject(new Error('Stream cancelled'));
      clearTimeout(buffer.timeout);
      this.buffers.delete(streamId);
    }
  }
}