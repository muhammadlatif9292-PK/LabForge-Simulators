// apps/web/src/HUD/runtime/HUD-runtime.ts
/**
 * HUD Runtime
 * 
 * Responsibilities:
 * - Manage the full tactical HUD lifecycle: layout, panels, overlays, transitions
 * - Coordinate with layout orchestrator, overlay engine, panel runtime
 * - Provide consistent reactive state to the UI layer (canvas/DOM)
 * - Support landscape-only orientation enforcement
 * - Manage input focus and accessibility announcements
 * 
 * Owned state:
 * - hudState: HUDState
 * - layoutOrchestrator: HUDLayoutOrchestrator
 * - overlayEngine: HUDOverlayEngine
 * - panelRuntime: HUDPanelRuntime
 * - transitionEngine: HUDTransitionEngine
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - HUDLayoutOrchestrator, HUDOverlayEngine, HUDPanelRuntime, HUDTransitionEngine
 * - HUDRecoveryEngine
 * - HUDAIOverlay, HUDMissionOverlay (injected)
 * 
 * Event emissions:
 * - "hud.layout.changed", "hud.panel.updated", "hud.overlay.shown"
 * 
 * Event subscriptions:
 * - "tutor.response.chunk" (AI overlay)
 * - "mission.objective.completed" (mission overlay)
 * - "collaboration.presence" (collab panel)
 * - "instrument.measurement.recorded" (measurement panel)
 * 
 * Synchronization: HUD state single source of truth; changes emitted to UI
 * Recovery: state persisted via recovery engine; restored on reconnect
 * Telemetry: panel count, overlay frequency, layout switches
 * Diagnostics: HUD state dump, active overlays
 * Accessibility: all panel text exposed to screen reader; focus management
 * Performance: debounced updates; virtualized panels; requestAnimationFrame for transitions
 * Forbidden: blocking main thread during transition; landscape lock violation
 */

import { v4 as uuidv4 } from 'uuid';
import type { PanelId, OverlayId, LayoutId, HUDState, HUDPanel, HUDOverlay, TransitionEffect } from '../contracts/hud-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { HUDLayoutOrchestrator } from './HUD-layout-orchestrator';
import type { HUDOverlayEngine } from './HUD-overlay-engine';
import type { HUDPanelRuntime } from './HUD-panel-runtime';
import type { HUDTransitionEngine } from './HUD-transition-engine';
import type { HUDRecoveryEngine } from './HUD-recovery-engine';

