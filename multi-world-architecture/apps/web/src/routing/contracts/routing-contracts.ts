// apps/web/src/routing/contracts/routing-contracts.ts
/**
 * Advanced Routing Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for workspace/experiment/dynamic/plugin/session/colab/collaboration routes
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
 * Forbidden: any implementation logic
 */

export type RouteId = string & { readonly __brand: 'RouteId' };
export type RoutePattern = string;
export type GuardId = string & { readonly __brand: 'GuardId' };

export enum RoutePriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
  BACKGROUND = 4,
}

export interface RouteDefinition {
  id: RouteId;
  pattern: RoutePattern;
  priority: RoutePriority;
  component: () => Promise<any>;  // lazy component loader
  guards: GuardId[];
  prefetchPatterns: RoutePattern[];
  metadata: Record<string, unknown>;
}

export interface RouteMatch {
  routeId: RouteId;
  params: Record<string, string>;
  query: Record<string, string>;
  hash: string;
}

export interface NavigationRequest {
  to: RoutePattern;
  params?: Record<string, string>;
  query?: Record<string, string>;
  replace?: boolean;
  state?: unknown;
  timestamp: number;
}

export interface RouteGuard {
  id: GuardId;
  canActivate: (match: RouteMatch, context: RouteContext) => Promise<boolean> | boolean;
  canDeactivate?: (current: RouteMatch) => Promise<boolean> | boolean;
}

export interface RouteContext {
  userId: string;
  sessionId: string;
  permissions: string[];
  worldId?: string;
}

export interface RouteTransition {
  from?: RouteMatch;
  to: RouteMatch;
  type: 'push' | 'pop' | 'replace';
  timestamp: number;
  durationMs?: number;
}

export interface NavigationHistory {
  stack: NavigationEntry[];
  currentIndex: number;
}

export interface NavigationEntry {
  url: string;
  state: unknown;
  timestamp: number;
}

export interface RouteHealth {
  registeredRoutes: number;
  activeGuards: number;
  currentRoute: string;
  transitionInProgress: boolean;
}