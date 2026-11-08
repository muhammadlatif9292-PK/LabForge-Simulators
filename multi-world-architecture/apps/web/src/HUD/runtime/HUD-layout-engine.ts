// apps/web/src/HUD/runtime/HUD-layout-engine.ts
/**
 * HUD Layout Engine
 * 
 * Responsibilities:
 * - Manage panel docking, resizing, and arrangement in landscape viewport
 * - Enforce landscape-only layout constraints with adaptive grid
 * - Support drag-to-resize panel boundaries with configurable minimums
 * - Compute panel positions dynamically from layout templates
 * - Handle viewport resize events (debounced) and re-layout
 * 
 * Owned state:
 * - gridColumns: number (computed from breakpoint)
 * - panelStates: Map<PanelId, PanelLayoutState>
 * - resizingPanel: PanelId | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - AdaptiveSpacingEngine (for breakpoint awareness)
 * - HUDTransitionEngine (for smooth panel resize transitions)
 * - ThemeRuntime (for spacing and elevation tokens)
 * 
 * Event emissions:
 *   "hud.layout.resized", "hud.layout.dock.changed"
 * 
 * Event subscriptions:
 *   "design.breakpoint.changed" (recompute layout)
 * 
 * Synchronization: single-threaded layout calculations; thread-safe via requestAnimationFrame
 * Recovery: layout recomputes on next resize; no persistent state needed
 * Telemetry: layout computation time, resize event count
 * Diagnostics: current grid configuration, panel boundaries
 * Accessibility: minimum panel sizes ensure touch targets; focus order follows visual layout
 * Performance: CSS transform for repositioning; avoid layout thrashing via debounce
 * Forbidden: violating landscape-only constraint; panels overlapping beyond z-index
 */

import { v4 as uuidv4 } from 'uuid';
import type { PanelId, HUDPanel } from '../contracts/hud-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { AdaptiveSpacingEngine } from '@labforge/design-system';
import type { HUDTransitionEngine } from './HUD-transition-engine';

interface PanelLayoutState {
  panelId: PanelId;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  dock: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'floating';
  minWidth: number;
  minHeight: number;
  resizable: boolean;
}

