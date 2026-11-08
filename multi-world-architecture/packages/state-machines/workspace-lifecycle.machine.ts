// packages/state-machines/workspace-lifecycle.machine.ts
/**
 * Workspace Lifecycle State Machine
 * 
 * Responsibilities:
 * - Formalise workspace lifecycle: inactive → loading → active → suspending → suspended → resuming → active → closing → inactive
 * 
 * Owned state: currentState
 * Dependencies: ILogger, IMeter, DistributedEventBus
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

export enum WorkspaceState {
  INACTIVE = 'inactive',
  LOADING = 'loading',
  ACTIVE = 'active',
  SUSPENDING = 'suspending',
  SUSPENDED = 'suspended',
  RESUMING = 'resuming',
  CLOSING = 'closing',
}

export enum WorkspaceEvent {
  OPEN = 'open',
  LOADED = 'loaded',
  SUSPEND = 'suspend',
  SUSPENDED = 'suspended',
  RESUME = 'resume',
  RESUMED = 'resumed',
  CLOSE = 'close',
  CLOSED = 'closed',
}

export class WorkspaceLifecycleMachine {
  private state: WorkspaceState = WorkspaceState.INACTIVE;

  private static transitions: Record<string, WorkspaceState> = {
    [`${WorkspaceState.INACTIVE}.${WorkspaceEvent.OPEN}`]: WorkspaceState.LOADING,
    [`${WorkspaceState.LOADING}.${WorkspaceEvent.LOADED}`]: WorkspaceState.ACTIVE,
    [`${WorkspaceState.ACTIVE}.${WorkspaceEvent.SUSPEND}`]: WorkspaceState.SUSPENDING,
    [`${WorkspaceState.SUSPENDING}.${WorkspaceEvent.SUSPENDED}`]: WorkspaceState.SUSPENDED,
    [`${WorkspaceState.SUSPENDED}.${WorkspaceEvent.RESUME}`]: WorkspaceState.RESUMING,
    [`${WorkspaceState.RESUMING}.${WorkspaceEvent.RESUMED}`]: WorkspaceState.ACTIVE,
    [`${WorkspaceState.ACTIVE}.${WorkspaceEvent.CLOSE}`]: WorkspaceState.CLOSING,
    [`${WorkspaceState.CLOSING}.${WorkspaceEvent.CLOSED}`]: WorkspaceState.INACTIVE,
  };

  getState(): WorkspaceState { return this.state; }

  send(event: WorkspaceEvent): boolean {
    const key = `${this.state}.${event}`;
    const target = WorkspaceLifecycleMachine.transitions[key];
    if (!target) return false;
    this.state = target;
    return true;
  }
}