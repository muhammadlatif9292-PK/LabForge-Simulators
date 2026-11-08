// src/labforge/instruments/ph-meter/engine.ts
import { FARADAY, R_GAS, CELSIUS_TO_K } from '../../lib/constants'
import { gaussian } from '../../lib/physics/noise'

export function nernstPotential(ph: number, tempCelsius: number, offsetMv: number): number {
  const T = tempCelsius + CELSIUS_TO_K
  const slope = (R_GAS * T / FARADAY) * 2.303 * 1000 // mV/pH
  return 0 - slope * ph + offsetMv
}

export function nernstSlope(tempCelsius: number): number {
  const T = tempCelsius + CELSIUS_TO_K
  return (R_GAS * T / FARADAY) * 2.303 * 1000
}

export function millivoltsToPH(millivolts: number, tempCelsius: number, offsetMv: number): number {
  const T = tempCelsius + CELSIUS_TO_K
  const slope = (R_GAS * T / FARADAY) * 2.303 * 1000
  return (0 - (millivolts - offsetMv)) / slope
}

export function temperatureCorrectPH(rawPH: number, measuredTempC: number): number {
  const slopeAtMeasured = nernstSlope(measuredTempC)
  const slopeAt25 = nernstSlope(25)
  if (slopeAt25 === 0) return rawPH
  const correction = (rawPH - 7.0) * (1 - slopeAtMeasured / slopeAt25)
  return rawPH + correction
}

export function phToColor(ph: number): string {
  const clamped = Math.min(14, Math.max(0, ph))
  const anchors: [number, string][] = [
    [0, '#FF0000'], [1, '#FF2200'], [2, '#FF6600'], [3, '#FF9900'],
    [4, '#FFCC00'], [5, '#CCCC00'], [6, '#66BB00'], [7, '#00AA00'],
    [8, '#00AAAA'], [10, '#0066FF'], [12, '#6600CC'], [14, '#880088']
  ]
  for (let i = 0; i < anchors.length - 1; i++) {
    const [p1, c1] = anchors[i]
    const [p2, c2] = anchors[i + 1]
    if (clamped >= p1 && clamped <= p2) {
      const t = (clamped - p1) / (p2 - p1)
      const r1 = parseInt(c1.slice(1,3), 16)
      const g1 = parseInt(c1.slice(3,5), 16)
      const b1 = parseInt(c1.slice(5,7), 16)
      const r2 = parseInt(c2.slice(1,3), 16)
      const g2 = parseInt(c2.slice(3,5), 16)
      const b2 = parseInt(c2.slice(5,7), 16)
      const r = Math.round(r1 + (r2 - r1) * t)
      const g = Math.round(g1 + (g2 - g1) * t)
      const b = Math.round(b1 + (b2 - b1) * t)
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
    }
  }
  return '#880088'
}

export function noisyPHReading(ph: number): number {
  return gaussian(ph, 0.01)
}

export function isMatchingBuffer(ph: number, bufferTarget: 4.01 | 7.0): boolean {
  return Math.abs(ph - bufferTarget) <= 0.05
}