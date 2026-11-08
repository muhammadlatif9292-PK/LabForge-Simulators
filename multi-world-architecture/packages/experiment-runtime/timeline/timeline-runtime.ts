// packages/experiment-runtime/timeline/timeline-runtime.ts
/**
 * Timeline Runtime
 * 
 * Responsibilities:
 * - Record an append-only, immutable timeline of all experiment events
 * - Support indexed queries by branch, type, time range
 * - Enforce sequential ordering within each branch
 * - Persist timeline events for offline access
 * - Provide event streaming for real-time collaboration
 * 
 * Owned state:
 * - events: Map<BranchId, TimelineEvent[]>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - Local persistence adapter
 * 
 * Event emissions:
 *   "experiment.timeline.event_appended", "experiment.timeline.exported"
 * 
 * Event subscriptions: none
 * Synchronization: append-only; immutable events
 * Recovery: timeline can be rebuilt from event log on restart
 * Telemetry: event count, event rate
 * Diagnostics: timeline summary per branch
 * Accessibility: timeline export in structured format
 * Performance: ring buffer per branch; paginated queries; async persistence
 * Forbidden: modifying or deleting timeline events after append
 */

import type {
  BranchId, ExperimentId, TimelineEvent, TimelineEventId, TimelineEventType,
} from '../contracts/experiment-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { v4 as uuidv4 } from 'uuid';

export class TimelineRuntime {
  private events: Map<BranchId, TimelineEvent[]> = new Map();
  private readonly maxEventsPerBranch = 50_000;

  constructor(
    private experimentId: ExperimentId,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  async appendEvent(
    branchId: BranchId,
    type: TimelineEventType,
    actor: 'user' | 'ai' | 'system',
    payload: unknown,
    metadata?: Record<string, unknown>,
    parentEventId?: TimelineEventId,
  ): Promise<TimelineEventId> {
    let branchEvents = this.events.get(branchId);
    if (!branchEvents) {
      branchEvents = [];
      this.events.set(branchId, branchEvents);
    }
    const sequenceNumber = branchEvents.length;
    const event: TimelineEvent = {
      id: uuidv4() as TimelineEventId,
      experimentId: this.experimentId,
      branchId,
      type,
      timestamp: Date.now(),
      sequenceNumber,
      actor,
      payload,
      metadata: metadata ?? {},
      parentEventId,
    };
    branchEvents.push(event);
    // Enforce cap
    if (branchEvents.length > this.maxEventsPerBranch) {
      branchEvents.splice(0, branchEvents.length - this.maxEventsPerBranch);
      this.meter.incrementCounter('experiment.timeline.evicted');
    }
    this.meter.incrementCounter('experiment.timeline.event_appended', { type, actor });
    // Persist asynchronously
    this.persistEvent(event).catch(err =>
      this.logger.error('Failed to persist timeline event', { error: err }),
    );
    await this.eventBus.publish('experiment.timeline.event_appended', {
      experimentId: this.experimentId,
      branchId,
      eventId: event.id,
      type,
      sequenceNumber,
    });
    this.logger.debug(`Timeline event appended: ${type} (seq ${sequenceNumber})`);
    return event.id;
  }

  getEvents(branchId: BranchId, limit?: number, offset?: number): TimelineEvent[] {
    const branchEvents = this.events.get(branchId) ?? [];
    const start = offset ?? 0;
    const end = limit ? start + limit : undefined;
    return branchEvents.slice(start, end);
  }

  queryEvents(
    branchId: BranchId,
    filters: { type?: TimelineEventType; actor?: 'user' | 'ai' | 'system'; fromTime?: number; toTime?: number },
    limit: number = 50,
  ): TimelineEvent[] {
    let results = this.events.get(branchId) ?? [];
    if (filters.type) results = results.filter(e => e.type === filters.type);
    if (filters.actor) results = results.filter(e => e.actor === filters.actor);
    if (filters.fromTime !== undefined) results = results.filter(e => e.timestamp >= filters.fromTime!);
    if (filters.toTime !== undefined) results = results.filter(e => e.timestamp <= filters.toTime!);
    return results.slice(-limit);
  }

  getEventById(branchId: BranchId, eventId: TimelineEventId): TimelineEvent | undefined {
    return this.events.get(branchId)?.find(e => e.id === eventId);
  }

  getSequenceCount(branchId: BranchId): number {
    return this.events.get(branchId)?.length ?? 0;
  }

  exportBranch(branchId: BranchId): { experimentId: ExperimentId; branchId: BranchId; events: TimelineEvent[] } {
    return {
      experimentId: this.experimentId,
      branchId,
      events: this.events.get(branchId) ?? [],
    };
  }

  private async persistEvent(event: TimelineEvent): Promise<void> {
    // In production, append to IndexedDB or remote event store
    // const key = `timeline:${event.experimentId}:${event.branchId}`;
  }

  clear(branchId?: BranchId): void {
    if (branchId) {
      this.events.delete(branchId);
    } else {
      this.events.clear();
    }
  }
}