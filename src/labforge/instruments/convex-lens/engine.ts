// src/labforge/instruments/convex-lens/engine.ts
import { thinLensEquation, convexLensPrincipalRays } from '../../lib/physics/optics'
import type { OpticsResult } from '../../lib/physics/optics'

export function computeConvexLens(
  focalLengthCm: number,
  objectDistCm: number,
  objectHeightCm: number
): OpticsResult {
  const fM = focalLengthCm / 100
  const uM = -objectDistCm / 100   // object distance negative (real object)
  const hM = objectHeightCm / 100
  const result = thinLensEquation(fM, uM, hM)
  // Add principal rays (requires full implementation in optics.ts, but we call the function)
  result.principalRays = convexLensPrincipalRays(fM, uM, hM, result)
  return result
}

export function getImageNature(result: OpticsResult): string {
  if (result.isAtInfinity) return 'No image (object at focal point)'
  const realVirtual = result.isReal ? 'Real' : 'Virtual'
  const erectInverted = result.isInverted ? 'Inverted' : 'Erect'
  const enlargedDiminished = result.isEnlarged ? 'Enlarged' : 'Diminished'
  return `${realVirtual}, ${erectInverted}, ${enlargedDiminished}`
}

export function formatImageDistance(result: OpticsResult): string {
  if (result.isAtInfinity) return '∞ (no image)'
  const vCm = result.imageDistance * 100
  if (result.isReal) return `${vCm.toFixed(1)} cm`
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
  if (result.isAtInfinity) return `1/v − 1/(−${u}) = 1/${f}  →  v → ∞`
  return `1/v − 1/(−${u}) = 1/${f}  →  v = ${v.toFixed(1)} cm`
}