// src/labforge/lib/physics/ode.ts
import { clamp } from '../units'
import { logger } from '../logger'

export type StateVector = number[]
export type DerivativeFunction = (t: number, y: StateVector) => StateVector

export function addVectors(a: StateVector, b: StateVector): StateVector {
  if (a.length !== b.length) throw new Error('addVectors: length mismatch')
  return a.map((v, i) => v + b[i])
}

export function scaleVector(v: StateVector, s: number): StateVector {
  return v.map(x => x * s)
}

export function rk4Step(
  f: DerivativeFunction,
  t: number,
  y: StateVector,
  dt: number
): StateVector {
  const k1 = f(t, y)
  const k2 = f(t + dt/2, addVectors(y, scaleVector(k1, dt/2)))
  const k3 = f(t + dt/2, addVectors(y, scaleVector(k2, dt/2)))
  const k4 = f(t + dt,   addVectors(y, scaleVector(k3, dt)))

  const result = addVectors(y, scaleVector(
    addVectors(
      addVectors(k1, scaleVector(k2, 2)),
      addVectors(scaleVector(k3, 2), k4)
    ),
    dt / 6
  ))

  if (result.some(v => !Number.isFinite(v))) {
    logger.warn('ode', 'NaN/Infinity in rk4Step result — returning previous state', { t, dt })
    return [...y]
  }
  return result
}

export function rk4Advance(
  f: DerivativeFunction,
  t0: number,
  y0: StateVector,
  totalTime: number,
  dt: number
): { t: number; y: StateVector } {
  if (totalTime <= 0) return { t: t0, y: [...y0] }
  const step = clamp(dt, 1e-6, 0.1)
  let t = t0
  let y = [...y0]
  let remaining = totalTime
  while (remaining > 1e-10) {
    const dtActual = Math.min(step, remaining)
    y = rk4Step(f, t, y, dtActual)
    t += dtActual
    remaining -= dtActual
  }
  return { t, y }
}