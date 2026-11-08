// src/state/slices/experimentSlice.ts
import { StateCreator } from "zustand";

export interface ExperimentSlice {
  activeExperimentId: string | null;
  currentStepIndex: number;
  experimentAnswers: Record<string, any>;
  experimentFeedback: string | null;
  startExperiment: (id: string) => void;
  nextStep: () => void;
  answerStep: (answer: any) => void;
  resetExperiment: () => void;
}

export const createExperimentSlice: StateCreator<ExperimentSlice> = (set) => ({
  activeExperimentId: null,
  currentStepIndex: 0,
  experimentAnswers: {},
  experimentFeedback: null,

  startExperiment: (id) =>
    set({ activeExperimentId: id, currentStepIndex: 0, experimentAnswers: {}, experimentFeedback: null }),

  nextStep: () =>
    set((state) => ({ currentStepIndex: state.currentStepIndex + 1 })),

  answerStep: (answer) =>
    set((state) => ({
      experimentAnswers: { ...state.experimentAnswers, [state.currentStepIndex]: answer },
    })),

  resetExperiment: () =>
    set({ activeExperimentId: null, currentStepIndex: 0, experimentAnswers: {}, experimentFeedback: null }),
});