// src/labforge/lib/physics/noise.ts
/**
 * Gaussian noise using Box-Muller transform.
 */
export function gaussian(mean: number, sigma: number): number {
  if (sigma <= 0) return mean
  let u1: number, u2: number
  do { u1 = Math.random() } while (u1 === 0)
  u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + sigma * z
}

/**
 * Poisson distribution using Knuth's algorithm.
 */
export function poisson(lambda: number): number {
  if (lambda <= 0) return 0
  const L = Math.exp(-lambda)
  let p = 1
  let k = 0
  do {
    k++
    p *= Math.random()
  } while (p > L)
  return k - 1
}

/**
 * Slow drift — smooth variation over time using sine + noise.
 */
export function driftValue(
  center: number,
  amplitude: number,
  timestamp: number,
  periodMs = 8000
): number {
  const phase = (timestamp * 2 * Math.PI) / periodMs
  const sine = Math.sin(phase)
  const noise = gaussian(0, amplitude * 0.1)
  return center + amplitude * sine + noise
}

/**
 * Quantise to nearest step — simulates ADC resolution.
 */
export function quantise(value: number, step: number): number {
  if (step <= 0) return value
  return Math.round(value / step) * step
}

/**
 * Timing jitter — value ± (Math.random() - 0.5) * 2 * maxJitter
 */
export function jitter(value: number, maxJitter: number): number {
  const delta = (Math.random() - 0.5) * 2 * maxJitter
  return value + delta
}