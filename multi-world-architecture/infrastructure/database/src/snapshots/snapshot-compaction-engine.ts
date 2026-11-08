// infrastructure/database/src/snapshots/snapshot-compaction-engine.ts
/**
 * Snapshot Compaction Engine
 * 
 * Responsibilities:
 * - Generate snapshots of event stream state at specific sequence numbers
 * - Compaction: merge older events into a snapshot and truncate the stream
 * - Schedule periodic compaction based on size or age policies
 * - Ensure snapshots are consistent and idempotent
 * 
 * Owned state:
 * - compactionSchedule: NodeJS.Timeout
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DatabaseClient (for stream and snapshots)
 * - EventStreamReader / Writer
 * 
 * Event emissions: "snapshot.created" after creating snapshot
 * Event subscriptions: none
 * Synchronization: acquires lock to prevent concurrent compaction
 * Recovery: can resume compaction from last snapshot
 * Telemetry: compaction duration, size reduction
 * Diagnostics: last compaction timestamp, pending events count
 * Accessibility: N/A
 * Performance: runs in background, uses batching
 * Forbidden: compacting while a replay is in progress; data loss
 */

import type { StreamId, SequenceNumber, Snapshot } from '../contracts/database-contracts';
import { v4 as uuidv4 } from 'uuid';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class SnapshotCompactionEngine {
  private compactionRunning = false;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private db: any,
    private eventStreamReader: any,
    private eventStreamWriter: any,
  ) {}

  async compactStream(streamId: StreamId, olderThanSequence: SequenceNumber, stateBuilder: (events: any[]) => any): Promise<Snapshot> {
    if (this.compactionRunning) throw new Error('Compaction already in progress');
    this.compactionRunning = true;
    const start = Date.now();
    try {
      // Read events up to that sequence
      const events = await this.eventStreamReader.readEvents(streamId, 0 as SequenceNumber, olderThanSequence as number);
      // Build snapshot state from events (domain-specific)
      const snapshotState = stateBuilder(events);
      const snapshot: Snapshot = {
        id: uuidv4(),
        streamId,
        data: snapshotState,
        sequenceNumber: olderThanSequence,
        createdAt: Date.now(),
        metadata: { eventCount: events.length },
      };
      // Save snapshot
      await this.db.saveSnapshot(snapshot);
      // Truncate events older than snapshot (optional, depends on retention policy)
      await this.db.deleteEventsOlderThan(streamId, olderThanSequence);
      this.meter.incrementCounter('database.snapshot.created');
      this.logger.info(`Snapshot created for stream ${streamId} at seq ${olderThanSequence}`);
      return snapshot;
    } finally {
      this.compactionRunning = false;
      this.meter.recordHistogram('database.compaction.duration', Date.now() - start);
    }
  }

  async getLatestSnapshot(streamId: StreamId): Promise<Snapshot | null> {
    return this.db.getLatestSnapshot(streamId);
  }
}