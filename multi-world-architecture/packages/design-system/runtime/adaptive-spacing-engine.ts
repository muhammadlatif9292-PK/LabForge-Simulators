// packages/design-system/runtime/adaptive-spacing-engine.ts
/**
 * Adaptive Spacing Engine
 * 
 * Responsibilities:
 * - Compute spacing values dynamically based on viewport size
 * - Adjust panel layouts for different screen widths while maintaining landscape
 * - Provide responsive breakpoint detection
 * - Scale HUD elements for readability on small screens
 * 
 * Owned state:
 * - currentBreakpoint: BreakpointId
 * - viewportWidth: number
 * - viewportHeight: number
 * 
 * Dependencies: ILogger, IMeter, ThemeRuntime
 * 
 * Event emissions: "design.breakpoint.changed"
 * Event subscriptions: none (listens to resize)
 * Synchronization: resize is debounced
 * Recovery: re-computes on next resize
 * Telemetry: breakpoint change count
 * Diagnostics: current viewport dimensions
 * Accessibility: ensures minimum touch target sizes
 * Performance: debounced resize handler; CSS-based where possible
 * Forbidden: responsive layouts that violate landscape-only constraint
 */

import type { BreakpointId } from '../contracts/design-system-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { ThemeRuntime } from './theme-runtime';

export class AdaptiveSpacingEngine {
  private currentBreakpoint: string = 'lg';
  private viewportWidth = 1920;
  private viewportHeight = 1080;
  private resizeTimer: any = null;
  private readonly DEBOUNCE_MS = 150;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private themeRuntime: ThemeRuntime,
  ) {
    if (typeof window !== 'undefined') {
      this.measureViewport();
      window.addEventListener('resize', this.onResize.bind(this));
      window.addEventListener('orientationchange', this.onResize.bind(this));
    }
  }

  private onResize(): void {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.measureViewport(), this.DEBOUNCE_MS);
  }

  private measureViewport(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width === this.viewportWidth && height === this.viewportHeight) return;
    this.viewportWidth = width;
    this.viewportHeight = height;
    const newBreakpoint = this.computeBreakpoint(width);
    if (newBreakpoint !== this.currentBreakpoint) {
      this.currentBreakpoint = newBreakpoint;
      this.meter.incrementCounter('design.breakpoint.changed', { breakpoint: newBreakpoint });
      this.eventBus.publish('design.breakpoint.changed', {
        breakpoint: newBreakpoint,
        width,
        height,
      });
      this.logger.debug(`Breakpoint changed: ${newBreakpoint} (${width}x${height})`);
    }
  }

  private computeBreakpoint(width: number): string {
    const theme = this.themeRuntime.getActiveTheme();
    const breakpoints = theme?.breakpoints;
    if (!breakpoints) return 'lg';
    // Sort by value descending and find first matching
    const sorted = Array.from(breakpoints.entries()).sort((a, b) => b[1] - a[1]);
    for (const [id, value] of sorted) {
      if (width >= value) return id;
    }
    return sorted[sorted.length - 1]?.[0] ?? 'xs';
  }

  getCurrentBreakpoint(): string {
    return this.currentBreakpoint;
  }

  getViewportWidth(): number {
    return this.viewportWidth;
  }

  getViewportHeight(): number {
    return this.viewportHeight;
  }

  isLandscape(): boolean {
    return this.viewportWidth >= this.viewportHeight;
  }

  // Compute panel layout for current viewport
  computePanelLayout(panelCount: number, availableWidth: number): number[] {
    const widths: number[] = [];
    const spacing = 8;
    const totalSpacing = spacing * (panelCount - 1);
    const contentWidth = availableWidth - totalSpacing;
    const panelWidth = Math.floor(contentWidth / panelCount);
    for (let i = 0; i < panelCount; i++) {
      widths.push(panelWidth);
    }
    return widths;
  }
}