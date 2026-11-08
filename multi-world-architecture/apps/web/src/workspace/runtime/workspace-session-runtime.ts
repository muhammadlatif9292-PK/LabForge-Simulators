// apps/web/src/workspace/runtime/workspace-session-runtime.ts
/**
 * Frontend Workspace Session Runtime
 * 
 * Responsibilities:
 * - Manage the user's current workspace session: active world, experiment, instruments
 * - Bind UI state to the distributed workspace session managed by the workspace service
 * - Persist workspace state locally for offline restoration
 * - Emit workspace focus/blur events for telemetry
 * 
 * Owned state:
 * - session: WorkspaceSession | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to sync with backend)
 * - OfflineStorageRuntime (for local persistence)
 * - SessionHydrationRuntime (for auth token)
 * 
 * Event emissions:
 *   "workspace.session.started", "workspace.session.resumed", "workspace.session.ended"
 * 
 * Event subscriptions:
 *   "gateway.session.created" (mirror backend session)
 *   "gateway.session.expired"
 * 
 * Synchronization: mirrors backend session; offline saves queued
 * Recovery: restore from local storage on app start
 * Telemetry: session duration, workspace changes
 * Diagnostics: current session state
 * Accessibility: session state exposed to screen reader
 * Performance: lightweight state container; async persistence
 * Forbidden: storing sensitive auth tokens in workspace session
 */

import { v4 as uuidv4 } from 'uuid';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { OfflineStorageRuntime } from '@labforge/storage-runtime';

export interface WorkspaceSession {
  id: string;
  userId: string;
  worldId: string | null;
  experimentId: string | null;
  activeInstrumentIds: string[];
  startedAt: number;
  lastActivity: number;
  state: 'active' | 'suspended' | 'ended';
}

export class WorkspaceSessionRuntime {
  private session: WorkspaceSession | null = null;
  private saveDebounce: any = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private storage: OfflineStorageRuntime,
  ) {
    this.eventBus.subscribe('gateway.session.created', this.onCreate.bind(this));
    this.eventBus.subscribe('gateway.session.expired', this.onExpire.bind(this));
  }

  async start(userId: string): Promise<WorkspaceSession> {
    this.session = {
      id: uuidv4(),
      userId,
      worldId: null,
      experimentId: null,
      activeInstrumentIds: [],
      startedAt: Date.now(),
      lastActivity: Date.now(),
      state: 'active',
    };
    await this.persist();
    this.meter.incrementCounter('workspace.session.started');
    this.logger.info('Workspace session started');
    return this.session;
  }

  async resume(): Promise<WorkspaceSession | null> {
    const saved = await this.storage.get<WorkspaceSession>('workspace_session' as any);
    if (saved) {
      this.session = saved;
      this.session.lastActivity = Date.now();
      this.session.state = 'active';
      this.meter.incrementCounter('workspace.session.resumed');
      this.logger.info('Workspace session resumed');
      return this.session;
    }
    return null;
  }

  getSession(): WorkspaceSession | null {
    return this.session;
  }

  setActiveWorld(worldId: string): void {
    if (this.session) {
      this.session.worldId = worldId;
      this.session.lastActivity = Date.now();
      this.schedulePersist();
    }
  }

  setActiveExperiment(experimentId: string | null): void {
    if (this.session) {
      this.session.experimentId = experimentId;
      this.schedulePersist();
    }
  }

  addInstrument(instrumentId: string): void {
    if (this.session && !this.session.activeInstrumentIds.includes(instrumentId)) {
      this.session.activeInstrumentIds.push(instrumentId);
      this.schedulePersist();
    }
  }

  removeInstrument(instrumentId: string): void {
    if (this.session) {
      this.session.activeInstrumentIds = this.session.activeInstrumentIds.filter(id => id !== instrumentId);
      this.schedulePersist();
    }
  }

  end(): void {
    if (this.session) {
      this.session.state = 'ended';
      this.persist().then(() => {
        this.eventBus.publish('workspace.session.ended', { sessionId: this.session!.id });
      });
    }
  }

  private onCreate(event: any): void {
    // Backend session created; mirror metadata if needed
  }

  private onExpire(event: any): void {
    if (this.session && this.session.state === 'active') {
      this.session.state = 'ended';
      this.persist();
    }
  }

  private schedulePersist(): void {
    if (this.saveDebounce) clearTimeout(this.saveDebounce);
    this.saveDebounce = setTimeout(() => this.persist(), 500);
  }

  private async persist(): Promise<void> {
    if (this.session) {
      await this.storage.set('workspace_session' as any, this.session);
    }
  }
}