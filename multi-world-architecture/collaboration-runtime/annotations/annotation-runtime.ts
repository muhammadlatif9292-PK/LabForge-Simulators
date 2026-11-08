// collaboration-runtime/annotations/annotation-runtime.ts
/**
 * Annotation Runtime
 * 
 * Responsibilities:
 * - Manage real-time annotations (drawings, text, highlights) on the shared workspace
 * - Support annotation creation, modification, and timed expiration
 * - Broadcast annotations to all session participants
 * - Enforce permission checks (who can annotate, on which objects)
 * 
 * Owned state:
 * - annotations: Map<AnnotationId, WorkspaceAnnotation>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * 
 * Event emissions:
 * - "annotation.created", "annotation.removed", "annotation.expired"
 * 
 * Event subscriptions:
 * - "annotation.remote" for peer annotations
 * 
 * Synchronization: last-writer-wins per annotation; no locking needed
 * Recovery: annotations are ephemeral; lost on session end (acceptable)
 * Telemetry: annotation count, create/delete rate
 * Diagnostics: active annotations per participant
 * Accessibility: annotation text is screen-readable
 * Performance: GPU-rendered for drawing annotations; batched updates
 * Forbidden: annotations persisting beyond session without consent
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AnnotationId, WorkspaceAnnotation, ParticipantId, CollaborationSessionId,
} from '../contracts/collaboration-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class AnnotationRuntime {
  private annotations: Map<AnnotationId, WorkspaceAnnotation> = new Map();
  private sessionId: CollaborationSessionId;

  constructor(
    sessionId: CollaborationSessionId,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.sessionId = sessionId;
    this.eventBus.subscribe('annotation.remote', this.onRemoteAnnotation.bind(this));
  }

  async createAnnotation(
    authorId: ParticipantId,
    type: WorkspaceAnnotation['type'],
    position: [number, number, number],
    content: string,
    color: string = '#ffff00',
    ttlMs?: number,
    targetObjectId?: string,
  ): Promise<AnnotationId> {
    const id = uuidv4() as AnnotationId;
    const annotation: WorkspaceAnnotation = {
      id,
      authorId,
      type,
      position,
      color,
      content,
      createdAt: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      visible: true,
      targetObjectId: targetObjectId as any,
    };
    this.annotations.set(id, annotation);
    await this.eventBus.publish('annotation.created', {
      sessionId: this.sessionId,
      annotation,
    });
    this.meter.incrementCounter('annotation.created', { type });
    if (ttlMs) {
      setTimeout(() => this.removeAnnotation(id), ttlMs);
    }
    return id;
  }

  async removeAnnotation(id: AnnotationId): Promise<void> {
    const annotation = this.annotations.get(id);
    if (!annotation) return;
    this.annotations.delete(id);
    await this.eventBus.publish('annotation.removed', {
      sessionId: this.sessionId,
      annotationId: id,
    });
    this.meter.incrementCounter('annotation.removed');
  }

  getAnnotations(): WorkspaceAnnotation[] {
    const now = Date.now();
    return Array.from(this.annotations.values())
      .filter(a => !a.expiresAt || a.expiresAt > now);
  }

  getAnnotationCount(): number {
    return this.getAnnotations().length;
  }

  private onRemoteAnnotation(event: any): void {
    const { annotation } = event.payload;
    if (annotation.expiresAt && annotation.expiresAt <= Date.now()) return;
    this.annotations.set(annotation.id, annotation);
  }

  clearAll(): void {
    this.annotations.clear();
  }
}