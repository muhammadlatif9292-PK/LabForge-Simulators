// src/labforge/registry/classes.ts
import type { ScienceClassDef, ScienceClass } from './types'

export const SCIENCE_CLASSES: ScienceClassDef[] = [
  {
    id: 'optics',
    label: 'Optics & Light',
    icon: '🔭',
    color: 'text-sky-400',
    bgColor: 'bg-sky-400/10',
    borderColor: 'border-sky-400/30',
    description: 'Lenses, mirrors, refraction, dispersion, and wave optics',
  },
  {
    id: 'mechanics',
    label: 'Mechanics',
    icon: '⚙️',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30',
    description: 'Forces, motion, energy, waves, and classical dynamics',
  },
  {
    id: 'electricity',
    label: 'Electricity & Magnetism',
    icon: '⚡',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
    description: 'Circuits, resistance, capacitance, and electromagnetic phenomena',
  },
  {
    id: 'waves',
    label: 'Waves & Sound',
    icon: '🌊',
    color: 'text-violet-400',
    bgColor: 'bg-violet-400/10',
    borderColor: 'border-violet-400/30',
    description: 'Mechanical waves, sound, resonance, and the Doppler effect',
  },
  {
    id: 'chemistry',
    label: 'Chemistry',
    icon: '🧪',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/30',
    description: 'Reactions, titration, electrolysis, chromatography, and distillation',
  },
  {
    id: 'biology',
    label: 'Biology & Medicine',
    icon: '🔬',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400/30',
    description: 'Microscopy, cardiac monitoring, respiratory function, and anatomy',
  },
  {
    id: 'thermodynamics',
    label: 'Thermodynamics',
    icon: '🌡️',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/30',
    description: 'Gas laws, heat engines, entropy, and thermodynamic cycles',
  },
  {
    id: 'nuclear',
    label: 'Nuclear & Radiation',
    icon: '☢️',
    color: 'text-lime-400',
    bgColor: 'bg-lime-400/10',
    borderColor: 'border-lime-400/30',
    description: 'Radioactive decay, radiation detection, and fission chain reactions',
  },
  {
    id: 'measurement',
    label: 'Measurement',
    icon: '📐',
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/10',
    borderColor: 'border-slate-400/30',
    description: 'Precision instruments for length, mass, time, and angle',
  },
  {
    id: 'astronomy',
    label: 'Astronomy',
    icon: '🌌',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-400/10',
    borderColor: 'border-indigo-400/30',
    description: 'Solar system, telescopes, stellar spectra, and celestial navigation',
  },
  {
    id: 'advanced-research',
    label: 'Advanced Research',
    icon: '⚛️',
    color: 'text-pink-400',
    bgColor: 'bg-pink-400/10',
    borderColor: 'border-pink-400/30',
    description: 'Mass spectrometry, NMR, X-ray diffraction, and surface microscopy',
  },
]

export function getClassDef(id: ScienceClass): ScienceClassDef {
  const def = SCIENCE_CLASSES.find(c => c.id === id)
  if (!def) throw new Error(`LabForge: unknown science class "${id}"`)
  return def
}