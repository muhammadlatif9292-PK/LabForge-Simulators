// packages/state-machines/AI-streaming.machine.ts
/**
 * AI Streaming State Machine
 * 
 * Responsibilities:
 * - Formalise the lifecycle of an AI streaming response
 * - States: idle → connecting → streaming → finishing → complete (or error)
 * - Handle pause/resume and cancellation
 * - Track buffer health and emit pressure events
 * 
 * Owned state: currentState, streamId
 * Dependencies: ILogger, IMeter, DistributedEventBus
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export enum AIStreamState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  STREAMING = 'streaming',
  PAUSED = 'paused',
  FINISHING = 'finishing',
  COMPLETE = 'complete',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

export enum AIStreamEvent {
  START_STREAM = 'start_stream',
  CONNECTED = 'connected',
  CHUNK_RECEIVED = 'chunk_received',
  PAUSE = 'pause',
  RESUME = 'resume',
  FINAL_CHUNK = 'final_chunk',
  STREAM_COMPLETE = 'stream_complete',
  CANCEL = 'cancel',
  ERROR = 'error',
  RESET = 'reset',
}

export class AIStreamingMachine {
  private state: AIStreamState = AIStreamState.IDLE;
  private chunksReceived = 0;

  private static readonly TRANSITIONS: Array<{ from: AIStreamState; to: AIStreamState; event: AIStreamEvent }> = [
    { from: AIStreamState.IDLE, to: AIStreamState.CONNECTING, event: AIStreamEvent.START_STREAM },
    { from: AIStreamState.CONNECTING, to: AIStreamState.STREAMING, event: AIStreamEvent.CONNECTED },
    { from: AIStreamState.STREAMING, to: AIStreamState.STREAMING, event: AIStreamEvent.CHUNK_RECEIVED },
    { from: AIStreamState.STREAMING, to: AIStreamState.PAUSED, event: AIStreamEvent.PAUSE },
    { from: AIStreamState.PAUSED, to: AIStreamState.STREAMING, event: AIStreamEvent.RESUME },
    { from: AIStreamState.STREAMING, to: AIStreamState.FINISHING, event: AIStreamEvent.FINAL_CHUNK },
    { from: AIStreamState.FINISHING, to: AIStreamState.COMPLETE, event: AIStreamEvent.STREAM_COMPLETE },
    { from: AIStreamState.STREAMING, to: AIStreamState.CANCELLED, event: AIStreamEvent.CANCEL },
    { from: AIStreamState.PAUSED, to: AIStreamState.CANCELLED, event: AIStreamEvent.CANCEL },
    { from: AIStreamState.CONNECTING, to: AIStreamState.ERROR, event: AIStreamEvent.ERROR },
    { from: AIStreamState.STREAMING, to: AIStreamState.ERROR, event: AIStreamEvent.ERROR },
    { from: AIStreamState.ERROR, to: AIStreamState.IDLE, event: AIStreamEvent.RESET },
    { from: AIStreamState.CANCELLED, to: AIStreamState.IDLE, event: AIStreamEvent.RESET },
    { from: AIStreamState.COMPLETE, to: AIStreamState.IDLE, event: AIStreamEvent.RESET },
  ];

  constructor(
    private streamId: string,
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  getState(): AIStreamState { return this.state; }

  async send(event: AIStreamEvent): Promise<boolean> {
    const transition = AIStreamingMachine.TRANSITIONS.find(t => t.from === this.state && t.event === event);
    if (!transition) {
      this.logger.warn(`AI stream transition rejected: ${this.state} + ${event}`, { streamId: this.streamId });
      return false;
    }
    const oldState = this.state;
    this.state = transition.to;
    if (event === AIStreamEvent.CHUNK_RECEIVED) this.chunksReceived++;
    this.meter.incrementCounter('ai.stream.state.changed', { from: oldState, to: this.state });
    await this.eventBus.publish('ai.stream.state.changed', { streamId: this.streamId, from: oldState, to: this.state, event });
    return true;
  }

  getChunksReceived(): number { return this.chunksReceived; }
}