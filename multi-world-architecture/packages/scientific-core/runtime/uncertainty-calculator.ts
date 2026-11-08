// packages/scientific-core/runtime/uncertainty-calculator.ts
/**
 * Uncertainty Calculator
 * 
 * Responsibilities:
 * - Compute combined standard uncertainty via the GUM (Guide to the Expression of Uncertainty in Measurement)
 * - Propagate uncertainty through arithmetic operations using analytical formulas
 * - Calculate coverage factor k for expanded uncertainty (k=2 for 95%)
 * - Combine multiple uncertainty components (type A and B)
 * - Support Monte Carlo simulation for complex expressions (optional)
 * 
 * Owned state: none
 * 
 * Dependencies: ILogger, IMeter (optional)
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: n/a
 * Telemetry: confidence interval computation count
 * Diagnostics: last operation details
 * Accessibility: uncertainties formatted as ± value
 * Performance: analytical formulas O(1); Monte Carlo O(n)
 * Forbidden: ignoring correlations without justification
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class UncertaintyCalculator {
  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  // Propagation for independent variables (Gaussian)
  propagateUncertainty(
    u1: number,
    u2: number,
    operation: 'add' | 'subtract' | 'multiply' | 'divide',
    values: [number, number],
    covariance: number = 0,
  ): number {
    const [x, y] = values;
    switch (operation) {
      case 'add':
      case 'subtract':
        return Math.sqrt(u1 ** 2 + u2 ** 2 + 2 * covariance);
      case 'multiply': {
        if (x === 0 || y === 0) return 0;
        return Math.abs(x * y) * Math.sqrt((u1 / x) ** 2 + (u2 / y) ** 2 + 2 * covariance / (x * y));
      }
      case 'divide': {
        if (y === 0) return Infinity;
        return Math.abs(x / y) * Math.sqrt((u1 / x) ** 2 + (u2 / y) ** 2 - 2 * covariance / (x * y));
      }
      default:
        return 0;
    }
  }

  // Combine independent uncertainty components (root sum square)
  combineComponents(components: number[]): number {
    return Math.sqrt(components.reduce((sum, u) => sum + u ** 2, 0));
  }

  // Expanded uncertainty (k=2 for 95% confidence)
  expandedUncertainty(standardUncertainty: number, coverageFactor: number = 2): number {
    return standardUncertainty * coverageFactor;
  }

  // Relative uncertainty
  relativeUncertainty(value: number, standardUncertainty: number): number {
    return Math.abs(standardUncertainty / value);
  }

  // Type A evaluation: standard deviation of the mean
  typeAEvaluation(samples: number[]): number {
    const n = samples.length;
    if (n < 2) return 0;
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const variance = samples.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (n - 1);
    return Math.sqrt(variance / n); // standard deviation of the mean
  }

  // Format uncertainty as ± value with unit
  format(value: number, uncertainty: number, unit: string, k: number = 2): string {
    const expanded = this.expandedUncertainty(uncertainty, k);
    return `${value.toFixed(6)} ± ${expanded.toFixed(6)} ${unit} (k=${k})`;
  }
}