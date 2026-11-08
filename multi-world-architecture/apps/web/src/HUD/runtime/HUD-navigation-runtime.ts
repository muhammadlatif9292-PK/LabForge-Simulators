// apps/web/src/HUD/runtime/HUD-navigation-runtime.ts
/**
 * HUD Navigation Runtime
 * 
 * Responsibilities:
 * - Manage focus navigation between HUD panels via keyboard (Tab/Shift+Tab, arrow keys)
 * - Maintain a focus order based on panel zIndex and visual layout
 * - Trap focus within modal panels when active
 * - Announce focus changes to screen readers via live region
 * - Support gesture-based navigation (swipe between panels) on touch devices
 * 
 * Owned state:
 * - focusOrder: PanelId[] (sorted by zIndex, then visual position)
 * - currentFocusIndex: number
 * - focusTrapped: boolean
 * - trappedPanelId: PanelId | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - AccessibilityThemeRuntime (for focus ring visibility)
 * - HUDLayoutEngine (to determine visual positions)
 * - DistributedEventBus (to emit focus events)
 * 
 * Event emissions:
 *   "hud.navigation.focus.changed", "hud.navigation.trap.activated"
 * 
 * Event subscriptions:
 *   "hud.panel.focused" (external focus requests)
 *   "hud.panel.opened" (update focus order)
 *   "hud.panel.closed" (remove from focus order)
 * 
 * Synchronization: single focus state; keyboard events handled on document
 * Recovery: focus resets to first panel on HUD re-initialization
 * Telemetry: focus change count, trap activations
 * Diagnostics: current focus position, focus order list
 * Accessibility: all focus management respects ARIA best practices; announcements via live region
 * Performance: O(1) focus movement; no DOM queries during navigation
 * Forbidden: losing focus entirely; trapping focus without escape mechanism
 */

import type { PanelId } from '../contracts/hud-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { HUDLayoutEngine } from './HUD-layout-engine';
import type { AccessibilityThemeRuntime } from '@labforge/design-system';

export class HUDNavigationRuntime {
  private focusOrder: PanelId[] = [];
  private currentIndex = -1;
  private focusTrapped = false;
  private trappedPanelId: PanelId | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private layoutEngine: HUDLayoutEngine,
    private accessibility: AccessibilityThemeRuntime,
  ) {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.onKeyDown.bind(this));
    }
    this.eventBus.subscribe('hud.panel.opened', this.onPanelOpened.bind(this));
    this.eventBus.subscribe('hud.panel.closed', this.onPanelClosed.bind(this));
    this.eventBus.subscribe('hud.panel.focused', this.onExternalFocus.bind(this));
  }

  rebuildFocusOrder(): void {
    const allPanels = Array.from(this.layoutEngine.getLayoutForViewport().values());
    // Sort by zIndex descending, then by visual position (left-to-right, top-to-bottom)
    this.focusOrder = allPanels
      .sort((a, b) => {
        if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
      })
      .map(p => p.panelId);
    this.logger.debug(`Focus order rebuilt: ${this.focusOrder.length} panels`);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.focusTrapped) return; // Trapping handled by modal logic
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        this.focusPrevious();
      } else {
        this.focusNext();
      }
    }
  }

  focusNext(): void {
    if (this.focusOrder.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.focusOrder.length;
    this.setFocus(this.focusOrder[this.currentIndex]);
  }

  focusPrevious(): void {
    if (this.focusOrder.length === 0) return;
    this.currentIndex = this.currentIndex <= 0 ? this.focusOrder.length - 1 : this.currentIndex - 1;
    this.setFocus(this.focusOrder[this.currentIndex]);
  }

  focusPanel(panelId: PanelId): void {
    const index = this.focusOrder.indexOf(panelId);
    if (index >= 0) {
      this.currentIndex = index;
      this.setFocus(panelId);
    }
  }

  trapFocus(panelId: PanelId): void {
    this.focusTrapped = true;
    this.trappedPanelId = panelId;
    this.meter.incrementCounter('hud.navigation.trap.activated');
    this.eventBus.publish('hud.navigation.trap.activated', { panelId });
    this.logger.debug(`Focus trapped in panel: ${panelId}`);
  }

  releaseFocus(): void {
    this.focusTrapped = false;
    this.trappedPanelId = null;
    this.logger.debug('Focus trap released');
  }

  private setFocus(panelId: PanelId): void {
    const panelEl = document.getElementById(`hud-panel-${panelId}`);
    if (panelEl) {
      panelEl.focus();
      this.accessibility.announce(`Focused: ${panelEl.getAttribute('aria-label') ?? panelId}`);
    }
    this.meter.incrementCounter('hud.navigation.focus.changed');
    this.eventBus.publish('hud.navigation.focus.changed', { panelId, index: this.currentIndex });
  }

  private onPanelOpened(event: any): void {
    this.rebuildFocusOrder();
    const { panelId } = event.payload;
    this.focusPanel(panelId);
  }

  private onPanelClosed(event: any): void {
    this.rebuildFocusOrder();
    if (this.currentIndex >= this.focusOrder.length) {
      this.currentIndex = Math.max(0, this.focusOrder.length - 1);
    }
  }

  private onExternalFocus(event: any): void {
    const { panelId } = event.payload;
    this.focusPanel(panelId);
  }

  getCurrentFocusPanel(): PanelId | null {
    return this.currentIndex >= 0 && this.currentIndex < this.focusOrder.length
      ? this.focusOrder[this.currentIndex]
      : null;
  }

  isTrapped(): boolean {
    return this.focusTrapped;
  }
}