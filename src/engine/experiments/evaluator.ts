// src/experiments/evaluator.ts
import { Step, Result } from "./experiment.types";

export function evaluateStep(step: Step, answer: any): Result {
  const passed = step.validator(answer, step.expectedAnswer);
  return {
    passed,
    message: passed ? "Correct!" : `Incorrect. ${step.hint || "Try again."}`,
  };
}