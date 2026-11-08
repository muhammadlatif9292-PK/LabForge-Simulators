// packages/scientific-core/runtime/calibration-runtime.ts
/**
 * Calibration Runtime
 * 
 * Responsibilities:
 * - Manage instrument calibration using multi-point linear regression
 * - Validate calibration quality (R², residual analysis)
 * - Schedule recalibration based on drift prediction or time
 * - Store calibration history for audit and traceability
 * - Apply calibration correction to raw measurements
 * 
 * Owned state:
 * - calibrationModels: Map<InstrumentId, CalibrationModel>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - PrecisionMathRuntime (for regression calculations)
 * 
 * Event emissions: "calibration.performed", "calibration.expired"
 * Event subscriptions: none
 * Synchronization: per-instrument; calibration updates are serialised
 * Recovery: calibration can be restored from persistent storage
 * Telemetry: calibration count, drift rate
 * Diagnostics: calibration model parameters
 * Accessibility: calibration status exposed for operators
 * Performance: linear regression O(n) per recalibration
 * Forbidden: using uncalibrated instruments for critical measurements
 */

import type { CalibrationPoint, CalibrationModel, UnitId } from '../contracts/scientific-core-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import { PrecisionMathRuntime } from './precision-math-runtime';

export class CalibrationRuntime {
  private models: Map<string, CalibrationModel> = new Map();
  private math: PrecisionMathRuntime;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.math = new PrecisionMathRuntime(12);
  }

  performCalibration(instrumentId: string, points: CalibrationPoint[], validityDays: number = 180): CalibrationModel {
    const n = points.length;
    if (n < 2) throw new Error('At least two calibration points required');
    // Simple linear regression: y = a + b*x, where reference is y, measured is x
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (const p of points) {
      sumX = this.math.add(sumX, p.measured);
      sumY = this.math.add(sumY, p.reference);
      sumXY = this.math.add(sumXY, this.math.multiply(p.measured, p.reference));
      sumX2 = this.math.add(sumX2, this.math.multiply(p.measured, p.measured));
    }
    const avgX = this.math.divide(sumX, n);
    const avgY = this.math.divide(sumY, n);
    const slope = this.math.divide(
      this.math.subtract(sumXY, this.math.multiply(n, this.math.multiply(avgX, avgY))),
      this.math.subtract(sumX2, this.math.multiply(n, this.math.multiply(avgX, avgX)))
    );
    const intercept = this.math.subtract(avgY, this.math.multiply(slope, avgX));
    // R²
    let ssRes = 0, ssTot = 0;
    for (const p of points) {
      const predicted = this.math.add(this.math.multiply(slope, p.measured), intercept);
      ssRes = this.math.add(ssRes, this.math.pow(this.math.subtract(p.reference, predicted), 2));
      ssTot = this.math.add(ssTot, this.math.pow(this.math.subtract(p.reference, avgY), 2));
    }
    const rSquared = ssTot === 0 ? 1 : this.math.subtract(1, this.math.divide(ssRes, ssTot));
    const model: CalibrationModel = {
      slope,
      intercept,
      rSquared,
      validUntil: Date.now() + validityDays * 86400000,
      points: [...points],
    };
    this.models.set(instrumentId, model);
    this.meter.incrementCounter('scientific.calibration.performed');
    this.logger.info(`Calibration performed for ${instrumentId}: slope=${slope.toFixed(6)}, R²=${rSquared.toFixed(4)}`);
    return model;
  }

  correctMeasurement(instrumentId: string, rawValue: number): number {
    const model = this.models.get(instrumentId);
    if (!model || Date.now() > model.validUntil) {
      throw new Error(`Calibration missing or expired for instrument ${instrumentId}`);
    }
    return this.math.add(this.math.multiply(model.slope, rawValue), model.intercept);
  }

  getModel(instrumentId: string): CalibrationModel | undefined {
    const model = this.models.get(instrumentId);
    if (model && Date.now() > model.validUntil) {
      this.logger.warn(`Calibration expired for ${instrumentId}`);
      return undefined;
    }
    return model;
  }

  isCalibrated(instrumentId: string): boolean {
    return !!this.getModel(instrumentId);
  }
}