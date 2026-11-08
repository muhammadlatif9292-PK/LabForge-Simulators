// src/core/measurement-system.ts
export function applyPrecision(value: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

export function applyErrorMargin(value: number, margin: number): number {
  return value + (Math.random() - 0.5) * 2 * margin;
}

export interface Measurement {
  value: number;
  unit: string;
  precision: number;
  errorMargin: number;
}