export class HUDRuntime {
  private state: HUDState;
  private eventSubscriptions: Array<{ event: string; handler: (...args: any[]) => void }> = [];

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private layoutOrchestrator: HUDLayoutOrchestrator,
    private overlayEngine: HUDOverlayEngine,
    private panelRuntime: HUDPanelRuntime,
    private transitionEngine: HUDTransitionEngine,
    private recoveryEngine: HUDRecoveryEngine,
  ) {
    this.state = this.initializeDefaultState();
  }

  async start(): Promise<void> {
    // Restore previous HUD state if available
    const saved = await this.recoveryEngine.loadState();
    if (saved) {
      this.state = saved;
    } else {
      this.layoutOrchestrator.applyDefaultLayout(this.state);
    }
    this.registerEvents();
    this.logger.info('HUD Runtime started');
    this.meter.incrementCounter('hud.started');
  }

  private initializeDefaultState(): HUDState {
    return {
      activeLayout: 'default' as LayoutId,
      panels: new Map(),
      overlays: [],
      transition: null,
      dimmed: false,
    };
  }

  private registerEvents(): void {
    this.subscribe('tutor.response.chunk', (e) => this.onAIResponseChunk(e.payload));
    this.subscribe('mission.objective.completed', (e) => this.onMissionUpdate(e.payload));
    this.subscribe('mission.completed', (e) => this.onMissionCompleted(e.payload));
    this.subscribe('collaboration.presence', (e) => this.onPresenceUpdate(e.payload));
    this.subscribe('instrument.measurement.recorded', (e) => this.onMeasurement(e.payload));
    this.subscribe('hud.command', (e) => this.onHUDCommand(e.payload));
  }

  private subscribe(eventType: string, handler: (event: any) => void): void {
    this.eventBus.subscribe(eventType, handler);
    this.eventSubscriptions.push({ event: eventType, handler });
  }

  // --- Event Handlers ---

  private async onAIResponseChunk(payload: any): Promise<void> {
    const overlay: HUDOverlay = {
      id: uuidv4() as OverlayId,
      type: 'ai_response',
      position: 'top',
      content: payload.chunk,
      duration: payload.isFinal ? 8000 : 0,
      priority: 80,
      timestamp: Date.now(),
    };
    if (payload.isFinal) {
      this.overlayEngine.showFinal(overlay, this.state);
    } else {
      this.overlayEngine.updateStreaming(overlay, this.state);
    }
  }

  private onMissionUpdate(payload: any): void {
    const overlay: HUDOverlay = {
      id: uuidv4() as OverlayId,
      type: 'mission_update',
      position: 'top',
      content: `Objective completed: ${payload.objectiveId}`,
      duration: 5000,
      priority: 90,
      timestamp: Date.now(),
    };
    this.overlayEngine.showTimed(overlay, this.state);
  }

  private onMissionCompleted(payload: any): void {
    this.overlayEngine.showTimed({
      id: uuidv4() as OverlayId,
      type: 'mission_update',
      position: 'center',
      content: 'Mission Complete!',
      duration: 8000,
      priority: 100,
      timestamp: Date.now(),
    }, this.state);
  }

  private onPresenceUpdate(payload: any): void {
    const collabPanel = this.panelRuntime.findPanelByType('collaboration', this.state);
    if (collabPanel) {
      collabPanel.data = { ...collabPanel.data, presence: payload };
      this.panelRuntime.updatePanel(collabPanel, this.state);
    }
  }

  private onMeasurement(payload: any): void {
    // Show measurement overlay and update measurement panel
    this.overlayEngine.showTimed({
      id: uuidv4() as OverlayId,
      type: 'measurement',
      position: 'bottom',
      content: `${payload.value} ${payload.unit}`,
      duration: 3000,
      priority: 70,
      timestamp: Date.now(),
    }, this.state);
    this.panelRuntime.appendMeasurement(payload, this.state);
  }

  private onHUDCommand(payload: { type: string; data?: any }): void {
    switch (payload.type) {
      case 'toggle_panel':
        this.panelRuntime.togglePanel(payload.data as PanelId, this.state);
        break;
      case 'switch_layout':
        this.layoutOrchestrator.switchLayout(payload.data as LayoutId, this.state);
        this.state.activeLayout = payload.data;
        break;
      case 'dim':
        this.state.dimmed = true;
        break;
      case 'undim':
        this.state.dimmed = false;
        break;
    }
    this.eventBus.publish('hud.state.changed', this.state);
  }

  // --- Public API ---

  getState(): Readonly<HUDState> {
    return this.state;
  }

  addPanel(panel: HUDPanel): void {
    this.panelRuntime.addPanel(panel, this.state);
    this.emitStateChanged();
  }

  showOverlay(overlay: HUDOverlay): void {
    this.overlayEngine.show(overlay, this.state);
  }

  setLayout(layoutId: LayoutId): void {
    this.layoutOrchestrator.switchLayout(layoutId, this.state);
    this.state.activeLayout = layoutId;
    this.emitStateChanged();
  }

  applyTransition(effect: TransitionEffect): void {
    this.transitionEngine.apply(effect, this.state);
  }

  async shutdown(): Promise<void> {
    // Unsubscribe all
    for (const sub of this.eventSubscriptions) {
      this.eventBus.unsubscribe(sub.event as any);
    }
    await this.recoveryEngine.saveState(this.state);
    this.logger.info('HUD Runtime shut down');
  }

  private emitStateChanged(): void {
    this.eventBus.publish('hud.state.changed', this.state);
  }
}