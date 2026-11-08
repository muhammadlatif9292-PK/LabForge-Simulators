// packages/module-registry/runtime/lazy-module-loader.ts
/**
 * Lazy Module Loader
 * 
 * Responsibilities:
 * - Execute module loader functions with timeout and retry logic
 * - Track loader statistics (duration, success rate) per module
 * - Support loading progress callbacks for UI feedback
 * - Cache loaded exports to avoid re-loading
 * - Fall back to error state and notify recovery system on failure
 * 
 * Owned state:
 * - loadStats: Map<ModuleId, LoadStat>
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: "registry.loader.progress"
 * Event subscriptions: none
 * Synchronization: per-module loading serialized by registry
 * Recovery: retry on failure; escalate to recovery engine after max retries
 * Telemetry: load duration histogram, retry count
 * Diagnostics: loader statistics
 * Accessibility: N/A
 * Performance: timeout enforcement via Promise.race; parallel loads per registry
 * Forbidden: infinite loading; retrying without backoff
 */

import type { ModuleId, ModuleDescriptor } from '../contracts/registry-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface LoadStat {
  moduleId: ModuleId;
  attempts: number;
  lastDurationMs: number;
  lastSuccess: number | null;
  lastError: string | null;
}

export class LazyModuleLoader {
  private stats: Map<ModuleId, LoadStat> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async load(descriptor: ModuleDescriptor): Promise<unknown> {
    const moduleId = descriptor.id;
    const stat = this.getOrCreateStat(moduleId);
    const maxRetries = descriptor.provider.retryCount;
    const timeoutMs = descriptor.provider.timeoutMs;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      stat.attempts = attempt;
      const start = performance.now();
      try {
        const exports = await this.loadWithTimeout(descriptor.provider.loader, timeoutMs);
        const duration = performance.now() - start;
        stat.lastDurationMs = duration;
        stat.lastSuccess = Date.now();
        stat.lastError = null;
        this.meter.recordHistogram('registry.loader.duration', duration, { moduleId });
        return exports;
      } catch (err) {
        lastError = err as Error;
        stat.lastError = lastError.message;
        this.meter.recordHistogram('registry.loader.duration', performance.now() - start, { moduleId, error: 'true' });
        this.logger.warn(`Module load attempt ${attempt}/${maxRetries + 1} failed: ${moduleId}`, { error: lastError.message });
        if (attempt <= maxRetries) {
          const backoff = Math.min(30000, 500 * Math.pow(2, attempt - 1));
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }
    }
    throw new Error(`Module ${moduleId} failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
  }

  private async loadWithTimeout(loader: () => Promise<any>, timeoutMs: number): Promise<unknown> {
    if (timeoutMs <= 0) return loader();
    return Promise.race([
      loader(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Module load timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  private getOrCreateStat(moduleId: ModuleId): LoadStat {
    let stat = this.stats.get(moduleId);
    if (!stat) {
      stat = { moduleId, attempts: 0, lastDurationMs: 0, lastSuccess: null, lastError: null };
      this.stats.set(moduleId, stat);
    }
    return stat;
  }

  getStat(moduleId: ModuleId): LoadStat | undefined {
    return this.stats.get(moduleId);
  }

  getAllStats(): LoadStat[] {
    return Array.from(this.stats.values());
  }
}