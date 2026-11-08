// apps/web/src/HUD/runtime/HUD-panel-runtime.ts
/**
 * HUD Panel Runtime
 * 
 * Responsibilities:
 * - Manage CRUD operations for HUD panels
 * - Provide query methods (find by type, find by ID)
 * - Support data binding: panels react to measurement, mission, collaboration updates
 * - Track panel visibility and focus for input routing
 * 
 * Owned state: none (operates on HUDState)
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: none (state managed by HUD recovery)
 * Telemetry: panel interactions
 * Diagnostics: panel data snapshots
 * Accessibility: panel content must be semantic HTML with ARIA roles
 * Performance: avoid full re-renders; diff-based updates
 * Forbidden: panels that overlap and block critical instruments
 */

import type { HUDState, HUDPanel, PanelId } from '../contracts/hud-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class HUDPanelRuntime {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  addPanel(panel: HUDPanel, state: HUDState): void {
    state.panels.set(panel.id, panel);
  }

  updatePanel(panel: HUDPanel, state: HUDState): void {
    state.panels.set(panel.id, panel);
  }

  removePanel(panelId: PanelId, state: HUDState): void {
    state.panels.delete(panelId);
  }

  togglePanel(panelId: PanelId, state: HUDState): void {
    const panel = state.panels.get(panelId);
    if (panel) {
      panel.visible = !panel.visible;
    }
  }

  findPanelByType(type: string, state: HUDState): HUDPanel | undefined {
    for (const panel of state.panels.values()) {
      if (panel.type === type && panel.visible) return panel;
    }
    return undefined;
  }

  appendMeasurement(measurement: any, state: HUDState): void {
    const panel = this.findPanelByType('measurements', state);
    if (panel) {
      if (!panel.data.history) panel.data.history = [];
      panel.data.history.push(measurement);
      if (panel.data.history.length > 100) panel.data.history.shift();
    }
  }
}