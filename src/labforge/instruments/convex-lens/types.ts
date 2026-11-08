// src/labforge/instruments/convex-lens/types.ts
import type { OpticsResult } from '../../lib/physics/optics'

export interface ConvexLensState {
  focalLengthCm: number
  objectDistCm:  number
  objectHeightCm: number
  result:        OpticsResult | null
}

export function getPresets(focalLengthCm: number): Array<{
  label: string
  objectDistCm: number
  expectedResult: string
}> {
  return [
    { label: 'Beyond 2F',       objectDistCm: focalLengthCm * 3,   expectedResult: 'Real, inverted, diminished' },
    { label: 'At 2F',           objectDistCm: focalLengthCm * 2,   expectedResult: 'Real, inverted, same size (m = −1)' },
    { label: 'Between F and 2F',objectDistCm: focalLengthCm * 1.5, expectedResult: 'Real, inverted, enlarged' },
    { label: 'At F',            objectDistCm: focalLengthCm * 1,   expectedResult: 'No image — rays parallel (image at ∞)' },
    { label: 'Between F and O', objectDistCm: focalLengthCm * 0.5, expectedResult: 'Virtual, erect, enlarged' },
  ]
}