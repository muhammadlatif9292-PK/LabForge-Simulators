// src/labforge/lib/units.ts
// Format SI prefix helper
function findPrefix(absVal: number): { symbol: string; factor: number } {
  const prefixes = [
    { symbol: 'T', factor: 1e12 }, { symbol: 'G', factor: 1e9 },
    { symbol: 'M', factor: 1e6 }, { symbol: 'k', factor: 1e3 },
    { symbol: '', factor: 1 },
    { symbol: 'm', factor: 1e-3 }, { symbol: 'μ', factor: 1e-6 },
    { symbol: 'n', factor: 1e-9 }, { symbol: 'p', factor: 1e-12 }
  ]
  for (const p of prefixes) {
    if (absVal >= p.factor) return p
  }
  return prefixes[prefixes.length - 1]
}

function roundTo(value: number, decimals: number): number {
  if (isNaN(value) || !isFinite(value)) return value
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

export function formatSI(value: number, unit: string, decimals = 3): string {
  if (isNaN(value)) return '—'
  if (!isFinite(value)) return value > 0 ? '∞' : '—'
  if (value === 0) return `0.${'0'.repeat(decimals)} ${unit}`
  const absVal = Math.abs(value)
  const { symbol, factor } = findPrefix(absVal)
  const scaled = roundTo(value / factor, decimals)
  return `${scaled.toFixed(decimals)} ${symbol}${unit}`
}

export function formatHz(value: number): string {
  return formatSI(value, 'Hz')
}
export function formatLength(metres: number): string {
  return formatSI(metres, 'm')
}
export function formatVoltage(volts: number): string {
  return formatSI(volts, 'V')
}
export function formatResistance(ohms: number): string {
  return formatSI(ohms, 'Ω')
}
export function degreesToRadians(deg: number): number {
  return deg * Math.PI / 180
}
export function radiansToDegrees(rad: number): number {
  return rad * 180 / Math.PI
}
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
export function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a)
}
export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax === inMin) return outMin
  const t = (value - inMin) / (inMax - inMin)
  return lerp(outMin, outMax, t)
}
export function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}
export function formatPH(ph: number): string {
  return ph.toFixed(2)
}
export function formatTemperature(kelvin: number): string {
  const celsius = kelvin - 273.15
  return `${kelvin.toFixed(2)} K (${celsius.toFixed(2)} °C)`
}