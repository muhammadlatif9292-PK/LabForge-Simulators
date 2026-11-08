// src/core/validation.ts
export function validateRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function validateNumber(value: any): boolean {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}

export function validatePositive(value: number): boolean {
  return value > 0;
}

export function validateNonZero(value: number): boolean {
  return value !== 0;
}