// src/experiments/library/vernier-measurement.ts
import { Experiment } from "../experiment.types";

export const vernierMeasurementExperiment: Experiment = {
  id: "vernier-measurement",
  name: "Vernier Caliper Reading",
  description: "Learn to read a vernier caliper with zero error correction.",
  steps: [
    {
      id: "step1",
      instruction: "Main scale reading is 21 mm. Vernier division 13 coincides. What is the raw reading?",
      expectedAnswer: 21.26,
      validator: (ans, exp) => Math.abs(ans - exp) < 0.01,
      hint: "Raw = main + (vernier division × 0.02)",
    },
    {
      id: "step2",
      instruction: "Zero error is +0.02 mm. Correct the previous reading.",
      expectedAnswer: 21.24,
      validator: (ans, exp) => Math.abs(ans - exp) < 0.01,
      hint: "Corrected = raw − zero error",
    },
  ],
};