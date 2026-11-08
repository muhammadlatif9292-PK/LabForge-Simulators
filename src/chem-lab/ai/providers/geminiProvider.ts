/**
 * Gemini Provider Configurations
 * Allows switching between pro and flash models or setting specific system instructions.
 */

export const GEMINI_CONFIGS = {
  PREDICT_MODEL: "gemini-3.1-pro-preview", // Higher reasoning for reaction prediction
  EXPLAIN_MODEL: "gemini-3-flash-preview", // Fast for UI explanations
  DEFAULT_TEMPERATURE: 0.7,
};

export const SYSTEM_PROMPTS = {
  CHEMIST: `You are an expert computational chemist. Always provide responses in valid JSON format.
Ensure stoichiometric balance and thermodynamic consistency in predictions.`,
};
