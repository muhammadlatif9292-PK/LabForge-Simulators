// packages/event-bus-runtime/src/contracts/event-bus-contracts.ts
/**
 * Event Bus Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for all event bus components
 * - Enforce typed payloads and metadata
 * - Guarantee compatibility across distributed boundaries
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
 * Forbidden: runtime logic, any implementation
 */

// Core event identifier
export type EventId = string & { readonly __brand: 'EventId' };
export type CorrelationId = string & { readonly __brand: 'CorrelationId' };
export type CausationId = string & { readonly __brand: 'CausationId' };
export type SubscriptionId = string & { readonly __brand: 'SubscriptionId' };
export type SchemaVersion = number;

export enum EventPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
  BACKGROUND = 4,
}

export interface EventMetadata {
  eventId: EventId;
  correlationId: CorrelationId;
  causationId?: CausationId;
  timestamp: number; // Unix ms
  schemaVersion: SchemaVersion;
  priority: EventPriority;
  source: string; // origin service/component
  replay: boolean; // true if this event is a replay
  ttl?: number; // optional time-to-live ms
  tags?: Record<string, string>;
}

export interface Event<TPayload = unknown> {
  type: string;
  payload: TPayload;
  metadata: EventMetadata;
}

export type EventHandler<TPayload = unknown> = (event: Event<TPayload>) => Promise<void> | void;
export type EventFilter = (event: Event) => boolean;

export interface SubscriptionOptions {
  filter?: EventFilter;
  priority?: EventPriority;
  once?: boolean;
  timeout?: number; // handler execution timeout
}

export interface Subscription {
  id: SubscriptionId;
  type: string;
  handler: EventHandler;
  options: SubscriptionOptions;
}

export interface PublishOptions {
  priority?: EventPriority;
  correlationId?: CorrelationId;
  causationId?: CausationId;
  ttl?: number;
  replay?: boolean;
  tags?: Record<string, string>;
}

export interface EventBus {
  publish<TPayload>(type: string, payload: TPayload, options?: PublishOptions): Promise<EventId>;
  subscribe<TPayload>(type: string, handler: EventHandler<TPayload>, options?: SubscriptionOptions): SubscriptionId;
  unsubscribe(subscriptionId: SubscriptionId): void;
  replay(fromTimestamp: number, toTimestamp?: number, type?: string): Promise<void>;
  health(): Promise<EventBusHealth>;
}

export interface EventBusHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  pendingEvents: number;
  deadLetterCount: number;
  activeSubscriptions: number;
  throughputPerSec: number;
  latencyMs: P50P99;
}

export interface P50P99 {
  p50: number;
  p99: number;
}

export interface EventRouter {
  route(event: Event): Promise<void>;
}

export interface EventReplayEngine {
  replay(fromTimestamp: number, toTimestamp?: number, type?: string): Promise<void>;
}

export interface DeadLetterQueue {
  enqueue(event: Event, reason: string, attempts: number): Promise<void>;
  retryAll(): Promise<number>;
  purge(): Promise<void>;
  stats(): DeadLetterStats;
}

export interface DeadLetterStats {
  queued: number;
  oldestTimestamp: number | null;
}

export interface EventConsistencyValidator {
  validate(event: Event): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface EventStreamRestorer {
  restore(): Promise<void>;
}

export interface EventPersistenceRuntime {
  persist(events: Event[]): Promise<void>;
  query(fromTimestamp: number, toTimestamp?: number, type?: string): Promise<Event[]>;
  compact(olderThanTimestamp: number): Promise<void>;
  getSnapshot(correlationId: CorrelationId): Promise<Event[] | null>;
}