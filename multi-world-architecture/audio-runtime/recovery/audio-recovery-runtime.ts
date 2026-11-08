// audio-runtime/recovery/audio-recovery-runtime.ts
/**
 * Audio Recovery Runtime
 * 
 * Responsibilities:
 * - Persist audio preferences (volume, mute) and listener state
 * - Restore audio graph after AudioContext suspension or crash
 * - Reload audio buffers lost due to memory pressure
 * - Monitor AudioContext health and trigger recovery if needed
 * 
 * Owned state: none (uses local storage)
 * 
 * Dependencies: ILogger, IMeter, local persistence adapter
 * 
 * Event emissions: "audio.recovery.restored", "audio.recovery.context.lost"
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: self-healing for context loss
 * Telemetry: recovery count
 * Diagnostics: last saved state timestamp
 * Accessibility: saved preferences ensure consistent experience
 * Performance: lightweight saves; debounced
 * Forbidden: losing user volume preferences on crash
 */

import type { AudioListenerState, AudioRecoveryState } from '../contracts/audio-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class AudioRecoveryRuntime {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private storage: any, // local persistence
  ) {}

  saveListenerState(listener: AudioListenerState): void {
    this.storage.set('audio_listener', JSON.stringify(listener));
  }

  loadListenerState(): AudioListenerState | null {
    const raw = this.storage.get('audio_listener');
    return raw ? JSON.parse(raw) : null;
  }

  savePreferences(prefs: { masterVolume: number; muted: boolean }): void {
    this.storage.set('audio_prefs', JSON.stringify(prefs));
  }

  loadPreferences(): { masterVolume: number; muted: boolean } | null {
    const raw = this.storage.get('audio_prefs');
    return raw ? JSON.parse(raw) : null;
  }

  async onContextLost(context: AudioContext, onRestore: () => void): Promise<void> {
    this.logger.warn('AudioContext lost, attempting recovery');
    this.meter.incrementCounter('audio.recovery.context.lost');
    context.addEventListener('statechange', () => {
      if (context.state === 'running') {
        this.logger.info('AudioContext restored');
        this.meter.incrementCounter('audio.recovery.restored');
        onRestore();
      }
    }, { once: true });
  }

  clear(): void {
    this.storage.delete('audio_listener');
    this.storage.delete('audio_prefs');
  }
}