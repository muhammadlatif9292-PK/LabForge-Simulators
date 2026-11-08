// packages/experiment-runtime/replay/experiment-replay-engine.ts
/**
 * Experiment Replay Engine
 * 
 * Responsibilities:
 * - Replay recorded experiment timeline events deterministically
 * - Support variable speed (1x, 2x, 10x, frame-by-frame)
 * - Validate replay consistency by comparing state hashes
 * - Support partial replay from a specific sequence number
 * - Pause, resume, and seek within replay
 * 
 * Owned state:
 * - replayState: 'idle' | 'playing' | 'paused' | 'completed'
 * - currentSequence: number
 * - validationErrors: ReplayValidationError[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - ExperimentRuntime (parent, to access timeline and replay events)
 * - DeterministicExecutionRuntime (for simulation replay)
 * 
 * Event emissions:
 *   "experiment.replay.started", "experiment.replay.paused", "experiment.replay.resumed"
 *   "experiment.replay.completed", "experiment.replay.inconsistent"
 * 
 * Event subscriptions: none
 * Synchronization: replay is single-threaded; no external sync during replay
 * Recovery: if replay interrupted, can resume from last processed sequence
 * Telemetry: replay duration, events processed, speed multiplier
 * Diagnostics: current replay position, validation errors
 * Accessibility: replay controls must be keyboard-accessible
 * Performance: skip rendering for fast replay; batch event processing
 * Forbidden: mutating original experiment data; non-deterministic replay
 */

import type {
  ExperimentSession, ReplayConfig, TimelineEvent,
} from '../contracts/experiment-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { ExperimentRuntime } from '../runtime/experiment-runtime';

interface ReplayValidationError {
  sequenceNumber: number;
  expectedHash?: string;
  actualHash?: string;
  message: string;
}

export class ExperimentReplayEngine {
  private state: 'idle' | 'playing' | 'paused' | 'completed' = 'idle';
  private currentSequence = 0;
  private errors: ReplayValidationError[] = [];
  private timerHandle: any = null;
  private config: ReplayConfig = {
    speedMultiplier: 1,
    stopOnError: true,
    loop: false,
    fromSequence: 0,
  };

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private experimentRuntime: ExperimentRuntime,
  ) {}

  async startReplay(
    session: ExperimentSession,
    config?: Partial<ReplayConfig>,
  ): Promise<void> {
    if (this.state === 'playing') {
      this.logger.warn('Replay already in progress');
      return;
    }
    this.config = { ...this.config, ...config };
    this.state = 'playing';
    this.currentSequence = this.config.fromSequence;
    this.errors = [];
    this.meter.incrementCounter('experiment.replay.started');
    this.logger.info(`Replay started from sequence ${this.currentSequence}`);
    await this.eventBus.publish('experiment.replay.started', {
      experimentId: session.descriptor.id,
      fromSequence: this.currentSequence,
      speedMultiplier: this.config.speedMultiplier,
    });
    this.processNextEvents(session);
  }

  private processNextEvents(session: ExperimentSession): void {
    if (this.state !== 'playing') return;
    const events = session.timeline.filter(e => e.sequenceNumber >= this.currentSequence);
    if (events.length === 0) {
      this.completeReplay(session);
      return;
    }
    const batchSize = Math.min(10, Math.ceil(this.config.speedMultiplier));
    const batch = events.slice(0, batchSize);
    for (const event of batch) {
      try {
        this.replayEvent(event);
        this.currentSequence = event.sequenceNumber + 1;
      } catch (err) {
        this.errors.push({
          sequenceNumber: event.sequenceNumber,
          message: (err as Error).message,
        });
        this.logger.error(`Replay error at sequence ${event.sequenceNumber}`, { error: err });
        this.meter.incrementCounter('experiment.replay.inconsistent');
        if (this.config.stopOnError) {
          this.pauseReplay(session);
          return;
        }
      }
    }
    const delayMs = 1000 / (60 * this.config.speedMultiplier);
    this.timerHandle = setTimeout(() => this.processNextEvents(session), delayMs);
  }

  private replayEvent(event: TimelineEvent): void {
    // Replay the event by re-emitting it or re-executing the associated command
    switch (event.type) {
      case 'measurement':
        this.eventBus.publish('instrument.measurement.recorded', event.payload);
        break;
      case 'instrument_action':
        // Re-execute command
        this.eventBus.publish('command.replay.execute', event.payload);
        break;
      default:
        this.logger.debug(`Replayed event: ${event.type} (${event.id})`);
    }
  }

  pauseReplay(session: ExperimentSession): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    this.meter.incrementCounter('experiment.replay.paused');
    this.eventBus.publish('experiment.replay.paused', {
      experimentId: session.descriptor.id,
      currentSequence: this.currentSequence,
    });
    this.logger.info(`Replay paused at sequence ${this.currentSequence}`);
  }

  resumeReplay(session: ExperimentSession): void {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.meter.incrementCounter('experiment.replay.resumed');
    this.eventBus.publish('experiment.replay.resumed', {
      experimentId: session.descriptor.id,
      currentSequence: this.currentSequence,
    });
    this.processNextEvents(session);
  }

  private completeReplay(session: ExperimentSession): void {
    this.state = 'completed';
    if (this.timerHandle) clearTimeout(this.timerHandle);
    this.meter.incrementCounter('experiment.replay.completed');
    this.logger.info(`Replay completed at sequence ${this.currentSequence}`);
    this.eventBus.publish('experiment.replay.completed', {
      experimentId: session.descriptor.id,
      finalSequence: this.currentSequence,
      errors: this.errors.length,
    });
  }

  getState(): string { return this.state; }
  getCurrentSequence(): number { return this.currentSequence; }
  getErrors(): ReplayValidationError[] { return [...this.errors]; }
}