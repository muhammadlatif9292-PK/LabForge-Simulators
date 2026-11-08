// packages/command-framework/permissions/permission-aware-command-runner.ts
/**
 * Permission-Aware Command Runner
 * 
 * Responsibilities:
 * - Check user permissions before executing a command
 * - Resolve permission requirements from the command handler registry
 * - Cache permission evaluations for a short TTL
 * - Emit denial events for audit
 * 
 * Owned state:
 * - permissionCache: Map<string, { allowed: boolean; expires: number }>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedAuthValidator (or PermissionReconciliation)
 * - CommandRegistry (to get permission requirements)
 * 
 * Event emissions: "command.permission.denied"
 * Event subscriptions: none
 * Synchronization: none (cache is local, short-lived)
 * Recovery: cache invalidated on permission changes
 * Telemetry: deny count per command type
 * Diagnostics: cache hit rate
 * Accessibility: N/A
 * Performance: fast cache; avoids repeated auth calls
 * Forbidden: executing commands without permission check
 */

import type { Command, CommandType, ExecutionContext } from '../contracts/command-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { CommandRegistry } from '../registry/command-registry';
import type { PermissionReconciliation } from '@labforge/security-runtime';

export class PermissionAwareCommandRunner {
  private cache: Map<string, { allowed: boolean; expires: number }> = new Map();
  private readonly cacheTTLMs = 5000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private registry: CommandRegistry,
    private permissionReconciliation: PermissionReconciliation,
  ) {}

  async executeWithPermissions<TPayload, TResult>(
    command: Command<TPayload>,
    context: ExecutionContext,
  ): Promise<TResult> {
    const entry = this.registry.getEntry(command.type);
    if (!entry) throw new Error(`No handler for command type: ${command.type}`);

    // Check permissions if required
    if (entry.permissions.length > 0) {
      const allowed = await this.checkPermissions(command.type, context, entry.permissions);
      if (!allowed) {
        this.meter.incrementCounter('command.permission.denied', { type: command.type });
        await this.eventBus.publish('command.permission.denied', {
          commandId: command.id,
          type: command.type,
          userId: context.userId,
          requiredPermissions: entry.permissions,
        });
        throw new Error(`Permission denied for command: ${command.type}`);
      }
    }
    // Execute the handler
    return entry.handler.execute(command.payload, context) as Promise<TResult>;
  }

  private async checkPermissions(
    commandType: CommandType,
    context: ExecutionContext,
    requiredPermissions: string[],
  ): Promise<boolean> {
    const cacheKey = `${context.userId}:${commandType}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.allowed;
    }
    for (const permission of requiredPermissions) {
      const result = this.permissionReconciliation.checkPermission({
        principalId: context.userId,
        resource: `command:${commandType}`,
        action: 'execute',
      });
      // Also check the specific permission string
      const specResult = this.permissionReconciliation.checkPermission({
        principalId: context.userId,
        resource: permission,
        action: 'execute',
      });
      if (!result.allowed && !specResult.allowed) {
        this.cache.set(cacheKey, { allowed: false, expires: Date.now() + this.cacheTTLMs });
        return false;
      }
    }
    this.cache.set(cacheKey, { allowed: true, expires: Date.now() + this.cacheTTLMs });
    return true;
  }

  invalidateCache(userId?: string): void {
    if (userId) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(userId)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }
}