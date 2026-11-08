// audio-runtime/runtime/ambient-audio-orchestrator.ts
/**
 * Ambient Audio Orchestrator
 * 
 * Responsibilities:
 * - Manage ambient soundscapes tied to world locations (ambient zones)
 * - Crossfade between ambient zones as the listener moves
 * - Schedule random ambient one-shots (e.g., bird calls, equipment hum)
 * - Support day/night cycles and world state changes for ambience
 * - Provide seamless looping and layered ambient tracks
 * 
 * Owned state:
 * - zones: Map<AmbientZoneId, AmbientZone>
 * - activeAmbientNodes: Map<AmbientZoneId, { source: AudioBufferSourceNode; gain: GainNode }>
 * - currentZoneWeights: Map<AmbientZoneId, number>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - AudioRuntime (for buffer loading)
 * - SpatialAudioEngine (for positioning)
 * 
 * Event emissions: "ambient.zone.entered", "ambient.zone.exited"
 * Event subscriptions:
 * - "world.listener.moved" (to recalculate zone weights)
 * - "world.time.changed" (day/night ambience)
 * 
 * Synchronization: none (audio graph operations)
 * Recovery: reload ambient buffers if context lost
 * Telemetry: active zones, transition count
 * Diagnostics: zone weights
 * Accessibility: ambient audio volume is controllable
 * Performance: only active zones have playing nodes; distant zones suspended
 * Forbidden: overlapping ambient loops without crossfade; abrupt transitions
 */

import type { AmbientZoneId, AmbientZone, AudioSourceId } from '../contracts/audio-contracts';
import type { AudioRuntime } from './audio-runtime';
import type { SpatialAudioEngine } from './spatial-audio-engine';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface ActiveAmbient {
  source: AudioBufferSourceNode;
  gain: GainNode;
  zone: AmbientZone;
}

export class AmbientAudioOrchestrator {
  private zones: Map<AmbientZoneId, AmbientZone> = new Map();
  private activeNodes: Map<AmbientZoneId, ActiveAmbient> = new Map();
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private updateInterval: any = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private audioRuntime: AudioRuntime,
    private spatialEngine: SpatialAudioEngine,
  ) {}

  start(context: AudioContext, masterGain: GainNode): void {
    this.context = context;
    this.masterGain = masterGain;
    this.updateInterval = setInterval(() => this.updateWeights(), 250);
  }

  registerZone(zone: AmbientZone): void {
    this.zones.set(zone.id, zone);
    this.logger.debug(`Ambient zone registered: ${zone.id}`);
  }

  removeZone(zoneId: AmbientZoneId): void {
    this.stopZone(zoneId);
    this.zones.delete(zoneId);
  }

  private updateWeights(): void {
    const listenerPos = this.spatialEngine['listener']?.position ?? [0, 0, 0];
    for (const zone of this.zones.values()) {
      const distance = this.spatialEngine.getDistanceToListener(zone.position);
      const weight = Math.max(0, 1 - distance / zone.radius);
      if (weight > 0 && !this.activeNodes.has(zone.id)) {
        this.activateZone(zone);
      } else if (weight <= 0 && this.activeNodes.has(zone.id)) {
        this.deactivateZone(zone.id);
      }
      const node = this.activeNodes.get(zone.id);
      if (node) {
        node.gain.gain.value = weight;
      }
    }
  }

  private activateZone(zone: AmbientZone): void {
    if (!this.context || !this.masterGain) return;
    // Pick a random source from the zone's sources
    if (zone.audioSources.length === 0) return;
    const sourceId = zone.audioSources[0]; // simplest: first source
    const descriptor = this.audioRuntime['sources'].get(sourceId);
    if (!descriptor?.buffer) return;
    const sourceNode = this.context.createBufferSource();
    sourceNode.buffer = descriptor.buffer;
    sourceNode.loop = true;
    const gainNode = this.context.createGain();
    gainNode.gain.value = 0;
    gainNode.gain.setTargetAtTime(1, this.context.currentTime, zone.crossfadeMs / 1000);
    const destination = this.spatialEngine.getPannerForSource(descriptor) ?? this.masterGain;
    sourceNode.connect(gainNode).connect(destination);
    sourceNode.start();
    this.activeNodes.set(zone.id, { source: sourceNode, gain: gainNode, zone });
    this.meter.incrementCounter('ambient.zone.entered');
    this.logger.debug(`Ambient zone activated: ${zone.id}`);
  }

  private deactivateZone(zoneId: AmbientZoneId): void {
    const node = this.activeNodes.get(zoneId);
    if (!node) return;
    const zone = node.zone;
    node.gain.gain.setTargetAtTime(0, this.context!.currentTime, zone.crossfadeMs / 1000);
    setTimeout(() => {
      try { node.source.stop(); } catch (e) { /* ignore */ }
      this.activeNodes.delete(zoneId);
    }, zone.crossfadeMs);
    this.meter.incrementCounter('ambient.zone.exited');
    this.logger.debug(`Ambient zone deactivated: ${zoneId}`);
  }

  stopZone(zoneId: AmbientZoneId): void {
    this.deactivateZone(zoneId);
  }

  stop(): void {
    if (this.updateInterval) clearInterval(this.updateInterval);
    for (const [id] of this.activeNodes) {
      this.stopZone(id);
    }
    this.activeNodes.clear();
  }
}