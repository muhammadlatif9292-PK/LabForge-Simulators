// collaboration-runtime/voice/voice-session-runtime.ts
/**
 * Voice Session Runtime
 * 
 * Responsibilities:
 * - Manage voice channels within a collaboration session
 * - Handle participant join/leave for voice channels
 * - Enforce mute/unmute permissions and push-to-talk
 * - Coordinate with WebRTC or server-side voice mixing infrastructure
 * - Provide voice activity detection for HUD indicators
 * 
 * Owned state:
 * - channels: Map<VoiceChannelId, VoiceChannel>
 * - participantChannels: Map<ParticipantId, VoiceChannelId>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - WebRTC infrastructure (signaling abstraction)
 * 
 * Event emissions:
 * - "voice.channel.created", "voice.channel.removed"
 * - "voice.participant.joined", "voice.participant.left"
 * - "voice.activity" (when participant speaks)
 * 
 * Event subscriptions:
 * - "collaboration.participant.left" (to remove from voice)
 * 
 * Synchronization: voice state is signaling-only; media is peer-to-peer
 * Recovery: channels recreated on rejoin; media renegotiated
 * Telemetry: active channels, participant speaking time
 * Diagnostics: channel membership, mute state
 * Accessibility: visual indicators for speaking/muted
 * Performance: no media processing in this runtime; signaling only
 * Forbidden: recording without consent; transmitting without mute awareness
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  VoiceChannelId, VoiceChannel, ParticipantId, CollaborationSessionId,
} from '../contracts/collaboration-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class VoiceSessionRuntime {
  private channels: Map<VoiceChannelId, VoiceChannel> = new Map();
  private participantMapping: Map<ParticipantId, VoiceChannelId> = new Map();
  private sessionId: CollaborationSessionId;

  constructor(
    sessionId: CollaborationSessionId,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.sessionId = sessionId;
    this.createDefaultChannel();
    this.eventBus.subscribe('collaboration.participant.left', this.onParticipantLeft.bind(this));
  }

  private createDefaultChannel(): void {
    const id = uuidv4() as VoiceChannelId;
    this.channels.set(id, {
      id,
      sessionId: this.sessionId,
      name: 'Main',
      participants: new Set(),
      maxParticipants: 50,
      active: true,
    });
  }

  async joinChannel(participantId: ParticipantId, channelId?: VoiceChannelId): Promise<VoiceChannel> {
    // Remove from any existing channel first
    await this.leaveChannel(participantId);
    const targetId = channelId ?? this.channels.keys().next().value as VoiceChannelId;
    const channel = this.channels.get(targetId);
    if (!channel) throw new Error('Voice channel not found');
    if (channel.participants.size >= channel.maxParticipants) {
      throw new Error('Voice channel full');
    }
    channel.participants.add(participantId);
    this.participantMapping.set(participantId, targetId);
    await this.eventBus.publish('voice.participant.joined', {
      sessionId: this.sessionId,
      channelId: targetId,
      participantId,
    });
    this.meter.incrementCounter('voice.participant.joined');
    return channel;
  }

  async leaveChannel(participantId: ParticipantId): Promise<void> {
    const channelId = this.participantMapping.get(participantId);
    if (!channelId) return;
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.participants.delete(participantId);
    }
    this.participantMapping.delete(participantId);
    await this.eventBus.publish('voice.participant.left', {
      sessionId: this.sessionId,
      channelId,
      participantId,
    });
    this.meter.incrementCounter('voice.participant.left');
  }

  reportVoiceActivity(participantId: ParticipantId, isSpeaking: boolean): void {
    if (isSpeaking) {
      this.eventBus.publish('voice.activity', {
        sessionId: this.sessionId,
        participantId,
        timestamp: Date.now(),
      });
    }
  }

  getActiveChannels(): number {
    return this.channels.size;
  }

  getParticipantsInChannel(channelId: VoiceChannelId): ParticipantId[] {
    const channel = this.channels.get(channelId);
    return channel ? Array.from(channel.participants) : [];
  }

  getChannelForParticipant(participantId: ParticipantId): VoiceChannelId | undefined {
    return this.participantMapping.get(participantId);
  }

  private async onParticipantLeft(event: any): Promise<void> {
    const participantId = event.payload.participant?.id;
    if (participantId) {
      await this.leaveChannel(participantId);
    }
  }
}