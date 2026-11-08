// src/experiments/experiment.types.ts
export interface Step {
  id: string;
  instruction: string;
  expectedAnswer: any;
  validator: (answer: any, expected: any) => boolean;
  hint?: string;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  steps: Step[];
}

export interface Result {
  passed: boolean;
  message: string;
  nextStep?: Step;
}