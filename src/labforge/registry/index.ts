// src/labforge/registry/index.ts
import type { InstrumentMeta, ScienceClass, Level } from './types'

export const INSTRUMENTS: InstrumentMeta[] = [
  // OPTICS
  {
    id: 'convex-lens', name: 'Convex Lens', scienceClass: 'optics', level: 'student',
    description: 'Ray diagram simulator for converging lenses with live image calculations.',
    longDescription: 'Explore how a convex (converging) lens forms real and virtual images.',
    specs: ['Thin lens equation', 'Focal length: 5 cm to 50 cm', 'Object distance: 1 cm to 100 cm'],
    tags: ['lens', 'optics'], ai: 'explain', hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Ch.12'], relatedIds: ['concave-lens'],
    load: () => import('../instruments/convex-lens'),
  },
  {
    id: 'concave-lens', name: 'Concave Lens', scienceClass: 'optics', level: 'student',
    description: 'Diverging lens — always forms virtual, erect, diminished images.',
    longDescription: 'A concave (diverging) lens always produces a virtual, erect, and diminished image.',
    specs: ['Thin lens equation with negative f', 'Image always: virtual, erect, diminished'],
    tags: ['lens', 'concave'], ai: 'explain', hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Ch.12'], relatedIds: ['convex-lens'],
    load: () => import('../instruments/concave-lens'),
  },
  {
    id: 'concave-mirror', name: 'Concave Mirror', scienceClass: 'optics', level: 'student',
    description: 'Converging spherical mirror — all 6 object positions with correct ray diagrams.',
    longDescription: 'A concave mirror can produce real or virtual images.',
    specs: ['Mirror equation: 1/v + 1/u = 1/f', 'All 6 positions'],
    tags: ['mirror', 'concave'], ai: 'explain', hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Ch.12'], relatedIds: ['convex-mirror'],
    load: () => import('../instruments/concave-mirror'),
  },
  {
    id: 'convex-mirror', name: 'Convex Mirror', scienceClass: 'optics', level: 'student',
    description: 'Diverging spherical mirror — always virtual, erect, diminished images.',
    longDescription: 'A convex mirror always produces a virtual, erect, and diminished image.',
    specs: ['Mirror equation with negative focal length', 'Wide field of view'],
    tags: ['mirror', 'convex'], ai: 'explain', hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Ch.12'], relatedIds: ['concave-mirror'],
    load: () => import('../instruments/convex-mirror'),
  },
  // MECHANICS
  {
    id: 'pendulum', name: 'Simple Pendulum', scienceClass: 'mechanics', level: 'student',
    description: 'Full nonlinear RK4 pendulum — energy tracking, variable gravity.',
    longDescription: 'Uses RK4 on θ̈ = −(g/L)sin(θ).',
    specs: ['Nonlinear ODE', 'Length 0.1–5 m', 'Gravity presets'],
    tags: ['pendulum', 'SHM'], ai: 'none', hasLiveAnimation: true,
    curricularTopics: ['KPTBB Class 10 Physics'], relatedIds: [],
    load: () => import('../instruments/pendulum'),
  },
  // ELECTRICITY
  {
    id: 'ohm-circuit', name: "Ohm's Law & Circuits", scienceClass: 'electricity', level: 'student',
    description: "Interactive Ohm's Law with series/parallel circuits and V-I graph.",
    longDescription: "Build series and parallel resistor circuits.",
    specs: ['Ohm’s Law', 'Up to 3 resistors', 'V-I graph'],
    tags: ["ohm's law", 'circuit'], ai: 'none', hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Physics Ch.14'], relatedIds: [],
    load: () => import('../instruments/ohm-circuit'),
  },
  // MEASUREMENT
  {
    id: 'vernier-caliper', name: 'Vernier Caliper', scienceClass: 'measurement', level: 'student',
    description: 'Animated vernier caliper with zero error simulation.',
    longDescription: '50-division vernier caliper reads to 0.02 mm.',
    specs: ['Range 0–150 mm', 'Least count 0.02 mm', 'Zero error simulation'],
    tags: ['vernier', 'caliper'], ai: 'none', hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 9 Physics'], relatedIds: [],
    load: () => import('../instruments/vernier-caliper'),
  },
  // CHEMISTRY
  {
    id: 'ph-meter', name: 'pH Meter', scienceClass: 'chemistry', level: 'student',
    description: 'Nernst equation pH electrode with temperature compensation.',
    longDescription: 'Digital pH meter using Nernst equation.',
    specs: ['pH 0–14', 'Temperature 10–60°C', '12 presets'],
    tags: ['ph', 'nernst'], ai: 'none', hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Chemistry'], relatedIds: ['chem-lab'],
    load: () => import('../instruments/ph-meter'),
  },
  {
    id: 'chem-lab', name: 'Chemistry Lab Simulator', scienceClass: 'chemistry', level: 'advanced',
    description: 'AI-powered visual reaction simulator with RK45 ODE kinetics.',
    longDescription: 'Drag chemical species onto a canvas, run real differential equation simulation.',
    specs: ['React Flow canvas', 'RK45 solver', 'Gemini AI'],
    tags: ['chemistry', 'reactions', 'ai'], ai: 'explain', hasLiveAnimation: true,
    curricularTopics: ['A-Level Chemistry'], relatedIds: ['ph-meter'],
    load: () => import('@/chem-lab'),
  },
]

const LEVEL_ORDER: Record<Level, number> = {
  student: 0, intermediate: 1, advanced: 2, expert: 3,
}

export function getLevelOrder(level: Level): number {
  return LEVEL_ORDER[level]
}

export function getInstrument(id: string): InstrumentMeta | undefined {
  return INSTRUMENTS.find(i => i.id === id)
}

export function getInstrumentsByClass(cls: ScienceClass | 'all'): InstrumentMeta[] {
  const filtered = cls === 'all'
    ? INSTRUMENTS
    : INSTRUMENTS.filter(i => i.scienceClass === cls)
  return [...filtered].sort((a, b) => getLevelOrder(a.level) - getLevelOrder(b.level))
}

export function searchInstruments(query: string): InstrumentMeta[] {
  if (!query.trim()) return INSTRUMENTS
  const q = query.toLowerCase()
  return INSTRUMENTS.filter(i =>
    i.name.toLowerCase().includes(q) ||
    i.description.toLowerCase().includes(q) ||
    i.tags.some(t => t.includes(q)) ||
    i.scienceClass.includes(q)
  )
}