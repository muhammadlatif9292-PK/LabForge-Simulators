// audio-runtime/runtime/audio-runtime.ts
/**
 * Audio Runtime
 * 
 * Responsibilities:
 * - Manage the Web Audio API context and master output
 * - Register, load, and control audio sources (instruments, ambient, voice)
 * - Manage audio listeners (typically one per user/camera)
 * - Enforce audio source limits and culling based on priority and distance
 * - Provide mute, volume, and global audio controls
 * - Coordinate with spatial, ambient, and voice subsystems
 * 
 * Owned state:
 * - context: AudioContext
 * - sources: Map<AudioSourceId, AudioSourceDescriptor>
 * - listener: AudioListenerState
 * - masterGain: GainNode
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - SpatialAudioEngine
 * - AmbientAudioOrchestrator
 * - VoiceSessionAudio
 * - AudioRecoveryRuntime
 * 
 * Event emissions: "audio.source.started", "audio.source.stopped", "audio.context.resumed"
 * Event subscriptions:
 * - "world.listener.moved" (update listener position)
 * - "instrument.activated", "instrument.deactivated" (instrument sounds)
 * - "collaboration.participant.muted" (voice mute)
 * 
 * Synchronization: single-threaded audio graph; no external sync needed
 * Recovery: restore AudioContext after system suspend; reload buffers if lost
 * Telemetry: source count, buffer underruns, context state
 * Diagnostics: active sources, listener position
 * Accessibility: captions for critical audio cues; volume control
 * Performance: cull distant/inactive sources; pool audio nodes
 * Forbidden: creating more than one AudioContext; blocking main thread for decode
 */

import type {
  AudioSourceId, AudioSourceDescriptor, AudioListenerState, AudioHealth,
} from '../contracts/audio-contracts';
import { AudioSourceType } from '../contracts/audio-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { SpatialAudioEngine } from './spatial-audio-engine';
import type { AmbientAudioOrchestrator } from './ambient-audio-orchestrator';
import type { VoiceSessionAudio } from './voice-session-audio';
import type { AudioRecoveryRuntime } from './audio-recovery-runtime';

