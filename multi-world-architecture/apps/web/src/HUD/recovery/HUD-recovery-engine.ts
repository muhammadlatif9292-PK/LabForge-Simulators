// apps/web/src/HUD/recovery/HUD-recovery-engine.ts
/**
 * HUD Recovery Engine
 * 
 * Responsibilities:
 * - Persist the current HUD state (panels, layout, overlays) for crash recovery
 * - Restore HUD state on application restart or reconnect
 * - Compact old overlay history
 * - Validate saved state integrity
 * 
 * Owned state: none (uses local storage)
 * 
 * Dependencies: ILogger, IMeter, local persistence adapter
 * 
 * Event emissions: "hud.recovery.saved", "hud.recovery.restored"
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: this IS the recovery mechanism
 * Telemetry: save frequency, restore success rate
 * Diagnostics: last saved timestamp
 * Accessibility: N/A
 * Performance: async writes; debounced saves
 * Forbidden: persisting full conversation secrets; blocking shutdown for save
 */

import type { HUDState } from '../contracts/hud-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class HUDRecoveryEngine {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private storage: any, // e.g., IndexedDB wrapper
  ) {}

  async saveState(state: HUDState): Promise<void> {
    // Strip ephemeral streaming overlays before saving
    const toSave = {
      ...state,
      overlays: state.overlays.filter(o => o.duration === 0 || o.type === 'ai_response'),
      panels: Array.from(state.panels.entries()).map(([id, panel]) => [id, { ...panel, data: {} }]),
    };
    await this.storage.set('hud_state', JSON.stringify(toSave));
    this.meter.incrementCounter('hud.recovery.saved');
  }

  async loadState(): Promise<HUDState | null> {
    const raw = await this.storage.get('hud_state');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        parsed.panels = new Map(parsed.panels);
        this.meter.incrementCounter('hud.recovery.restored');
        return parsed;
      } catch (err) {
        this.logger.error('Corrupted HUD state', { error: err });
        this.meter.incrementCounter('hud.recovery.corrupted');
        return null;
      }
    }
    return null;
  }
}