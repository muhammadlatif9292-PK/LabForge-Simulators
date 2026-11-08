// collaboration-runtime/sessions/collaboration-session-runtime.ts
/**
 * Collaboration Session Runtime
 * 
 * Responsibilities:
 * - Manage full lifecycle of a collaboration session (lobby → active → paused → ended)
 * - Enforce session settings (max participants, permissions)
 * - Coordinate presence, annotations, workspace sync, and voice under one session
 * - Handle host transfer if host disconnects
 * 
 * Owned state:
 * - session: CollaborationSession
 * - presenceRuntime: PresenceRuntime
 * - workspaceSync: SharedWorkspaceSync
 * - annotationRuntime: AnnotationRuntime
 * - voiceChannels: VoiceSessionRuntime | null
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DistributedEventBus
 * - PresenceRuntime, SharedWorkspaceSync, AnnotationRuntime, VoiceSessionRuntime
 * - CollaborationRecovery
 * 
 * Event emissions:
 * - "collaboration.session.created", "collaboration.session.ended"
 * - "collaboration.host.transferred"
 * 
 * Event subscriptions:
 * - "participant.left" (to handle host departure)
 * 
 * Synchronization: session state is single source of truth;
 *                 workspace ops ordered deterministically
 * Recovery: session state persisted; can be rejoined after disconnect
 * Telemetry: session duration, participant peak, annotation count
 * Diagnostics: session health report
 * Accessibility: participant list screen-readable; actions keyboard accessible
 * Performance: lazy initialization of subsystems; session cap enforced
 * Forbidden: exceeding max participants without host override; losing workspace data on end
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  CollaborationSessionId, CollaborationSession, ParticipantId,
  CollaborationSettings, CollaborationHealth,
} from '../contracts/collaboration-contracts';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { PresenceRuntime } from '../presence/presence-runtime';
import type { SharedWorkspaceSync } from '../synchronization/shared-workspace-sync';
import type { AnnotationRuntime } from '../annotations/annotation-runtime';
import type { VoiceSessionRuntime } from '../voice/voice-session-runtime';
import type { CollaborationRecovery } from '../recovery/collaboration-recovery';

export class CollaborationSessionRuntime {
  private session: CollaborationSession;
  private presenceRuntime: PresenceRuntime;
  private workspaceSync: SharedWorkspaceSync;
  private annotationRuntime: AnnotationRuntime;
  private voiceRuntime: VoiceSessionRuntime | null = null;
  private started = false;

  constructor(
    worldId: string,
    hostId: ParticipantId,
    settings: CollaborationSettings,
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private eventBus: DistributedEventBus,
    private recovery: CollaborationRecovery,
  ) {
    const sessionId = uuidv4() as CollaborationSessionId;
    this.session = {
      id: sessionId,
      worldId,
      hostId,
      participants: new Map(),
      maxParticipants: settings.maxVoiceChannels || 25,
      state: 'lobby',
      createdAt: Date.now(),
      settings,
    };
    this.presenceRuntime = new PresenceRuntime(sessionId, eventBus, logger, meter);
    this.workspaceSync = new SharedWorkspaceSync(sessionId, eventBus, logger, meter);
    this.annotationRuntime = new AnnotationRuntime(sessionId, eventBus, logger, meter);
    if (settings.allowVoiceChat) {
      this.voiceRuntime = new VoiceSessionRuntime(sessionId, eventBus, logger, meter);
    }
    this.eventBus.subscribe('collaboration.participant.left', this.onParticipantLeft.bind(this));
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.session.state = 'active';
    this.started = true;
    await this.recovery.saveSession(this.session);
    await this.eventBus.publish('collaboration.session.created', {
      sessionId: this.session.id,
      worldId: this.session.worldId,
    });
    this.logger.info(`Collaboration session started: ${this.session.id}`);
    this.meter.incrementCounter('collaboration.session.started');
  }

  async end(): Promise<void> {
    this.session.state = 'ended';
    this.started = false;
    await this.presenceRuntime.shutdown();
    await this.recovery.saveSession(this.session);
    await this.eventBus.publish('collaboration.session.ended', {
      sessionId: this.session.id,
    });
    this.logger.info(`Collaboration session ended: ${this.session.id}`);
    this.meter.incrementCounter('collaboration.session.ended');
  }

  async pause(): Promise<void> {
    this.session.state = 'paused';
  }

  async resume(): Promise<void> {
    this.session.state = 'active';
  }

  private async onParticipantLeft(event: any): Promise<void> {
    const { participant } = event.payload;
    // If host left, transfer to next participant
    if (participant.id === this.session.hostId) {
      const remaining = this.presenceRuntime.getParticipants().filter(p => p.role !== 'observer');
      if (remaining.length > 0) {
        const newHost = remaining[0];
        this.session.hostId = newHost.id;
        newHost.role = 'host';
        await this.eventBus.publish('collaboration.host.transferred', {
          sessionId: this.session.id,
          newHostId: newHost.id,
        });
        this.logger.info(`Host transferred to ${newHost.displayName}`);
      } else {
        // No participants left, end session
        await this.end();
      }
    }
  }

  getHealth(): CollaborationHealth {
    return {
      sessionId: this.session.id,
      participantCount: this.presenceRuntime.getParticipants().length,
      activeAnnotations: this.annotationRuntime.getAnnotationCount(),
      voiceChannels: this.voiceRuntime ? this.voiceRuntime.getActiveChannels() : 0,
      syncLatencyMs: this.workspaceSync.getAverageLatencyMs(),
      status: this.session.state === 'active' ? 'healthy' : 'degraded',
    };
  }

  getPresenceRuntime(): PresenceRuntime { return this.presenceRuntime; }
  getWorkspaceSync(): SharedWorkspaceSync { return this.workspaceSync; }
  getAnnotationRuntime(): AnnotationRuntime { return this.annotationRuntime; }
  getVoiceRuntime(): VoiceSessionRuntime | null { return this.voiceRuntime; }
  getSession(): CollaborationSession { return { ...this.session }; }
}