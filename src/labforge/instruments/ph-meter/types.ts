// src/labforge/instruments/ph-meter/types.ts
export interface PHMeterState {
  ph: number
  temperatureC: number
  selectedSolutionId: string | null
  isProbeSubmerged: boolean
  isMeasuring: boolean
  calibrationOffset: number
  calibrationStep: 'none' | 'buffer1' | 'buffer2' | 'complete'
  millivoltReading: number
  temperatureCorrectedPH: number
}

export interface SolutionPreset {
  id: string
  name: string
  ph: number
  color: string
  description: string
}

export const SOLUTION_PRESETS: SolutionPreset[] = [
  { id: 'gastric', name: 'Gastric Acid', ph: 1.5, color: '#FF2200', description: 'Stomach acid (HCl + pepsin)' },
  { id: 'lemon', name: 'Lemon Juice', ph: 2.4, color: '#FFE000', description: 'Citric acid solution' },
  { id: 'vinegar', name: 'Vinegar', ph: 3.0, color: '#FFFACD', description: 'Acetic acid (5% solution)' },
  { id: 'coffee', name: 'Coffee', ph: 5.0, color: '#8B4513', description: 'Brewed black coffee' },
  { id: 'rain', name: 'Clean Rain Water', ph: 5.6, color: '#E0F0FF', description: 'Dissolved CO₂ makes it slightly acidic' },
  { id: 'water', name: 'Pure Water', ph: 7.0, color: '#44AAFF', description: 'Distilled deionised water at 25°C' },
  { id: 'blood', name: 'Human Blood', ph: 7.4, color: '#CC0000', description: 'Arterial blood (tightly regulated)' },
  { id: 'seawater', name: 'Sea Water', ph: 8.0, color: '#006994', description: 'Ocean surface water' },
  { id: 'soap', name: 'Hand Soap', ph: 10.0, color: '#FFB3DE', description: 'Mild alkaline cleanser' },
  { id: 'mog', name: 'Milk of Magnesia', ph: 10.5, color: '#F0F0F0', description: 'Mg(OH)₂ suspension' },
  { id: 'bleach', name: 'Household Bleach', ph: 12.5, color: '#FFFDE7', description: 'NaOCl solution — corrosive' },
  { id: 'caustic', name: 'Caustic Soda', ph: 13.5, color: '#E8F5E9', description: 'NaOH solution — strongly corrosive' },
]

export type CalibrationStep = 'none' | 'buffer1' | 'buffer2' | 'complete'