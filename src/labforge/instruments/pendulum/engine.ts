// src/labforge/instruments/pendulum/engine.ts
import { rk4Step } from '../../lib/physics/ode'
import type { DerivativeFunction } from '../../lib/physics/ode'
import { degreesToRadians } from '../../lib/units'

export function makePendulumDerivative(
  length: number,
  gravity: number,
  damping: number
): DerivativeFunction {
  return (t: number, y: number[]) => {
    const theta = y[0]
    const omega = y[1]
    const dTheta = omega
    const dOmega = -(gravity / length) * Math.sin(theta) - damping * omega
    return [dTheta, dOmega]
  }
}

export function stepPendulum(
  theta: number,
  omega: number,
  t: number,
  dt: number,
  length: number,
  gravity: number,
  damping: number
): { theta: number; omega: number; t: number } {
  const f = makePendulumDerivative(length, gravity, damping)
  const y = [theta, omega]
  const yNext = rk4Step(f, t, y, dt)
  return { theta: yNext[0], omega: yNext[1], t: t + dt }
}

export function smallAnglePeriod(length: number, gravity: number): number {
  return 2 * Math.PI * Math.sqrt(length / gravity)
}

export function kineticEnergy(mass: number, length: number, omega: number): number {
  return 0.5 * mass * Math.pow(length * omega, 2)
}

export function potentialEnergy(mass: number, gravity: number, length: number, theta: number): number {
  return mass * gravity * length * (1 - Math.cos(theta))
}

export function bobPosition(length: number, theta: number): { x: number; y: number } {
  return { x: length * Math.sin(theta), y: -length * Math.cos(theta) }
}