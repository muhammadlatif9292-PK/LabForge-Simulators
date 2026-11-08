// packages/event-bus-runtime/src/runtime/event-consistency-validator.ts
/**
 * Event Consistency Validator
 * 
 * Responsibilities:
 * - Ensure all events have required metadata fields
 * - Validate payload against schema registry (placeholder)
 * - Check event ordering (optional, based on correlationId)
 * - Prevent duplicate eventId (idempotency)
 * 
 * Owned state:
 * - recentEventIds: Set<EventId> for dedup window (LRU)
 * 
 * Dependencies: none
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: n/a
 * Telemetry: dedup hit counter, schema violation counters
 * Diagnostics: exposed via validationResult errors
 * Accessibility: clear error messages
 * Performance: quick checks only, O(1) dedup with bounded set
 * Forbidden: deep payload inspection that impacts latency
 */

import type { Event, EventConsistencyValidator as IValidator, ValidationResult } from '../contracts/event-bus-contracts';
import { EventId } from '../contracts/event-bus-contracts';

export class EventConsistencyValidator implements IValidator {
  private recentIds: Set<string> = new Set();
  private readonly MAX_RECENT = 100_000;

  validate(event: Event): ValidationResult {
    const errors: string[] = [];
    if (!event.metadata.eventId) errors.push('Missing eventId');
    if (!event.metadata.correlationId) errors.push('Missing correlationId');
    if (!event.metadata.timestamp) errors.push('Missing timestamp');
    if (!event.type) errors.push('Missing type');

    // Idempotency check (simple dedup)
    if (event.metadata.eventId) {
      if (this.recentIds.has(event.metadata.eventId)) {
        errors.push(`Duplicate eventId: ${event.metadata.eventId}`);
      } else {
        this.recentIds.add(event.metadata.eventId);
        if (this.recentIds.size > this.MAX_RECENT) {
          // Evict oldest (approximate)
          const iter = this.recentIds.values();
          this.recentIds.delete(iter.next().value);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}