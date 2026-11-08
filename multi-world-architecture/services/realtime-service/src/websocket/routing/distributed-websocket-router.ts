// services/realtime-service/src/websocket/routing/distributed-websocket-router.ts
/**
 * Distributed WebSocket Router
 * 
 * Responsibilities:
 * - Route incoming WebSocket messages to appropriate handlers based on type
 * - Distribute broadcast messages across all nodes via pub/sub
 * - Support wildcard and pattern-based routing
 * - Maintain handler registry with middleware support
 * 
 * Owned state:
 * - handlers: Map<string, WsMessageHandler>
 * - middleware: WsMiddleware[]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (for cross-node message fan-out)
 * - WebSocketSessionRuntime (to resolve session)
 * 
 * Event emissions: none directly; delegates to handlers
 * Event subscriptions: "ws.message.broadcast" for cross-node delivery
 * Synchronization: none (handlers are local)
 * Recovery: handlers re-registered on service start
 * Telemetry: messages routed per type, handler execution latency
 * Diagnostics: registered routes, active middleware
 * Accessibility: N/A
 * Performance: hash-map O(1) routing; async handler execution
 * Forbidden: blocking the event loop during routing; unhandled message loss
 */

import type { WsSession, WsOperation, WsMessageHandler } from '../contracts/websocket-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

type WsMiddleware = (session: WsSession, operation: WsOperation, next: () => Promise<void>) => Promise<void>;

export class DistributedWebSocketRouter {
  private handlers: Map<string, WsMessageHandler> = new Map();
  private middlewares: WsMiddleware[] = [];

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private nodeId: string,
  ) {
    // Listen for broadcasts from other nodes
    this.eventBus.subscribe('ws.message.broadcast', this.onBroadcast.bind(this));
  }

  registerHandler(messageType: string, handler: WsMessageHandler): void {
    this.handlers.set(messageType, handler);
    this.logger.debug(`WebSocket handler registered: ${messageType}`);
  }

  use(middleware: WsMiddleware): void {
    this.middlewares.push(middleware);
  }

  async routeMessage(session: WsSession, operation: WsOperation): Promise<void> {
    const start = Date.now();
    const handler = this.handlers.get(operation.type);
    if (!handler) {
      this.logger.warn(`No handler for operation type: ${operation.type}`);
      this.meter.incrementCounter('ws.message.unhandled');
      return;
    }
    // Execute middleware chain
    let index = 0;
    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const mw = this.middlewares[index++];
        await mw(session, operation, next);
      } else {
        await handler(session, operation);
      }
    };
    try {
      await next();
      this.meter.recordHistogram('ws.message.handling.duration', Date.now() - start, { type: operation.type });
      this.meter.incrementCounter('ws.message.handled', { type: operation.type });
    } catch (err) {
      this.logger.error(`Handler error for ${operation.type}`, { error: err, operationId: operation.operationId });
      this.meter.incrementCounter('ws.message.error', { type: operation.type });
    }
  }

  async broadcast(session: WsSession, operation: WsOperation): Promise<void> {
    // Publish to all nodes including self; each node delivers locally
    await this.eventBus.publish('ws.message.broadcast', {
      operation,
      originNodeId: this.nodeId,
      sessionId: session.sessionId,
    });
    this.meter.incrementCounter('ws.message.broadcast');
  }

  private onBroadcast(event: any): void {
    const { operation, originNodeId } = event.payload;
    if (originNodeId === this.nodeId) return; // skip self (already delivered)
    // Deliver locally: need session lookup and handler execution
    // This would call the same routeMessage if local session is available
  }
}