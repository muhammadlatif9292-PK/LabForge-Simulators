/**
 * Client for managing chem-ai API communication.
 * Rules: This is the ONLY file that calls fetch("/api/chem-ai/").
 */
export const AIClient = {
  predict: () => fetch("/api/chem-ai/predict"),
  safety: () => fetch("/api/chem-ai/safety")
};
