// packages/telemetry/src/runtime/distributed-trace-runtime.ts
/**
 * Telemetry: Distributed Trace Runtime
 * 
 * Responsibilities:
 * - Thin wrapper around the core DistributedTraceEngine for easy frontend/backend use
 * - Ensures consistent tracing API across all packages
 */
export { DistributedTraceEngine as DistributedTraceRuntime } from '@labforge/observability-runtime/tracing/distributed-trace-engine';