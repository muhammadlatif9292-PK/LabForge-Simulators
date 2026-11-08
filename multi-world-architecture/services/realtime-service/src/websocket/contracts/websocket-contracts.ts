// services/realtime-service/src/websocket/contracts/websocket-contracts.ts
/**
 * WebSocket Runtime Contracts
 * 
 * Responsibilities:
 * - Define strict types for WebSocket sessions, presence, routing, and operations
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any runtime logic
 */

export type SessionId = string & { readonly __brand: 'SessionId' };
export type ConnectionId = string & { readonly __brand: 'ConnectionId' };
export type OperationId = string & { readonly __brand: 'OperationId' };
export type UserId = string;

export interface WsSession {
  sessionId: SessionId;
  userId: UserId;
  connectionIds: Set<ConnectionId>;
  createdAt: number;
  lastActivity: number;
  metadata: Record<string, unknown>;
  status: 'active' | 'idle' | 'disconnected';
}

export interface PresenceInfo {
  userId: UserId;
  sessionId: SessionId;
  status: 'online' | 'away' | 'offline';
  lastSeen: number;
  currentWorldId?: string;
  currentActivity?: string;
}

export interface WsOperation {
  operationId: OperationId;
  userId: UserId;
  sessionId: SessionId;
  type: string;
  payload: unknown;
  timestamp: number;
  sequenceNumber: number;
  clientClock: number;
}

export interface WsRoute {
  path: string;
  handler: WsMessageHandler;
}

export type WsMessageHandler = (session: WsSession, message: WsOperation) => Promise<void> | void;

export interface ReconnectToken {
  token: string;
  sessionId: SessionId;
  userId: UserId;
  expiresAt: number;
}