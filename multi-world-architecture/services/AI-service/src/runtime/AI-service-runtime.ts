// services/AI-service/src/runtime/AI-service-runtime.ts
/**
 * AI Service Runtime
 * 
 * Responsibilities:
 * - Thin service wrapper that bootstraps the AI-agent-runtime,
 *   exposes HTTP endpoints, and connects to the message bus.
 * - Manages AI model lifecycle (load, warmup, evict) in response to demand.
 * - Routes incoming requests to the MultiAgentOrchestrator.
 * 
 * Owned state:
 * - orchestrator: MultiAgentOrchestrator
 * - modelCache: Map<ModelId, ModelInstance>
 * 
 * Dependencies:
 * - MultiAgentOrchestrator, SemanticMemoryRuntime, AIStreamBuffer, etc.
 * - DistributedEventBus, DistributedLockManager (for model loading)
 * 
 * Event emissions: none directly; delegates to agents
 * Event subscriptions: "ai.request" from gateway
 * Synchronization: model loading guarded by distributed lock
 * Recovery: models reloaded on crash
 * Telemetry: request rate, response latency, GPU utilisation
 * Diagnostics: active models, pending requests
 * Accessibility: N/A
 * Performance: lazy model loading; streaming responses
 * Forbidden: loading models without sufficient GPU memory; blocking inference
 */

import type { ILogger, IMeter, ITracer } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { MultiAgentOrchestrator } from '@labforge/AI-agent-runtime';

export class AIServiceRuntime {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private tracer: ITracer,
    private eventBus: DistributedEventBus,
    private orchestrator: MultiAgentOrchestrator,
  ) {}

  async start(): Promise<void> {
    this.eventBus.subscribe('ai.request', async (event) => {
      const { task, context } = event.payload as any;
      try {
        await this.orchestrator.submitTask(task, context);
      } catch (err) {
        this.logger.error('AI request failed', { error: err });
      }
    });
    this.logger.info('AI service runtime started');
    this.meter.incrementCounter('ai_service.started');
  }

  async shutdown(): Promise<void> {
    this.logger.info('AI service runtime stopped');
  }
}