// src/labforge/instruments/concave-lens/engine.ts
import { thinLensEquation, concaveLensPrincipalRays } from '../../lib/physics/optics'
import type { OpticsResult } from '../../lib/physics/optics'

export function computeConcaveLens(
  focalLengthCm: number,
  objectDistCm: number,
  objectHeightCm: number
): OpticsResult {
  const fM = -focalLengthCm / 100   // negative = concave
  const uM = -objectDistCm / 100
  const hM = objectHeightCm / 100
  const result = thinLensEquation(fM, uM, hM)
  result.principalRays = concaveLensPrincipalRays(fM, uM, hM, result)
  return result
}

export function getImageNature(): string {
  return 'Virtual, Erect, Diminished'
}

export function formatImageDistance(result: OpticsResult): string {
  const vCm = result.imageDistance * 100
  return `Virtual: ${vCm.toFixed(1)} cm`
}

export function getFormulaSubstituted(
  focalLengthCm: number,
  objectDistCm: number,
  result: OpticsResult
): string {
  const f = focalLengthCm
  const u = objectDistCm
  const v = result.imageDistance * 100
  return `1/v − 1/(−${u}) = 1/(−${f})  →  v = ${v.toFixed(1)} cm`
}