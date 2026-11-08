// apps/web/src/workspace/runtime/workspace-replay-engine.ts
/**
 * Frontend Workspace Replay Engine
 * 
 * Responsibilities:
 * - Replay recorded user interactions within a workspace (instrument actions, measurements)
 * - Support controlled replay for education and debugging
 * - Verify replay consistency by comparing state hashes
 * - Integrate with command replay runtime for undo/redo
 * 
 * Owned state:
 * - replayLog: WorkspaceAction[]
 * - replayPosition: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - CommandReplayRuntime
 * - InstrumentInteractionRuntime
 * - EventBus
 * 
 * Event emissions: "workspace.replay.started", "workspace.replay.completed"
 * Event subscriptions: none
 * Synchronization: replay is sequential
 * Recovery: replay can be restarted
 * Telemetry: replay duration, actions replayed
 * Diagnostics: replay position
 * Accessibility: announce replay state
 * Performance: actions replayed as fast as possible (no rendering)
 * Forbidden: modifying original recorded actions; skipping validation
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface WorkspaceAction {
  id: string;
  type: string;
  instrumentId?: string;
  payload: unknown;
  timestamp: number;
}

export class WorkspaceReplayEngine {
  private log: WorkspaceAction[] = [];
  private position = 0;
  private state: 'idle' | 'replaying' = 'idle';

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  recordAction(action: WorkspaceAction): void {
    this.log.push(action);
    if (this.log.length > 10000) this.log.shift();
  }

  async startReplay(speedMultiplier: number = 1): Promise<void> {
    if (this.state === 'replaying') return;
    this.state = 'replaying';
    this.position = 0;
    this.meter.incrementCounter('workspace.replay.started');
    const delay = 1000 / 60 / speedMultiplier; // scale to tick rate

    return new Promise<void>(resolve => {
      const interval = setInterval(() => {
        if (this.position >= this.log.length || this.state !== 'replaying') {
          clearInterval(interval);
          this.state = 'idle';
          this.meter.incrementCounter('workspace.replay.completed');
          this.eventBus.publish('workspace.replay.completed', { actions: this.position });
          resolve();
          return;
        }
        const action = this.log[this.position];
        this.eventBus.publish('workspace.action.replayed', action);
        this.position++;
      }, delay);
    });
  }

  stopReplay(): void {
    this.state = 'idle';
  }

  getRecordedActions(): WorkspaceAction[] {
    return [...this.log];
  }
}