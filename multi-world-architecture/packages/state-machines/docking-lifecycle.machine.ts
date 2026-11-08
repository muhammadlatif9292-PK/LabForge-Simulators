// packages/state-machines/docking-lifecycle.machine.ts
/**
 * Docking Lifecycle State Machine
 * 
 * Responsibilities:
 * - Define the formal lifecycle of a docked panel within the HUD
 * - States: detached → docking → docked → undocking → detached, also minimized, maximized, closed
 * - Guard against illegal transitions (e.g., minimizing while already minimized)
 * - Emit lifecycle events for animation coordination and telemetry
 * 
 * Owned state: currentState
 * Dependencies: ILogger, IMeter, DistributedEventBus
 * Event emissions: "docking.state.changed", "docking.transition.rejected"
 * Event subscriptions: none
 * Synchronization: single-threaded; transitions are atomic
 * Recovery: restores to last known valid state
 * Telemetry: transition counts per type, time spent in each state
 * Diagnostics: current docking state per panel
 * Accessibility: state changes announced to screen reader via live region
 * Performance: O(1) transition lookup
 * Forbidden: illegal transitions; zombie panels
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export enum DockingState {
  DETACHED = 'detached',
  DOCKING = 'docking',
  DOCKED = 'docked',
  UNDOCKING = 'undocking',
  MINIMIZED = 'minimized',
  MAXIMIZED = 'maximized',
  CLOSING = 'closing',
  CLOSED = 'closed',
}

export enum DockingEvent {
  ATTACH = 'attach',
  DETACH = 'detach',
  MINIMIZE = 'minimize',
  RESTORE = 'restore',
  MAXIMIZE = 'maximize',
  CLOSE = 'close',
  ANIMATION_COMPLETE = 'animation_complete',
}

interface DockingTransition {
  from: DockingState;
  to: DockingState;
  event: DockingEvent;
}

export class DockingLifecycleMachine {
  private state: DockingState = DockingState.DETACHED;
  private transitionHistory: Array<{ from: DockingState; to: DockingState; event: DockingEvent; timestamp: number }> = [];
  private readonly maxHistory = 50;

  // Allowed transitions
  private static readonly TRANSITIONS: DockingTransition[] = [
    { from: DockingState.DETACHED, to: DockingState.DOCKING, event: DockingEvent.ATTACH },
    { from: DockingState.DOCKING, to: DockingState.DOCKED, event: DockingEvent.ANIMATION_COMPLETE },
    { from: DockingState.DOCKED, to: DockingState.UNDOCKING, event: DockingEvent.DETACH },
    { from: DockingState.DOCKED, to: DockingState.MINIMIZED, event: DockingEvent.MINIMIZE },
    { from: DockingState.DOCKED, to: DockingState.MAXIMIZED, event: DockingEvent.MAXIMIZE },
    { from: DockingState.UNDOCKING, to: DockingState.DETACHED, event: DockingEvent.ANIMATION_COMPLETE },
    { from: DockingState.MINIMIZED, to: DockingState.DOCKED, event: DockingEvent.RESTORE },
    { from: DockingState.MAXIMIZED, to: DockingState.DOCKED, event: DockingEvent.RESTORE },
    { from: DockingState.DETACHED, to: DockingState.CLOSING, event: DockingEvent.CLOSE },
    { from: DockingState.DOCKED, to: DockingState.CLOSING, event: DockingEvent.CLOSE },
    { from: DockingState.MINIMIZED, to: DockingState.CLOSING, event: DockingEvent.CLOSE },
    { from: DockingState.CLOSING, to: DockingState.CLOSED, event: DockingEvent.ANIMATION_COMPLETE },
  ];

  constructor(
    private panelId: string,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getState(): DockingState {
    return this.state;
  }

  canTransition(event: DockingEvent): boolean {
    return DockingLifecycleMachine.TRANSITIONS.some(t => t.from === this.state && t.event === event);
  }

  async send(event: DockingEvent): Promise<boolean> {
    const transition = DockingLifecycleMachine.TRANSITIONS.find(t => t.from === this.state && t.event === event);

    if (!transition) {
      this.logger.warn(`Docking transition rejected: ${this.state} + ${event}`, { panelId: this.panelId });
      this.meter.incrementCounter('docking.transition.rejected', { from: this.state, event });
      await this.eventBus.publish('docking.transition.rejected', {
        panelId: this.panelId,
        from: this.state,
        event,
      });
      return false;
    }

    const oldState = this.state;
    this.state = transition.to;

    this.transitionHistory.push({
      from: oldState,
      to: this.state,
      event,
      timestamp: Date.now(),
    });
    if (this.transitionHistory.length > this.maxHistory) {
      this.transitionHistory.shift();
    }

    this.meter.incrementCounter('docking.state.changed', { from: oldState, to: this.state });
    this.logger.debug(`Docking state: ${oldState} → ${this.state} (event: ${event})`, { panelId: this.panelId });
    await this.eventBus.publish('docking.state.changed', {
      panelId: this.panelId,
      from: oldState,
      to: this.state,
      event,
    });

    return true;
  }

  getTransitionHistory(): Array<{ from: DockingState; to: DockingState; event: DockingEvent; timestamp: number }> {
    return [...this.transitionHistory];
  }

  reset(): void {
    this.state = DockingState.DETACHED;
    this.transitionHistory = [];
  }
}