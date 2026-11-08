// infrastructure/database/src/vector-memory/semantic-memory-index.ts
/**
 * Semantic Memory Index
 * 
 * Responsibilities:
 * - Index vector embeddings for similarity search
 * - Support insertion, deletion, and re-indexing
 * - Use approximate nearest neighbor (ANN) algorithm for performance
 * - Provide metadata filtering alongside vector search
 * 
 * Owned state:
 * - index structure (e.g., in-memory HNSW graph)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - Vector database adapter (injected)
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none for reads; write lock during bulk index
 * Recovery: rebuild index from persistent store if lost
 * Telemetry: index size, query latency
 * Diagnostics: index statistics
 * Accessibility: N/A
 * Performance: supports incremental updates; background compaction
 * Forbidden: blocking reads during index update; excessive memory usage
 */

import type { VectorRecord } from '../contracts/database-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class SemanticMemoryIndex {
  private vectors: VectorRecord[] = [];
  private indexBuilt = false;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private dimensions: number,
  ) {}

  async addRecord(record: VectorRecord): Promise<void> {
    this.vectors.push(record);
    this.indexBuilt = false; // invalidate index
    this.meter.incrementCounter('database.vector.added');
  }

  async buildIndex(): Promise<void> {
    // Build ANN index (simplified: sort by nothing)
    // In reality, build HNSW or IVF
    this.indexBuilt = true;
    this.meter.incrementCounter('database.vector.index_built');
    this.logger.debug('Semantic index built');
  }

  async search(queryVector: number[], topK: number = 10, filterMetadata?: Record<string, unknown>): Promise<VectorRecord[]> {
    if (!this.indexBuilt) await this.buildIndex();
    // Naive linear scan; replace with ANN
    let results = this.vectors.filter(v => {
      if (filterMetadata) {
        for (const key in filterMetadata) {
          if (v.metadata[key] !== filterMetadata[key]) return false;
        }
      }
      return true;
    }).map(v => ({
      record: v,
      similarity: this.cosineSimilarity(queryVector, v.vector),
    }));
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK).map(r => r.record);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] ** 2;
      normB += b[i] ** 2;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async deleteRecord(id: string): Promise<void> {
    this.vectors = this.vectors.filter(v => v.id !== id);
    this.indexBuilt = false;
  }
}