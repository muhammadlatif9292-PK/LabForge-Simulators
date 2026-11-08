// packages/scientific-core/contracts/scientific-core-contracts.ts
/**
 * Scientific Core Contracts
 * 
 * Responsibilities:
 * - Define strict types for scientific units, measurements, constants,
 *   calibration, signals, dimensional analysis, and formulas
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type UnitId = string & { readonly __brand: 'UnitId' };
export type MeasurementId = string & { readonly __brand: 'MeasurementId' };
export type FormulaId = string & { readonly __brand: 'FormulaId' };

export enum UnitDimension {
  LENGTH = 'length',
  MASS = 'mass',
  TIME = 'time',
  ELECTRIC_CURRENT = 'electric_current',
  TEMPERATURE = 'temperature',
  AMOUNT_OF_SUBSTANCE = 'amount_of_substance',
  LUMINOUS_INTENSITY = 'luminous_intensity',
  PLANE_ANGLE = 'plane_angle',
  SOLID_ANGLE = 'solid_angle',
  DIMENSIONLESS = 'dimensionless',
}

export enum UnitSystem {
  SI = 'si',
  IMPERIAL = 'imperial',
  CGS = 'cgs',
  ASTRONOMICAL = 'astronomical',
  CUSTOM = 'custom',
}

export interface UnitDefinition {
  id: UnitId;
  name: string;
  symbol: string;
  dimension: UnitDimension;
  system: UnitSystem;
  baseFactor: number;      // relative to base SI unit
  offset: number;          // 0 for most, e.g., Celsius offset
  prefixes: MetricPrefix[];
}

export enum MetricPrefix {
  YOTTA = 'yotta', // 10^24
  ZETTA = 'zetta',
  EXA = 'exa',
  PETA = 'peta',
  TERA = 'tera',
  GIGA = 'giga',
  MEGA = 'mega',
  KILO = 'kilo',
  HECTO = 'hecto',
  DEKA = 'deka',
  NONE = 'none',
  DECI = 'deci',
  CENTI = 'centi',
  MILLI = 'milli',
  MICRO = 'micro',
  NANO = 'nano',
  PICO = 'pico',
  FEMTO = 'femto',
  ATTO = 'atto',
  ZEPTO = 'zepto',
  YOCTO = 'yocto',
}

export interface ScientificMeasurement {
  id: MeasurementId;
  value: number;
  unit: UnitId;
  standardUncertainty: number; // combined standard uncertainty (±)
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface CalibrationPoint {
  reference: number;   // true value
  measured: number;    // instrument reading
  timestamp: number;
}

export interface CalibrationModel {
  slope: number;
  intercept: number;
  rSquared: number;
  validUntil: number;
  points: CalibrationPoint[];
}

export interface SignalSample {
  timestamp: number;
  value: number;
}

export interface DimensionalFormula {
  numerator: UnitDimension[];
  denominator: UnitDimension[];
}

export interface FormulaExpression {
  formula: string;
  variables: string[];
  ast?: any; // parsed AST
}

export interface FormulaResult {
  value: number;
  unit: UnitId;
  uncertainty?: number;
}

export interface ScientificConstant {
  symbol: string;
  name: string;
  value: number;
  unit: UnitId;
  uncertainty: number;
  category: 'universal' | 'electromagnetic' | 'atomic' | 'physico-chemical';
}