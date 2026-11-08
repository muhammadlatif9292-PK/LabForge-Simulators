// src/types/experiment.types.ts
export type ExperimentId = string;
export type StepId = string;

export interface ExperimentProgress {
  experimentId: ExperimentId;
  currentStep: number;
  answers: Record<StepId, any>;
  completed: boolean;
}