export class HUDLayoutEngine {
  private panels: Map<PanelId, PanelLayoutState> = new Map();
  private viewportWidth = 1920;
  private viewportHeight = 1080;
  private gridColumns = 24;
  private gridRows = 12;
  private resizingPanel: PanelId | null = null;
  private resizeDebounce: any = null;
  private readonly DEBOUNCE_MS = 100;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private spacingEngine: AdaptiveSpacingEngine,
    private transitionEngine: HUDTransitionEngine,
  ) {
    this.eventBus.subscribe('design.breakpoint.changed', this.onBreakpointChanged.bind(this));
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onViewportResize.bind(this));
      this.measureViewport();
    }
  }

  private measureViewport(): void {
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.recomputeGrid();
  }

  private onViewportResize(): void {
    if (this.resizeDebounce) clearTimeout(this.resizeDebounce);
    this.resizeDebounce = setTimeout(() => this.measureViewport(), this.DEBOUNCE_MS);
  }

  private onBreakpointChanged(event: any): void {
    this.recomputeGrid();
  }

  private recomputeGrid(): void {
    // Adjust grid density based on viewport width while keeping landscape
    if (this.viewportWidth >= 2560) {
      this.gridColumns = 36; this.gridRows = 16;
    } else if (this.viewportWidth >= 1920) {
      this.gridColumns = 24; this.gridRows = 12;
    } else if (this.viewportWidth >= 1366) {
      this.gridColumns = 16; this.gridRows = 8;
    } else {
      this.gridColumns = 12; this.gridRows = 6;
    }
    this.reapplyLayouts();
  }

  registerPanel(panel: HUDPanel, dock: PanelLayoutState['dock'] = 'floating'): PanelLayoutState {
    const state: PanelLayoutState = {
      panelId: panel.id,
      x: panel.position.x,
      y: panel.position.y,
      width: panel.position.width,
      height: panel.position.height,
      zIndex: panel.zIndex,
      dock,
      minWidth: 100,
      minHeight: 60,
      resizable: dock !== 'center',
    };
    this.panels.set(panel.id, state);
    this.applyDockLayout(state);
    return state;
  }

  unregisterPanel(panelId: PanelId): void {
    this.panels.delete(panelId);
  }

  setDock(panelId: PanelId, dock: PanelLayoutState['dock']): void {
    const state = this.panels.get(panelId);
    if (!state) return;
    state.dock = dock;
    this.applyDockLayout(state);
    this.meter.incrementCounter('hud.layout.dock.changed');
    this.eventBus.publish('hud.layout.dock.changed', { panelId, dock });
  }

  beginResize(panelId: PanelId): void {
    this.resizingPanel = panelId;
    if (typeof document !== 'undefined') {
      document.addEventListener('mousemove', this.onResizeDrag);
      document.addEventListener('mouseup', this.endResize);
      document.addEventListener('touchmove', this.onResizeDragTouch);
      document.addEventListener('touchend', this.endResize);
    }
  }

  private onResizeDrag = (e: MouseEvent): void => {
    if (!this.resizingPanel) return;
    const state = this.panels.get(this.resizingPanel);
    if (!state) return;
    const newWidth = Math.max(state.minWidth, e.clientX - state.x);
    const newHeight = Math.max(state.minHeight, e.clientY - state.y);
    state.width = Math.min(newWidth, this.viewportWidth - state.x);
    state.height = Math.min(newHeight, this.viewportHeight - state.y);
    this.transitionEngine.applyInstantTransform(state.panelId, state);
  };

  private onResizeDragTouch = (e: TouchEvent): void => {
    if (!this.resizingPanel || !e.touches[0]) return;
    const state = this.panels.get(this.resizingPanel);
    if (!state) return;
    const touch = e.touches[0];
    state.width = Math.max(state.minWidth, touch.clientX - state.x);
    state.height = Math.max(state.minHeight, touch.clientY - state.y);
  };

  private endResize = (): void => {
    this.resizingPanel = null;
    document.removeEventListener('mousemove', this.onResizeDrag);
    document.removeEventListener('mouseup', this.endResize);
    document.removeEventListener('touchmove', this.onResizeDragTouch);
    document.removeEventListener('touchend', this.endResize);
    this.meter.incrementCounter('hud.layout.resized');
    this.eventBus.publish('hud.layout.resized', {});
  };

  getPanelState(panelId: PanelId): PanelLayoutState | undefined {
    return this.panels.get(panelId);
  }

  getLayoutForViewport(): Map<PanelId, PanelLayoutState> {
    return new Map(this.panels);
  }

  private applyDockLayout(state: PanelLayoutState): void {
    const vw = this.viewportWidth;
    const vh = this.viewportHeight;
    const colW = vw / this.gridColumns;
    const rowH = vh / this.gridRows;
    switch (state.dock) {
      case 'left':
        state.x = 0;
        state.y = 0;
        state.width = colW * 4;   // 4 columns
        state.height = vh;
        break;
      case 'right':
        state.width = colW * 4;
        state.x = vw - state.width;
        state.y = 0;
        state.height = vh;
        break;
      case 'top':
        state.x = 0;
        state.y = 0;
        state.width = vw;
        state.height = rowH * 2;
        break;
      case 'bottom':
        state.x = 0;
        state.y = vh - rowH * 2;
        state.width = vw;
        state.height = rowH * 2;
        break;
      case 'center':
        state.x = colW * 4;
        state.y = rowH * 2;
        state.width = vw - (colW * 8);
        state.height = vh - (rowH * 4);
        break;
      case 'floating':
        // Keep current position, clamp to viewport
        state.x = Math.max(0, Math.min(state.x, vw - state.width));
        state.y = Math.max(0, Math.min(state.y, vh - state.height));
        break;
    }
  }

  private reapplyLayouts(): void {
    for (const [, state] of this.panels) {
      this.applyDockLayout(state);
    }
  }

  getViewportDimensions(): { width: number; height: number } {
    return { width: this.viewportWidth, height: this.viewportHeight };
  }
}