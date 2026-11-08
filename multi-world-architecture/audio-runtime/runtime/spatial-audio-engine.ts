// audio-runtime/runtime/spatial-audio-engine.ts
/**
 * Spatial Audio Engine
 * 
 * Responsibilities:
 * - Apply 3D spatial positioning to audio sources using HRTF (Head-Related Transfer Function)
 * - Manage PannerNodes for point/area sources based on listener position
 * - Calculate distance attenuation and Doppler shift
 * - Support automatic orientation tracking for head-tracked audio (future)
 * - Provide a flat global output for non-spatial sources
 * 
 * Owned state:
 * - panners: Map<AudioSourceId, PannerNode>
 * - listener: AudioListenerState
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - Web Audio API (PannerNode, AudioListener)
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none (audio graph is single-threaded)
 * Recovery: recreate panners if context is recreated
 * Telemetry: panner count, average distance
 * Diagnostics: listener orientation, panner positions
 * Accessibility: spatial audio enhances immersion; provide mono fallback
 * Performance: use efficient HRTF model; limit concurrent panners
 * Forbidden: using HRTF on mobile without headphone detection
 */

import type { AudioSourceDescriptor, AudioListenerState, AudioSourceId } from '../contracts/audio-contracts';
import { AudioSpatialModel } from '../contracts/audio-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class SpatialAudioEngine {
  private context: AudioContext | null = null;
  private panners: Map<AudioSourceId, PannerNode> = new Map();
  private listener: AudioListenerState | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  initialize(context: AudioContext, listener: AudioListenerState): void {
    this.context = context;
    this.listener = listener;
    this.updateListener(listener);
  }

  getPannerForSource(descriptor: AudioSourceDescriptor): AudioNode | null {
    if (!this.context) return null;
    if (descriptor.spatialModel === AudioSpatialModel.GLOBAL) {
      return null; // connect directly to master
    }
    let panner = this.panners.get(descriptor.id);
    if (!panner) {
      panner = this.context.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.maxDistance = 100;
      panner.rolloffFactor = 1;
      panner.coneInnerAngle = 360;
      panner.coneOuterAngle = 0;
      panner.coneOuterGain = 0;
      this.setPannerPosition(panner, descriptor.position);
      this.panners.set(descriptor.id, panner);
    }
    return panner;
  }

  updateSourcePosition(sourceId: AudioSourceId, position: [number, number, number]): void {
    const panner = this.panners.get(sourceId);
    if (panner) {
      this.setPannerPosition(panner, position);
    }
  }

  updateListener(listener: AudioListenerState): void {
    this.listener = listener;
    if (!this.context) return;
    const audioListener = this.context.listener;
    // Modern API uses AudioListener position/orientation properties
    if (audioListener.positionX) {
      audioListener.positionX.value = listener.position[0];
      audioListener.positionY.value = listener.position[1];
      audioListener.positionZ.value = listener.position[2];
      audioListener.forwardX.value = listener.orientation[0];
      audioListener.forwardY.value = listener.orientation[1];
      audioListener.forwardZ.value = listener.orientation[2];
      audioListener.upX.value = listener.orientation[3];
      audioListener.upY.value = listener.orientation[4];
      audioListener.upZ.value = listener.orientation[5];
    } else {
      // Fallback for older API
      (audioListener as any).setPosition(listener.position[0], listener.position[1], listener.position[2]);
      (audioListener as any).setOrientation(
        listener.orientation[0], listener.orientation[1], listener.orientation[2],
        listener.orientation[3], listener.orientation[4], listener.orientation[5],
      );
    }
  }

  removeSource(sourceId: AudioSourceId): void {
    this.panners.delete(sourceId);
  }

  private setPannerPosition(panner: PannerNode, position: [number, number, number]): void {
    panner.positionX.value = position[0];
    panner.positionY.value = position[1];
    panner.positionZ.value = position[2];
  }

  getDistanceToListener(position: [number, number, number]): number {
    if (!this.listener) return Infinity;
    return Math.hypot(
      position[0] - this.listener.position[0],
      position[1] - this.listener.position[1],
      position[2] - this.listener.position[2],
    );
  }

  dispose(): void {
    this.panners.clear();
    this.context = null;
  }
}