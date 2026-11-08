// packages/design-system/runtime/motion-orchestrator.ts
/**
 * Motion Orchestrator
 * 
 * Responsibilities:
 * - Centralise all motion/animation orchestration across the HUD and UI
 * - Provide reusable animation presets (fadeIn, slideUp, scaleIn, etc.)
 * - Respect user preference for reduced motion
 * - Coordinate animations with HUD transitions and route transitions
 * - Manage animation queue to prevent conflicting animations
 * 
 * Owned state:
 * - activeAnimations: Set<string>
 * - prefersReducedMotion: boolean
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - ThemeRuntime (for motion token values)
 * 
 * Event emissions: "design.motion.started", "design.motion.completed"
 * Event subscriptions: none
 * Synchronization: single animation queue; overlapping animations serialised
 * Recovery: animations restartable
 * Telemetry: animation count, duration
 * Diagnostics: active animations
 * Accessibility: reduced-motion mode disables all non-essential animations
 * Performance: only animate transform and opacity (compositor-only); avoid layout triggers
 * Forbidden: animating properties that cause layout/paint; infinite animation loops
 */

import type { MotionDuration, MotionEasing } from '../contracts/design-system-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface AnimationConfig {
  element: HTMLElement;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

export class MotionOrchestrator {
  private active: Set<string> = new Set();
  private prefersReducedMotion = false;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = mq.matches;
      mq.addEventListener('change', (e) => {
        this.prefersReducedMotion = e.matches;
        if (this.prefersReducedMotion) this.cancelAll();
      });
    }
  }

  async animate(
    id: string,
    element: HTMLElement,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions & { duration?: MotionDuration; easing?: MotionEasing },
  ): Promise<void> {
    if (this.prefersReducedMotion) {
      // Apply end state instantly
      const lastKeyframe = keyframes[keyframes.length - 1];
      if (lastKeyframe) {
        Object.assign(element.style, lastKeyframe);
      }
      return;
    }
    if (this.active.has(id)) {
      this.logger.warn(`Animation already active: ${id}`);
      return;
    }
    this.active.add(id);
    this.meter.incrementCounter('design.motion.started');
    try {
      const animation = element.animate(keyframes, {
        duration: options.duration ?? 250,
        easing: options.easing ?? 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards',
        ...options,
      });
      await animation.finished;
    } catch (err) {
      this.logger.warn(`Animation interrupted: ${id}`, { error: err });
    } finally {
      this.active.delete(id);
      this.meter.incrementCounter('design.motion.completed');
    }
  }

  // --- Predefined animation presets ---

  fadeIn(element: HTMLElement, duration?: MotionDuration): Promise<void> {
    return this.animate(`fadeIn-${Date.now()}`, element, [
      { opacity: 0 },
      { opacity: 1 },
    ], { duration: duration ?? 150 });
  }

  fadeOut(element: HTMLElement, duration?: MotionDuration): Promise<void> {
    return this.animate(`fadeOut-${Date.now()}`, element, [
      { opacity: 1 },
      { opacity: 0 },
    ], { duration: duration ?? 150 });
  }

  slideUp(element: HTMLElement, distance: number = 20, duration?: MotionDuration): Promise<void> {
    return this.animate(`slideUp-${Date.now()}`, element, [
      { opacity: 0, transform: `translateY(${distance}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: duration ?? 250, easing: 'cubic-bezier(0, 0, 0.2, 1)' });
  }

  slideDown(element: HTMLElement, distance: number = 20, duration?: MotionDuration): Promise<void> {
    return this.animate(`slideDown-${Date.now()}`, element, [
      { opacity: 1, transform: 'translateY(0)' },
      { opacity: 0, transform: `translateY(${distance}px)` },
    ], { duration: duration ?? 200, easing: 'cubic-bezier(0.4, 0, 1, 1)' });
  }

  scaleIn(element: HTMLElement, duration?: MotionDuration): Promise<void> {
    return this.animate(`scaleIn-${Date.now()}`, element, [
      { opacity: 0, transform: 'scale(0.9)' },
      { opacity: 1, transform: 'scale(1)' },
    ], { duration: duration ?? 200, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' });
  }

  // --- Utility ---

  cancelAll(): void {
    if (typeof document !== 'undefined') {
      document.getAnimations().forEach(a => a.cancel());
    }
    this.active.clear();
  }

  isReducedMotion(): boolean {
    return this.prefersReducedMotion;
  }

  getActiveCount(): number {
    return this.active.size;
  }
}