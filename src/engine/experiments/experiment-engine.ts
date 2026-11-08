// src/experiments/experiment-engine.ts
import { Experiment, Step, Result } from "./experiment.types";
import { evaluateStep } from "./evaluator";

export class ExperimentEngine {
  private experiment: Experiment;
  private currentStepIndex: number = 0;
  private answers: any[] = [];

  constructor(experiment: Experiment) {
    this.experiment = experiment;
  }

  start(): void {
    this.currentStepIndex = 0;
    this.answers = [];
  }

  getCurrentStep(): Step | null {
    return this.experiment.steps[this.currentStepIndex] || null;
  }

  submitAnswer(answer: any): Result {
    const step = this.getCurrentStep();
    if (!step) throw new Error("Experiment completed");

    const evaluation = evaluateStep(step, answer);
    this.answers.push(answer);

    if (evaluation.passed) {
      this.currentStepIndex++;
    }

    return evaluation;
  }

  isComplete(): boolean {
    return this.currentStepIndex >= this.experiment.steps.length;
  }

  getResults(): any {
    return {
      experimentId: this.experiment.id,
      steps: this.experiment.steps.map((step, i) => ({
        stepId: step.id,
        answer: this.answers[i],
        passed: evaluateStep(step, this.answers[i]).passed,
      })),
    };
  }
}