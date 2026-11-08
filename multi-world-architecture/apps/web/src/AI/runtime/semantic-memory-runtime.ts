// apps/web/src/AI/runtime/semantic-memory-runtime.ts
/**
 * Frontend Semantic Memory Runtime
 * 
 * Responsibilities:
 * - Thin wrapper around the shared SemanticMemoryRuntime for use in the frontend app shell
 * - Ensures the AI layer can be initialised and torn down along with the rest of the HUD
 */
export { SemanticMemoryRuntime as SemanticMemoryRuntime } from '@labforge/AI-agent-runtime/runtime/semantic-memory-runtime';