// packages/state-machines/world-streaming.machine.ts
/**
 * World Streaming State Machine
 * 
 * Responsibilities:
 * - Formalise asset streaming state per world: idle → queued → fetching → (done | failed)
 * - Track download progress and retry attempts
 * - Ensure only critical assets block world readiness
 * 
 * Owned state: currentState
 * Dependencies: ILogger, IMeter, DistributedEventBus
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export enum WorldStreamState {
  IDLE = 'idle',
  QUEUED = 'queued',
  FETCHING = 'fetching',
  PAUSED = 'paused',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

export enum WorldStreamEvent {
  ENQUEUE = 'enqueue',
  START_FETCH = 'start_fetch',
  PROGRESS = 'progress',
  PAUSE = 'pause',
  RESUME = 'resume',
  COMPLETE = 'complete',
  FAIL = 'fail',
  RETRY = 'retry',
}

export class WorldStreamingMachine {
  private state: WorldStreamState = WorldStreamState.IDLE;

  private static readonly TRANSITIONS: Record<string, WorldStreamState> = {
    [`${WorldStreamState.IDLE}.${WorldStreamEvent.ENQUEUE}`]: WorldStreamState.QUEUED,
    [`${WorldStreamState.QUEUED}.${WorldStreamEvent.START_FETCH}`]: WorldStreamState.FETCHING,
    [`${WorldStreamState.FETCHING}.${WorldStreamEvent.PROGRESS}`]: WorldStreamState.FETCHING,
    [`${WorldStreamState.FETCHING}.${WorldStreamEvent.PAUSE}`]: WorldStreamState.PAUSED,
    [`${WorldStreamState.PAUSED}.${WorldStreamEvent.RESUME}`]: WorldStreamState.FETCHING,
    [`${WorldStreamState.FETCHING}.${WorldStreamEvent.COMPLETE}`]: WorldStreamState.COMPLETE,
    [`${WorldStreamState.FETCHING}.${WorldStreamEvent.FAIL}`]: WorldStreamState.FAILED,
    [`${WorldStreamState.FAILED}.${WorldStreamEvent.RETRY}`]: WorldStreamState.QUEUED,
  };

  constructor(
    private worldId: string,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getState(): WorldStreamState { return this.state; }

  async send(event: WorldStreamEvent): Promise<boolean> {
    const key = `${this.state}.${event}`;
    const target = WorldStreamingMachine.TRANSITIONS[key];
    if (!target) {
      this.logger.warn(`World stream transition rejected: ${this.state} + ${event}`);
      return false;
    }
    this.state = target;
    this.meter.incrementCounter('world.streaming.state.changed', { state: this.state });
    return true;
  }
}