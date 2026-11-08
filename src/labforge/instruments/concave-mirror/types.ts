// src/labforge/instruments/concave-mirror/types.ts
import type { OpticsResult } from '../../lib/physics/optics'

export interface ConcaveMirrorState {
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
  return [
    { label: 'Beyond C (u > 2f)',       objectDistCm: focalLengthCm * 3,   expectedResult: 'Real, inverted, diminished' },
    { label: 'At C (u = 2f)',           objectDistCm: focalLengthCm * 2,   expectedResult: 'Real, inverted, same size (m = −1)' },
    { label: 'Between C and F',         objectDistCm: focalLengthCm * 1.5, expectedResult: 'Real, inverted, enlarged' },
    { label: 'At F (u = f)',            objectDistCm: focalLengthCm * 1,   expectedResult: 'No image — rays emerge parallel' },
    { label: 'Between F and P (u < f)', objectDistCm: focalLengthCm * 0.5, expectedResult: 'Virtual, erect, enlarged' },
    { label: 'Behind mirror (u > 0)',   objectDistCm: -focalLengthCm * 0.5, expectedResult: 'Virtual, erect, diminished' },
  ]
}