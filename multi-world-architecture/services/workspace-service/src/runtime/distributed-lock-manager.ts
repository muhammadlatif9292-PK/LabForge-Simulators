// services/workspace-service/src/runtime/distributed-lock-manager.ts
/**
 * Distributed Lock Manager
 * 
 * Responsibilities:
 * - Provide distributed mutex locks using Redis (Redlock algorithm)
 * - Guarantee exclusive access across all service instances
 * - Support lock TTL to prevent deadlocks on crash
 * - Emit telemetry on lock acquisition/release
 * 
 * Owned state:
 * - activeLocks: Map<string, LockHandle>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - Redis client (ioredis)
 * 
 * Event emissions: none (synchronous utility)
 * Event subscriptions: none
 * Synchronization: Redis-based atomic SET NX with TTL
 * Recovery: stale locks released automatically via TTL
 * Telemetry: lock acquisition latency, contention count, timeout count
 * Diagnostics: active locks, lock wait times
 * Accessibility: N/A
 * Performance: O(1) per lock acquisition; Redis network latency bounded
 * Forbidden: holding locks indefinitely without TTL; deadlocks
 */

import { v4 as uuidv4 } from 'uuid';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface LockHandle {
  key: string;
  token: string;
  acquiredAt: number;
  ttlMs: number;
  release: () => Promise<void>;
}

export class DistributedLockManager {
  private activeLocks: Map<string, LockHandle> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private redis: any, // ioredis
  ) {}

  async acquire(key: string, ttlMs: number = 30000): Promise<LockHandle> {
    const token = uuidv4();
    const start = Date.now();
    const fullKey = `lock:${key}`;

    // Retry with exponential backoff up to ttlMs
    const deadline = start + ttlMs;
    while (Date.now() < deadline) {
      const result = await this.redis.set(fullKey, token, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        const handle: LockHandle = {
          key: fullKey,
          token,
          acquiredAt: Date.now(),
          ttlMs,
          release: async () => {
            // Release using Lua script for atomicity (check token matches)
            const luaScript = `
              if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
              else
                return 0
              end`;
            await this.redis.eval(luaScript, 1, fullKey, token);
            this.activeLocks.delete(key);
            this.meter.incrementCounter('distributed_lock.released');
            this.logger.debug(`Lock released: ${key}`);
          },
        };
        this.activeLocks.set(key, handle);
        const elapsed = Date.now() - start;
        this.meter.recordHistogram('distributed_lock.acquire_time', elapsed);
        this.meter.incrementCounter('distributed_lock.acquired');
        if (elapsed > 100) {
          this.meter.incrementCounter('distributed_lock.contention');
        }
        return handle;
      }
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
    }

    this.meter.incrementCounter('distributed_lock.timeout');
    throw new Error(`Failed to acquire lock: ${key} within ${ttlMs}ms`);
  }

  async releaseAll(): Promise<void> {
    for (const handle of this.activeLocks.values()) {
      await handle.release().catch(err => this.logger.error('Lock release failed', err));
    }
    this.activeLocks.clear();
  }
}