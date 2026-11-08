// packages/experiment-runtime/runtime/experiment-runtime.ts
/**
 * Experiment Runtime
 * 
 * Responsibilities:
 * - Orchestrate the full experiment: lifecycle, timeline recording, branching,
 *   autosave, replay, and recovery
 * - Serve as the single entry point for all experiment operations
 * - Coordinate with instruments, simulations, and measurements
 * - Maintain the experiment session as the source of truth
 * - Never lose data: every action is recorded on the timeline
 * 
 * Owned state:
 * - session: ExperimentSession
 * - lifecycle: ExperimentLifecycle
 * - serializer: ExperimentSerializer
 * - autosave: ExperimentAutosaveRuntime
 * - replayEngine: ExperimentReplayEngine
 * - branchRuntime: ExperimentBranchRuntime
 * - recovery: ExperimentRecoveryEngine
 * - timelineRuntime: TimelineRuntime
 * 
 * Dependencies:
 * - ILogger, IMeter, ITracer
 * - DistributedEventBus
 * - All sub-runtimes listed above
 * 
 * Event emissions:
 *   "experiment.created", "experiment.started", "experiment.paused",
 *   "experiment.resumed", "experiment.completed", "experiment.failed",
 *   "experiment.archived", "experiment.data.changed"
 * 
 * Event subscriptions:
 *   "instrument.measurement.recorded" (to log on timeline)
 *   "command.committed" (to log user actions)
 * 
 * Synchronization: single session per experiment; timeline is append-only
 * Recovery: autosave + recovery engine ensure no data loss
 * Telemetry: experiment duration, event count, branch count
 * Diagnostics: session health, unsaved changes
 * Accessibility: experiment data exportable in accessible formats
 * Performance: timeline capped at configurable maximum; autosave in background
 * Forbidden: data loss during crash; silent failure of autosave
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ExperimentId, ExperimentDescriptor, ExperimentStatus,
  ExperimentSession, ExperimentBranch, ExperimentSnapshot,
  ExperimentHealth, BranchId, TimelineEvent,
} from '../contracts/experiment-contracts';
import { TimelineEventType } from '../contracts/experiment-contracts';
import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { ExperimentLifecycle } from './experiment-lifecycle';
import { ExperimentSerializer } from './experiment-serializer';
import { ExperimentAutosaveRuntime } from './experiment-autosave-runtime';
import { ExperimentReplayEngine } from './experiment-replay-engine';
import { ExperimentBranchRuntime } from './experiment-branch-runtime';
import { ExperimentRecoveryEngine } from './experiment-recovery-engine';
import { TimelineRuntime } from '../timeline/timeline-runtime';

export class ExperimentRuntime {
  private session: ExperimentSession;
  private lifecycle: ExperimentLifecycle;
  private serializer: ExperimentSerializer;
  private autosaveRuntime: ExperimentAutosaveRuntime;
  private replayEngine: ExperimentReplayEngine;
  private branchRuntime: ExperimentBranchRuntime;
  private recoveryEngine: ExperimentRecoveryEngine;
  private timelineRuntime: TimelineRuntime;
  private dirty = false;

  constructor(
    descriptor: ExperimentDescriptor,
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private eventBus: DistributedEventBus,
    private storage: any,
  ) {
    this.lifecycle = new ExperimentLifecycle(descriptor.id, logger, meter, eventBus);
    this.serializer = new ExperimentSerializer(logger, meter);
    this.autosaveRuntime = new ExperimentAutosaveRuntime(logger, meter, storage, this.serializer);
    this.replayEngine = new ExperimentReplayEngine(logger, meter, eventBus, this);
    this.branchRuntime = new ExperimentBranchRuntime(descriptor.id, logger, meter, eventBus);
    this.recoveryEngine = new ExperimentRecoveryEngine(descriptor.id, logger, meter, storage, this.serializer);
    this.timelineRuntime = new TimelineRuntime(descriptor.id, logger, meter, eventBus);
    this.session = {
      descriptor: { ...descriptor, status: 'created' },
      branches: [this.branchRuntime.createMainBranch()],
      activeBranchId: 'main' as BranchId,
      timeline: [],
      autoSaveInterval: 30000,
      dirty: false,
    };
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.eventBus.subscribe('instrument.measurement.recorded', this.onMeasurementRecorded.bind(this));
    this.eventBus.subscribe('command.committed', this.onCommandCommitted.bind(this));
  }

  async start(): Promise<void> {
    await this.lifecycle.transition('running', 'Experiment started by user');
    this.session.descriptor.status = 'running';
    this.autosaveRuntime.start(this.session);
    this.meter.incrementCounter('experiment.started');
    await this.eventBus.publish('experiment.started', { experimentId: this.session.descriptor.id });
    this.logger.info(`Experiment started: ${this.session.descriptor.title}`);
  }

  async pause(): Promise<void> {
    await this.lifecycle.transition('paused', 'Experiment paused');
    this.session.descriptor.status = 'paused';
    this.autosaveRuntime.stop();
    await this.autosaveRuntime.saveSnapshot(this.session, this.session.activeBranchId);
    await this.eventBus.publish('experiment.paused', { experimentId: this.session.descriptor.id });
  }

  async resume(): Promise<void> {
    await this.lifecycle.transition('running', 'Experiment resumed');
    this.session.descriptor.status = 'running';
    this.autosaveRuntime.start(this.session);
    await this.eventBus.publish('experiment.resumed', { experimentId: this.session.descriptor.id });
  }

  async complete(): Promise<void> {
    await this.lifecycle.transition('completed', 'Experiment completed');
    this.session.descriptor.status = 'completed';
    this.autosaveRuntime.stop();
    await this.autosaveRuntime.saveSnapshot(this.session, this.session.activeBranchId);
    await this.eventBus.publish('experiment.completed', { experimentId: this.session.descriptor.id });
  }

  async fail(error: string): Promise<void> {
    await this.lifecycle.transition('failed', error);
    this.session.descriptor.status = 'failed';
    this.autosaveRuntime.stop();
    await this.autosaveRuntime.saveSnapshot(this.session, this.session.activeBranchId);
    await this.eventBus.publish('experiment.failed', { experimentId: this.session.descriptor.id, error });
  }

  async archive(): Promise<void> {
    await this.lifecycle.transition('archived', 'Experiment archived');
    this.session.descriptor.status = 'archived';
    this.autosaveRuntime.stop();
    await this.eventBus.publish('experiment.archived', { experimentId: this.session.descriptor.id });
  }

  // --- Timeline recording ---

  private async onMeasurementRecorded(event: any): Promise<void> {
    const measurement = event.payload;
    await this.recordEvent(TimelineEventType.MEASUREMENT, 'user', measurement);
  }

  private async onCommandCommitted(event: any): Promise<void> {
    const { commandId, type } = event.payload;
    await this.recordEvent(TimelineEventType.INSTRUMENT_ACTION, 'user', { commandId, commandType: type });
  }

  async recordEvent(type: TimelineEventType, actor: 'user' | 'ai' | 'system', payload: unknown, metadata?: Record<string, unknown>): Promise<TimelineEventId> {
    const event = await this.timelineRuntime.appendEvent(this.session.activeBranchId, type, actor, payload, metadata);
    this.session.timeline = this.timelineRuntime.getEvents(this.session.activeBranchId);
    this.dirty = true;
    this.session.dirty = true;
    await this.eventBus.publish('experiment.data.changed', {
      experimentId: this.session.descriptor.id,
      eventType: type,
      eventId: event,
    });
    return event;
  }

  async addUserNote(text: string): Promise<TimelineEventId> {
    return this.recordEvent(TimelineEventType.USER_NOTE, 'user', { text });
  }

  async addHypothesis(statement: string): Promise<TimelineEventId> {
    return this.recordEvent(TimelineEventType.HYPOTHESIS, 'user', { statement });
  }

  async addConclusion(conclusion: string): Promise<TimelineEventId> {
    return this.recordEvent(TimelineEventType.CONCLUSION, 'user', { conclusion });
  }

  // --- Branching ---

  async createBranch(name: string, description?: string): Promise<ExperimentBranch> {
    const branch = await this.branchRuntime.createBranch(name, this.session.activeBranchId, description);
    this.session.branches.push(branch);
    this.session.activeBranchId = branch.id;
    await this.recordEvent(TimelineEventType.BRANCH_CREATED, 'user', { branchId: branch.id, name });
    return branch;
  }

  async switchBranch(branchId: BranchId): Promise<void> {
    const branch = this.branchRuntime.getBranch(branchId);
    if (!branch) throw new Error(`Branch not found: ${branchId}`);
    // Save current branch state before switching
    await this.autosaveRuntime.saveSnapshot(this.session, this.session.activeBranchId);
    this.session.activeBranchId = branchId;
    this.session.timeline = this.timelineRuntime.getEvents(branchId);
    this.logger.info(`Switched to branch: ${branch.name}`);
  }

  // --- Replay ---

  async startReplay(config?: Partial<import('../contracts/experiment-contracts').ReplayConfig>): Promise<void> {
    await this.replayEngine.startReplay(this.session, config);
  }

  // --- Recovery ---

  async saveSnapshot(): Promise<ExperimentSnapshot> {
    return this.autosaveRuntime.saveSnapshot(this.session, this.session.activeBranchId);
  }

  async loadSnapshot(snapshotId: SnapshotId): Promise<void> {
    const snapshot = await this.autosaveRuntime.loadSnapshot(snapshotId);
    if (snapshot) {
      this.session.descriptor = snapshot.state as any; // restored
      this.dirty = false;
    }
  }

  async restoreFromRecovery(): Promise<boolean> {
    const restored = await this.recoveryEngine.restore();
    if (restored) {
      this.session = restored as any;
      this.lifecycle.restoreState(this.session.descriptor.status);
      return true;
    }
    return false;
  }

  // --- Accessors ---

  getDescriptor(): ExperimentDescriptor {
    return { ...this.session.descriptor };
  }

  getSession(): ExperimentSession {
    return this.session;
  }

  getTimeline(): TimelineEvent[] {
    return this.timelineRuntime.getEvents(this.session.activeBranchId);
  }

  getBranches(): ExperimentBranch[] {
    return this.branchRuntime.getAllBranches();
  }

  getHealth(): ExperimentHealth {
    return {
      experimentId: this.session.descriptor.id,
      status: this.session.descriptor.status,
      totalEvents: this.session.timeline.length,
      branches: this.session.branches.length,
      lastSnapshotTimestamp: this.autosaveRuntime.getLastSnapshotTimestamp(),
      unsavedEvents: this.dirty ? this.session.timeline.length - (this.autosaveRuntime.getLastSnapshotSequence() ?? 0) : 0,
      recoveryState: 'healthy',
    };
  }

  async shutdown(): Promise<void> {
    this.autosaveRuntime.stop();
    if (this.dirty) {
      await this.autosaveRuntime.saveSnapshot(this.session, this.session.activeBranchId);
    }
    this.timelineRuntime.clear();
    this.logger.info('Experiment runtime shut down');
  }
}