// worlds/chemistry-world/chemistry-world-memory-manager.ts
/**
 * Chemistry World Memory Manager
 * 
 * Responsibilities:
 * - Track memory usage specific to the chemistry world (entities, substances, reaction cache)
 * - Enforce a budget to prevent OOM with many chemical entities
 * - Coordinate with the global mobile memory manager
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class ChemistryWorldMemoryManager {
  private entityBytes = 0;
  private readonly maxEntityMemory = 50 * 1024 * 1024; // 50 MB

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  trackEntity(bytes: number): boolean {
    if (this.entityBytes + bytes > this.maxEntityMemory) {
      this.logger.warn('Chemistry world entity memory budget exceeded');
      return false;
    }
    this.entityBytes += bytes;
    this.meter.setGauge('chemistry.world.memory_entity_bytes', this.entityBytes);
    return true;
  }

  releaseEntity(bytes: number): void {
    this.entityBytes = Math.max(0, this.entityBytes - bytes);
    this.meter.setGauge('chemistry.world.memory_entity_bytes', this.entityBytes);
  }

  getUsageBytes(): number {
    return this.entityBytes;
  }
}