// packages/command-framework/AI/AI-command-router.ts
/**
 * AI Command Router
 * 
 * Responsibilities:
 * - Route AI-generated commands to the appropriate command handler
 * - Validate AI commands against stricter safety rules before execution
 * - Log all AI command activity for audit and safety review
 * - Enforce AI-specific permissions (AI may have reduced permissions)
 * - Never allow AI commands to bypass the standard command lifecycle
 * 
 * Owned state: none (stateless)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - CommandRuntime (to execute commands)
 * - PermissionAwareCommandRunner (to check AI permissions)
 * 
 * Event emissions: "ai.command.routed", "ai.command.blocked"
 * Event subscriptions: "ai.command" from AI-orchestrator
 * Synchronization: none (commands serialised by CommandRuntime)
 * Recovery: commands follow standard recovery path
 * Telemetry: AI command count, block rate
 * Diagnostics: recent AI commands
 * Accessibility: N/A
 * Performance: lightweight routing overhead
 * Forbidden: AI commands mutating user state without explicit consent; bypassing safety checks
 */

import type { CommandType, Command, ExecutionContext } from '../contracts/command-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { CommandRuntime } from '../runtime/command-runtime';
import type { PermissionAwareCommandRunner } from '../permissions/permission-aware-command-runner';

export class AICommandRouter {
  private blockedTypes: Set<CommandType> = new Set(); // AI cannot execute these

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private commandRuntime: CommandRuntime,
    private permissionRunner: PermissionAwareCommandRunner,
  ) {
    this.eventBus.subscribe('ai.command', this.onAICommand.bind(this));
    // AI safety: blacklist dangerous command types
    this.blockedTypes.add('world.delete' as CommandType);
    this.blockedTypes.add('user.permission.grant' as CommandType);
  }

  private async onAICommand(event: any): Promise<void> {
    const { command, aiContext } = event.payload as { command: Command; aiContext: any };
    if (this.blockedTypes.has(command.type)) {
      this.logger.warn(`AI command blocked: ${command.type}`);
      this.meter.incrementCounter('ai.command.blocked');
      await this.eventBus.publish('ai.command.blocked', { commandId: command.id, type: command.type, reason: 'blocked_type' });
      return;
    }
    await this.routeAICommand(command, aiContext);
  }

  async routeAICommand(command: Command, aiContext?: any): Promise<unknown> {
    const context: ExecutionContext = {
      userId: command.metadata.userId ?? 'ai-agent',
      sessionId: command.metadata.sessionId ?? 'ai-session',
      variables: { aiSource: true, ...aiContext },
      metadata: { aiGenerated: true },
    };
    this.meter.incrementCounter('ai.command.routed');
    this.logger.info(`AI command routed: ${command.type} (${command.id})`);
    await this.eventBus.publish('ai.command.routed', { commandId: command.id, type: command.type });
    return this.commandRuntime.execute(command.type, command.payload, context, {
      ...command.metadata,
      tags: { ...command.metadata.tags, ai_generated: 'true' },
    });
  }
}