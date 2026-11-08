// apps/web/src/routing/session-restoration-router.ts
/**
 * Session Restoration Router
 * 
 * Responsibilities:
 * - Detect if the user has an active session from a previous visit
 * - Restore the last route before crash/close, including params and state
 * - Coordinate with session hydration to reload world/experiment context
 * - Prevent routing to invalid session-specific routes when session expired
 * 
 * Owned state:
 * - lastSessionRoute: { routeId; params; timestamp } | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - Local persistence (sessionStorage/IndexedDB)
 * - RouteOrchestrator (to restore)
 * 
 * Event emissions: "routing.session.restored", "routing.session.expired"
 * Event subscriptions: none
 * Synchronization: none (local)
 * Recovery: restores from last known good state
 * Telemetry: restoration count, restoration success rate
 * Diagnostics: last saved route
 * Accessibility: N/A
 * Performance: lightweight read on startup
 * Forbidden: restoring to protected routes without re-authentication
 */

import type { RouteId, RouteMatch } from './contracts/routing-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class SessionRestorationRouter {
  private lastRoute: { routeId: string; url: string; timestamp: number } | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private storage: Storage, // sessionStorage or IndexedDB
  ) {
    this.loadLastRoute();
  }

  private loadLastRoute(): void {
    try {
      const raw = this.storage.getItem('labforge_last_route');
      if (raw) {
        this.lastRoute = JSON.parse(raw);
        this.logger.info('Last session route loaded');
      }
    } catch (err) {
      this.logger.warn('Failed to load last session route');
    }
  }

  saveCurrentRoute(routeId: RouteId, url: string): void {
    this.lastRoute = { routeId, url, timestamp: Date.now() };
    try {
      this.storage.setItem('labforge_last_route', JSON.stringify(this.lastRoute));
    } catch (err) {
      this.logger.warn('Failed to save session route');
    }
  }

  async restoreSessionRoute(): Promise<{ url: string } | null> {
    if (!this.lastRoute) return null;
    // Check if session is still valid (e.g., not expired)
    const sessionAge = Date.now() - this.lastRoute.timestamp;
    const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
    if (sessionAge > maxSessionAge) {
      this.logger.info('Last session route expired');
      this.meter.incrementCounter('routing.session.expired');
      this.storage.removeItem('labforge_last_route');
      this.lastRoute = null;
      await this.eventBus.publish('routing.session.expired', {});
      return null;
    }
    this.meter.incrementCounter('routing.session.restored');
    await this.eventBus.publish('routing.session.restored', { routeId: this.lastRoute.routeId });
    return { url: this.lastRoute.url };
  }

  clearSessionRoute(): void {
    this.lastRoute = null;
    this.storage.removeItem('labforge_last_route');
  }
}