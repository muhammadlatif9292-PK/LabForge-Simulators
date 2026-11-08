// src/labforge/lib/physics/electricity.ts
import { logger } from '../logger'

export interface Resistor { id: string; resistance: number; label: string }

export function ohmsCurrent(voltage: number, resistance: number): number {
  if (resistance <= 0) throw new RangeError('Resistance must be > 0')
  return voltage / resistance
}
export function ohmsResistance(voltage: number, current: number): number {
  if (current === 0) throw new RangeError('Current cannot be zero')
  return voltage / current
}
export function ohmsVoltage(current: number, resistance: number): number {
  return current * resistance
}
export function seriesResistance(resistors: number[]): number {
  return resistors.reduce((a, b) => a + b, 0)
}
export function parallelResistance(resistors: number[]): number {
  if (resistors.some(r => r <= 0)) throw new RangeError('All resistors must be > 0')
  const invSum = resistors.reduce((sum, r) => sum + 1/r, 0)
  return 1 / invSum
}
export function voltageDivider(vin: number, r1: number, r2: number): number {
  return vin * r2 / (r1 + r2)
}
export function powerDissipated(voltage: number, current: number): number {
  return voltage * current
}
export function generateVIData(resistance: number, maxVoltage: number, points = 50): Array<{ v: number; i: number }> {
  const data = []
  for (let i = 0; i <= points; i++) {
    const v = (i / points) * maxVoltage
    data.push({ v, i: v / resistance })
  }
  return data
}
export function validateCircuit(voltage: number, resistors: Resistor[]): string[] {
  const errors: string[] = []
  if (voltage < 0) errors.push('Voltage cannot be negative')
  if (resistors.length === 0) errors.push('At least one resistor required')
  for (const r of resistors) {
    if (r.resistance <= 0) errors.push(`Resistor ${r.label} has invalid resistance ${r.resistance}`)
  }
  return errors
}