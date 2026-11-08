// packages/synchronization/src/runtime/distributed-state-validator.ts
/**
 * Distributed State Validator
 * 
 * Responsibilities:
 * - Validate that a state transition produces the expected hash
 * - Detect divergent states across nodes
 * - Trigger recovery if corruption is detected
 * 
 * Owned state:
 * - expectedHashes: Map<number, string>
 * 
 * Dependencies: ILogger, IMeter
 */

import { createHash } from 'crypto';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class DistributedStateValidator {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  validateState(serialized: string, expectedHash: string): boolean {
    const actual = createHash('sha256').update(serialized).digest('hex').substring(0, 16);
    const valid = actual === expectedHash;
    if (!valid) {
      this.logger.warn('State hash mismatch');
      this.meter.incrementCounter('state.validator.mismatch');
    }
    return valid;
  }

  computeHash(data: string): string {
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }
}