// apps/web/src/HUD/runtime/HUD-overlay-engine.ts
/**
 * HUD Overlay Engine
 * 
 * Responsibilities:
 * - Manage the overlay queue: display, stacking, and removal
 * - Support timed overlays (auto-dismiss), persistent ones, and streaming updates (AI)
 * - Handle priority-based stacking (higher priority overlays on top)
 * - Animate overlay appearance/disappearance
 * 
 * Owned state:
 * - activeOverlays: HUDOverlay[] (managed within HUDState)
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: none (mutates HUDState directly)
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: overlays are ephemeral; no persistence needed
 * Telemetry: overlay count, display frequency
 * Diagnostics: active overlay list
 * Accessibility: overlay content exposed to screen reader via ARIA live regions
 * Performance: limit total active overlays; use pooling for object creation
 * Forbidden: blocking interactions; infinite overlay loops
 */

import type { HUDState, HUDOverlay, OverlayId } from '../contracts/hud-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class HUDOverlayEngine {
  private maxOverlays = 5;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  show(overlay: HUDOverlay, state: HUDState): void {
    state.overlays.push(overlay);
    this.prune(state);
    this.meter.incrementCounter('hud.overlay.shown', { type: overlay.type });
  }

  showTimed(overlay: HUDOverlay, state: HUDState): void {
    this.show(overlay, state);
    if (overlay.duration && overlay.duration > 0) {
      setTimeout(() => {
        this.dismiss(overlay.id, state);
      }, overlay.duration);
    }
  }

  showFinal(overlay: HUDOverlay, state: HUDState): void {
    // Replace any streaming overlay of same type with final version
    state.overlays = state.overlays.filter(o => !(o.type === overlay.type && o.id !== overlay.id));
    this.showTimed(overlay, state);
  }

  updateStreaming(overlay: HUDOverlay, state: HUDState): void {
    // Find existing streaming overlay for this type and update it
    const existing = state.overlays.find(o => o.type === overlay.type && o.duration === 0);
    if (existing) {
      existing.content += overlay.content;
      existing.timestamp = Date.now();
    } else {
      this.show(overlay, state);
    }
  }

  dismiss(overlayId: OverlayId, state: HUDState): void {
    const index = state.overlays.findIndex(o => o.id === overlayId);
    if (index >= 0) {
      state.overlays.splice(index, 1);
    }
  }

  private prune(state: HUDState): void {
    // Sort by priority descending and keep top maxOverlays
    state.overlays.sort((a, b) => b.priority - a.priority);
    while (state.overlays.length > this.maxOverlays) {
      const removed = state.overlays.pop();
      this.meter.incrementCounter('hud.overlay.pruned');
    }
  }
}