export class AudioRuntime {
  private context: AudioContext;
  private masterGain: GainNode;
  private sources: Map<AudioSourceId, AudioSourceDescriptor> = new Map();
  private activeNodes: Map<AudioSourceId, AudioBufferSourceNode | MediaStreamAudioSourceNode> = new Map();
  private listener: AudioListenerState;
  private running = false;
  private readonly maxActiveSources = 32;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private spatialEngine: SpatialAudioEngine,
    private ambientOrchestrator: AmbientAudioOrchestrator,
    private voiceAudio: VoiceSessionAudio,
    private recovery: AudioRecoveryRuntime,
  ) {
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.masterGain.gain.value = 0.8;
    this.listener = this.recovery.loadListenerState() ?? this.createDefaultListener();
    this.spatialEngine.initialize(this.context, this.listener);
    this.setupEventHandlers();
  }

  private createDefaultListener(): AudioListenerState {
    return {
      id: 'default' as any,
      position: [0, 0, 0],
      orientation: [0, 0, -1, 0, 1, 0],
      velocity: [0, 0, 0],
      worldId: '',
    };
  }

  private setupEventHandlers(): void {
    this.eventBus.subscribe('world.listener.moved', this.onListenerMoved.bind(this));
    this.eventBus.subscribe('instrument.activated', this.onInstrumentActivated.bind(this));
    this.eventBus.subscribe('instrument.deactivated', this.onInstrumentDeactivated.bind(this));
    document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
  }

  async start(): Promise<void> {
    if (this.running) return;
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
    this.running = true;
    this.ambientOrchestrator.start(this.context, this.masterGain);
    this.meter.incrementCounter('audio.runtime.started');
    this.logger.info('Audio runtime started');
  }

  async registerSource(descriptor: AudioSourceDescriptor): Promise<void> {
    if (!descriptor.buffer && descriptor.url) {
      descriptor.buffer = await this.loadBuffer(descriptor.url);
    }
    this.sources.set(descriptor.id, descriptor);
    if (descriptor.autoPlay) {
      this.playSource(descriptor.id);
    }
  }

  playSource(sourceId: AudioSourceId, offsetSeconds: number = 0): void {
    const descriptor = this.sources.get(sourceId);
    if (!descriptor || !descriptor.buffer) return;
    // Cull if too many active sources
    if (this.activeNodes.size >= this.maxActiveSources) {
      this.cullLowestPriority();
    }
    // Select routing based on spatial model
    const destinationNode = this.spatialEngine.getPannerForSource(descriptor) ?? this.masterGain;
    const sourceNode = this.context.createBufferSource();
    sourceNode.buffer = descriptor.buffer;
    sourceNode.playbackRate.value = descriptor.pitch;
    sourceNode.loop = descriptor.loop;
    const gainNode = this.context.createGain();
    gainNode.gain.value = descriptor.volume;
    sourceNode.connect(gainNode).connect(destinationNode);
    sourceNode.start(0, offsetSeconds);
    this.activeNodes.set(sourceId, sourceNode);
    sourceNode.onended = () => {
      this.activeNodes.delete(sourceId);
    };
    this.meter.incrementCounter('audio.source.started');
    this.eventBus.publish('audio.source.started', { sourceId });
  }

  stopSource(sourceId: AudioSourceId): void {
    const node = this.activeNodes.get(sourceId);
    if (node) {
      try { node.stop(); } catch (e) { /* already stopped */ }
      this.activeNodes.delete(sourceId);
      this.eventBus.publish('audio.source.stopped', { sourceId });
    }
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  getMasterVolume(): number {
    return this.masterGain.gain.value;
  }

  async updateListener(position: [number, number, number], orientation?: [number, number, number, number, number, number]): Promise<void> {
    this.listener.position = position;
    if (orientation) this.listener.orientation = orientation;
    this.spatialEngine.updateListener(this.listener);
    this.recovery.saveListenerState(this.listener);
  }

  getHealth(): AudioHealth {
    return {
      status: this.context.state === 'running' ? 'healthy' : 'degraded',
      activeSources: this.activeNodes.size,
      listenerCount: 1,
      voiceConnections: this.voiceAudio.getActiveConnections(),
      audioContextState: this.context.state,
      bufferUnderruns: 0,
    };
  }

  private async loadBuffer(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return this.context.decodeAudioData(arrayBuffer);
  }

  private cullLowestPriority(): void {
    let lowestPriority = Infinity;
    let lowestId: AudioSourceId | null = null;
    for (const [id, node] of this.activeNodes) {
      const descriptor = this.sources.get(id);
      if (descriptor && descriptor.priority < lowestPriority && !descriptor.loop) {
        lowestPriority = descriptor.priority;
        lowestId = id;
      }
    }
    if (lowestId) {
      this.stopSource(lowestId);
    }
  }

  private onListenerMoved(event: any): void {
    const { position, orientation } = event.payload;
    this.updateListener(position, orientation);
  }

  private onInstrumentActivated(event: any): void {
    const { instrumentId } = event.payload;
    // Find audio source bound to this instrument and play
    for (const [id, desc] of this.sources) {
      if (desc.type === AudioSourceType.INSTRUMENT && desc.metadata?.instrumentId === instrumentId) {
        this.playSource(id);
      }
    }
  }

  private onInstrumentDeactivated(event: any): void {
    const { instrumentId } = event.payload;
    for (const [id, desc] of this.sources) {
      if (desc.type === AudioSourceType.INSTRUMENT && desc.metadata?.instrumentId === instrumentId) {
        this.stopSource(id);
      }
    }
  }

  private async onVisibilityChange(): Promise<void> {
    if (document.hidden) {
      // Suspend audio context to save resources
      await this.context.suspend();
    } else {
      await this.context.resume();
    }
  }

  async shutdown(): Promise<void> {
    this.running = false;
    for (const [id] of this.activeNodes) {
      this.stopSource(id);
    }
    this.ambientOrchestrator.stop();
    this.voiceAudio.disconnectAll();
    await this.context.close();
    this.logger.info('Audio runtime shut down');
  }
}