// apps/web/src/routing/route-orchestrator.ts
/**
 * Route Orchestrator
 * 
 * Responsibilities:
 * - Central router: register route definitions, match URLs, resolve lazy components
 * - Execute guard chain before activation (canActivate) and on deactivation (canDeactivate)
 * - Manage navigation history stack and support push/pop/replace
 * - Emit route transition events for analytics and debugging
 * - Support route priority for preloading critical paths
 * 
 * Owned state:
 * - routes: Map<RouteId, RouteDefinition>
 * - guards: Map<GuardId, RouteGuard>
 * - history: NavigationHistory
 * - currentMatch: RouteMatch | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - RouteTransitionEngine (animation)
 * - SessionRestorationRouter, WorldPrefetchRouter, PluginRouteLoader, CollaborationNavigationSync (optional)
 * 
 * Event emissions:
 *   "routing.navigation.started", "routing.navigation.completed"
 *   "routing.navigation.failed", "routing.guard.rejected"
 * 
 * Event subscriptions: none (this is the entry point)
 * Synchronization: single-threaded navigation; concurrent navigations queued
 * Recovery: restore current URL from history on app restart
 * Telemetry: navigation duration, guard rejection count
 * Diagnostics: current route, history depth, registered routes
 * Accessibility: ensure route changes announce to screen readers
 * Performance: lazy component loading; route definitions preloaded; pattern matching O(n) worst-case
 * Forbidden: blocking navigation without guard resolving; memory leaks in history stack
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  RouteId, RouteDefinition, RouteMatch, NavigationRequest,
  RouteGuard, RouteContext, RouteTransition,
  NavigationHistory, RouteHealth, RoutePattern,
} from './contracts/routing-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { RouteTransitionEngine } from './route-transition-engine';
import type { SessionRestorationRouter } from './session-restoration-router';
import type { WorldPrefetchRouter } from './world-prefetch-router';
import type { PluginRouteLoader } from './plugin-route-loader';
import type { CollaborationNavigationSync } from './collaboration-navigation-sync';

export class RouteOrchestrator {
  private routes: Map<RouteId, RouteDefinition> = new Map();
  private guards: Map<string, RouteGuard> = new Map();
  private history: NavigationHistory = { stack: [], currentIndex: -1 };
  private currentMatch: RouteMatch | null = null;
  private transitioning = false;
  private navigationQueue: NavigationRequest[] = [];

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private transitionEngine: RouteTransitionEngine,
    private sessionRouter?: SessionRestorationRouter,
    private worldPrefetch?: WorldPrefetchRouter,
    private pluginLoader?: PluginRouteLoader,
    private collaborationSync?: CollaborationNavigationSync,
  ) {
    // Listen to popstate for browser back/forward
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', (event) => {
        const url = window.location.pathname + window.location.search + window.location.hash;
        this.handleNavigation({ to: url as RoutePattern, replace: false, timestamp: Date.now() });
      });
    }
  }

  registerRoute(definition: RouteDefinition): void {
    this.routes.set(definition.id, definition);
    this.logger.debug(`Route registered: ${definition.id} (${definition.pattern})`);
  }

  registerGuard(guard: RouteGuard): void {
    this.guards.set(guard.id, guard);
  }

  async navigate(request: NavigationRequest, context: RouteContext): Promise<void> {
    if (this.transitioning) {
      this.navigationQueue.push(request);
      return;
    }
    this.transitioning = true;
    const span = this.eventBus as any; // tracer placeholder
    try {
      this.meter.incrementCounter('routing.navigation.started');
      await this.eventBus.publish('routing.navigation.started', { to: request.to });

      // 1. Match route
      const match = this.matchRoute(request.to);
      if (!match) throw new Error(`No route matched for: ${request.to}`);

      // 2. Resolve guards
      const canActivate = await this.checkGuards(match, context);
      if (!canActivate) {
        this.meter.incrementCounter('routing.guard.rejected');
        await this.eventBus.publish('routing.guard.rejected', { routeId: match.routeId });
        throw new Error('Route guard rejected activation');
      }

      // 3. Play transition
      const transition: RouteTransition = {
        from: this.currentMatch ?? undefined,
        to: match,
        type: request.replace ? 'replace' : 'push',
        timestamp: Date.now(),
      };
      await this.transitionEngine.playTransition(transition);

      // 4. Update history
      if (request.replace && this.history.stack.length > 0) {
        this.history.stack[this.history.currentIndex] = {
          url: request.to,
          state: request.state ?? null,
          timestamp: Date.now(),
        };
      } else {
        // Discard forward entries if pushing after back
        this.history.stack = this.history.stack.slice(0, this.history.currentIndex + 1);
        this.history.stack.push({
          url: request.to,
          state: request.state ?? null,
          timestamp: Date.now(),
        });
        this.history.currentIndex = this.history.stack.length - 1;
      }
      if (typeof history !== 'undefined') {
        history.pushState(request.state ?? null, '', request.to);
      }

      // 5. Prefetch related routes
      const definition = this.routes.get(match.routeId);
      if (definition) {
        if (this.worldPrefetch) {
          this.worldPrefetch.prefetchWorldRoutes(match, context).catch(err => this.logger.error('Prefetch failed', err));
        }
        if (this.pluginLoader) {
          this.pluginLoader.prefetchPluginRoutes(match).catch(err => this.logger.error('Plugin prefetch failed', err));
        }
      }

      // 6. Sync to collaboration if enabled
      if (this.collaborationSync) {
        await this.collaborationSync.syncNavigation(match, context);
      }

      this.currentMatch = match;
      this.meter.incrementCounter('routing.navigation.completed');
      await this.eventBus.publish('routing.navigation.completed', { routeId: match.routeId, params: match.params });
    } catch (err) {
      this.meter.incrementCounter('routing.navigation.failed');
      this.logger.error('Navigation failed', { error: err, to: request.to });
      await this.eventBus.publish('routing.navigation.failed', { to: request.to, error: (err as Error).message });
    } finally {
      this.transitioning = false;
      // Process next queued navigation
      if (this.navigationQueue.length > 0) {
        const next = this.navigationQueue.shift()!;
        this.navigate(next, context).catch(e => this.logger.error('Queued navigation failed', e));
      }
    }
  }

  async handleNavigation(request: NavigationRequest): Promise<void> {
    const context = await this.buildDefaultContext();
    return this.navigate(request, context);
  }

  matchRoute(pattern: RoutePattern): RouteMatch | null {
    // Simplified: exact match first, then parameterized patterns
    // Production would use a radix tree or regex matcher
    for (const [id, def] of this.routes) {
      const match = this.matchPattern(def.pattern, pattern);
      if (match) {
        return {
          routeId: id,
          params: match.params,
          query: match.query,
          hash: match.hash,
        };
      }
    }
    return null;
  }

  private matchPattern(defPattern: string, url: string): { params: Record<string, string>; query: Record<string, string>; hash: string } | null {
    // Very simple exact match for now
    if (defPattern === url) {
      return { params: {}, query: {}, hash: '' };
    }
    // Parameterized pattern matcher would go here
    return null;
  }

  private async checkGuards(match: RouteMatch, context: RouteContext): Promise<boolean> {
    const def = this.routes.get(match.routeId);
    if (!def) return false;
    for (const guardId of def.guards) {
      const guard = this.guards.get(guardId);
      if (!guard) continue;
      try {
        const allowed = await guard.canActivate(match, context);
        if (!allowed) return false;
      } catch (err) {
        this.logger.error(`Guard ${guardId} threw error`, { error: err });
        return false;
      }
    }
    return true;
  }

  private async buildDefaultContext(): Promise<RouteContext> {
    return {
      userId: 'anonymous',
      sessionId: uuidv4(),
      permissions: [],
    };
  }

  getCurrentRoute(): RouteMatch | null {
    return this.currentMatch;
  }

  getHealth(): RouteHealth {
    return {
      registeredRoutes: this.routes.size,
      activeGuards: this.guards.size,
      currentRoute: this.currentMatch?.routeId ?? 'none',
      transitionInProgress: this.transitioning,
    };
  }
}