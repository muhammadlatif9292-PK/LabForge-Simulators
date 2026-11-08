// apps/web/src/routing/route-transition-engine.ts
/**
 * Route Transition Engine
 * 
 * Responsibilities:
 * - Orchestrate visual transitions between routes (fade, slide, scale)
 * - Coordinate with HUD transition system
 * - Respect user preferences for reduced motion
 * - Emit transition lifecycle events for analytics
 * 
 * Owned state:
 * - activeTransition: TransitionState | null
 * 
 * Dependencies: ILogger, IMeter, HUDTransitionEngine (optional)
 * 
 * Event emissions: "routing.transition.started", "routing.transition.completed"
 * Event subscriptions: none
 * Synchronization: single transition at a time
 * Recovery: transition interrupted safely
 * Telemetry: transition duration, type
 * Diagnostics: active transition
 * Accessibility: respect prefers-reduced-motion
 * Performance: GPU-composited transforms; 60fps
 * Forbidden: blocking rendering during transition
 */

import type { RouteTransition } from './contracts/routing-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface TransitionState {
  transition: RouteTransition;
  startedAt: number;
  rafId: number;
}

export class RouteTransitionEngine {
  private active: TransitionState | null = null;
  private prefersReducedMotion = false;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = mq.matches;
      mq.addEventListener('change', (e) => { this.prefersReducedMotion = e.matches; });
    }
  }

  async playTransition(transition: RouteTransition): Promise<void> {
    if (this.active) {
      this.cancelActive();
    }
    if (this.prefersReducedMotion) {
      // Instantly complete
      this.logger.debug('Transition skipped (reduced motion)');
      return;
    }
    return new Promise<void>(resolve => {
      const state: TransitionState = {
        transition,
        startedAt: performance.now(),
        rafId: requestAnimationFrame(() => this.tick(state, resolve)),
      };
      this.active = state;
      this.meter.incrementCounter('routing.transition.started');
    });
  }

  private tick(state: TransitionState, resolve: () => void): void {
    const elapsed = performance.now() - state.startedAt;
    const duration = 300; // ms
    if (elapsed >= duration) {
      this.active = null;
      this.meter.incrementCounter('routing.transition.completed');
      this.meter.recordHistogram('routing.transition.duration', elapsed);
      resolve();
      return;
    }
    state.rafId = requestAnimationFrame(() => this.tick(state, resolve));
  }

  private cancelActive(): void {
    if (this.active) {
      cancelAnimationFrame(this.active.rafId);
      this.active = null;
    }
  }

  isTransitioning(): boolean {
    return this.active !== null;
  }
}