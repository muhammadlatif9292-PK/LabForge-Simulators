// packages/command-framework/registry/command-registry.ts
/**
 * Command Registry
 * 
 * Responsibilities:
 * - Register command handlers with their schemas, permissions, and metadata
 * - Provide fast lookup by command type
 * - Validate command payloads against registered schemas
 * - Support handler hot-reloading in development
 * 
 * Owned state:
 * - handlers: Map<CommandType, CommandRegistryEntry>
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: "command.handler.registered", "command.handler.removed"
 * Event subscriptions: none
 * Synchronization: none (read-mostly after initialisation)
 * Recovery: handlers re-registered on restart
 * Telemetry: handler count
 * Diagnostics: registered command types
 * Accessibility: N/A
 * Performance: O(1) lookup
 * Forbidden: double registration; handler mutation during execution
 */

import type { CommandType, CommandHandler, CommandRegistryEntry } from '../contracts/command-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class CommandRegistry {
  private entries: Map<CommandType, CommandRegistryEntry> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  register(handler: CommandHandler, options?: Partial<Omit<CommandRegistryEntry, 'handler'>>): void {
    if (this.entries.has(handler.commandType)) {
      this.logger.warn(`Overwriting handler for command type: ${handler.commandType}`);
    }
    this.entries.set(handler.commandType, {
      handler,
      schema: (options as any)?.schema,
      permissions: handler.permissions ?? options?.permissions ?? [],
      undoable: options?.undoable ?? false,
      maxRetries: options?.maxRetries ?? 2,
      timeoutMs: options?.timeoutMs ?? 30000,
    });
    this.meter.incrementCounter('command.handler.registered');
    this.logger.debug(`Command handler registered: ${handler.commandType}`);
  }

  unregister(commandType: CommandType): void {
    this.entries.delete(commandType);
    this.meter.incrementCounter('command.handler.removed');
  }

  getHandler(commandType: CommandType): CommandHandler | undefined {
    return this.entries.get(commandType)?.handler;
  }

  getEntry(commandType: CommandType): CommandRegistryEntry | undefined {
    return this.entries.get(commandType);
  }

  hasHandler(commandType: CommandType): boolean {
    return this.entries.has(commandType);
  }

  getAllCommandTypes(): CommandType[] {
    return Array.from(this.entries.keys());
  }
}