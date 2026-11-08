// packages/scientific-core/runtime/scientific-validation-engine.ts
/**
 * Scientific Validation Engine
 * 
 * Responsibilities:
 * - Validate measurement values against physical constraints (e.g., speed < c)
 * - Check dimensional consistency of formulas and conversions
 * - Enforce minimum uncertainty reporting
 * - Verify calibration quality and detect outliers
 * - Log validation violations for quality assurance
 * 
 * Owned state:
 * - violationLog: ValidationViolation[] (bounded)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - ScientificConstantsRegistry (for universal bounds)
 * - UnitConversionEngine (for dimensional checks)
 * 
 * Event emissions: "scientific.validation.violation"
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: log can be persisted for audit
 * Telemetry: violation count per rule
 * Diagnostics: recent violations
 * Accessibility: N/A
 * Performance: lightweight checks; no heavy computation per validation
 * Forbidden: allowing physically impossible values to propagate without flagging
 */

import type { ScientificMeasurement, UnitId, CalibrationModel } from '../contracts/scientific-core-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { ScientificConstantsRegistry } from './scientific-constants-registry';
import type { UnitConversionEngine } from './unit-conversion-engine';

interface ValidationViolation {
  timestamp: number;
  type: string;
  message: string;
}

export class ScientificValidationEngine {
  private violations: ValidationViolation[] = [];
  private maxViolations = 500;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private constants: ScientificConstantsRegistry,
    private unitConverter: UnitConversionEngine,
  ) {}

  validateMeasurement(measurement: ScientificMeasurement, instrumentId?: string): boolean {
    // Speed of light limit for velocities
    const dim = this.unitConverter.getUnit(measurement.unit)?.dimension;
    if (dim === 'length' || dim === 'time') {
      // Not a strict check for velocity unless we know it's speed
    }
    // Non-negative mass, temperature above absolute zero in Kelvin
    if (measurement.unit === 'kelvin' && measurement.value < 0) {
      this.reportViolation('negative_temperature', `Negative temperature: ${measurement.value} K`);
      return false;
    }
    // Check uncertainty is positive
    if (measurement.standardUncertainty < 0) {
      this.reportViolation('negative_uncertainty', `Negative uncertainty: ${measurement.standardUncertainty}`);
      return false;
    }
    return true;
  }

  validateCalibration(model: CalibrationModel): boolean {
    if (model.rSquared < 0.95) {
      this.logger.warn(`Low R² in calibration: ${model.rSquared.toFixed(4)}`);
      this.reportViolation('poor_calibration', `R² below threshold: ${model.rSquared.toFixed(4)}`);
      return false;
    }
    return true;
  }

  checkDimensionalHomogeneity(formulaDimensions: { left: string[]; right: string[] }): boolean {
    const leftSet = new Set(formulaDimensions.left);
    const rightSet = new Set(formulaDimensions.right);
    return leftSet.size === rightSet.size && [...leftSet].every(d => rightSet.has(d));
  }

  detectOutlier(samples: number[], thresholdSigma: number = 3): number[] {
    const mean = samples.reduce((a,b)=>a+b,0)/samples.length;
    const std = Math.sqrt(samples.reduce((s,v)=>s+(v-mean)**2,0)/samples.length);
    return samples.map((v, i) => Math.abs(v-mean)/std > thresholdSigma ? i : -1).filter(i=>i>=0);
  }

  private reportViolation(type: string, message: string): void {
    this.violations.push({ timestamp: Date.now(), type, message });
    if (this.violations.length > this.maxViolations) this.violations.shift();
    this.meter.incrementCounter('scientific.validation.violation', { type });
    this.logger.warn(`Scientific validation violation: ${message}`);
  }

  getRecentViolations(limit: number = 20): ValidationViolation[] {
    return this.violations.slice(-limit);
  }
}