// apps/web/src/routing/plugin-route-loader.ts
/**
 * Plugin Route Loader
 * 
 * Responsibilities:
 * - Dynamically load route definitions from installed plugins
 * - Validate plugin routes against the plugin sandbox policy
 * - Lazy-load plugin route components on demand
 * - Unload plugin routes when plugin is deactivated
 * 
 * Owned state:
 * - pluginRoutes: Map<PluginId, RouteDefinition[]>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - PluginIsolationRuntime (to check permissions)
 * - RouteOrchestrator (to register/unregister)
 * 
 * Event emissions: "routing.plugin.loaded", "routing.plugin.unloaded"
 * Event subscriptions: "plugin.activated", "plugin.deactivated"
 * Synchronization: none
 * Recovery: plugin routes re-registered on plugin reactivation
 * Telemetry: plugin route count, load time
 * Diagnostics: loaded plugin routes
 * Accessibility: N/A
 * Performance: lazy component loading
 * Forbidden: loading plugin routes without permission validation
 */

import type { RouteId, RouteDefinition } from './contracts/routing-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

type PluginId = string;

export class PluginRouteLoader {
  private pluginRoutes: Map<PluginId, RouteDefinition[]> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private pluginIsolation: any, // PluginIsolationRuntime
    private routeOrchestrator: any, // RouteOrchestrator
  ) {
    this.eventBus.subscribe('plugin.activated', this.onPluginActivated.bind(this));
    this.eventBus.subscribe('plugin.deactivated', this.onPluginDeactivated.bind(this));
  }

  private async onPluginActivated(event: any): Promise<void> {
    const { pluginId, routes } = event.payload;
    if (!routes) return;
    // Validate permissions
    for (const route of routes) {
      if (!this.pluginIsolation.canUseCapability(pluginId, `route:${route.id}`)) {
        this.logger.warn(`Plugin ${pluginId} denied route ${route.id}`);
        continue;
      }
      this.routeOrchestrator.registerRoute(route);
    }
    this.pluginRoutes.set(pluginId, routes);
    this.meter.incrementCounter('routing.plugin.loaded');
    this.eventBus.publish('routing.plugin.loaded', { pluginId, routeCount: routes.length });
  }

  private onPluginDeactivated(event: any): void {
    const { pluginId } = event.payload;
    const routes = this.pluginRoutes.get(pluginId);
    if (!routes) return;
    for (const route of routes) {
      this.routeOrchestrator.unregisterRoute?.(route.id);
    }
    this.pluginRoutes.delete(pluginId);
    this.meter.incrementCounter('routing.plugin.unloaded');
    this.eventBus.publish('routing.plugin.unloaded', { pluginId });
  }

  async prefetchPluginRoutes(match: any): Promise<void> {
    // Preload components for plugin routes matching current path
  }
}