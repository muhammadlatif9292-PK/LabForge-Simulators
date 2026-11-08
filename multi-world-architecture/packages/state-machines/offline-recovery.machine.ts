// packages/state-machines/offline-recovery.machine.ts
/**
 * Offline Recovery State Machine
 * 
 * Responsibilities:
 * - Formalise the recovery from network loss: online → offline → syncing → online
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

export enum OfflineState {
  ONLINE = 'online',
  OFFLINE = 'offline',
  SYNCING = 'syncing',
}

export enum OfflineEvent {
  DISCONNECT = 'disconnect',
  RECONNECT = 'reconnect',
  SYNC_COMPLETE = 'sync_complete',
}

export class OfflineRecoveryMachine {
  private state: OfflineState = OfflineState.ONLINE;

  private static transitions: Record<string, OfflineState> = {
    [`${OfflineState.ONLINE}.${OfflineEvent.DISCONNECT}`]: OfflineState.OFFLINE,
    [`${OfflineState.OFFLINE}.${OfflineEvent.RECONNECT}`]: OfflineState.SYNCING,
    [`${OfflineState.SYNCING}.${OfflineEvent.SYNC_COMPLETE}`]: OfflineState.ONLINE,
  };

  getState(): OfflineState { return this.state; }

  send(event: OfflineEvent): boolean {
    const key = `${this.state}.${event}`;
    const next = OfflineRecoveryMachine.transitions[key];
    if (!next) return false;
    this.state = next;
    return true;
  }
}