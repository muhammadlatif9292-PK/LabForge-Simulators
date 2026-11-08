// packages/AI-agent-runtime/src/contracts/ai-agent-contracts.ts
/**
 * AI Agent Contracts
 * 
 * Responsibilities:
 * - Define strict types for AI agents, tasks, memory, and coordination
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
 * Forbidden: runtime logic
 */

export type AgentId = string & { readonly __brand: 'AgentId' };
export type TaskId = string & { readonly __brand: 'TaskId' };
export type MemoryId = string & { readonly __brand: 'MemoryId' };

export enum AgentRole {
  ORCHESTRATOR = 'orchestrator',
  TUTOR = 'tutor',
  SIMULATION_AI = 'simulation-ai',
  ANALYST = 'analyst',
  PLANNER = 'planner',
  EXECUTOR = 'executor',
}

export interface AITask {
  id: TaskId;
  type: string;
  priority: number;
  payload: unknown;
  agentId?: AgentId; // assigned agent
  parentTaskId?: TaskId;
  deadline?: number;
  maxRetries: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

export interface AgentDescriptor {
  id: AgentId;
  role: AgentRole;
  capabilities: string[];
  modelConfig?: Record<string, unknown>;
}

export interface SemanticMemoryEntry {
  id: MemoryId;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  timestamp: number;
  ttl?: number;
}

export interface AICommand {
  id: string;
  type: string;
  payload: unknown;
  agentId: AgentId;
  timestamp: number;
  expiresAt?: number;
}

export interface StreamChunk {
  id: string;
  content: string;
  isFinal: boolean;
  metadata: Record<string, unknown>;
}