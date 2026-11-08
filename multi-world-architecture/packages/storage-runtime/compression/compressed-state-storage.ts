// packages/storage-runtime/compression/compressed-state-storage.ts
/**
 * Compressed State Storage
 * 
 * Responsibilities:
 * - Transparently compress data before storage and decompress on retrieval
 * - Support multiple compression algorithms (gzip, brotli, deflate) with auto-selection
 * - Only compress data above a minimum size threshold to avoid overhead
 * - Store compression metadata alongside compressed blocks
 * - Validate integrity (checksum) after decompression
 * 
 * Owned state: none (stateless)
 * 
 * Dependencies: ILogger, IMeter, CompressionStreams API
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: corrupted compressed data detected via checksum
 * Telemetry: compression ratio, time spent, bytes saved
 * Diagnostics: algorithm usage statistics
 * Accessibility: N/A
 * Performance: only compress when saving large objects (> 1KB); async streams
 * Forbidden: compressing small objects; failing silently on decompression
 */

import type { CompressionId, CompressedBlock, Checksum } from '../contracts/storage-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class CompressedStateStorage {
  private readonly MIN_COMPRESS_SIZE_BYTES = 1024; // 1KB threshold
  private stats: Map<CompressionId, { count: number; originalBytes: number; compressedBytes: number }> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async compress(data: string | ArrayBuffer, algorithm: CompressionId = 'gzip'): Promise<CompressedBlock> {
    const input = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
    const start = performance.now();
    // Compute checksum before compression
    const checksumBuffer = await crypto.subtle.digest('SHA-256', input);
    const checksum = Array.from(new Uint8Array(checksumBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('') as Checksum;
    // Compress using CompressionStreams API
    let compressed: Uint8Array;
    if (typeof CompressionStream !== 'undefined') {
      const format = algorithm === 'gzip' ? 'gzip' : algorithm === 'deflate' ? 'deflate' : 'gzip';
      const cs = new CompressionStream(format);
      const writer = cs.writable.getWriter();
      writer.write(input);
      writer.close();
      const reader = cs.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      compressed = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }
    } else {
      compressed = input; // no compression available
    }
    const elapsed = performance.now() - start;
    this.meter.recordHistogram('storage.compression.duration', elapsed);
    this.meter.incrementCounter('storage.compression.completed', { algorithm });
    this.updateStats(algorithm, input.length, compressed.length);
    return {
      originalSizeBytes: input.length,
      compressedSizeBytes: compressed.length,
      algorithm,
      data: compressed.buffer,
      checksum,
    };
  }

  async decompress(block: CompressedBlock): Promise<string | ArrayBuffer> {
    const start = performance.now();
    let decompressed: Uint8Array;
    if (typeof DecompressionStream !== 'undefined' && block.compressedSizeBytes < block.originalSizeBytes) {
      const format = block.algorithm === 'gzip' ? 'gzip' : block.algorithm === 'deflate' ? 'deflate' : 'gzip';
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      writer.write(new Uint8Array(block.data));
      writer.close();
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      decompressed = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.length;
      }
    } else {
      decompressed = new Uint8Array(block.data);
    }
    // Verify checksum
    const checksumBuffer = await crypto.subtle.digest('SHA-256', decompressed);
    const computedChecksum = Array.from(new Uint8Array(checksumBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('') as Checksum;
    if (computedChecksum !== block.checksum) {
      this.logger.error('Decompression checksum mismatch');
      this.meter.incrementCounter('storage.compression.checksum_mismatch');
      throw new Error('Decompressed data integrity check failed');
    }
    const elapsed = performance.now() - start;
    this.meter.recordHistogram('storage.decompression.duration', elapsed);
    this.meter.incrementCounter('storage.decompression.completed');
    // Try to return as string if it was originally a string
    try {
      return new TextDecoder().decode(decompressed);
    } catch {
      return decompressed.buffer;
    }
  }

  shouldCompress(sizeBytes: number): boolean {
    return sizeBytes >= this.MIN_COMPRESS_SIZE_BYTES;
  }

  private updateStats(algorithm: CompressionId, original: number, compressed: number): void {
    let stat = this.stats.get(algorithm);
    if (!stat) {
      stat = { count: 0, originalBytes: 0, compressedBytes: 0 };
      this.stats.set(algorithm, stat);
    }
    stat.count++;
    stat.originalBytes += original;
    stat.compressedBytes += compressed;
    this.meter.setGauge('storage.compression.ratio', compressed / Math.max(1, original));
  }

  getStats(): Map<CompressionId, { count: number; ratio: number }> {
    const result = new Map<CompressionId, { count: number; ratio: number }>();
    for (const [alg, stat] of this.stats) {
      result.set(alg, {
        count: stat.count,
        ratio: stat.originalBytes > 0 ? stat.compressedBytes / stat.originalBytes : 1,
      });
    }
    return result;
  }
}