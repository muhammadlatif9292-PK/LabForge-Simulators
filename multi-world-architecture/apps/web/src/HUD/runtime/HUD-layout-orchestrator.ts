// apps/web/src/HUD/runtime/HUD-layout-orchestrator.ts
/**
 * HUD Layout Orchestrator
 * 
 * Responsibilities:
 * - Define and apply HUD panel layouts for different modes (standard, mission, tutoring, minimal)
 * - Ensure landscape-only orientation: elements positioned relative to viewport edges
 * - Manage panel visibility, z-index, and docking
 * - Animate layout transitions via the transition engine
 * 
 * Owned state: none (transforms HUDState in-place via orchestrator)
 * 
 * Dependencies: ILogger, IMeter, HUDTransitionEngine
 * 
 * Event emissions: none (state changed by runtime)
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: layout definitions are static; recoverable
 * Telemetry: layout switch count
 * Diagnostics: active layout name
 * Accessibility: layouts must maintain readable font sizes and contrast
 * Performance: CSS transform-based transitions; GPU compositing
 * Forbidden: layouts that overflow viewport; non-landscape configurations
 */

import type { LayoutId, HUDState, HUDPanel, PanelId } from '../contracts/hud-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { HUDTransitionEngine } from './HUD-transition-engine';
import { v4 as uuidv4 } from 'uuid';

interface LayoutDefinition {
  panels: Omit<HUDPanel, 'id' | 'data'>[];
}

export class HUDLayoutOrchestrator {
  private layouts: Map<string, LayoutDefinition> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private transitionEngine: HUDTransitionEngine,
  ) {
    this.defineLayouts();
  }

  private defineLayouts(): void {
    this.layouts.set('standard', {
      panels: [
        { type: 'instruments', position: { x: 0, y: 0, width: 300, height: 1080 }, zIndex: 10, visible: true, opacity: 1 },
        { type: 'measurements', position: { x: 300, y: 0, width: 350, height: 400 }, zIndex: 20, visible: true, opacity: 1 },
        { type: 'missions', position: { x: 1620, y: 0, width: 300, height: 1080 }, zIndex: 10, visible: true, opacity: 1 },
        { type: 'ai', position: { x: 300, y: 680, width: 600, height: 400 }, zIndex: 30, visible: true, opacity: 0.95 },
        { type: 'notes', position: { x: 900, y: 680, width: 300, height: 400 }, zIndex: 25, visible: true, opacity: 1 },
        { type: 'settings', position: { x: 0, y: 1000, width: 100, height: 80 }, zIndex: 5, visible: true, opacity: 0.5 },
        { type: 'collaboration', position: { x: 1820, y: 100, width: 100, height: 800 }, zIndex: 15, visible: true, opacity: 1 },
      ],
    });
    this.layouts.set('mission_focused', {
      panels: [
        { type: 'instruments', position: { x: 0, y: 0, width: 400, height: 1080 }, zIndex: 10, visible: true, opacity: 1 },
        { type: 'missions', position: { x: 1520, y: 0, width: 400, height: 400 }, zIndex: 20, visible: true, opacity: 1 },
        { type: 'ai', position: { x: 400, y: 680, width: 1120, height: 400 }, zIndex: 30, visible: true, opacity: 1 },
        { type: 'measurements', position: { x: 1520, y: 400, width: 400, height: 680 }, zIndex: 15, visible: true, opacity: 1 },
        { type: 'collaboration', position: { x: 1850, y: 0, width: 70, height: 1080 }, zIndex: 5, visible: true, opacity: 0.8 },
      ],
    });
    this.layouts.set('minimal', {
      panels: [
        { type: 'instruments', position: { x: 0, y: 0, width: 200, height: 1080 }, zIndex: 10, visible: true, opacity: 1 },
      ],
    });
  }

  applyDefaultLayout(state: HUDState): void {
    this.switchLayout('standard' as LayoutId, state);
  }

  switchLayout(layoutId: LayoutId, state: HUDState): void {
    const def = this.layouts.get(layoutId);
    if (!def) return;
    // Apply transition
    this.transitionEngine.apply({ type: 'fade', durationMs: 300, easing: 'ease-out' }, state);

    // Clear old panels
    state.panels.clear();
    // Create new panels
    for (const pdef of def.panels) {
      const panel: HUDPanel = {
        id: uuidv4() as PanelId,
        ...pdef,
        data: {},
      };
      state.panels.set(panel.id, panel);
    }
    this.meter.incrementCounter('hud.layout.switched', { layout: layoutId });
    this.logger.info(`HUD layout switched to ${layoutId}`);
  }
}