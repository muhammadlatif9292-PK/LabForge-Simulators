// collaboration-runtime/synchronization/shared-workspace-sync.ts
/**
 * Shared Workspace Sync
 * 
 * Responsibilities:
 * - Synchronize workspace objects (instruments, samples, notes) across all participants
 * - Implement object-level locking to prevent concurrent manipulation conflicts
 * - Apply operational transforms or last-writer-wins for object updates
 * - Support offline queue for workspace operations
 * - Maintain version vectors per object for conflict detection
 * 
 * Owned state:
 * - objects: Map<WorkspaceObjectId, WorkspaceObject>
 * - locks: Map<WorkspaceObjectId, ParticipantId>
 * - pendingOps: WorkspaceOperation[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - SynchronizationRuntime (for conflict resolution)
 * 
 * Event emissions:
 * - "workspace.object.updated", "workspace.object.locked", "workspace.object.unlocked"
 * - "workspace.object.created", "workspace.object.removed"
 * 
 * Event subscriptions:
 * - "workspace.operation" from remote participants
 * 
 * Synchronization: object-level locking; version vectors for unlocked objects
 * Recovery: object state included in session recovery; re-fetched from peers
 * Telemetry: sync latency, lock contention rate
 * Diagnostics: active locks, object version map
 * Accessibility: N/A
 * Performance: delta updates; batch sync for object tree
 * Forbidden: deadlocks from lock ordering; data loss from premature unlock
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  WorkspaceObjectId, WorkspaceObject, ParticipantId, CollaborationSessionId,
} from '../contracts/collaboration-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface WorkspaceOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'lock' | 'unlock';
  objectId: WorkspaceObjectId;
  participantId: ParticipantId;
  payload: unknown;
  timestamp: number;
  version: number;
}

export class SharedWorkspaceSync {
  private objects: Map<WorkspaceObjectId, WorkspaceObject> = new Map();
  private locks: Map<WorkspaceObjectId, ParticipantId> = new Map();
  private pendingOps: WorkspaceOperation[] = [];
  private latencySamples: number[] = [];
  private sessionId: CollaborationSessionId;

  constructor(
    sessionId: CollaborationSessionId,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.sessionId = sessionId;
    this.eventBus.subscribe('workspace.operation', this.onRemoteOperation.bind(this));
  }

  async createObject(type: WorkspaceObject['type'], ownerId: ParticipantId, initialData?: Record<string, unknown>): Promise<WorkspaceObjectId> {
    const id = uuidv4() as WorkspaceObjectId;
    const obj: WorkspaceObject = {
      id,
      type,
      ownerId,
      shared: true,
      transform: new Float32Array(16), // identity
      data: initialData ?? {},
      version: 1,
    };
    this.objects.set(id, obj);
    await this.broadcastOperation({
      id: uuidv4(),
      type: 'create',
      objectId: id,
      participantId: ownerId,
      payload: obj,
      timestamp: Date.now(),
      version: 1,
    });
    this.meter.incrementCounter('workspace.object.created', { type });
    return id;
  }

  async updateObject(objectId: WorkspaceObjectId, participantId: ParticipantId, updates: Partial<Pick<WorkspaceObject, 'transform' | 'data'>>): Promise<void> {
    const obj = this.objects.get(objectId);
    if (!obj) throw new Error('Object not found');
    // Check if locked by another participant
    const lockedBy = this.locks.get(objectId);
    if (lockedBy && lockedBy !== participantId) {
      throw new Error('Object locked by another participant');
    }
    const prevVersion = obj.version;
    obj.version++;
    if (updates.transform) obj.transform = updates.transform;
    if (updates.data) obj.data = { ...obj.data, ...updates.data };
    await this.broadcastOperation({
      id: uuidv4(),
      type: 'update',
      objectId,
      participantId,
      payload: updates,
      timestamp: Date.now(),
      version: obj.version,
    });
  }

  async lockObject(objectId: WorkspaceObjectId, participantId: ParticipantId): Promise<void> {
    if (this.locks.has(objectId)) {
      throw new Error('Object already locked');
    }
    this.locks.set(objectId, participantId);
    const obj = this.objects.get(objectId);
    if (obj) obj.lockedBy = participantId;
    await this.broadcastOperation({
      id: uuidv4(),
      type: 'lock',
      objectId,
      participantId,
      payload: null,
      timestamp: Date.now(),
      version: obj?.version ?? 0,
    });
    this.meter.incrementCounter('workspace.object.locked');
  }

  async unlockObject(objectId: WorkspaceObjectId, participantId: ParticipantId): Promise<void> {
    const lockOwner = this.locks.get(objectId);
    if (lockOwner !== participantId) return;
    this.locks.delete(objectId);
    const obj = this.objects.get(objectId);
    if (obj) obj.lockedBy = undefined;
    await this.broadcastOperation({
      id: uuidv4(),
      type: 'unlock',
      objectId,
      participantId,
      payload: null,
      timestamp: Date.now(),
      version: obj?.version ?? 0,
    });
    this.meter.incrementCounter('workspace.object.unlocked');
  }

  deleteObject(objectId: WorkspaceObjectId, participantId: ParticipantId): void {
    const obj = this.objects.get(objectId);
    if (obj && obj.ownerId !== participantId) throw new Error('Only owner can delete');
    this.objects.delete(objectId);
    this.locks.delete(objectId);
    this.broadcastOperation({
      id: uuidv4(),
      type: 'delete',
      objectId,
      participantId,
      payload: null,
      timestamp: Date.now(),
      version: 0,
    });
  }

  getObject(objectId: WorkspaceObjectId): WorkspaceObject | undefined {
    return this.objects.get(objectId);
  }

  getAllObjects(): WorkspaceObject[] {
    return Array.from(this.objects.values());
  }

  private async broadcastOperation(op: WorkspaceOperation): Promise<void> {
    const start = Date.now();
    await this.eventBus.publish('workspace.operation', { sessionId: this.sessionId, operation: op });
    this.latencySamples.push(Date.now() - start);
    if (this.latencySamples.length > 100) this.latencySamples.shift();
  }

  private onRemoteOperation(event: any): void {
    const { operation } = event.payload as { operation: WorkspaceOperation };
    // Apply remote operation deterministically
    switch (operation.type) {
      case 'create':
        if (!this.objects.has(operation.objectId)) {
          this.objects.set(operation.objectId, operation.payload as WorkspaceObject);
        }
        break;
      case 'update': {
        const obj = this.objects.get(operation.objectId);
        if (obj && operation.version > obj.version) {
          const updates = operation.payload as any;
          if (updates.transform) obj.transform = updates.transform;
          if (updates.data) obj.data = { ...obj.data, ...updates.data };
          obj.version = operation.version;
        }
        break;
      }
      case 'delete':
        this.objects.delete(operation.objectId);
        break;
      case 'lock':
        this.locks.set(operation.objectId, operation.participantId);
        break;
      case 'unlock':
        this.locks.delete(operation.objectId);
        break;
    }
  }

  getAverageLatencyMs(): number {
    if (this.latencySamples.length === 0) return 0;
    return this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length;
  }
}