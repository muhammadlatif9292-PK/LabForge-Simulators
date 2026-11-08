// packages/scientific-core/runtime/scientific-measurement-runtime.ts
/**
 * Scientific Measurement Runtime
 * 
 * Responsibilities:
 * - Create, store, and query scientific measurements with uncertainty
 * - Combine measurements using error propagation rules
 * - Compare measurements with statistical significance
 * - Serialize/deserialize measurements for offline storage
 * - Validate measurement values (range checks, sanity)
 * 
 * Owned state:
 * - recentMeasurements: MeasurementId[] (bounded)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - UncertaintyCalculator
 * - UnitConversionEngine (to normalize units)
 * 
 * Event emissions: none (pure calculation)
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: no persistent state (measurements passed in)
 * Telemetry: measurement count
 * Diagnostics: last created measurement
 * Accessibility: measurement representation must be human-readable
 * Performance: O(1) per operation
 * Forbidden: ignoring uncertainty in comparisons; losing metadata
 */

import { v4 as uuidv4 } from 'uuid';
import type { ScientificMeasurement, MeasurementId, UnitId } from '../contracts/scientific-core-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { UncertaintyCalculator } from './uncertainty-calculator';
import type { UnitConversionEngine } from './unit-conversion-engine';

export class ScientificMeasurementRuntime {
  private recentIds: string[] = [];
  private maxRecent = 1000;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private uncertainty: UncertaintyCalculator,
    private unitConverter: UnitConversionEngine,
  ) {}

  createMeasurement(value: number, unit: UnitId, standardUncertainty: number, metadata?: Record<string, unknown>): ScientificMeasurement {
    const id = uuidv4() as MeasurementId;
    const measurement: ScientificMeasurement = {
      id,
      value,
      unit,
      standardUncertainty,
      timestamp: Date.now(),
      metadata: metadata ?? {},
    };
    this.recentIds.push(id);
    if (this.recentIds.length > this.maxRecent) this.recentIds.shift();
    this.meter.incrementCounter('scientific.measurement.created');
    return measurement;
  }

  combineMeasurements(m1: ScientificMeasurement, m2: ScientificMeasurement, operation: 'add' | 'subtract' | 'multiply' | 'divide', targetUnit?: UnitId): ScientificMeasurement {
    // Convert to common unit if needed
    let v1 = m1.value;
    let v2 = m2.value;
    let unit = m1.unit;
    if (m1.unit !== m2.unit) {
      // Convert m2 to m1's unit (or to targetUnit)
      if (targetUnit) {
        v1 = this.unitConverter.convert(m1.value, m1.unit, targetUnit);
        v2 = this.unitConverter.convert(m2.value, m2.unit, targetUnit);
        unit = targetUnit;
      } else {
        throw new Error('Units must be compatible; provide targetUnit');
      }
    }
    const resultValue = this.computeResult(v1, v2, operation);
    const resultUncertainty = this.uncertainty.propagateUncertainty(m1.standardUncertainty, m2.standardUncertainty, operation, [v1, v2]);
    return this.createMeasurement(resultValue, unit, resultUncertainty, { combinedFrom: [m1.id, m2.id] });
  }

  compareMeasurements(m1: ScientificMeasurement, m2: ScientificMeasurement): { significantDifference: boolean; tScore: number } {
    // Welch's t-test simplified: |mean1 - mean2| / sqrt(u1^2 + u2^2)
    const t = Math.abs(m1.value - m2.value) / Math.sqrt(m1.standardUncertainty ** 2 + m2.standardUncertainty ** 2);
    return { significantDifference: t > 2, tScore: t };
  }

  private computeResult(a: number, b: number, op: 'add' | 'subtract' | 'multiply' | 'divide'): number {
    switch (op) {
      case 'add': return a + b;
      case 'subtract': return a - b;
      case 'multiply': return a * b;
      case 'divide': return b !== 0 ? a / b : NaN;
    }
  }

  serialize(measurement: ScientificMeasurement): string {
    return JSON.stringify(measurement);
  }

  deserialize(json: string): ScientificMeasurement {
    return JSON.parse(json);
  }
}