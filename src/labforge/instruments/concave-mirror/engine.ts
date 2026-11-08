// src/labforge/instruments/concave-mirror/engine.ts
import { mirrorEquation, radiusToFocalLength, concaveMirrorPrincipalRays } from '../../lib/physics/optics'
import type { OpticsResult } from '../../lib/physics/optics'

export function focalLengthFromRadius(radiusCm: number): number {
  return (radiusCm / 100) / 2
}

export function computeConcaveMirror(
  radiusCm: number,
  objectDistCm: number,
  objectHeightCm: number
): OpticsResult {
  const fM = focalLengthFromRadius(radiusCm)  // positive for concave
  const uM = -Math.abs(objectDistCm) / 100    // object in front, negative
  const hM = objectHeightCm / 100
  const result = mirrorEquation(fM, uM, hM)
  result.principalRays = concaveMirrorPrincipalRays(fM, uM, hM, result)
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
  if (result.imageDistance < 0) return `Real: ${Math.abs(vCm).toFixed(1)} cm (in front)`
  return `Virtual: ${vCm.toFixed(1)} cm (behind mirror)`
}

export function getFormulaSubstituted(
  radiusCm: number,
  objectDistCm: number,
  result: OpticsResult
): string {
  const f = focalLengthFromRadius(radiusCm) * 100
  const u = objectDistCm
  const v = result.imageDistance * 100
  if (result.isAtInfinity) return `1/v + 1/(−${u}) = 1/${f.toFixed(1)}  →  v → ∞`
  return `1/v + 1/(−${u}) = 1/${f.toFixed(1)}  →  v = ${v.toFixed(1)} cm`
}