// src/labforge/instruments/concave-lens/types.ts
import type { OpticsResult } from '../../lib/physics/optics'

export interface ConcaveLensState {
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
    { label: 'Close to lens',  objectDistCm: focalLengthCm * 0.5, expectedResult: 'Virtual, erect, slightly diminished' },
    { label: 'At focal length',objectDistCm: focalLengthCm * 1,   expectedResult: 'Virtual, erect, diminished (m = 0.5)' },
    { label: 'Far from lens',  objectDistCm: focalLengthCm * 3,   expectedResult: 'Virtual, erect, strongly diminished' },
  ]
}