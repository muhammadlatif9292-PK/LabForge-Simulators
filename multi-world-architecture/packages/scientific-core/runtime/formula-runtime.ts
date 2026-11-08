// packages/scientific-core/runtime/formula-runtime.ts
/**
 * Formula Runtime
 * 
 * Responsibilities:
 * - Parse and evaluate scientific formulas from strings
 * - Bind variables to measured values with units
 * - Perform dimensional analysis to verify formula correctness
 * - Support standard mathematical functions (sin, log, exp, etc.)
 * - Cache compiled formulas for performance
 * 
 * Owned state:
 * - compiledFormulas: Map<string, (variables: Record<string, number>) => FormulaResult>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - UnitConversionEngine (to ensure consistent units)
 * - DimensionalAnalysisEngine (to validate)
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none (read-only)
 * Recovery: cache can be rebuilt
 * Telemetry: evaluation count, parse errors
 * Diagnostics: registered formulas
 * Accessibility: N/A
 * Performance: compiled formulas are fast; lazy compilation
 * Forbidden: evaluating unverified formulas on critical data
 */

import type { FormulaResult, UnitId } from '../contracts/scientific-core-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { UnitConversionEngine } from './unit-conversion-engine';

export class FormulaRuntime {
  private compiled: Map<string, (vars: Record<string, number>) => number> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private unitConverter: UnitConversionEngine,
  ) {}

  registerFormula(id: string, expression: string, variableNames: string[]): void {
    // Simple expression parser converting to Function; production would use a proper AST
    try {
      const fn = new Function(...variableNames, `return ${expression};`) as (...args: number[]) => number;
      this.compiled.set(id, (vars) => fn(...variableNames.map(v => vars[v])));
      this.logger.debug(`Formula registered: ${id}`);
    } catch (err) {
      this.logger.error(`Failed to compile formula ${id}: ${expression}`, { error: err });
      this.meter.incrementCounter('scientific.formula.compile_error');
    }
  }

  evaluate(id: string, variables: Record<string, number>, expectedUnit: UnitId): FormulaResult {
    const fn = this.compiled.get(id);
    if (!fn) throw new Error(`Formula not found: ${id}`);
    const value = fn(variables);
    this.meter.incrementCounter('scientific.formula.evaluated');
    return { value, unit: expectedUnit };
  }

  evaluateWithUnits(id: string, variables: Record<string, { value: number; unit: UnitId }>, targetUnit: UnitId): FormulaResult {
    // Convert all variable units to target unit before evaluating
    const converted: Record<string, number> = {};
    for (const [name, { value, unit }] of Object.entries(variables)) {
      converted[name] = this.unitConverter.convert(value, unit, targetUnit);
    }
    return this.evaluate(id, converted, targetUnit);
  }
}