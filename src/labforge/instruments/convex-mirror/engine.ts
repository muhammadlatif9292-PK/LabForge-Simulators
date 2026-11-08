// src/labforge/instruments/convex-mirror/engine.ts
import { mirrorEquation, convexMirrorPrincipalRays } from '../../lib/physics/optics'
import type { OpticsResult } from '../../lib/physics/optics'

export function focalLengthFromRadius(radiusCm: number): number {
  return -(radiusCm / 100) / 2   // negative for convex
}

export function computeConvexMirror(
  radiusCm: number,
  objectDistCm: number,
  objectHeightCm: number
): OpticsResult {
  const fM = focalLengthFromRadius(radiusCm)   // negative
  const uM = -Math.abs(objectDistCm) / 100     // object in front, negative
  const hM = objectHeightCm / 100
  const result = mirrorEquation(fM, uM, hM)
  result.principalRays = convexMirrorPrincipalRays(fM, uM, hM, result)
  return result
}

export function getImageNature(): string {
  return 'Virtual, Erect, Diminished'
}

export function formatImageDistance(result: OpticsResult): string {
  const vCm = result.imageDistance * 100
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
  return `1/v + 1/(−${u}) = 1/(${f.toFixed(1)})  →  v = ${v.toFixed(1)} cm`
}