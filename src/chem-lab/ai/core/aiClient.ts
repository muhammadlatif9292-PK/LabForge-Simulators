import { GoogleGenAI } from "@google/genai";

/**
 * Core AI Client
 * Responsibility: Provide a unified interface for AI providers, handle extraction, and error safety.
 */

const API_KEY = process.env.GEMINI_API_KEY || "";

if (!API_KEY) {
  console.warn("AI_CLIENT: GEMINI_API_KEY not found in environment.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Safely extracts and parses JSON from a markdown/text response.
 * Handles cases where the model wraps JSON in code blocks or adds prefix text.
 */
export function extractJson<T>(text: string): T | null {
  try {
    // Look for JSON block if it exists
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/);
    const cleanContent = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
    return JSON.parse(cleanContent.trim()) as T;
  } catch (e) {
    console.error("AI_CLIENT_PARSE_ERROR:", e);
    return null;
  }
}

export const aiClient = {
  /**
   * Generates a structural response using a prompt and an optional schema hint.
   */
  async generateStruct<T>(prompt: string, model: string = "gemini-3-flash-preview"): Promise<T | null> {
    if (!API_KEY) return null;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json"
        }
      });

      if (!response.text) return null;
      
      return extractJson<T>(response.text);
    } catch (error) {
      console.error("AI_CLIENT_REQUEST_ERROR:", error);
      return null;
    }
  }
};
