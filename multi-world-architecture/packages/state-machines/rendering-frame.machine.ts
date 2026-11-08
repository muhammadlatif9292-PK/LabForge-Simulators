// packages/state-machines/rendering-frame.machine.ts
/**
 * Rendering Frame State Machine
 * 
 * Responsibilities:
 * - Formalise the lifecycle of a single rendered frame
 * - States: idle → preparing → gpu_wait → compositing → presenting → idle
 * - Guard against overlapping frames (ensure previous frame completed before next)
 * - Track frame budget (over/under 16.67ms at 60fps)
 * - Emit frame lifecycle events for performance telemetry
 * 
 * Owned state: currentState, frameStartTime
 * Dependencies: ILogger, IMeter
 * Event emissions: "rendering.frame.completed", "rendering.frame.budget.exceeded"
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export enum FrameState {
  IDLE = 'idle',
  PREPARING = 'preparing',
  GPU_SUBMIT = 'gpu_submit',
  GPU_WAIT = 'gpu_wait',
  COMPOSITING = 'compositing',
  PRESENTING = 'presenting',
  ERROR = 'error',
}

export enum FrameEvent {
  BEGIN_FRAME = 'begin_frame',
  PREPARE_COMPLETE = 'prepare_complete',
  GPU_SUBMITTED = 'gpu_submitted',
  GPU_COMPLETE = 'gpu_complete',
  COMPOSITE_COMPLETE = 'composite_complete',
  PRESENT_COMPLETE = 'present_complete',
  ERROR = 'error',
}

export class RenderingFrameMachine {
  private state: FrameState = FrameState.IDLE;
  private frameStartTime = 0;

  private static readonly TRANSITIONS: Array<{ from: FrameState; to: FrameState; event: FrameEvent }> = [
    { from: FrameState.IDLE, to: FrameState.PREPARING, event: FrameEvent.BEGIN_FRAME },
    { from: FrameState.PREPARING, to: FrameState.GPU_SUBMIT, event: FrameEvent.PREPARE_COMPLETE },
    { from: FrameState.GPU_SUBMIT, to: FrameState.GPU_WAIT, event: FrameEvent.GPU_SUBMITTED },
    { from: FrameState.GPU_WAIT, to: FrameState.COMPOSITING, event: FrameEvent.GPU_COMPLETE },
    { from: FrameState.COMPOSITING, to: FrameState.PRESENTING, event: FrameEvent.COMPOSITE_COMPLETE },
    { from: FrameState.PRESENTING, to: FrameState.IDLE, event: FrameEvent.PRESENT_COMPLETE },
    { from: FrameState.IDLE, to: FrameState.ERROR, event: FrameEvent.ERROR },
    { from: FrameState.PREPARING, to: FrameState.ERROR, event: FrameEvent.ERROR },
    { from: FrameState.GPU_WAIT, to: FrameState.ERROR, event: FrameEvent.ERROR },
    { from: FrameState.ERROR, to: FrameState.IDLE, event: FrameEvent.BEGIN_FRAME },
  ];

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getState(): FrameState { return this.state; }

  async send(event: FrameEvent): Promise<boolean> {
    if (event === FrameEvent.BEGIN_FRAME) {
      this.frameStartTime = performance.now();
    }

    const transition = RenderingFrameMachine.TRANSITIONS.find(t => t.from === this.state && t.event === event);
    if (!transition) {
      this.logger.warn(`Frame transition rejected: ${this.state} + ${event}`);
      return false;
    }

    const oldState = this.state;
    this.state = transition.to;

    if (event === FrameEvent.PRESENT_COMPLETE && this.state === FrameState.IDLE) {
      const frameTime = performance.now() - this.frameStartTime;
      const budgetMs = 1000 / 60;
      this.meter.recordHistogram('rendering.frame.duration', frameTime);
      if (frameTime > budgetMs) {
        this.meter.incrementCounter('rendering.frame.budget.exceeded');
        await this.eventBus.publish('rendering.frame.budget.exceeded', { frameTimeMs: frameTime, budgetMs });
      }
      await this.eventBus.publish('rendering.frame.completed', { frameTimeMs: frameTime });
    }

    return true;
  }

  getFrameStartTime(): number { return this.frameStartTime; }
}