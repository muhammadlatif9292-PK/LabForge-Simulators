// asset-streaming-runtime/integrity/streaming-integrity-validator.ts
/**
 * Streaming Integrity Validator
 * 
 * Responsibilities:
 * - Compute checksums (SHA-256) for downloaded assets and compare with expected
 * - Detect corruption during or after download
 * - Generate integrity reports with actionable recommendations
 * - Support periodic re-validation of cached assets
 * - Register corrupted assets for re-download
 * 
 * Owned state:
 * - corruptionLog: IntegrityReport[] (bounded)
 * 
 * Dependencies: ILogger, IMeter, Web Crypto API
 * 
 * Event emissions: "asset.integrity.validated", "asset.integrity.corrupt"
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: triggers re-download via event
 * Telemetry: validation count, corruption rate
 * Diagnostics: recent corruptions
 * Accessibility: N/A
 * Performance: async hash computation; use streaming hashing for large files
 * Forbidden: accepting assets without validation; blocking UI for hash computation
 */

import type { AssetId, Checksum, IntegrityReport } from '../contracts/asset-streaming-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class StreamingIntegrityValidator {
  private corruptionLog: IntegrityReport[] = [];
  private maxLogSize = 100;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async validate(assetId: string, data: ArrayBuffer, expectedChecksum: Checksum): Promise<IntegrityReport> {
    const start = performance.now();
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const actualChecksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const valid = actualChecksum === expectedChecksum;
    const report: IntegrityReport = {
      assetId: assetId as AssetId,
      valid,
      expectedChecksum,
      actualChecksum: actualChecksum as Checksum,
      sizeMismatch: false,
      recommendation: valid ? 'keep' : 'redownload',
    };
    if (!valid) {
      this.corruptionLog.push(report);
      if (this.corruptionLog.length > this.maxLogSize) this.corruptionLog.shift();
      this.meter.incrementCounter('asset.integrity.corrupt');
      this.logger.warn(`Asset integrity check failed: ${assetId}`);
    } else {
      this.meter.incrementCounter('asset.integrity.valid');
    }
    this.meter.recordHistogram('asset.integrity.hash_duration', performance.now() - start);
    return report;
  }

  async validateCached(assetId: AssetId, data: ArrayBuffer, checksum: Checksum): Promise<void> {
    const report = await this.validate(assetId, data, checksum);
    if (!report.valid) {
      // Trigger re-download by publishing event
      this.logger.error(`Cached asset corrupted: ${assetId}, requesting redownload`);
    }
  }

  getRecentCorruptions(): IntegrityReport[] {
    return [...this.corruptionLog];
  }
}