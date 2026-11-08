// src/labforge/instruments/pendulum/types.ts
export interface PendulumReadouts {
  thetaDeg: number
  omegaRadS: number
  periodS: number
  frequencyHz: number
  kineticJ: number
  potentialJ: number
  totalJ: number
}

export interface GravityPreset {
  label: string
  body: string
  g: number
  emoji: string
}

export const GRAVITY_PRESETS: GravityPreset[] = [
  { label: 'Moon', body: 'Moon', g: 1.62, emoji: '🌙' },
  { label: 'Mars', body: 'Mars', g: 3.72, emoji: '🔴' },
  { label: 'Earth', body: 'Earth', g: 9.81, emoji: '🌍' },
  { label: 'Jupiter', body: 'Jupiter', g: 24.79, emoji: '🪐' },
]

export interface TrailPoint {
  x: number
  y: number
}