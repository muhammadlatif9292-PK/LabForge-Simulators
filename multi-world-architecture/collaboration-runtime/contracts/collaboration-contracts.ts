// collaboration-runtime/contracts/collaboration-contracts.ts
/**
 * Collaboration Runtime Contracts
 * 
 * Responsibilities:
 * - Define strict types for multiplayer collaboration: presence, sessions,
 *   annotations, voice, and shared workspace synchronization
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type CollaborationSessionId = string & { readonly __brand: 'CollaborationSessionId' };
export type ParticipantId = string & { readonly __brand: 'ParticipantId' };
export type AnnotationId = string & { readonly __brand: 'AnnotationId' };
export type VoiceChannelId = string & { readonly __brand: 'VoiceChannelId' };
export type WorkspaceObjectId = string & { readonly __brand: 'WorkspaceObjectId' };

export interface Participant {
  id: ParticipantId;
  userId: string;
  displayName: string;
  role: 'host' | 'co_host' | 'participant' | 'observer';
  status: 'online' | 'away' | 'busy' | 'offline';
  instrumentFocus?: string; // which instrument they're manipulating
  worldPosition?: [number, number, number];
  handRaised: boolean;
  muted: boolean;
  videoEnabled: boolean;
  joinedAt: number;
  lastActivity: number;
}

export interface CollaborationSession {
  id: CollaborationSessionId;
  worldId: string;
  hostId: ParticipantId;
  participants: Map<ParticipantId, Participant>;
  maxParticipants: number;
  state: 'lobby' | 'active' | 'paused' | 'ended';
  createdAt: number;
  settings: CollaborationSettings;
}

export interface CollaborationSettings {
  allowAnnotations: boolean;
  allowVoiceChat: boolean;
  allowInstrumentControl: boolean;
  requireRaiseHand: boolean;
  maxVoiceChannels: number;
}

export interface WorkspaceAnnotation {
  id: AnnotationId;
  authorId: ParticipantId;
  type: 'drawing' | 'text' | 'highlight' | 'measurement';
  targetObjectId?: WorkspaceObjectId;
  position: [number, number, number];
  color: string;
  content: string;
  createdAt: number;
  expiresAt?: number;
  visible: boolean;
}

export interface WorkspaceObject {
  id: WorkspaceObjectId;
  type: 'instrument' | 'sample' | 'note' | 'model';
  ownerId: ParticipantId;
  shared: boolean;
  lockedBy?: ParticipantId;
  transform: Float32Array;
  data: Record<string, unknown>;
  version: number;
}

export interface VoiceChannel {
  id: VoiceChannelId;
  sessionId: CollaborationSessionId;
  name: string;
  participants: Set<ParticipantId>;
  maxParticipants: number;
  active: boolean;
}

export interface CollaborationEvent {
  eventId: string;
  sessionId: CollaborationSessionId;
  type: 'participant_joined' | 'participant_left' | 'hand_raised' | 'hand_lowered'
      | 'annotation_added' | 'annotation_removed' | 'object_locked' | 'object_unlocked'
      | 'voice_channel_joined' | 'voice_channel_left' | 'mute_changed';
  participantId: ParticipantId;
  payload: unknown;
  timestamp: number;
}

export interface CollaborationHealth {
  sessionId: CollaborationSessionId;
  participantCount: number;
  activeAnnotations: number;
  voiceChannels: number;
  syncLatencyMs: number;
  status: 'healthy' | 'degraded' | 'partitioned';
}