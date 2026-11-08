// packages/storage-runtime/integrity/cache-integrity-validator.ts
/**
 * Cache Integrity Validator
 * 
 * Responsibilities:
 * - Compute and verify checksums for stored data
 * - Periodically scan storage for corruption
 * - Generate integrity reports with repair recommendations
 * - Track corruption statistics for observability
 * 
 * Owned state:
 * - corruptionLog: IntegrityReport[]
 * 
 * Dependencies: ILogger, IMeter, Web Crypto API
 * 
 * Event emissions: "storage.integrity.checked", "storage.integrity.corrupt"
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: triggers re-download or re-fetch of corrupted data
 * Telemetry: corruption count, scan duration
 * Diagnostics: recent corruption reports
 * Accessibility: N/A
 * Performance: async hash computation; doesn't block storage operations
 * Forbidden: corrupting data during integrity check; false positives
 */

import type { StorageKey, Checksum, IntegrityReport } from '../contracts/storage-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class CacheIntegrityValidator {
  private corruptionReports: IntegrityReport[] = [];
  private maxReports = 200;
  private corruptionCount = 0;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async computeChecksum(data: string | ArrayBuffer): Promise<Checksum> {
    const start = performance.now();
    const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('') as Checksum;
    this.meter.recordHistogram('storage.integrity.checksum.duration', performance.now() - start);
    return checksum;
  }

  async validate(key: StorageKey, data: string | ArrayBuffer, expectedChecksum: Checksum): Promise<IntegrityReport> {
    const start = Date.now();
    const actualChecksum = await this.computeChecksum(data);
    const valid = actualChecksum === expectedChecksum;
    const report: IntegrityReport = {
      valid,
      key,
      expectedChecksum,
      actualChecksum,
      timestamp: Date.now(),
      recommendation: valid ? 'keep' : 'repair',
    };
    if (!valid) {
      this.corruptionReports.push(report);
      this.corruptionCount++;
      if (this.corruptionReports.length > this.maxReports) {
        this.corruptionReports.shift();
      }
      this.logger.warn(`Data corruption detected for key: ${key}`);
      this.meter.incrementCounter('storage.integrity.corrupt');
    }
    this.meter.recordHistogram('storage.integrity.validate.duration', Date.now() - start);
    this.meter.incrementCounter('storage.integrity.checked');
    return report;
  }

  getCorruptionCount(): number {
    return this.corruptionCount;
  }

  getRecentCorruptions(limit: number = 20): IntegrityReport[] {
    return this.corruptionReports.slice(-limit);
  }

  async periodicScan(keys: StorageKey[], readFn: (key: StorageKey) => Promise<{ data: string | ArrayBuffer; checksum: Checksum } | null>): Promise<IntegrityReport[]> {
    const results: IntegrityReport[] = [];
    for (const key of keys) {
      const entry = await readFn(key);
      if (!entry) continue;
      const report = await this.validate(key, entry.data, entry.checksum);
      results.push(report);
    }
    this.logger.info(`Periodic scan completed: ${results.length} keys checked, ${results.filter(r => !r.valid).length} corrupted`);
    return results;
  }
}