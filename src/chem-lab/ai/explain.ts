import { AIResult } from '../types';

/**
 * AI-generated explanations of simulation results.
 */
export const explainResults = async <T>(): Promise<AIResult<T>> => ({
  status: 'success',
  data: {} as T,
  meta: { cacheHit: false, responseTimeMs: 0, attempt: 1, fallback: false }
});
