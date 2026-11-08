// audio-runtime/contracts/audio-contracts.ts
/**
 * Audio Runtime Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for spatial audio, ambient soundscapes,
 *   voice communication audio, and audio recovery
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

export type AudioSourceId = string & { readonly __brand: 'AudioSourceId' };
export type AudioListenerId = string & { readonly __brand: 'AudioListenerId' };
export type AmbientZoneId = string & { readonly __brand: 'AmbientZoneId' };
export type VoiceStreamId = string & { readonly __brand: 'VoiceStreamId' };

export enum AudioSourceType {
  INSTRUMENT = 'instrument',
  AMBIENT = 'ambient',
  VOICE = 'voice',
  UI = 'ui',
  NARRATION = 'narration',
}

export enum AudioSpatialModel {
  POINT = 'point',
  AREA = 'area',
  GLOBAL = 'global',
}

export interface AudioSourceDescriptor {
  id: AudioSourceId;
  type: AudioSourceType;
  buffer: AudioBuffer | null;           // loaded audio data
  url?: string;                          // if streaming
  spatialModel: AudioSpatialModel;
  position: [number, number, number];
  radius?: number;                       // for area sources
  volume: number;                        // 0-1
  pitch: number;                         // playback rate
  loop: boolean;
  autoPlay: boolean;
  priority: number;                      // higher = less likely to be culled
  maxInstances: number;                  // max concurrent playbacks
}

export interface AudioListenerState {
  id: AudioListenerId;
  position: [number, number, number];
  orientation: [number, number, number, number, number, number]; // forward + up
  velocity: [number, number, number];
  worldId: string;
}

export interface AmbientZone {
  id: AmbientZoneId;
  worldId: string;
  position: [number, number, number];
  radius: number;
  audioSources: AudioSourceId[];
  crossfadeMs: number;
  blendCurve: 'linear' | 'exponential';
}

export interface VoiceConnection {
  streamId: VoiceStreamId;
  participantId: string;
  channelId: string;
  codec: 'opus' | 'pcm';
  sampleRate: number;
  bitrate: number;
  muted: boolean;
  speaking: boolean;
  level: number; // 0-1 RMS
}

export interface AudioHealth {
  status: 'healthy' | 'degraded' | 'unavailable';
  activeSources: number;
  listenerCount: number;
  voiceConnections: number;
  audioContextState: string;
  bufferUnderruns: number;
}

export interface AudioRecoveryState {
  lastKnownListener: AudioListenerState;
  activeAmbientZones: AmbientZoneId[];
  voiceSettings: { inputMuted: boolean; outputVolume: number };
}