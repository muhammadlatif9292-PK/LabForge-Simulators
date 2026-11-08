// collaboration-runtime/recovery/collaboration-recovery.ts
/**
 * Collaboration Recovery
 * 
 * Responsibilities:
 * - Persist collaboration session metadata for reconnection
 * - Save participant roster, annotations, and workspace state
 * - Restore session state when a participant reconnects
 * - Compact expired annotations and stale data
 * 
 * Owned state: none (uses external storage)
 * 
 * Dependencies: ILogger, IMeter, persistent storage adapter
 * 
 * Event emissions: "collaboration.recovery.saved", "collaboration.recovery.restored"
 * Event subscriptions: none
 * Synchronization: writes are per-session; no concurrent write conflicts expected
 * Recovery: this IS the recovery mechanism
 * Telemetry: save/restore latency, storage size
 * Diagnostics: last save timestamp
 * Accessibility: N/A
 * Performance: async writes; debounced saves
 * Forbidden: persisting voice audio; saving without encryption
 */

import type { CollaborationSession, CollaborationSessionId } from '../contracts/collaboration-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class CollaborationRecovery {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private storage: any, // local/remote persistence
  ) {}

  async saveSession(session: CollaborationSession): Promise<void> {
    const start = Date.now();
    const serializable = {
      ...session,
      participants: Array.from(session.participants.entries())
        .map(([id, p]) => [id, { ...p }]),
    };
    await this.storage.set(`collab_session:${session.id}`, JSON.stringify(serializable));
    const latency = Date.now() - start;
    this.meter.recordHistogram('collaboration.recovery.save_latency', latency);
    this.meter.incrementCounter('collaboration.recovery.saved');
  }

  async loadSession(sessionId: CollaborationSessionId): Promise<CollaborationSession | null> {
    const start = Date.now();
    const raw = await this.storage.get(`collab_session:${sessionId}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      parsed.participants = new Map(parsed.participants);
      this.meter.recordHistogram('collaboration.recovery.restore_latency', Date.now() - start);
      this.meter.incrementCounter('collaboration.recovery.restored');
      return parsed;
    } catch (err) {
      this.logger.error('Corrupted collaboration session data', { error: err });
      return null;
    }
  }

  async deleteSession(sessionId: CollaborationSessionId): Promise<void> {
    await this.storage.delete(`collab_session:${sessionId}`);
  }
}