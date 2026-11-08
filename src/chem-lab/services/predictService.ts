import { aiClient } from "../ai/core/aiClient";
import { SYSTEM_PROMPTS, GEMINI_CONFIGS } from "../ai/providers/geminiProvider";
import { PredictResponse, Species } from "../types";

/**
 * Predict Service
 * Responsibility: Format prompts, handle species mapping, and coordinate AI calls for reaction predictions.
 */

export const predictService = {
  /**
   * Predicts a chemical reaction based on available reactants and conditions.
   */
  async predictReaction(reactants: Species[], temperatureK: number): Promise<PredictResponse | null> {
    if (reactants.length === 0) return null;

    const reactantList = reactants.map(r => `${r.name} (${r.formula})`).join(", ");
    
    const prompt = `
      ${SYSTEM_PROMPTS.CHEMIST}
      
      Predict the outcome of mixing these substances: ${reactantList}
      Current Temperature: ${temperatureK}K
      
      Your response MUST follow this exact JSON structure:
      {
        "reactionOccurs": boolean,
        "products": [{"name": string, "formula": string, "yield_pct": number}],
        "dH_kJ_per_mol": number,
        "dG_kJ_per_mol": number,
        "mechanism": string[],
        "confidence": "high" | "medium" | "low",
        "safetyFlags": string[],
        "explanation": string
      }
    `;

    try {
      const result = await aiClient.generateStruct<PredictResponse>(
        prompt, 
        GEMINI_CONFIGS.PREDICT_MODEL
      );
      
      // Minimal validation - ensure critical fields exist
      if (result && typeof result.reactionOccurs === 'boolean') {
        return result;
      }

      return null;
    } catch (error) {
      console.error("PREDICT_SERVICE_ERROR:", error);
      return null;
    }
  }
};
