// collaboration-runtime/presence/presence-runtime.ts
/**
 * Presence Runtime
 * 
 * Responsibilities:
 * - Track real-time presence of all participants in a collaboration session
 * - Manage participant lifecycle: join, leave, status changes, hand raises
 * - Broadcast presence updates to all session participants
 * - Detect stale presences and clean up ghost participants
 * - Support presence-based features (hand raise queue, instrument focus indicators)
 * 
 * Owned state:
 * - participants: Map<ParticipantId, Participant>
 * - handRaiseQueue: ParticipantId[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (for real-time presence broadcast)
 * - DistributedPresenceEngine (from realtime-service)
 * 
 * Event emissions:
 * - "collaboration.participant.joined", "collaboration.participant.left"
 * - "collaboration.hand.raised", "collaboration.hand.lowered"
 * - "collaboration.presence.updated"
 * 
 * Event subscriptions:
 * - "presence.heartbeat" (from WebSocket layer)
 * 
 * Synchronization: last-writer-wins per participant; heartbeats maintain liveness
 * Recovery: presence rebuilt from active connections on restart
 * Telemetry: participant count, churn rate, hand raise frequency
 * Diagnostics: participant list, stale presence count
 * Accessibility: N/A
 * Performance: heartbeat debouncing; batch presence updates
 * Forbidden: leaking participant IPs or private data; ghost participants indefinitely
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ParticipantId, Participant, CollaborationSessionId,
} from '../contracts/collaboration-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class PresenceRuntime {
  private participants: Map<ParticipantId, Participant> = new Map();
  private handRaiseQueue: ParticipantId[] = [];
  private sessionId: CollaborationSessionId;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly STALE_TIMEOUT_MS = 30_000;

  constructor(
    sessionId: CollaborationSessionId,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.sessionId = sessionId;
    this.heartbeatInterval = setInterval(() => this.cleanupStale(), 10_000);
  }

  async joinParticipant(userId: string, displayName: string, role: Participant['role'] = 'participant'): Promise<Participant> {
    const id = uuidv4() as ParticipantId;
    const participant: Participant = {
      id,
      userId,
      displayName,
      role,
      status: 'online',
      handRaised: false,
      muted: true,
      videoEnabled: false,
      joinedAt: Date.now(),
      lastActivity: Date.now(),
    };
    this.participants.set(id, participant);
    this.meter.setGauge('collaboration.participant_count', this.participants.size);
    this.meter.incrementCounter('collaboration.participant.joined');
    await this.eventBus.publish('collaboration.participant.joined', {
      sessionId: this.sessionId,
      participant: this.sanitize(participant),
    });
    await this.broadcastPresence();
    this.logger.info(`Participant joined: ${displayName} (${id})`);
    return participant;
  }

  async leaveParticipant(participantId: ParticipantId): Promise<void> {
    const participant = this.participants.get(participantId);
    if (!participant) return;
    this.participants.delete(participantId);
    this.handRaiseQueue = this.handRaiseQueue.filter(id => id !== participantId);
    participant.status = 'offline';
    this.meter.setGauge('collaboration.participant_count', this.participants.size);
    this.meter.incrementCounter('collaboration.participant.left');
    await this.eventBus.publish('collaboration.participant.left', {
      sessionId: this.sessionId,
      participant: this.sanitize(participant),
    });
    await this.broadcastPresence();
    this.logger.info(`Participant left: ${participant.displayName}`);
  }

  async updateStatus(participantId: ParticipantId, status: Partial<Pick<Participant, 'status' | 'muted' | 'instrumentFocus' | 'worldPosition'>>): Promise<void> {
    const participant = this.participants.get(participantId);
    if (!participant) return;
    Object.assign(participant, status);
    participant.lastActivity = Date.now();
    await this.broadcastPresence();
  }

  async raiseHand(participantId: ParticipantId): Promise<void> {
    const participant = this.participants.get(participantId);
    if (!participant || participant.handRaised) return;
    participant.handRaised = true;
    this.handRaiseQueue.push(participantId);
    this.meter.incrementCounter('collaboration.hand.raised');
    await this.eventBus.publish('collaboration.hand.raised', {
      sessionId: this.sessionId,
      participantId,
    });
    await this.broadcastPresence();
  }

  async lowerHand(participantId: ParticipantId): Promise<void> {
    const participant = this.participants.get(participantId);
    if (!participant || !participant.handRaised) return;
    participant.handRaised = false;
    this.handRaiseQueue = this.handRaiseQueue.filter(id => id !== participantId);
    this.meter.incrementCounter('collaboration.hand.lowered');
    await this.eventBus.publish('collaboration.hand.lowered', {
      sessionId: this.sessionId,
      participantId,
    });
    await this.broadcastPresence();
  }

  getRaiseHandQueue(): ParticipantId[] {
    return [...this.handRaiseQueue];
  }

  getParticipants(): Participant[] {
    return Array.from(this.participants.values()).map(p => this.sanitize(p));
  }

  getParticipant(participantId: ParticipantId): Participant | undefined {
    const p = this.participants.get(participantId);
    return p ? this.sanitize(p) : undefined;
  }

  private async broadcastPresence(): Promise<void> {
    const presenceList = this.getParticipants();
    await this.eventBus.publish('collaboration.presence.updated', {
      sessionId: this.sessionId,
      participants: presenceList,
    });
  }

  private cleanupStale(): void {
    const now = Date.now();
    for (const [id, participant] of this.participants) {
      if (now - participant.lastActivity > this.STALE_TIMEOUT_MS) {
        this.logger.warn(`Stale participant removed: ${participant.displayName}`);
        this.leaveParticipant(id).catch(err => this.logger.error('Cleanup failed', err));
      }
    }
  }

  private sanitize(p: Participant): Participant {
    // Remove sensitive fields before broadcasting
    return { ...p, userId: p.userId.substring(0, 4) + '...' };
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    for (const [id] of this.participants) {
      await this.leaveParticipant(id);
    }
  }
}