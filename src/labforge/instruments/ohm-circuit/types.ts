// src/labforge/instruments/ohm-circuit/types.ts
export type CircuitMode = 'series' | 'parallel'

export interface ResistorConfig {
  id: string
  resistance: number
  label: string
  color: string
}

export interface CircuitReadouts {
  totalResistance: number
  totalCurrent: number
  totalPower: number
  voltageDrops: number[]
  currents: number[]
}

export interface VIDataPoint {
  v: number
  i: number
}