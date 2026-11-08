// src/labforge/instruments/convex-mirror/types.ts
import type { OpticsResult } from '../../lib/physics/optics'

export interface ConvexMirrorState {
  radiusCm: number
  objectDistCm: number
  objectHeightCm: number
  result: OpticsResult | null
}

export function getPresets(focalLengthCm: number): Array<{
  label: string
  objectDistCm: number
  expectedResult: string
}> {
  const absF = Math.abs(focalLengthCm)
  return [
    { label: 'Close (u = 0.5f)',  objectDistCm: absF * 0.5, expectedResult: 'Virtual, erect, slightly diminished' },
    { label: 'Medium (u = f)',    objectDistCm: absF * 1,   expectedResult: 'Virtual, erect, diminished (m = 0.33)' },
    { label: 'Far (u = 3f)',      objectDistCm: absF * 3,   expectedResult: 'Virtual, erect, strongly diminished' },
  ]
}