// src/labforge/instruments/ohm-circuit/engine.ts
import {
  ohmsCurrent,
  seriesResistance,
  parallelResistance,
  powerDissipated,
  generateVIData,
  validateCircuit,
} from '../../lib/physics/electricity'
import type { ResistorConfig, CircuitMode, CircuitReadouts, VIDataPoint } from './types'

export function computeCircuit(
  voltage: number,
  resistors: ResistorConfig[],
  mode: CircuitMode
): CircuitReadouts | null {
  if (resistors.length === 0 || voltage <= 0) return null

  const errors = validateCircuit(voltage, resistors.map(r => ({
    id: r.id, resistance: r.resistance, label: r.label
  })))
  if (errors.length > 0) return null

  const rValues = resistors.map(r => r.resistance)
  let totalResistance: number
  let voltageDrops: number[]
  let currents: number[]

  if (mode === 'series') {
    totalResistance = seriesResistance(rValues)
    const totalCurrent = ohmsCurrent(voltage, totalResistance)
    voltageDrops = rValues.map(r => totalCurrent * r)
    currents = rValues.map(() => totalCurrent)
  } else {
    totalResistance = parallelResistance(rValues)
    voltageDrops = rValues.map(() => voltage)
    currents = rValues.map(r => ohmsCurrent(voltage, r))
  }

  const totalCurrent = ohmsCurrent(voltage, totalResistance)
  const totalPower = powerDissipated(voltage, totalCurrent)

  return { totalResistance, totalCurrent, totalPower, voltageDrops, currents }
}

export function getVIData(totalResistance: number, maxVoltage: number): VIDataPoint[] {
  return generateVIData(totalResistance, maxVoltage, 50)
}

export function checkCircuit(voltage: number, resistors: ResistorConfig[]): string[] {
  return validateCircuit(voltage, resistors.map(r => ({
    id: r.id, resistance: r.resistance, label: r.label
  })))
}

export function getCircuitSummary(readouts: CircuitReadouts, mode: CircuitMode, count: number): string {
  const modeStr = mode === 'series' ? 'series' : 'parallel'
  return `${count} resistor${count !== 1 ? 's' : ''} in ${modeStr}: R_total = ${readouts.totalResistance.toFixed(0)} Ω, I = ${(readouts.totalCurrent * 1000).toFixed(1)} mA, P = ${(readouts.totalPower * 1000).toFixed(0)} mW`
}