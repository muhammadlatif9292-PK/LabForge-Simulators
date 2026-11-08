// src/labforge/instruments/vernier-caliper/engine.ts
export function computeVernierReading(
  objectWidthMm: number,
  zeroErrorMm: number
): {
  mainScaleReading: number
  vernierScaleReading: number
  coincidingDivision: number
  rawReading: number
  correctedReading: number
} {
  const mainScale = Math.floor(objectWidthMm)
  const fractional = objectWidthMm - mainScale
  const coinciding = Math.round(fractional / 0.02) // 0.02 mm least count
  const vernierReading = coinciding * 0.02
  const raw = mainScale + vernierReading
  const corrected = raw - zeroErrorMm
  return {
    mainScaleReading: mainScale,
    vernierScaleReading: vernierReading,
    coincidingDivision: Math.min(49, Math.max(0, coinciding)),
    rawReading: raw,
    correctedReading: corrected,
  }
}