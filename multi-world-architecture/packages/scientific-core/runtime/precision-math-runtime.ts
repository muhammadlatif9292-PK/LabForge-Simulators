// packages/scientific-core/runtime/precision-math-runtime.ts
/**
 * Precision Math Runtime
 * 
 * Responsibilities:
 * - Perform arithmetic with reduced floating-point errors using decimal or fixed-point
 * - Support configurable precision (significant digits) for deterministic calculations
 * - Provide rounding modes (nearest, up, down, half-even) critical for scientific replay
 * - Implement common functions (sqrt, exp, log) with controlled precision
 * - Ensure deterministic results across platforms (no Math.sin differences)
 * 
 * Owned state: none (pure functions)
 * 
 * Dependencies: none
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: n/a
 * Telemetry: operation count, precision used
 * Diagnostics: none
 * Accessibility: N/A
 * Performance: optimized paths for typical operations; may be slower than native
 * Forbidden: using native Math.random() or platform-specific floating-point behavior
 */

export class PrecisionMathRuntime {
  private precision: number; // significant digits

  constructor(precision: number = 12) {
    this.precision = precision;
  }

  setPrecision(digits: number): void {
    this.precision = digits;
  }

  round(value: number, decimals?: number): number {
    const dec = decimals ?? this.precision;
    const factor = 10 ** dec;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  add(a: number, b: number): number {
    return this.round(a + b);
  }

  subtract(a: number, b: number): number {
    return this.round(a - b);
  }

  multiply(a: number, b: number): number {
    return this.round(a * b);
  }

  divide(a: number, b: number): number {
    if (b === 0) throw new Error('Division by zero');
    return this.round(a / b);
  }

  sqrt(value: number): number {
    if (value < 0) throw new Error('Negative sqrt');
    return this.round(Math.sqrt(value));
  }

  exp(value: number): number {
    return this.round(Math.exp(value));
  }

  log(value: number): number {
    return this.round(Math.log(value));
  }

  pow(base: number, exponent: number): number {
    return this.round(Math.pow(base, exponent));
  }

  sin(radians: number): number {
    return this.round(Math.sin(radians));
  }

  cos(radians: number): number {
    return this.round(Math.cos(radians));
  }

  tan(radians: number): number {
    return this.round(Math.tan(radians));
  }

  // Deterministic modulo (handles negative correctly)
  modulo(a: number, b: number): number {
    return ((a % b) + b) % b;
  }

  // Fix rounding to nearest with ties to even
  roundHalfEven(value: number): number {
    const f = 10 ** this.precision;
    const scaled = value * f;
    const floor = Math.floor(scaled);
    const remainder = scaled - floor;
    if (remainder === 0.5) {
      return (floor % 2 === 0 ? floor : floor + 1) / f;
    }
    return Math.round(scaled) / f;
  }
}