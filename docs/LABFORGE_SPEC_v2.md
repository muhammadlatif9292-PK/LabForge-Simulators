# LabForge — Complete File Specification v2.0.0

**Version:** 2.0.0 (fixes 27 issues found in v1.0.0)  
**Component:** `src/labforge/`  
**Lives inside:** Same Next.js project as `src/chem-lab/`  
**Entry export:** `LabForgeApp` — one default React component, no required props  
**Total files:** 43 (was 35 — 8 new files added)

---

## CHANGELOG FROM v1.0.0

| # | Type | Fix |
|---|------|-----|
| 1 | Critical | Store `setSearchQuery` had TypeScript error — `undefined` not valid for `ScienceClass\|'all'` |
| 2 | Critical | `dynamic()` inside `useMemo` is wrong — fixed to module-level pattern with key |
| 3 | Critical | `lib/logger.ts` was referenced in rules but never specified — added as FILE 0.0 |
| 4 | Critical | `OBJECT_PRESETS` typed as constant but values depend on focal length — redesigned as a function |
| 5 | Critical | `registry/index.ts` missing `ScienceClass` and `Level` imports |
| 6–13 | Missing | All instrument `index.ts` barrel exports now explicitly written |
| 14 | Missing | `shell/TopBar.tsx` added for mobile hamburger |
| 15 | Logic | `ph-meter` relatedIds corrected to `['chem-lab']` |
| 16 | Logic | `pendulum` relatedIds corrected to `[]` |
| 17 | Logic | Vernier engine no longer mixes canvas pixels with physics — returns pure mm values |
| 18 | Logic | `getLevelOrder()` now fully implemented in spec |
| 19 | Missing | Canvas ResizeObserver pattern added to all canvas instrument specs |
| 20 | Missing | `shell/ErrorBoundary.tsx` added — FILE 1.1 |
| 21 | Missing | `app/page.tsx` integration shown in new INTEGRATION section |
| 22 | Missing | Sidebar behaviour when instrument is open now specified |
| 23 | Missing | Package.json dependency check added to pre-build checklist |
| 24 | Missing | tsconfig.json path alias verification added |
| 25–27 | DeepSeek | Per-file TypeScript check command added: `npx tsc --noEmit` |

---

## HOW TO USE THIS DOCUMENT

This document is written for DeepSeek to build, file by file, in exact wave order.  
Every file is fully specified. No placeholders exist anywhere.  
Do not skip waves. Do not build Wave 2 before Wave 0 is complete.

### Rules for the AI Building This

1. **Every file must compile with `"strict": true` TypeScript**
2. **Every function must have explicit return type annotations**
3. **No `any` type — use `unknown` then narrow, or define the correct type**
4. **No `console.log` — use `logger` from `lib/logger.ts` only**
5. **Every physics equation must have a JSDoc comment citing the formula**
6. **Every Canvas draw call goes through `lib/canvas/` helpers — never raw `ctx` calls in components**
7. **Every instrument is self-contained — imports from `lib/` only, never from other instruments**
8. **The shell (`shell/`) never imports from any instrument folder**
9. **`LabForgeApp.tsx` never imports physics — only shell components and registry**
10. **When in doubt about a physics constant, use NIST 2018 CODATA values**

### How to Prompt DeepSeek for Each File

```
Build FILE [number]: `[path]` from the LabForge spec v2.0.0.

CONTRACT: [paste CONTRACT line]
IMPORTS: [paste imports block]
EXPORTS: [paste exports block]
NOTES: [paste any implementation notes]

RULES (non-negotiable):
- strict TypeScript, no `any`, all functions have explicit return types
- No console.log — use logger from lib/logger.ts
- Every physics formula has a JSDoc comment with the equation written out
- ctx.save() / ctx.restore() in every canvas draw function
- Handle edge cases: NaN → return fallback, division by zero → throw RangeError

After completing this file, run: npx tsc --noEmit
Only confirm complete when zero TypeScript errors remain.
Do not start the next file until confirmed.
```

---

## PRE-BUILD CHECKLIST — RUN BEFORE WAVE 0

```bash
# Verify package.json has all required dependencies:
# zustand, recharts, lucide-react, next, react, react-dom

# Verify tsconfig.json has:
# "strict": true
# "paths": { "@/*": ["./src/*"] }

# Verify tailwind.config.js content includes:
# content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"]

# Run before starting Wave 0:
npx tsc --noEmit   # should show zero errors on existing chem-lab code
```

---

## FOLDER STRUCTURE — COMPLETE v2.0.0

```
src/labforge/
├── LabForgeApp.tsx                    ← ROOT component — the one file parent apps import
│
├── registry/
│   ├── types.ts                       ← All TypeScript types (zero imports)
│   ├── classes.ts                     ← Science class definitions + colours
│   └── index.ts                       ← INSTRUMENTS array + helper functions
│
├── lib/
│   ├── logger.ts                      ← NEW: structured logger (replaces console.log)
│   ├── constants.ts                   ← All SI physical constants (NIST 2018)
│   ├── units.ts                       ← Formatting + unit conversion (pure functions)
│   ├── physics/
│   │   ├── optics.ts                  ← Lens/mirror equations, Snell's law, ray data
│   │   ├── ode.ts                     ← RK4 solver (shared by all animated instruments)
│   │   ├── electricity.ts             ← Ohm's law, series/parallel, V-I generation
│   │   └── noise.ts                   ← Gaussian, Poisson, drift, quantise
│   └── canvas/
│       ├── grid.ts                    ← Axes, gridlines, coordinate conversion
│       └── rays.ts                    ← Light ray drawing for optics
│
├── store/
│   └── labforgeStore.ts               ← Zustand: nav state only (no physics state)
│
├── shell/
│   ├── ErrorBoundary.tsx              ← NEW: catches crashing instruments gracefully
│   ├── TopBar.tsx                     ← NEW: hamburger button for mobile
│   ├── Sidebar.tsx                    ← Science class list (left column)
│   ├── InstrumentGrid.tsx             ← Card grid for selected class
│   ├── InstrumentCard.tsx             ← Single card with Open button
│   ├── SimulationShell.tsx            ← Wrapper around open instrument
│   ├── SearchBar.tsx                  ← Search with debounce + clear
│   └── LevelBadge.tsx                 ← Coloured difficulty badge
│
└── instruments/
    ├── convex-lens/
    │   ├── index.ts                   ← export { ConvexLensApp as default }
    │   ├── ConvexLensApp.tsx
    │   ├── engine.ts
    │   └── types.ts
    ├── concave-lens/
    │   ├── index.ts                   ← export { ConcaveLensApp as default }
    │   ├── ConcaveLensApp.tsx
    │   ├── engine.ts
    │   └── types.ts
    ├── concave-mirror/
    │   ├── index.ts                   ← export { ConcaveMirrorApp as default }
    │   ├── ConcaveMirrorApp.tsx
    │   ├── engine.ts
    │   └── types.ts
    ├── convex-mirror/
    │   ├── index.ts                   ← export { ConvexMirrorApp as default }
    │   ├── ConvexMirrorApp.tsx
    │   ├── engine.ts
    │   └── types.ts
    ├── pendulum/
    │   ├── index.ts                   ← export { PendulumApp as default }
    │   ├── PendulumApp.tsx
    │   ├── engine.ts
    │   └── types.ts
    ├── ohm-circuit/
    │   ├── index.ts                   ← export { OhmCircuitApp as default }
    │   ├── OhmCircuitApp.tsx
    │   ├── engine.ts
    │   └── types.ts
    ├── vernier-caliper/
    │   ├── index.ts                   ← export { VernierCaliperApp as default }
    │   ├── VernierCaliperApp.tsx
    │   ├── engine.ts
    │   └── types.ts
    └── ph-meter/
        ├── index.ts                   ← export { PhMeterApp as default }
        ├── PhMeterApp.tsx
        ├── engine.ts
        └── types.ts
```

---

## INTEGRATION — How to Wire LabForge Into the App

**`app/page.tsx`** (add or replace):
```tsx
import LabForgeApp from '@/labforge/LabForgeApp'
export default function Page() {
  return <LabForgeApp style={{ height: '100dvh' }} />
}
```

**`app/layout.tsx`** — no changes needed if it already exists.

**`src/chem-lab/index.ts`** — add one line at the end if not present:
```ts
export { ChemLabApp as default } from './ChemLabApp'
```

That is the only file outside `src/labforge/` that is touched.

---

## WAVE 0 — FOUNDATION

> All Wave 0 files are pure TypeScript — zero React, zero CSS.  
> Build and `npx tsc --noEmit` after every single file.  
> Nothing in Wave 1+ will work until every Wave 0 file passes.

---

### FILE 0.0 — `src/labforge/lib/logger.ts`

**Build this first. Everything else imports it.**

**Purpose:** Structured logger. Replaces all `console.log` across LabForge.  
Rule 4 says "no console.log" — this file is what you use instead.

**Imports from:** Nothing.

**Full implementation — provide this to DeepSeek verbatim:**

```ts
/**
 * LabForge structured logger.
 * Use this everywhere instead of console.log / console.error.
 * In production, swap the bodies to send to a telemetry service.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level:   LogLevel
  module:  string
  message: string
  data?:   unknown
  ts:      number   // Date.now()
}

const ICONS: Record<LogLevel, string> = {
  debug: '🔍',
  info:  'ℹ️',
  warn:  '⚠️',
  error: '❌',
}

function log(level: LogLevel, module: string, message: string, data?: unknown): void {
  const entry: LogEntry = { level, module, message, data, ts: Date.now() }
  const line = `${ICONS[level]} [${module}] ${message}`

  switch (level) {
    case 'debug': console.debug(line, ...(data !== undefined ? [data] : [])); break
    case 'info':  console.info(line,  ...(data !== undefined ? [data] : [])); break
    case 'warn':  console.warn(line,  ...(data !== undefined ? [data] : [])); break
    case 'error': console.error(line, ...(data !== undefined ? [data] : [])); break
  }
}

export const logger = {
  debug: (module: string, msg: string, data?: unknown): void => log('debug', module, msg, data),
  info:  (module: string, msg: string, data?: unknown): void => log('info',  module, msg, data),
  warn:  (module: string, msg: string, data?: unknown): void => log('warn',  module, msg, data),
  error: (module: string, msg: string, data?: unknown): void => log('error', module, msg, data),
}
```

**Contract:** `logger` object has four methods. Each returns `void`. Never throws. Safe to call from any context including Web Workers.

**After building:** `npx tsc --noEmit` — zero errors.

---

### FILE 0.1 — `src/labforge/registry/types.ts`

**Purpose:** Every TypeScript type used across LabForge. Master type file. Zero imports.

**Imports from:** Nothing.

```ts
import type React from 'react'  // type-only import for React.ComponentType

export type Level = 'student' | 'intermediate' | 'advanced' | 'expert'

export type ScienceClass =
  | 'optics'
  | 'mechanics'
  | 'electricity'
  | 'waves'
  | 'chemistry'
  | 'biology'
  | 'thermodynamics'
  | 'nuclear'
  | 'measurement'
  | 'astronomy'
  | 'advanced-research'

export type AIMode = 'none' | 'explain' | 'identify' | 'interpret'

export interface InstrumentMeta {
  id:               string
  name:             string
  scienceClass:     ScienceClass
  level:            Level
  description:      string          // one sentence — shown on card
  longDescription:  string          // 2-3 sentences — shown in detail view
  specs:            string[]        // 4-6 bullet points
  tags:             string[]        // searchable keywords
  ai:               AIMode
  hasLiveAnimation: boolean
  curricularTopics: string[]        // e.g. ['KPTBB Class 10 Ch.12']
  relatedIds:       string[]        // IDs of related instruments
  load: () => Promise<{ default: React.ComponentType }>
}

export interface ScienceClassDef {
  id:          ScienceClass
  label:       string          // e.g. 'Optics & Light'
  icon:        string          // emoji
  color:       string          // full Tailwind class e.g. 'text-sky-400'
  bgColor:     string          // full Tailwind class e.g. 'bg-sky-400/10'
  borderColor: string          // full Tailwind class e.g. 'border-sky-400/30'
  description: string
}

export interface LabForgeState {
  activeClass:        ScienceClass | 'all'
  activeInstrumentId: string | null
  searchQuery:        string
  sidebarCollapsed:   boolean
}
```

**Contract:** Zero imports (except the type-only React import). Compiles standalone.

**After building:** `npx tsc --noEmit`

---

### FILE 0.2 — `src/labforge/registry/classes.ts`

**Purpose:** All 11 science class definitions with Tailwind classes.

**Imports from:**
```ts
import type { ScienceClassDef, ScienceClass } from './types'
```

**Full implementation:**

```ts
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

/**
 * Returns the ScienceClassDef for a given id.
 * Throws if id not found — forces exhaustive handling.
 */
export function getClassDef(id: ScienceClass): ScienceClassDef {
  const def = SCIENCE_CLASSES.find(c => c.id === id)
  if (!def) throw new Error(`LabForge: unknown science class "${id}"`)
  return def
}
```

**CRITICAL — Tailwind warning:** Every Tailwind class in this file must be a complete string literal. Never `'text-' + color`. The JIT scanner needs to see the full string.

**Contract:** Exactly 11 entries. `getClassDef` throws on unknown ID, never returns `undefined`.

**After building:** `npx tsc --noEmit`

---

### FILE 0.3 — `src/labforge/lib/constants.ts`

**Purpose:** Every SI constant used anywhere. One file. NIST CODATA 2018 values.

**Imports from:** Nothing.

```ts
// ─── Mechanics ────────────────────────────────────────────────────────────────
/** Standard gravitational acceleration — Earth surface (m/s²) NIST 2018 */
export const G_EARTH    = 9.80665
/** Gravitational acceleration — Moon surface (m/s²) */
export const G_MOON     = 1.62
/** Gravitational acceleration — Mars surface (m/s²) */
export const G_MARS     = 3.72
/** Gravitational acceleration — Jupiter surface (m/s²) */
export const G_JUPITER  = 24.79

// ─── Thermodynamics ───────────────────────────────────────────────────────────
/** Universal gas constant (J mol⁻¹ K⁻¹) NIST 2018 */
export const R_GAS           = 8.314462618
/** Absolute zero offset — Celsius to Kelvin */
export const CELSIUS_TO_K    = 273.15
/** Standard temperature (K) */
export const STANDARD_TEMP_K = 298.15

// ─── Electricity ──────────────────────────────────────────────────────────────
/** Faraday constant (C mol⁻¹) NIST 2018 */
export const FARADAY         = 96485.33212
/** Elementary charge (C) NIST 2018 */
export const ELECTRON_CHARGE = 1.602176634e-19

// ─── Optics ───────────────────────────────────────────────────────────────────
/** Speed of light in vacuum (m/s) NIST 2018 */
export const SPEED_OF_LIGHT = 2.99792458e8
/** Refractive index — common borosilicate glass */
export const N_GLASS   = 1.52
/** Refractive index — water at 20°C */
export const N_WATER   = 1.333
/** Refractive index — air at 20°C, 1 atm */
export const N_AIR     = 1.000293
/** Refractive index — diamond */
export const N_DIAMOND = 2.417

// ─── Chemistry ────────────────────────────────────────────────────────────────
/** Avogadro's number (mol⁻¹) NIST 2018 */
export const AVOGADRO      = 6.02214076e23
/** Neutral pH at 25°C */
export const PH_NEUTRAL    = 7.0

// ─── Simulation limits ────────────────────────────────────────────────────────
/** Maximum ODE sub-steps per animation frame — prevents UI hang */
export const MAX_STEPS_PER_FRAME = 50
/** Minimum dt for ODE solver (seconds) */
export const ODE_MIN_DT = 1e-6
/** Maximum dt for ODE solver (seconds) */
export const ODE_MAX_DT = 0.1
```

**Contract:** Named exports only. No magic numbers anywhere else in LabForge.

**After building:** `npx tsc --noEmit`

---

### FILE 0.4 — `src/labforge/lib/units.ts`

**Purpose:** All formatting and conversion functions. Pure — same input, same output, no side effects.

**Imports from:** Nothing.

```ts
/**
 * Format a number with auto SI prefix.
 * formatSI(0.00123, 'F') → '1.230 mF'
 * formatSI(1_500_000, 'Hz') → '1.500 MHz'
 * Returns '—' for NaN, '∞' for Infinity.
 */
export function formatSI(value: number, unit: string, decimals = 3): string

/**
 * Format frequency with auto SI prefix.
 * formatHz(1500) → '1.500 kHz'
 * formatHz(0.5) → '500.000 mHz'
 */
export function formatHz(value: number): string

/**
 * Format distance in metres with auto prefix.
 * formatLength(0.002) → '2.000 mm'
 * formatLength(1.5) → '1.500 m'
 */
export function formatLength(metres: number): string

/**
 * Format voltage with auto SI prefix.
 * formatVoltage(0.0035) → '3.500 mV'
 */
export function formatVoltage(volts: number): string

/**
 * Format resistance.
 * formatResistance(1500) → '1.500 kΩ'
 */
export function formatResistance(ohms: number): string

/** degrees → radians. degreesToRadians(180) → Math.PI */
export function degreesToRadians(deg: number): number

/** radians → degrees. radiansToDegrees(Math.PI) → 180 */
export function radiansToDegrees(rad: number): number

/**
 * Clamp value to [min, max].
 * clamp(150, 0, 100) → 100
 */
export function clamp(value: number, min: number, max: number): number

/**
 * Linear interpolation.
 * lerp(0, 10, 0.5) → 5
 */
export function lerp(a: number, b: number, t: number): number

/**
 * Map from one range to another.
 * mapRange(5, 0, 10, 0, 100) → 50
 * Used to map physics values → canvas pixels.
 */
export function mapRange(
  value: number,
  inMin: number, inMax: number,
  outMin: number, outMax: number
): number

/**
 * Round to N decimal places.
 * roundTo(3.14159, 2) → 3.14
 */
export function roundTo(value: number, decimals: number): number

/**
 * Format pH to 2 decimal places.
 * formatPH(7.0) → '7.00'
 */
export function formatPH(ph: number): string

/**
 * Format temperature in both K and °C.
 * formatTemperature(298.15) → '298.15 K (25.00 °C)'
 */
export function formatTemperature(kelvin: number): string
```

**Implementation notes:**

`formatSI` prefix table (in order, largest first):

| Prefix | Symbol | Factor |
|--------|--------|--------|
| tera   | T      | 1e12   |
| giga   | G      | 1e9    |
| mega   | M      | 1e6    |
| kilo   | k      | 1e3    |
| (base) |        | 1      |
| milli  | m      | 1e-3   |
| micro  | μ      | 1e-6   |
| nano   | n      | 1e-9   |
| pico   | p      | 1e-12  |

Algorithm:
```
absVal = Math.abs(value)
if absVal === 0 → return '0.000 [unit]'
if !isFinite(value) → return value > 0 ? '∞' : '—'
find prefix where absVal >= factor (starting from largest)
scaled = value / factor
return scaled.toFixed(decimals) + ' ' + symbol + unit
```

**Contract:** All functions are pure. Handle `NaN` → `'—'`, `Infinity` → `'∞'`, `-Infinity` → `'—'`, `0` → `'0.000 [unit]'`.

**After building:** `npx tsc --noEmit`

---

### FILE 0.5 — `src/labforge/lib/physics/noise.ts`

**Purpose:** Measurement noise models for realistic instrument readings.

**Imports from:** Nothing.

```ts
/**
 * Gaussian noise using Box-Muller transform.
 * Returns sample from N(mean, sigma²).
 *
 * Formula (Box-Muller):
 *   z = sqrt(-2·ln(u1)) · cos(2π·u2)
 *   result = mean + sigma·z
 *
 * Edge case: sigma <= 0 → returns mean unchanged.
 *
 * Use for: multimeter fluctuation (sigma~0.003V),
 *          balance drift (sigma~0.0002g),
 *          thermometer noise (sigma~0.05°C)
 */
export function gaussian(mean: number, sigma: number): number

/**
 * Poisson distribution using Knuth's algorithm.
 * Returns integer k — number of events in an interval,
 * given lambda average events per interval.
 *
 * Algorithm:
 *   L = exp(-lambda), p = 1, k = 0
 *   do: k++, p *= Math.random()
 *   while p > L
 *   return k - 1
 *
 * Edge case: lambda <= 0 → returns 0.
 *
 * Use for: Geiger counter (lambda = avg CPM / 60)
 */
export function poisson(lambda: number): number

/**
 * Slow drift — smooth variation over time using sine + noise.
 *
 * result = center + amplitude·sin(2π·t / periodMs) + gaussian(0, amplitude·0.1)
 *
 * Use for: electrode drift, balance creep.
 * @param periodMs - default 8000ms
 */
export function driftValue(
  center: number,
  amplitude: number,
  timestamp: number,
  periodMs?: number
): number

/**
 * Quantise to nearest step — simulates ADC resolution.
 *
 * result = Math.round(value / step) * step
 *
 * quantise(3.14159, 0.01) → 3.14
 *
 * Edge case: step <= 0 → returns value unchanged.
 */
export function quantise(value: number, step: number): number

/**
 * Timing jitter — value ± (Math.random() - 0.5) * 2 * maxJitter
 *
 * Use for: oscilloscope trigger jitter.
 */
export function jitter(value: number, maxJitter: number): number
```

**After building:** `npx tsc --noEmit`

---

### FILE 0.6 — `src/labforge/lib/physics/ode.ts`

**Purpose:** Shared RK4 ODE solver. Built once. All animated instruments import from here.

**Imports from:**
```ts
import { clamp } from '../units'
import { logger } from '../logger'
```

```ts
/** State vector — array of numbers representing full system state. */
export type StateVector = number[]

/**
 * Derivative function: f(t, y) = dy/dt
 * Takes current time and state, returns rate of change.
 */
export type DerivativeFunction = (t: number, y: StateVector) => StateVector

/**
 * Add two state vectors element-wise.
 * addVectors([1,2], [3,4]) → [4,6]
 * Both must be same length — throws if not.
 */
export function addVectors(a: StateVector, b: StateVector): StateVector

/**
 * Multiply state vector by scalar.
 * scaleVector([1,2,3], 2) → [2,4,6]
 */
export function scaleVector(v: StateVector, s: number): StateVector

/**
 * RK4 fixed-step integrator — one step.
 *
 * Formula (classic 4th-order Runge-Kutta):
 *   k1 = f(t, y)
 *   k2 = f(t + dt/2,  y + dt/2·k1)
 *   k3 = f(t + dt/2,  y + dt/2·k2)
 *   k4 = f(t + dt,    y + dt·k3)
 *   y_new = y + (dt/6)·(k1 + 2k2 + 2k3 + k4)
 *
 * @param f  - derivative function
 * @param t  - current time (seconds)
 * @param y  - current state vector
 * @param dt - step size (seconds)
 * @returns new state vector — NEVER mutates input y
 *
 * NaN guard: if any component of result is NaN or Infinity,
 * logs a warning and returns the INPUT y unchanged.
 */
export function rk4Step(
  f: DerivativeFunction,
  t: number,
  y: StateVector,
  dt: number
): StateVector

/**
 * Advance physics by totalTime seconds using multiple RK4 steps.
 *
 * @param f         - derivative function
 * @param t0        - start time
 * @param y0        - start state
 * @param totalTime - how much simulated time to advance (seconds)
 * @param dt        - step size, clamped to [ODE_MIN_DT, ODE_MAX_DT]
 * @returns { t: final time, y: final state }
 *
 * Edge case: totalTime <= 0 → returns { t: t0, y: y0 } immediately.
 *
 * Use in animation loops:
 *   const { t, y } = rk4Advance(f, simTime, state, frameDeltaTime, 0.001)
 */
export function rk4Advance(
  f: DerivativeFunction,
  t0: number,
  y0: StateVector,
  totalTime: number,
  dt: number
): { t: number; y: StateVector }
```

**Implementation of `rk4Step`:**
```ts
export function rk4Step(f, t, y, dt) {
  const k1 = f(t,        y)
  const k2 = f(t + dt/2, addVectors(y, scaleVector(k1, dt/2)))
  const k3 = f(t + dt/2, addVectors(y, scaleVector(k2, dt/2)))
  const k4 = f(t + dt,   addVectors(y, scaleVector(k3, dt)))

  const result = addVectors(y, scaleVector(
    addVectors(
      addVectors(k1, scaleVector(k2, 2)),
      addVectors(scaleVector(k3, 2), k4)
    ),
    dt / 6
  ))

  // NaN guard — never propagate bad state
  if (result.some(v => !Number.isFinite(v))) {
    logger.warn('ode', 'NaN/Infinity in rk4Step result — returning previous state', { t, dt })
    return [...y]
  }
  return result
}
```

**Contract:** `rk4Step` never mutates `y`. Output length always equals input length. Returns input `y` (not mutated, but a copy) if NaN detected.

**After building:** `npx tsc --noEmit`

---

### FILE 0.7 — `src/labforge/lib/physics/optics.ts`

**Purpose:** All optics physics — lens/mirror equations, Snell's law, ray data for all four optics instruments.

**Imports from:**
```ts
import { degreesToRadians, radiansToDegrees } from '../units'
import { logger } from '../logger'
```

**Types:**
```ts
/** 2D point in physics space (metres). NOT canvas pixels. */
export interface Point2D {
  x: number   // positive = right
  y: number   // positive = up
}

/** A single light ray for drawing: from start to end, with a direction. */
export interface LightRay {
  start:     Point2D
  end:       Point2D
  direction: number   // radians from positive x-axis (for reference)
}

/** Full result of applying lens or mirror equation to an object. */
export interface OpticsResult {
  imageDistance:  number    // v in metres. negative = virtual
  magnification:  number    // m = -v/u. negative = inverted
  isReal:         boolean   // true if image forms on opposite side of lens / in front of mirror
  isInverted:     boolean   // true if image is upside down
  isEnlarged:     boolean   // true if |magnification| > 1
  isAtInfinity:   boolean   // true if object is exactly at focal point (image at ∞)
  imageHeight:    number    // in metres = objectHeight × |magnification|, signed by isInverted
  principalRays:  LightRay[]
}
```

**Functions — full signatures:**

```ts
/**
 * Thin Lens Equation: 1/v − 1/u = 1/f  →  v = uf/(u+f)
 *
 * Sign convention (New Cartesian for lenses):
 *   u: NEGATIVE for real objects (left of lens)
 *   f: POSITIVE for convex, NEGATIVE for concave
 *   v: POSITIVE for real image (right), NEGATIVE for virtual (left)
 *   m = −v/u  (negative m = inverted, |m|>1 = enlarged)
 *
 * @param focalLength  metres — positive=convex, negative=concave
 * @param objectDist   metres — MUST be negative for real object
 * @param objectHeight metres — positive value
 *
 * Special case: when u = −f, image at ∞ → set isAtInfinity=true, imageDistance=Infinity
 */
export function thinLensEquation(
  focalLength:  number,
  objectDist:   number,
  objectHeight: number
): OpticsResult

/**
 * Mirror Equation: 1/v + 1/u = 1/f  →  v = uf/(u−f)
 *
 * Sign convention (New Cartesian for mirrors):
 *   u: NEGATIVE (object always in front of mirror)
 *   f: POSITIVE for concave, NEGATIVE for convex  (f = R/2)
 *   v: NEGATIVE for real image (in front), POSITIVE for virtual (behind)
 *   m = −v/u
 *
 * Note: 1/v = 1/f − 1/u  (DIFFERENT from lens: plus not minus)
 *
 * @param focalLength  metres — positive=concave, negative=convex
 * @param objectDist   metres — MUST be negative
 * @param objectHeight metres — positive
 */
export function mirrorEquation(
  focalLength:  number,
  objectDist:   number,
  objectHeight: number
): OpticsResult

/**
 * Snell's Law: n₁·sinθ₁ = n₂·sinθ₂  →  θ₂ = arcsin((n₁/n₂)·sinθ₁)
 * Critical angle: θc = arcsin(n₂/n₁) — only when n₁ > n₂
 *
 * @param n1        refractive index of incident medium
 * @param n2        refractive index of refracted medium
 * @param angleDeg  angle of incidence from normal (degrees, 0–90)
 * @returns refractedAngleDeg, isTIR (total internal reflection), criticalAngleDeg
 *
 * Never throws. Returns isTIR=true when angle exceeds critical angle.
 * Returns criticalAngleDeg=Infinity when n1 <= n2.
 */
export function snellsLaw(
  n1: number,
  n2: number,
  angleDeg: number
): { refractedAngleDeg: number; isTotalInternalReflection: boolean; criticalAngleDeg: number }

/** Focal length from radius of curvature. f = R/2 */
export function radiusToFocalLength(radius: number): number

/** Lens power in dioptres. P = 1/f  (f in metres) */
export function powerDioptres(focalLength: number): number

/**
 * Generate 3 principal rays for a CONVEX LENS.
 *
 * Ray 1 (amber #f59e0b): Parallel to axis → bends through F' (far focal point)
 * Ray 2 (emerald #10b981): Through optical centre O → straight (undeviated)
 * Ray 3 (blue #3b82f6): Through near focal point F → emerges parallel to axis
 *
 * All rays converge at the image point.
 * For virtual image (object inside F): rays diverge — trace backwards to find virtual image.
 */
export function convexLensPrincipalRays(
  focalLength:  number,
  objectDist:   number,
  objectHeight: number,
  result:       OpticsResult
): LightRay[]

/**
 * Generate 3 principal rays for a CONCAVE LENS.
 *
 * Ray 1: Parallel to axis → diverges as if coming from near focal point F
 * Ray 2: Through optical centre → straight (undeviated)
 * Ray 3: Aimed at far focal point F' → emerges parallel to axis
 *
 * All three rays diverge after the lens — trace backwards to find virtual image.
 */
export function concaveLensPrincipalRays(
  focalLength:  number,
  objectDist:   number,
  objectHeight: number,
  result:       OpticsResult
): LightRay[]

/**
 * Generate 3 principal rays for a CONCAVE MIRROR.
 *
 * Ray 1: Parallel to axis → reflects through F
 * Ray 2: Through F → reflects parallel to axis
 * Ray 3: Through C (centre of curvature = 2f) → reflects straight back through C
 */
export function concaveMirrorPrincipalRays(
  focalLength:  number,
  objectDist:   number,
  objectHeight: number,
  result:       OpticsResult
): LightRay[]

/**
 * Generate 3 principal rays for a CONVEX MIRROR.
 *
 * Ray 1: Parallel to axis → reflects as if coming from F behind mirror
 * Ray 2: Aimed at F behind mirror → reflects parallel to axis
 * Ray 3: Aimed at C behind mirror → reflects straight back
 *
 * All reflected rays diverge — trace backwards to find virtual image behind mirror.
 */
export function convexMirrorPrincipalRays(
  focalLength:  number,
  objectDist:   number,
  objectHeight: number,
  result:       OpticsResult
): LightRay[]
```

**CRITICAL — Sign convention must be CONSISTENT across all four functions.**  
Mix-up between mirror and lens sign convention is the #1 bug in optics code.  
Lens: `1/v − 1/u = 1/f`  
Mirror: `1/v + 1/u = 1/f`  
Do NOT copy-paste between them without changing the sign on `1/u`.

**Contract:** Pure functions. `thinLensEquation` returns `isAtInfinity=true` when `|objectDist + focalLength| < 0.001`. `snellsLaw` never throws.

**After building:** `npx tsc --noEmit`

---

### FILE 0.8 — `src/labforge/lib/physics/electricity.ts`

**Purpose:** Ohm's Law and circuit calculations for the circuit instrument.

**Imports from:**
```ts
import { logger } from '../logger'
```

```ts
export interface Resistor {
  id:         string
  resistance: number   // Ohms, must be > 0
  label:      string   // 'R1', 'R2', 'R3'
}

/**
 * Ohm's Law: I = V/R
 * @throws RangeError if resistance <= 0
 */
export function ohmsCurrent(voltage: number, resistance: number): number

/**
 * Ohm's Law: R = V/I
 * @throws RangeError if current === 0
 */
export function ohmsResistance(voltage: number, current: number): number

/**
 * Ohm's Law: V = I·R
 */
export function ohmsVoltage(current: number, resistance: number): number

/**
 * Series: R_total = R₁ + R₂ + ... + Rn
 */
export function seriesResistance(resistors: number[]): number

/**
 * Parallel: 1/R_total = 1/R₁ + 1/R₂ + ... + 1/Rn
 * @throws RangeError if any resistor <= 0
 */
export function parallelResistance(resistors: number[]): number

/**
 * Voltage divider: V_out = V_in × R2/(R1+R2)
 */
export function voltageDivider(vin: number, r1: number, r2: number): number

/**
 * Power: P = V·I
 */
export function powerDissipated(voltage: number, current: number): number

/**
 * Generate V-I data points by sweeping voltage 0 → maxVoltage.
 * Returns exactly `points` elements (default 50).
 * Each: { v: number, i: number }
 * i = v / resistance at each point.
 */
export function generateVIData(
  resistance: number,
  maxVoltage: number,
  points?: number
): Array<{ v: number; i: number }>

/**
 * Validate circuit before computing.
 * Returns [] if valid.
 * Returns string[] of error messages if invalid.
 */
export function validateCircuit(voltage: number, resistors: Resistor[]): string[]
```

**After building:** `npx tsc --noEmit`

---

### FILE 0.9 — `src/labforge/lib/canvas/grid.ts`

**Purpose:** Shared Canvas 2D utilities — coordinate conversion and all drawing helpers.

**Imports from:** Nothing (takes `ctx` as parameter).

```ts
export interface GridConfig {
  canvasWidth:  number
  canvasHeight: number
  xMin: number          // physics x at left pixel edge
  xMax: number          // physics x at right pixel edge
  yMin: number          // physics y at bottom pixel edge
  yMax: number          // physics y at top pixel edge
  gridColor?:       string   // default 'rgba(255,255,255,0.06)'
  axisColor?:       string   // default 'rgba(255,255,255,0.3)'
  labelColor?:      string   // default 'rgba(255,255,255,0.5)'
  backgroundColor?: string   // default '#0f172a'
  tickSpacingX?:    number   // physics units between x ticks
  tickSpacingY?:    number   // physics units between y ticks
  fontSize?:        number   // px, default 11
  labelUnitX?:      string   // e.g. 'cm', 's'
  labelUnitY?:      string
  xAxisLabel?:      string   // axis title
  yAxisLabel?:      string
}

/**
 * Physics x → canvas pixel x.
 * Linear map: xMin → 0, xMax → canvasWidth
 */
export function physicsToCanvasX(px: number, cfg: GridConfig): number

/**
 * Physics y → canvas pixel y.
 * INVERTED: yMax → 0 (top), yMin → canvasHeight (bottom)
 * physicsToCanvasY(0, cfg) → the pixel y of the x-axis
 */
export function physicsToCanvasY(py: number, cfg: GridConfig): number

/** Canvas pixel x → physics x (exact inverse of physicsToCanvasX) */
export function canvasToPhysicsX(cx: number, cfg: GridConfig): number

/** Canvas pixel y → physics y (exact inverse of physicsToCanvasY) */
export function canvasToPhysicsY(cy: number, cfg: GridConfig): number

/**
 * Fill background and draw gridlines, axes, tick marks, axis labels.
 * Call FIRST in every instrument's draw loop.
 * Uses ctx.save() / ctx.restore() internally.
 */
export function drawGrid(ctx: CanvasRenderingContext2D, cfg: GridConfig): void

/**
 * Draw filled circle at physics (px, py).
 * color default: 'rgb(16,185,129)', radius default: 4px
 */
export function drawDataPoint(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  cfg: GridConfig,
  color?: string,
  radius?: number
): void

/**
 * Draw connected line through physics coordinate array.
 * color default: 'rgb(16,185,129)', lineWidth default: 2px
 */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  cfg: GridConfig,
  color?: string,
  lineWidth?: number
): void

/**
 * Draw dashed line. Same as drawLine but with dash pattern.
 * dashPattern default: [6, 4]
 */
export function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  cfg: GridConfig,
  color?: string,
  lineWidth?: number,
  dashPattern?: number[]
): void

/**
 * Draw vertical dashed line at physics x.
 * Optional text label at bottom of line.
 */
export function drawVerticalMarker(
  ctx: CanvasRenderingContext2D,
  physicsX: number,
  cfg: GridConfig,
  color: string,
  label?: string
): void

/**
 * Draw arrow from physics (x1,y1) to physics (x2,y2).
 * Arrowhead at (x2,y2). arrowHeadSize default: 8px.
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  cfg: GridConfig,
  color: string,
  arrowHeadSize?: number
): void

/**
 * Fill the entire canvas with backgroundColor.
 * Call before every animation frame.
 */
export function clearCanvas(ctx: CanvasRenderingContext2D, cfg: GridConfig): void
```

**Contract:** All draw functions call `ctx.save()` at start, `ctx.restore()` at end. `physicsToCanvasX` and `canvasToPhysicsX` are exact inverses. `physicsToCanvasY` inverts the y-axis correctly.

**After building:** `npx tsc --noEmit`

---

### FILE 0.10 — `src/labforge/lib/canvas/rays.ts`

**Purpose:** Draw optics ray diagrams — lens/mirror symbols, principal rays, object/image arrows.

**Imports from:**
```ts
import type { LightRay, OpticsResult } from '../physics/optics'
import type { GridConfig } from './grid'
import {
  physicsToCanvasX, physicsToCanvasY,
  drawArrow, drawDashedLine, drawLine, drawVerticalMarker
} from './grid'
```

```ts
/**
 * Draw all principal rays as coloured arrows.
 *
 * Colours (fixed):
 *   rays[0] → '#f59e0b' amber   (parallel-to-axis ray)
 *   rays[1] → '#10b981' emerald (through-centre ray)
 *   rays[2] → '#3b82f6' blue    (through-focal-point ray)
 *
 * @param opacity default 0.85
 */
export function drawPrincipalRays(
  ctx: CanvasRenderingContext2D,
  rays: LightRay[],
  cfg: GridConfig,
  opacity?: number
): void

/**
 * Draw lens symbol at x=0.
 * isConverging=true → biconvex ↕ shape (two arrowheads, curved outward)
 * isConverging=false → biconcave )( shape (two arrowheads, curved inward)
 * heightPx default: 75% of canvasHeight
 */
export function drawLensSymbol(
  ctx: CanvasRenderingContext2D,
  cfg: GridConfig,
  isConverging: boolean,
  heightPx?: number
): void

/**
 * Draw spherical mirror symbol at x=0.
 * isConcave=true → concave, curves toward left (toward incoming light)
 * isConcave=false → convex, curves toward right (away from light)
 * heightPx default: 75% of canvasHeight
 */
export function drawMirrorSymbol(
  ctx: CanvasRenderingContext2D,
  cfg: GridConfig,
  isConcave: boolean,
  heightPx?: number
): void

/**
 * Draw upward arrow at physics (objectDist, 0) to (objectDist, objectHeight).
 * Always solid. Always white. Represents the real upright object.
 *
 * @param objectDistMetres negative value e.g. -0.30
 * @param objectHeightMetres positive value e.g. 0.05
 */
export function drawObjectArrow(
  ctx: CanvasRenderingContext2D,
  objectDistMetres: number,
  objectHeightMetres: number,
  cfg: GridConfig
): void

/**
 * Draw image arrow at its position from OpticsResult.
 * SOLID arrow for real image.
 * DASHED arrow for virtual image.
 * Direction: up if erect, down if inverted.
 *
 * Do NOT call this when result.isAtInfinity === true.
 */
export function drawImageArrow(
  ctx: CanvasRenderingContext2D,
  result: OpticsResult,
  objectHeightMetres: number,
  cfg: GridConfig
): void

/**
 * Draw focal point markers on the x-axis.
 * For lens (isLens=true): draw F (at -f) and F' (at +f) — both sides
 * For mirror (isLens=false): draw F (at f) and C (at 2f) — same side
 * Small filled circles with labels 'F', 'F′', 'C'
 */
export function drawFocalPoints(
  ctx: CanvasRenderingContext2D,
  focalLength: number,
  cfg: GridConfig,
  isLens: boolean
): void

/**
 * Draw the principal axis — horizontal dashed line through y=0
 */
export function drawPrincipalAxis(
  ctx: CanvasRenderingContext2D,
  cfg: GridConfig
): void
```

**Contract:** All functions `ctx.save()` / `ctx.restore()`. Real image arrow = solid line. Virtual image arrow = dashed line. Lens/mirror symbols drawn at `x=0` physics coordinates.

**After building:** `npx tsc --noEmit`

---

### FILE 0.11 — `src/labforge/store/labforgeStore.ts`

**Purpose:** Zustand navigation store. Navigation state only — no physics, no instrument internals.

**Imports from:**
```ts
import { create } from 'zustand'
import type { LabForgeState, ScienceClass } from '../registry/types'
```

**Full implementation — provide this to DeepSeek verbatim:**

```ts
'use client'

import { create } from 'zustand'
import type { LabForgeState, ScienceClass } from '../registry/types'

interface LabForgeActions {
  setActiveClass:    (cls: ScienceClass | 'all') => void
  openInstrument:   (id: string) => void
  closeInstrument:  () => void
  setSearchQuery:   (query: string) => void
  toggleSidebar:    () => void
}

type LabForgeStore = LabForgeState & LabForgeActions

const initialState: LabForgeState = {
  activeClass:        'all',
  activeInstrumentId: null,
  searchQuery:        '',
  sidebarCollapsed:   false,
}

export const useLabForgeStore = create<LabForgeStore>((set) => ({
  ...initialState,

  setActiveClass: (cls) =>
    set({ activeClass: cls, activeInstrumentId: null, searchQuery: '' }),

  openInstrument: (id) =>
    set({ activeInstrumentId: id }),

  closeInstrument: () =>
    set({ activeInstrumentId: null }),

  // FIX v1: activeClass set to 'all' not undefined (undefined fails ScienceClass|'all' type)
  setSearchQuery: (query) =>
    set({ searchQuery: query, activeClass: 'all' }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))
```

**Contract:** `activeInstrumentId` is `null` in grid view, a string ID when instrument is open. `setSearchQuery` always sets `activeClass` to `'all'` so search works across classes. No physics state stored here.

**After building:** `npx tsc --noEmit`

---

### FILE 0.12 — `src/labforge/registry/index.ts`

**Purpose:** The master instrument list. The ONLY file that references instrument folders via `load` functions.

**Imports from:**
```ts
import type { InstrumentMeta, ScienceClass, Level } from './types'
// Note: ScienceClass and Level imported here — FIX from v1
```

**Complete implementation:**

```ts
import type { InstrumentMeta, ScienceClass, Level } from './types'

export const INSTRUMENTS: InstrumentMeta[] = [

  // ─── OPTICS ──────────────────────────────────────────────────────────────
  {
    id: 'convex-lens',
    name: 'Convex Lens',
    scienceClass: 'optics',
    level: 'student',
    description: 'Ray diagram simulator for converging lenses with live image calculations.',
    longDescription: 'Explore how a convex (converging) lens forms real and virtual images. Drag the object to any position and watch all three principal rays redraw instantly. See how image position, magnification, and nature change as you move the object through the focal point.',
    specs: [
      'Thin lens equation: 1/v − 1/u = 1/f',
      'Focal length: 5 cm to 50 cm',
      'Object distance: 1 cm to 100 cm',
      'Displays: image distance, magnification, nature (real/virtual/inverted/erect)',
      'Three principal rays with correct geometry',
      'Focal point markers F and F\'',
    ],
    tags: ['lens', 'optics', 'converging', 'ray diagram', 'focal length', 'magnification', 'refraction'],
    ai: 'explain',
    hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Ch.12', 'O-Level Physics', 'A-Level Physics'],
    relatedIds: ['concave-lens', 'concave-mirror', 'convex-mirror'],
    load: () => import('../instruments/convex-lens'),
  },
  {
    id: 'concave-lens',
    name: 'Concave Lens',
    scienceClass: 'optics',
    level: 'student',
    description: 'Diverging lens — always forms virtual, erect, diminished images.',
    longDescription: 'A concave (diverging) lens always produces a virtual, erect, and diminished image regardless of object position. This makes it ideal for correcting myopia. Adjust focal length and object distance to verify the image is always virtual.',
    specs: [
      'Thin lens equation with negative f',
      'Focal length: −5 cm to −50 cm',
      'Image always: virtual, erect, diminished',
      'Three principal rays with diverging geometry',
      'Power in dioptres displayed',
      'Myopia correction context shown',
    ],
    tags: ['lens', 'concave', 'diverging', 'optics', 'myopia', 'virtual image'],
    ai: 'explain',
    hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Ch.12', 'O-Level Physics'],
    relatedIds: ['convex-lens', 'concave-mirror'],
    load: () => import('../instruments/concave-lens'),
  },
  {
    id: 'concave-mirror',
    name: 'Concave Mirror',
    scienceClass: 'optics',
    level: 'student',
    description: 'Converging spherical mirror — all 6 object positions with correct ray diagrams.',
    longDescription: 'A concave mirror can produce real or virtual images depending on where the object is placed. This simulator covers all six classic object positions with accurate ray diagrams and real-time calculations using the mirror equation.',
    specs: [
      'Mirror equation: 1/v + 1/u = 1/f, f = R/2',
      'Radius of curvature: 10 cm to 100 cm',
      'All 6 positions: beyond C, at C, between C and F, at F, between F and P, behind mirror',
      'Three principal rays: parallel, through F, through C',
      'Applications: telescopes, solar cookers, headlights, dentist mirror',
      'Real-time magnification and image distance',
    ],
    tags: ['mirror', 'concave', 'converging', 'optics', 'spherical', 'reflector'],
    ai: 'explain',
    hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Ch.12', 'O-Level Physics', 'A-Level Physics'],
    relatedIds: ['convex-mirror', 'convex-lens', 'concave-lens'],
    load: () => import('../instruments/concave-mirror'),
  },
  {
    id: 'convex-mirror',
    name: 'Convex Mirror',
    scienceClass: 'optics',
    level: 'student',
    description: 'Diverging spherical mirror — always virtual, erect, diminished images.',
    longDescription: 'A convex mirror always produces a virtual, erect, and diminished image. This makes it ideal for wide-field-of-view applications like rear-view mirrors and security mirrors. Explore why this property is useful and verify it with the mirror equation.',
    specs: [
      'Mirror equation with negative focal length',
      'Image always: virtual, erect, diminished',
      'Wide field of view demonstrated',
      'Applications: rear-view mirrors, security mirrors, road corners',
      'Three principal rays for diverging geometry',
      'Focal length: −5 cm to −50 cm',
    ],
    tags: ['mirror', 'convex', 'diverging', 'optics', 'rear-view', 'security'],
    ai: 'explain',
    hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Ch.12', 'O-Level Physics'],
    relatedIds: ['concave-mirror', 'convex-lens'],
    load: () => import('../instruments/convex-mirror'),
  },

  // ─── MECHANICS ───────────────────────────────────────────────────────────
  {
    id: 'pendulum',
    name: 'Simple Pendulum',
    scienceClass: 'mechanics',
    level: 'student',
    description: 'Full nonlinear RK4 pendulum — energy tracking, variable gravity, period vs length graph.',
    longDescription: 'Not a small-angle approximation. Uses RK4 on the exact equation θ̈ = −(g/L)sin(θ). Accurate at 85° swing angles. Change gravity to simulate the Moon, Mars, or Jupiter.',
    specs: [
      'Full nonlinear ODE: θ̈ = −(g/L)sin(θ) − bθ̇, solved by RK4',
      'String length: 0.1 m to 5 m',
      'Initial angle: 1° to 85°',
      'Gravity: Moon 1.62, Mars 3.72, Earth 9.81, Jupiter 24.79 m/s²',
      'Live: period T, frequency f, angular velocity ω, KE, PE, total E',
      'Period vs. Length graph builds in real time',
    ],
    tags: ['pendulum', 'oscillation', 'SHM', 'gravity', 'period', 'frequency', 'mechanics'],
    ai: 'none',
    hasLiveAnimation: true,
    curricularTopics: ['KPTBB Class 10 Physics', 'O-Level Physics', 'A-Level Physics'],
    relatedIds: [],     // FIX v1: was ['ohm-circuit'], corrected to []
    load: () => import('../instruments/pendulum'),
  },

  // ─── ELECTRICITY ─────────────────────────────────────────────────────────
  {
    id: 'ohm-circuit',
    name: "Ohm's Law & Circuits",
    scienceClass: 'electricity',
    level: 'student',
    description: "Interactive Ohm's Law with series/parallel circuits and live V-I graph.",
    longDescription: "Build series and parallel resistor circuits, apply a voltage, and watch the V-I graph draw in real time. Covers every Ohm's Law experiment in the KPTBB Class 10 and O-Level curricula.",
    specs: [
      "Ohm's Law: V = I × R, solved live",
      'Up to 3 resistors, series or parallel mode',
      'Voltage: 0 V to 30 V',
      'Each resistor: 1 Ω to 10,000 Ω',
      'V-I graph — straight line, slope = 1/R',
      'Displays: R_total, I_total, P_total, per-resistor V and I',
    ],
    tags: ["ohm's law", 'circuit', 'series', 'parallel', 'resistance', 'current', 'voltage'],
    ai: 'none',
    hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Physics Ch.14', 'O-Level Physics', 'GCSE Physics'],
    relatedIds: [],
    load: () => import('../instruments/ohm-circuit'),
  },

  // ─── MEASUREMENT ─────────────────────────────────────────────────────────
  {
    id: 'vernier-caliper',
    name: 'Vernier Caliper',
    scienceClass: 'measurement',
    level: 'student',
    description: 'Animated vernier caliper with zero error simulation and step-by-step reading guide.',
    longDescription: 'The 50-division vernier caliper reads to 0.02 mm. Both scales animate as you move the jaw. Introduce a zero error and practice correcting it. The coinciding vernier division is highlighted with a glow effect.',
    specs: [
      'Range: 0 mm to 150 mm',
      'Least count: 0.02 mm (50-division vernier)',
      'Zero error: −0.04 mm to +0.04 mm',
      'Main scale, vernier scale, depth rod animate together',
      'Coinciding division highlighted in emerald',
      'Step-by-step reading guide toggle',
    ],
    tags: ['vernier', 'caliper', 'measurement', 'least count', 'zero error', 'precision', 'length'],
    ai: 'none',
    hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 9 Physics', 'O-Level Physics', 'Practical Lab Skills'],
    relatedIds: [],
    load: () => import('../instruments/vernier-caliper'),
  },

  // ─── CHEMISTRY ───────────────────────────────────────────────────────────
  {
    id: 'ph-meter',
    name: 'pH Meter',
    scienceClass: 'chemistry',
    level: 'student',
    description: 'Nernst equation pH electrode with temperature compensation and buffer calibration.',
    longDescription: 'A digital pH meter using the Nernst equation. Select from 12 preset solutions, submerge the probe, and read the temperature-compensated pH and millivolt values. Includes two-point buffer calibration.',
    specs: [
      'pH range: 0.00 to 14.00, resolution 0.01',
      'Temperature: 10°C to 60°C with ATC',
      'Nernst equation: E = E° − (RT/nF)·2.303·pH',
      '12 preset solutions from pH 1.5 to 13.5',
      'Two-point calibration: pH 4.01 and pH 7.00 buffers',
      'Solution colour changes with universal indicator response',
    ],
    tags: ['ph', 'acidity', 'nernst', 'electrode', 'buffer', 'calibration', 'chemistry'],
    ai: 'none',
    hasLiveAnimation: false,
    curricularTopics: ['KPTBB Class 10 Chemistry', 'A-Level Chemistry', 'O-Level Chemistry'],
    relatedIds: ['chem-lab'],   // FIX v1: was ['convex-lens'], corrected
    load: () => import('../instruments/ph-meter'),
  },
  {
    id: 'chem-lab',
    name: 'Chemistry Lab Simulator',
    scienceClass: 'chemistry',
    level: 'advanced',
    description: 'AI-powered visual reaction simulator with RK45 ODE kinetics and Gemini analysis.',
    longDescription: 'Drag chemical species onto a canvas, connect reaction flows, set conditions, and run a real differential equation simulation. AI explains mechanisms, predicts products, and monitors safety hazards.',
    specs: [
      'React Flow drag-and-drop reaction canvas',
      'RK45 adaptive ODE solver with Arrhenius kinetics',
      'Gibbs free energy thermodynamics',
      'Gemini AI: prediction, safety analysis, live Q&A',
      'Real NIST thermodynamic species data',
      'GHS hazard codes and safety monitor',
    ],
    tags: ['chemistry', 'reactions', 'simulation', 'ai', 'ode', 'kinetics', 'thermodynamics'],
    ai: 'explain',
    hasLiveAnimation: true,
    curricularTopics: ['A-Level Chemistry', 'University Chemistry', 'KPTBB Class 10'],
    relatedIds: ['ph-meter'],
    load: () => import('@/chem-lab'),
  },
]

// ─── Helper functions ─────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<Level, number> = {
  student: 0, intermediate: 1, advanced: 2, expert: 3,
}

/** Returns 0-3 for level sorting. FIX v1: was exported but unimplemented. */
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
  const q = query.toLowerCase().trim()
  return INSTRUMENTS.filter(i =>
    i.name.toLowerCase().includes(q) ||
    i.description.toLowerCase().includes(q) ||
    i.tags.some(tag => tag.includes(q)) ||
    i.scienceClass.includes(q)
  )
}
```

**After building:** `npx tsc --noEmit`

---

## WAVE 1 — SHELL UI

> All Wave 0 files must pass `npx tsc --noEmit` before starting Wave 1.

---

### FILE 1.1 — `src/labforge/shell/ErrorBoundary.tsx`

**NEW in v2. Build this first — SimulationShell wraps with it.**

**Purpose:** Catches errors from crashing instrument components. One crashing instrument must NOT kill the entire app.

**Imports from:**
```ts
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '../lib/logger'
```

**Full implementation — provide this to DeepSeek verbatim:**

```tsx
'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '../lib/logger'

interface Props {
  children:       ReactNode
  instrumentName: string
  onReset:        () => void   // called when user clicks "Back to Library"
}

interface State {
  hasError:   boolean
  errorMsg:   string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('ErrorBoundary', `Instrument crashed: ${error.message}`, {
      instrument: this.props.instrumentName,
      stack: info.componentStack,
    })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%',
        background: '#09090b', color: '#f1f5f9',
        gap: 16, padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f1f5f9' }}>
          {this.props.instrumentName} encountered an error
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', maxWidth: 400 }}>
          {this.state.errorMsg || 'An unexpected error occurred in this instrument.'}
        </p>
        <button
          onClick={this.props.onReset}
          style={{
            marginTop: 8, padding: '10px 24px',
            background: '#10b981', border: 'none', borderRadius: 8,
            color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          ← Back to Library
        </button>
      </div>
    )
  }
}
```

**Contract:** Class component (required for error boundaries). Logs the error via `logger.error`. Shows a clean fallback UI. The `onReset` callback closes the instrument in the store.

---

### FILE 1.2 — `src/labforge/shell/LevelBadge.tsx`

**Purpose:** Colour-coded difficulty badge. Pure presentational, no state.

**Imports from:**
```ts
import type { Level } from '../registry/types'
```

**Props:**
```ts
interface LevelBadgeProps {
  level: Level
  size?: 'sm' | 'md'   // default 'sm'
}
```

**Colour map (Tailwind literal strings — DO NOT construct dynamically):**

| Level | bg | text | border |
|-------|----|------|--------|
| student | `bg-green-400/15` | `text-green-400` | `border-green-400/30` |
| intermediate | `bg-blue-400/15` | `text-blue-400` | `border-blue-400/30` |
| advanced | `bg-amber-400/15` | `text-amber-400` | `border-amber-400/30` |
| expert | `bg-red-400/15` | `text-red-400` | `border-red-400/30` |

Display text: capitalise the level — `'Student'`, `'Intermediate'`, `'Advanced'`, `'Expert'`.

Renders: `<span className="... border rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide">`

**Contract:** Single `<span>`. No hooks. No state. No side effects.

---

### FILE 1.3 — `src/labforge/shell/TopBar.tsx`

**NEW in v2.**

**Purpose:** Top bar visible only on mobile (< 768px). Shows LabForge logo and a hamburger button to toggle the sidebar.

**Imports from:**
```ts
import { useLabForgeStore } from '../store/labforgeStore'
```

**No props.**

**Renders:**
```
┌────────────────────────────────────────┐
│ ☰  LabForge                  [version] │
└────────────────────────────────────────┘
```

- Only renders when `window.innerWidth < 768` — use a `useEffect` with a window resize listener or a CSS `md:hidden` class
- Hamburger button calls `toggleSidebar()` from store
- LabForge wordmark: monospace font, emerald colour

---

### FILE 1.4 — `src/labforge/shell/SearchBar.tsx`

**Imports from:**
```ts
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLabForgeStore } from '../store/labforgeStore'
```

**No props.** Reads/writes store directly.

**Behaviour:**
- Local state `inputValue` for instant UI update
- 150ms debounce before calling `setSearchQuery`
- Escape key → clears both local state and store query
- Shows ✕ clear button when input is non-empty (clicks clear both)

**Implementation pattern:**
```ts
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

const handleChange = useCallback((val: string) => {
  setInputValue(val)
  if (timerRef.current) clearTimeout(timerRef.current)
  timerRef.current = setTimeout(() => {
    setSearchQuery(val)
  }, 150)
}, [setSearchQuery])

// Cleanup timer on unmount
useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
```

**Design:** `bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-2 text-sm w-full`. Focus: `border-slate-500 ring-1 ring-slate-500 outline-none`.

---

### FILE 1.5 — `src/labforge/shell/InstrumentCard.tsx`

**Imports from:**
```ts
import type { InstrumentMeta } from '../registry/types'
import { getClassDef } from '../registry/classes'
import { useLabForgeStore } from '../store/labforgeStore'
import { LevelBadge } from './LevelBadge'
```

**Props:** `{ instrument: InstrumentMeta }`

**Layout:**
```
┌─ [3px left border: class colour] ──────────────────┐
│  [class icon emoji]  [instrument name]              │
│  [one-line description, truncated to one line]      │
│  [LevelBadge]   [🤖 AI]  (if ai !== 'none')        │
│  [──────── Open → ────────] (full width button)     │
└─────────────────────────────────────────────────────┘
```

- Card: `bg-slate-900 border border-slate-800 rounded-lg p-4 transition-all duration-150`
- Hover: `hover:border-slate-600 hover:scale-[1.01]`
- Left border: inline style `borderLeft: '3px solid [classColor]'`
- Class colour extracted from `getClassDef(instrument.scienceClass)` — use the `.color` Tailwind class on the icon, not on the card body (icon gets the colour, rest stays slate)
- Description: `text-sm text-slate-400 line-clamp-1 overflow-hidden`
- AI badge: small `span` with `bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 rounded-full px-2 py-0.5 text-xs`

**Open button:**
```ts
onClick={() => useLabForgeStore.getState().openInstrument(instrument.id)}
```
Style: `w-full mt-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 font-medium transition-colors`

**Contract:** Only the button opens the instrument. Card itself is NOT clickable (prevents accidental opens on scroll/touch).

---

### FILE 1.6 — `src/labforge/shell/Sidebar.tsx`

**Imports from:**
```ts
import { SCIENCE_CLASSES } from '../registry/classes'
import { INSTRUMENTS } from '../registry/index'
import { useLabForgeStore } from '../store/labforgeStore'
import type { ScienceClass } from '../registry/types'
```

**No props.**

**Layout:**
```
┌──────────────────────┐
│  ⚗️ LabForge         │  ← title, always visible
│  ──────────────────  │
│  🔭 All      (9)     │  ← 'all' first
│  🔭 Optics   (4)     │  ← only classes with instruments
│  ⚙️ Mechanics (1)    │
│  ⚡ Electricity (1)  │
│  🧪 Chemistry  (2)   │
│  📐 Measurement (1)  │
│  ──────────────────  │
│  [collapsed classes] │
└──────────────────────┘
```

**Behaviour when instrument is open:**
- Sidebar stays visible on desktop (≥ 768px) — user can navigate to another class while instrument is open
- When user clicks a different class tab while an instrument is open: call `setActiveClass(cls)` which resets `activeInstrumentId` to null — instrument closes and grid for new class shows
- On mobile (< 768px): sidebar collapses when instrument opens (use `sidebarCollapsed` from store)

**Class tab active state:**
```tsx
const isActive = activeClass === cls.id
// Active: border-l-2 + class border colour (inline style) + class text colour class
// Inactive: text-slate-500 hover:text-slate-300 hover:bg-slate-800/50
```

**Count badge:**
```ts
const count = INSTRUMENTS.filter(i => i.scienceClass === cls.id).length
// Only show classes where count > 0
```

---

### FILE 1.7 — `src/labforge/shell/InstrumentGrid.tsx`

**Imports from:**
```ts
import { getInstrumentsByClass, searchInstruments } from '../registry/index'
import { SCIENCE_CLASSES, getClassDef } from '../registry/classes'
import { useLabForgeStore } from '../store/labforgeStore'
import { InstrumentCard } from './InstrumentCard'
```

**No props.**

**Logic:**
```ts
const { activeClass, searchQuery } = useLabForgeStore(s => ({ ... }))

const instruments = searchQuery.trim()
  ? searchInstruments(searchQuery)
  : getInstrumentsByClass(activeClass)
```

**Grid layout:** `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4`

**Header:**
- If search: `"{N} results for '{query}'"` with a clear button
- If class: class icon + class label + instrument count
- Font: `text-lg font-semibold text-slate-200 mb-4`

**Empty state:**
```
[🔭 large emoji]
[No instruments found]
[Try a different search or select another class.]
[Clear search] button (only shown when searchQuery is non-empty)
```

---

### FILE 1.8 — `src/labforge/shell/SimulationShell.tsx`

**Purpose:** Full-screen wrapper for open instrument. Mounts dynamically. Wraps with ErrorBoundary.

**Imports from:**
```ts
'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { getInstrument } from '../registry/index'
import { getClassDef } from '../registry/classes'
import { useLabForgeStore } from '../store/labforgeStore'
import { LevelBadge } from './LevelBadge'
import { ErrorBoundary } from './ErrorBoundary'
import type { InstrumentMeta } from '../registry/types'
import type { ComponentType } from 'react'
```

**No props.** Reads `activeInstrumentId` from store.

**The dynamic import pattern — FIX from v1:**

```tsx
// The correct approach: store the ComponentType in state.
// When activeInstrumentId changes, load a fresh component.
// dynamic() is called at module level but with a changing import target via state.

'use client'
import dynamic from 'next/dynamic'
import { useState, useEffect } from 'react'
// ...

export function SimulationShell() {
  const activeId      = useLabForgeStore(s => s.activeInstrumentId)
  const closeInstrument = useLabForgeStore(s => s.closeInstrument)

  // Key trick: when the ID changes, we load a new dynamic component.
  // We use the instrument's load function directly.
  const [InstrumentComponent, setInstrumentComponent] = useState<ComponentType | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activeId) {
      setInstrumentComponent(null)
      return
    }
    const meta = getInstrument(activeId)
    if (!meta) return

    setLoading(true)
    // Create a dynamic component from this instrument's load function
    const Comp = dynamic(meta.load, {
      ssr: false,
      loading: () => <LoadingScreen name={meta.name} />,
    })
    setInstrumentComponent(() => Comp)  // setState with function to avoid calling Comp()
    setLoading(false)
  }, [activeId])

  if (!activeId) return null

  const meta = getInstrument(activeId)
  if (!meta) return null

  const cls = getClassDef(meta.scienceClass)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header strip */}
      <div style={{
        height: 48, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#0f172a',
      }}>
        <button onClick={closeInstrument} style={{ ... }}>← Back</button>
        <span>{cls.icon}</span>
        <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{meta.name}</span>
        <LevelBadge level={meta.level} />
        {meta.ai !== 'none' && <span style={{ fontSize: 11, color: '#10b981' }}>🤖 AI</span>}
      </div>

      {/* Instrument area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <ErrorBoundary instrumentName={meta.name} onReset={closeInstrument}>
          {InstrumentComponent ? <InstrumentComponent /> : <LoadingScreen name={meta.name} />}
        </ErrorBoundary>
      </div>
    </div>
  )
}
```

**LoadingScreen (inline component — do not export separately):**
```tsx
function LoadingScreen({ name }: { name: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%',
      background: '#09090b', gap: 12,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%',
        border: '3px solid #10b981', borderTopColor: 'transparent',
        animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading {name}…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
```

**Contract:** When `activeInstrumentId` is null, renders nothing. `ErrorBoundary` wraps the instrument so crashes don't propagate. `closeInstrument` is passed as `onReset` to ErrorBoundary.

---

### FILE 1.9 — `src/labforge/LabForgeApp.tsx`

**Purpose:** Root component. Assembles everything. This is the only import needed by the parent page.

**Imports from:**
```ts
'use client'
import { useLabForgeStore } from './store/labforgeStore'
import { Sidebar }         from './shell/Sidebar'
import { TopBar }          from './shell/TopBar'
import { SearchBar }       from './shell/SearchBar'
import { InstrumentGrid }  from './shell/InstrumentGrid'
import { SimulationShell } from './shell/SimulationShell'
```

**Props:**
```ts
interface LabForgeAppProps {
  className?: string
  style?:     React.CSSProperties
}
```

**Full layout — desktop:**
```
┌───────────────────────────────────────────────────────┐
│ [Sidebar 220px fixed] │ [SearchBar top strip]         │
│                       ├───────────────────────────────┤
│                       │ [InstrumentGrid or            │
│                       │  SimulationShell fills rest]  │
└───────────────────────────────────────────────────────┘
```

**Full layout — mobile (< 768px):**
```
┌───────────────────────────────────────────────────────┐
│ [TopBar: hamburger + LabForge title]                  │
├───────────────────────────────────────────────────────┤
│ [Sidebar: slide-in drawer when !sidebarCollapsed]     │
├───────────────────────────────────────────────────────┤
│ [SearchBar]                                           │
├───────────────────────────────────────────────────────┤
│ [InstrumentGrid or SimulationShell — full width]      │
└───────────────────────────────────────────────────────┘
```

**Implementation:**
```tsx
export default function LabForgeApp({ className, style }: LabForgeAppProps) {
  const activeId       = useLabForgeStore(s => s.activeInstrumentId)
  const sidebarCollapsed = useLabForgeStore(s => s.sidebarCollapsed)

  return (
    <div
      className={className}
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: '#09090b', color: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Mobile top bar — hidden on md+ via CSS */}
      <TopBar />

      {/* Main row */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar — hidden on mobile when collapsed */}
        {!sidebarCollapsed && (
          <div style={{
            width: 220, flexShrink: 0,
            borderRight: '1px solid rgba(255,255,255,0.06)',
            overflowY: 'auto',
          }}>
            <Sidebar />
          </div>
        )}

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Search — only show when grid is visible, not during simulation */}
          {!activeId && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <SearchBar />
            </div>
          )}

          <div style={{ flex: 1, overflow: 'auto' }}>
            {activeId ? <SimulationShell /> : <InstrumentGrid />}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Contract:** `'use client'`. Accepts `className` and `style` — parent controls container size. LabForge fills 100% of what it is given. The parent page must give it a height (e.g. `height: '100dvh'`).

---

## WAVE 2 — OPTICS INSTRUMENTS

> Wave 1 must pass `npx tsc --noEmit` before starting Wave 2.

### THE CANVAS RESIZE PATTERN — Required in every canvas instrument

**All canvas instruments must handle window resize. Copy this pattern exactly:**

```ts
// In every instrument App component that uses a canvas:
const canvasRef = useRef<HTMLCanvasElement>(null)
const containerRef = useRef<HTMLDivElement>(null)
const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 })

useEffect(() => {
  const container = containerRef.current
  if (!container) return

  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      setCanvasSize({ width: Math.floor(width), height: Math.floor(height) })
    }
  })
  ro.observe(container)
  return () => ro.disconnect()
}, [])
```

This ensures the canvas fills its container at all times and redraws correctly when the window resizes.

---

### FILE 2.1 — `src/labforge/instruments/convex-lens/types.ts`

**Imports from:**
```ts
import type { OpticsResult } from '../../lib/physics/optics'
```

```ts
export interface ConvexLensState {
  focalLengthCm: number      // 5 to 50 cm
  objectDistCm:  number      // 1 to 100 cm (positive, negated internally)
  objectHeightCm:number      // 1 to 10 cm
  result:        OpticsResult | null
}

export interface ObjectPreset {
  label:          string
  description:    string   // expected result description
  // objectDistCm is a multiplier of focalLength, NOT a fixed value
  // so presets are a function, not a constant — FIX from v1
}

// Preset multipliers relative to focal length f:
// Beyond 2F: use 3f. At 2F: use 2f. Between F and 2F: use 1.5f.
// At F: use 1f. Between F and O: use 0.5f.
export function getPresets(focalLengthCm: number): Array<{
  label:          string
  objectDistCm:   number
  expectedResult: string
}>
```

**Implementation of `getPresets`:**
```ts
export function getPresets(focalLengthCm: number) {
  return [
    { label: 'Beyond 2F',       objectDistCm: focalLengthCm * 3,   expectedResult: 'Real, inverted, diminished' },
    { label: 'At 2F',           objectDistCm: focalLengthCm * 2,   expectedResult: 'Real, inverted, same size (m = −1)' },
    { label: 'Between F and 2F',objectDistCm: focalLengthCm * 1.5, expectedResult: 'Real, inverted, enlarged' },
    { label: 'At F',            objectDistCm: focalLengthCm * 1,   expectedResult: 'No image — rays parallel (image at ∞)' },
    { label: 'Between F and O', objectDistCm: focalLengthCm * 0.5, expectedResult: 'Virtual, erect, enlarged' },
  ]
}
```

---

### FILE 2.2 — `src/labforge/instruments/convex-lens/engine.ts`

**Imports from:**
```ts
import { thinLensEquation, convexLensPrincipalRays } from '../../lib/physics/optics'
import type { OpticsResult } from '../../lib/physics/optics'
```

```ts
/**
 * Compute OpticsResult from user-facing cm inputs.
 * Converts: cm → metres, positive objectDist → negative (real object convention).
 *
 * @param focalLengthCm  positive, convex lens
 * @param objectDistCm   positive (user sees positive), converted to negative internally
 * @param objectHeightCm positive
 */
export function computeConvexLens(
  focalLengthCm:  number,
  objectDistCm:   number,
  objectHeightCm: number
): OpticsResult

/** 'Real, Inverted, Diminished' | 'Virtual, Erect, Enlarged' | 'No image (object at focal point)' */
export function getImageNature(result: OpticsResult): string

/** '16.7 cm' | '∞ (no image)' | 'Virtual: −8.3 cm' */
export function formatImageDistance(result: OpticsResult): string

/** '1/v − 1/(−25) = 1/10  →  v = 16.7 cm' */
export function getFormulaSubstituted(
  focalLengthCm: number,
  objectDistCm:  number,
  result:        OpticsResult
): string
```

---

### FILE 2.3 — `src/labforge/instruments/convex-lens/ConvexLensApp.tsx`

**Imports from:**
```ts
'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { computeConvexLens, getImageNature, formatImageDistance, getFormulaSubstituted } from './engine'
import { convexLensPrincipalRays } from '../../lib/physics/optics'
import { clearCanvas, drawGrid, drawPrincipalAxis } from '../../lib/canvas/grid'
import {
  drawPrincipalRays, drawLensSymbol, drawObjectArrow,
  drawImageArrow, drawFocalPoints, drawPrincipalAxis as drawAxis
} from '../../lib/canvas/rays'
import { powerDioptres } from '../../lib/physics/optics'
import { getPresets } from './types'
import type { GridConfig } from '../../lib/canvas/grid'
```

**Layout (two-column — canvas left, controls right):**
```
┌─────────────────────────────┬──────────────────────────┐
│                             │  CONTROLS                │
│  [Canvas — ray diagram]     │  Focal Length (f)        │
│                             │  [5─────────────●──50cm] │
│                             │  10 cm                   │
│                             │                          │
│                             │  Object Distance (u)     │
│  Canvas is responsive:      │  [1────●─────────100cm]  │
│  fills containerRef div.    │  25 cm                   │
│  ResizeObserver updates     │                          │
│  canvasSize state.          │  Object Height (h)       │
│                             │  [1────────────●──10cm]  │
│                             │  3 cm                    │
│                             │                          │
│                             │  QUICK PRESETS           │
│                             │  [Beyond 2F][At 2F]      │
│                             │  [Betw F&2F][At F]       │
│                             │  [Betw F&O]              │
│                             │                          │
│                             │  READINGS                │
│                             │  Image distance: 16.7 cm │
│                             │  Magnification: −0.67×   │
│                             │  Nature: Real, Inv, Dim  │
│                             │  Power: 10.0 D           │
│                             │                          │
│                             │  FORMULA                 │
│                             │  1/v − 1/(−25) = 1/10   │
│                             │  v = 16.7 cm             │
└─────────────────────────────┴──────────────────────────┘
```

**Canvas physics coordinate system:**
```ts
const fM = focalLengthCm / 100  // focal length in metres
const hM = objectHeightCm / 100
const config: GridConfig = {
  canvasWidth:  canvasSize.width,
  canvasHeight: canvasSize.height,
  xMin: -fM * 1.3,
  xMax:  fM * 1.8,
  yMin: -hM * 4,
  yMax:  hM * 4,
  tickSpacingX: fM / 2,
  tickSpacingY: hM,
  labelUnitX: 'cm',
  labelUnitY: 'cm',
}
```

**Draw order every time result changes:**
1. `clearCanvas(ctx, config)`
2. `drawGrid(ctx, config)`
3. `drawPrincipalAxis(ctx, config)` — horizontal dashed line at y=0
4. `drawFocalPoints(ctx, fM, config, true)` — F and F' markers
5. `drawLensSymbol(ctx, config, true)` — convex lens at x=0
6. `drawObjectArrow(ctx, -objectDistCm/100, hM, config)` — object
7. `if (!result.isAtInfinity) drawImageArrow(ctx, result, hM, config)` — image
8. `drawPrincipalRays(ctx, result.principalRays, config)` — coloured rays

**State management:**
- All state is `useState` local — no Zustand
- `result` computed with `useMemo` from focalLengthCm, objectDistCm, objectHeightCm
- Canvas redraws with `useEffect` when result changes or canvasSize changes

**At focal point:** Show warning banner above readings:
```
⚠️ Object is at focal point — image forms at infinity.
Rays emerge parallel — no image is formed.
```
Do not draw image arrow. Do still draw the rays (they show parallel output).

**Slider style:** `w-full accent-emerald-400` on `<input type="range">`. Value shown above slider.

**Readings panel:** `bg-slate-900/80 rounded-lg p-3 font-mono text-sm space-y-1.5`. Labels `text-slate-500`, values `text-emerald-400`. Nature string: real = `text-blue-400`, virtual = `text-amber-400`.

---

### FILE 2.4 — `src/labforge/instruments/convex-lens/index.ts`

```ts
export { ConvexLensApp as default } from './ConvexLensApp'
```

---

### FILES 2.5–2.16 — Remaining Optics + Other Instrument Index Files

**All instrument `index.ts` files — NEW in v2. Every one explicitly specified:**

**`src/labforge/instruments/concave-lens/index.ts`:**
```ts
export { ConcaveLensApp as default } from './ConcaveLensApp'
```

**`src/labforge/instruments/concave-mirror/index.ts`:**
```ts
export { ConcaveMirrorApp as default } from './ConcaveMirrorApp'
```

**`src/labforge/instruments/convex-mirror/index.ts`:**
```ts
export { ConvexMirrorApp as default } from './ConvexMirrorApp'
```

**`src/labforge/instruments/pendulum/index.ts`:**
```ts
export { PendulumApp as default } from './PendulumApp'
```

**`src/labforge/instruments/ohm-circuit/index.ts`:**
```ts
export { OhmCircuitApp as default } from './OhmCircuitApp'
```

**`src/labforge/instruments/vernier-caliper/index.ts`:**
```ts
export { VernierCaliperApp as default } from './VernierCaliperApp'
```

**`src/labforge/instruments/ph-meter/index.ts`:**
```ts
export { PhMeterApp as default } from './PhMeterApp'
```

**Each of these is a separate file — build each one individually and run `npx tsc --noEmit` after each.**

---

### Concave Lens, Concave Mirror, Convex Mirror — Differences from ConvexLensApp

Build types.ts, engine.ts, [Name]App.tsx, index.ts for each. The structure is identical. Only these things differ:

**Concave Lens (`concave-lens/`):**
- `engine.ts`: uses `thinLensEquation(focalLength, u, h)` with **negative focal length** (f slider shows 5–50cm, internally use -f)
- `getPresets()` returns 3 presets (near/medium/far — no "at focal point" since concave diverging lens never sends to infinity)
- `drawLensSymbol(ctx, config, false)` — `false` = diverging (biconcave shape)
- Image is ALWAYS virtual, erect, diminished — no special "at infinity" case
- Canvas: image always dashed (virtual), always on same side as object

**Concave Mirror (`concave-mirror/`):**
- `engine.ts`: uses `mirrorEquation(focalLength, u, h)` with **positive focal length**
- Mirror convention: light travels left → right, mirror is on the RIGHT, object on LEFT
- `drawMirrorSymbol(ctx, config, true)` — concave
- `drawFocalPoints(ctx, fM, config, false)` — `false` = mirror (draws F and C at 2f)
- Uses `concaveMirrorPrincipalRays(...)` from optics.ts
- `getPresets()` returns 6 entries (all 6 classic positions for concave mirror)
- Canvas xMin/xMax reversed so mirror appears on right: `xMin = -fM * 0.2, xMax = fM * 3`

**Convex Mirror (`convex-mirror/`):**
- `engine.ts`: uses `mirrorEquation(focalLength, u, h)` with **negative focal length**
- `drawMirrorSymbol(ctx, config, false)` — convex
- Uses `convexMirrorPrincipalRays(...)` from optics.ts
- `getPresets()` returns 3 entries (near/medium/far — all give virtual results)
- Canvas: a shaded region behind the mirror to show "virtual region"
- Image ALWAYS virtual — always dashed

---

## WAVE 3 — PENDULUM

### FILE 3.1 — `src/labforge/instruments/pendulum/types.ts`

```ts
export interface PendulumReadouts {
  thetaDeg:     number   // current angle in degrees
  omegaRadS:    number   // angular velocity rad/s
  periodS:      number   // T = 2π√(L/g) small-angle formula
  frequencyHz:  number   // f = 1/T
  kineticJ:     number   // KE in Joules
  potentialJ:   number   // PE in Joules
  totalJ:       number   // TE = KE + PE
}

export interface GravityPreset {
  label: string   // 'Earth'
  body:  string   // display name
  g:     number   // m/s²
  emoji: string
}

export const GRAVITY_PRESETS: GravityPreset[]
// Must be exactly: Moon 1.62, Mars 3.72, Earth 9.81, Jupiter 24.79

export interface TrailPoint {
  x: number    // canvas pixel x
  y: number    // canvas pixel y
}
```

**`GRAVITY_PRESETS` implementation:**
```ts
export const GRAVITY_PRESETS: GravityPreset[] = [
  { label: 'Moon',    body: 'Moon',    g: 1.62,  emoji: '🌙' },
  { label: 'Mars',    body: 'Mars',    g: 3.72,  emoji: '🔴' },
  { label: 'Earth',   body: 'Earth',   g: 9.81,  emoji: '🌍' },
  { label: 'Jupiter', body: 'Jupiter', g: 24.79, emoji: '🪐' },
]
```

---

### FILE 3.2 — `src/labforge/instruments/pendulum/engine.ts`

**Imports from:**
```ts
import { rk4Step } from '../../lib/physics/ode'
import type { DerivativeFunction } from '../../lib/physics/ode'
```

```ts
/**
 * Returns the derivative function for the pendulum ODE.
 *
 * State vector: [θ (rad), ω (rad/s)]
 *
 * Exact nonlinear equations (NOT small-angle approximation):
 *   dθ/dt = ω
 *   dω/dt = −(g/L)·sin(θ) − b·ω
 *
 * The sin(θ) term (not θ) is what makes this the full nonlinear ODE.
 * At small angles sin(θ) ≈ θ, so both agree.
 * At 80° they diverge by ~15% in period.
 */
export function makePendulumDerivative(
  length:  number,   // metres
  gravity: number,   // m/s²
  damping: number    // dimensionless coefficient, default 0.02
): DerivativeFunction

/**
 * Advance pendulum state by dt seconds (one RK4 step).
 * Sub-steps of 0.001s are done externally in the animation loop.
 */
export function stepPendulum(
  theta:   number,
  omega:   number,
  t:       number,
  dt:      number,
  length:  number,
  gravity: number,
  damping: number
): { theta: number; omega: number; t: number }

/**
 * T = 2π√(L/g)  — small-angle formula, displayed only (not used in ODE).
 */
export function smallAnglePeriod(length: number, gravity: number): number

/**
 * KE = ½·m·(L·ω)²  = ½·m·L²·ω²
 * @param mass kg, default 0.1
 */
export function kineticEnergy(mass: number, length: number, omega: number): number

/**
 * PE = m·g·L·(1 − cos(θ))  (relative to lowest point)
 */
export function potentialEnergy(mass: number, gravity: number, length: number, theta: number): number

/**
 * Bob position relative to pivot:
 *   x = L·sin(θ)   (positive = right)
 *   y = −L·cos(θ)  (negative = below pivot, θ=0 hangs straight down)
 */
export function bobPosition(length: number, theta: number): { x: number; y: number }
```

---

### FILE 3.3 — `src/labforge/instruments/pendulum/PendulumApp.tsx`

**Imports from:**
```ts
'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { stepPendulum, smallAnglePeriod, kineticEnergy, potentialEnergy, bobPosition } from './engine'
import { GRAVITY_PRESETS } from './types'
import type { TrailPoint, PendulumReadouts } from './types'
import { degreesToRadians, radiansToDegrees } from '../../lib/units'
```

**Layout:**
```
┌────────────────────────┬──────────────────────────┐
│                        │  String Length           │
│  [Canvas — pendulum]   │  [────────●────] 1.5 m  │
│                        │                          │
│  ContainerRef div      │  Initial Angle           │
│  with ResizeObserver   │  [────●────────] 30°     │
│                        │                          │
│  Pivot at top-centre   │  Gravity                 │
│  String drawn          │  [🌙][🔴][🌍][🪐]       │
│  Bob coloured by speed │                          │
│  Trail fades           │  [▶ Start] [⏸ Pause]    │
│                        │  [↺ Reset]               │
│  [Energy bar chart]    │                          │
│  KE █████░░░░ 23%      │  READINGS                │
│  PE ██░░░░░░░ 87%      │  T (small-angle): 2.453s │
│  TE ███████░░ 100%     │  Frequency: 0.408 Hz     │
│                        │  θ = 29.3°               │
│  [T vs L graph]        │  ω = 0.85 rad/s          │
│  Recharts LineChart     │  KE: 0.0023 J            │
│                        │  PE: 0.0187 J            │
│                        │  Total E: 0.0210 J       │
└────────────────────────┴──────────────────────────┘
```

**Animation loop pattern:**
```ts
useEffect(() => {
  if (!isRunning) return
  let animId: number
  let lastNow: number | null = null

  // Mutable refs to avoid stale closure
  let theta = thetaRef.current
  let omega = omegaRef.current
  let time  = timeRef.current
  const trail: TrailPoint[] = [...trailRef.current]

  const loop = (now: number) => {
    const frameDt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 0.001
    lastNow = now

    const subSteps = Math.max(1, Math.floor(frameDt / 0.001))
    for (let i = 0; i < subSteps; i++) {
      const next = stepPendulum(theta, omega, time, 0.001, length, gravity, damping)
      theta = next.theta; omega = next.omega; time = next.t
    }

    thetaRef.current = theta; omegaRef.current = omega; timeRef.current = time

    // Update trail (max 60 points)
    const pos = bobPosition(length, theta)
    const pivotX = canvasSize.width / 2
    const pivotY = 40
    const scale = Math.min(canvasSize.width, canvasSize.height - 80) / (length * 2.2)
    trail.push({ x: pivotX + pos.x * scale, y: pivotY - pos.y * scale })
    if (trail.length > 60) trail.shift()
    trailRef.current = trail

    // Compute readouts (batch setState)
    const KE = kineticEnergy(0.1, length, omega)
    const PE = potentialEnergy(0.1, gravity, length, theta)
    setReadouts({
      thetaDeg: radiansToDegrees(theta),
      omegaRadS: omega,
      periodS: smallAnglePeriod(length, gravity),
      frequencyHz: 1 / smallAnglePeriod(length, gravity),
      kineticJ: KE,
      potentialJ: PE,
      totalJ: KE + PE,
    })

    drawFrame(theta, length, trail, canvasSize, omega)
    animId = requestAnimationFrame(loop)
  }

  animId = requestAnimationFrame(loop)
  return () => cancelAnimationFrame(animId)
}, [isRunning, length, gravity, damping])
```

**Bob colour by speed:** `lerp(blue, red, Math.min(1, |omega| / 5))`  
At ω=0 (tops of swing): blue. At ω=max (bottom): red.

**Trail:** Draw 60 past bob positions. Each point's opacity = `index/60 * 0.4`.

**Energy bars:**
- Three horizontal bars below canvas
- KE: red bar, width = `kineticJ / totalJ * 100%`
- PE: blue bar, width = `potentialJ / totalJ * 100%`
- Total E: white/slate bar, always 100%

**Period vs Length graph (Recharts):**
- X axis: length 0–5m, Y axis: period 0–5s
- When user changes length slider, add `{ length, period: smallAnglePeriod(length, gravity) }` to chart data
- Overlay theoretical curve `T = 2π√(L/g)` as a smooth line

---

## WAVE 4 — ELECTRICITY

### FILE 4.1 — `src/labforge/instruments/ohm-circuit/types.ts`

```ts
export type CircuitMode = 'series' | 'parallel'

export interface ResistorConfig {
  id:         string
  resistance: number   // 1 to 10000 Ohms
  label:      string   // 'R1', 'R2', 'R3'
  color:      string   // '#10b981', '#3b82f6', '#f59e0b' — one per resistor
}

export interface CircuitReadouts {
  totalResistance: number   // Ohms
  totalCurrent:    number   // Amperes
  totalPower:      number   // Watts
  voltageDrops:    number[] // one per resistor
  currents:        number[] // one per resistor
}

export interface VIDataPoint {
  v: number
  i: number
}
```

---

### FILE 4.2 — `src/labforge/instruments/ohm-circuit/engine.ts`

(Same as specified in v1 — no changes. Import from electricity.ts)

---

### FILE 4.3 — `src/labforge/instruments/ohm-circuit/OhmCircuitApp.tsx`

**Layout:**
```
┌────────────────────────────────┬─────────────────────────┐
│  CIRCUIT CANVAS                │  Mode: [Series][Parallel]│
│                                │                         │
│  Series:                       │  Voltage                │
│  ┌──[R1 220Ω]──[R2 330Ω]──┐  │  [0──────────●────30V]  │
│  │                          │  │  12 V                   │
│  └─── Battery ─────────────┘  │                         │
│                                │  R1: 1──────────● 220Ω  │
│  Animated dots move clockwise  │  R2: 1──────────● 330Ω  │
│  Speed proportional to current │  [+ Add R3]             │
│                                │                         │
│  V-I GRAPH (Recharts)          │  READINGS               │
│                                │  R_total: 550 Ω         │
│  I(A)│ /                       │  I_total: 21.8 mA       │
│      │/                        │  P_total: 262 mW        │
│      ──────────── V(V)         │  ─────────────────────  │
│  • = current operating point   │  Per Resistor:          │
│                                │  R1: 4.80 V, 21.8 mA   │
│                                │  R2: 7.20 V, 21.8 mA   │
└────────────────────────────────┴─────────────────────────┘
```

**Circuit canvas drawing (Canvas 2D):**
- Series layout: Battery symbol on left, resistors in a horizontal chain on top wire, return wire at bottom
- Parallel layout: Battery on left, resistors stacked vertically with vertical connecting wires
- Battery symbol: two vertical lines (long = positive, short = negative), voltage label
- Resistor symbol: rectangular box with label and resistance value
- Animated current flow: 4–6 small filled circles per wire segment, moving at speed proportional to current (use `requestAnimationFrame`)
- When no current (V=0 or R=0): dots stopped

**V-I Graph:**
- Recharts `LineChart`, X axis 0–30V, Y axis auto-scaled
- One line with slope `1/R_total`
- Dot at current operating point: `{ v: voltage, i: totalCurrent }`

---

## WAVE 5 — VERNIER CALIPER

### FILE 5.1 — `src/labforge/instruments/vernier-caliper/types.ts`

```ts
export interface VernierState {
  objectWidthMm: number      // 0 to 150 mm
  zeroErrorMm:   number      // −0.04 | −0.02 | 0 | +0.02 | +0.04
  showGuide:     boolean
}
```

---

### FILE 5.2 — `src/labforge/instruments/vernier-caliper/engine.ts`

**FIX from v1:** Engine returns pure mm values only — no canvas pixels.

```ts
/**
 * Compute vernier caliper reading.
 *
 * 50-division vernier: Least Count = 1mm/50 = 0.02mm
 *
 * Main scale reading = floor(objectWidthMm) mm
 * Coinciding division = round((fractional part) / 0.02)  (0 to 49)
 * Vernier scale reading = coincidingDivision × 0.02 mm
 * Raw reading = mainScale + vernierScale
 * Corrected reading = rawReading − zeroError
 *
 * @param objectWidthMm actual width 0 to 150 mm
 * @param zeroErrorMm   −0.04 to +0.04 mm
 */
export function computeVernierReading(objectWidthMm: number, zeroErrorMm: number): {
  mainScaleReading:   number   // integer mm
  vernierScaleReading:number   // multiple of 0.02mm
  coincidingDivision: number   // 0 to 49
  rawReading:         number   // mainScale + vernierScale
  correctedReading:   number   // rawReading − zeroError
}
```

---

### FILE 5.3 — `src/labforge/instruments/vernier-caliper/VernierCaliperApp.tsx`

**Rendering: SVG (not Canvas 2D) for precise scale markings.**

**SVG must contain:**
1. Fixed jaw body (rectangle, main scale markings 0–150mm)
2. Movable jaw (rectangle, position = objectWidthMm in SVG units, vernier scale markings)
3. Depth rod (extends from back of movable jaw)
4. Thumb slide (circle on movable jaw)
5. Object (grey filled rectangle between jaws)
6. Scale markings: 1mm short ticks, 10mm tall ticks with labels
7. Coinciding vernier division: highlighted with `filter: drop-shadow(0 0 3px #10b981)` and `fill: #10b981`

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  [SVG — the full caliper, fills container width]         │
│  [Object width slider: 0──────────●────────────── 150mm] │
│  [Zero error: None | +0.02 | +0.04 | -0.02 | -0.04 mm] │
│  [Show Reading Guide] toggle                             │
│                                                          │
│  READING:                                                │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Main scale:    21 mm                               │ │
│  │  Vernier scale: 0.26 mm  (division 13 × 0.02)      │ │
│  │  Raw reading:   21.26 mm                            │ │
│  │  Zero error:    +0.02 mm                            │ │
│  │  Corrected:     21.24 mm                            │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**Reading guide (when `showGuide` is true):**
```
Step 1 — Main scale reading
  The 0 of the vernier is past the [21] mm mark → main scale = 21 mm

Step 2 — Vernier scale reading
  Division [13] coincides with a main scale line
  13 × 0.02 = 0.26 mm

Step 3 — Total reading
  21 + 0.26 = 21.26 mm

Step 4 — Zero error correction
  Zero error = +0.02 mm
  Corrected = 21.26 − 0.02 = 21.24 mm ✓
```

---

## WAVE 6 — pH METER

### Files 6.1 and 6.2

(Same as v1 specification — types.ts and engine.ts unchanged)

**Only corrections:**
- `SOLUTION_PRESETS` must include exactly 12 solutions as listed
- `isMatchingBuffer` uses `4.01` and `7.00` as the two overloaded parameter values

---

### FILE 6.3 — `src/labforge/instruments/ph-meter/PhMeterApp.tsx`

(Same layout as v1 — no structural changes, but note the resize pattern must be applied to the canvas/beaker container)

**The beaker liquid color** uses `phToColor(ph)` with a CSS `transition: background-color 0.5s ease`.

**The probe animation** uses a CSS `transition: transform 0.8s ease` on the probe element's Y position.

---

## WAVE 7 — REGISTER CHEMISTRY LAB

### UPDATE — `src/chem-lab/index.ts`

Open the existing file. If this line is not already there, add it:
```ts
export { ChemLabApp as default } from './ChemLabApp'
```

No other changes to any chem-lab file.

---

## FILE CONNECTION MAP — COMPLETE v2

```
lib/logger.ts            ← imported by: lib/physics/ode, lib/physics/optics,
                                        store/labforgeStore (if needed),
                                        shell/ErrorBoundary, ALL instrument engines

registry/types.ts        ← imported by: registry/classes, registry/index,
                                        store/labforgeStore, ALL shell, ALL instrument types

registry/classes.ts      ← imported by: registry/index, shell/Sidebar,
                                        shell/InstrumentCard, shell/SimulationShell

registry/index.ts        ← imported by: shell/Sidebar, shell/InstrumentGrid,
                                        shell/SimulationShell, LabForgeApp

lib/constants.ts         ← imported by: lib/physics/ode, lib/physics/optics,
                                        lib/physics/electricity, instruments/ph-meter/engine,
                                        instruments/pendulum/types

lib/units.ts             ← imported by: lib/physics/ode, lib/physics/optics,
                                        ALL instrument engines, ALL App components

lib/physics/noise.ts     ← imported by: instruments/ph-meter/engine

lib/physics/ode.ts       ← imported by: instruments/pendulum/engine

lib/physics/optics.ts    ← imported by: ALL four optics instrument engines,
                                        lib/canvas/rays

lib/physics/electricity.ts ← imported by: instruments/ohm-circuit/engine

lib/canvas/grid.ts       ← imported by: lib/canvas/rays,
                                        ALL optics App components,
                                        instruments/pendulum/PendulumApp,
                                        instruments/ohm-circuit/OhmCircuitApp

lib/canvas/rays.ts       ← imported by: ALL four optics App components

store/labforgeStore.ts   ← imported by: shell/Sidebar, shell/TopBar, shell/SearchBar,
                                        shell/InstrumentGrid, shell/SimulationShell,
                                        shell/InstrumentCard, LabForgeApp

shell/ErrorBoundary.tsx  ← imported by: shell/SimulationShell
shell/LevelBadge.tsx     ← imported by: shell/InstrumentCard, shell/SimulationShell
shell/TopBar.tsx         ← imported by: LabForgeApp
shell/InstrumentCard.tsx ← imported by: shell/InstrumentGrid
shell/SearchBar.tsx      ← imported by: LabForgeApp
shell/Sidebar.tsx        ← imported by: LabForgeApp
shell/InstrumentGrid.tsx ← imported by: LabForgeApp
shell/SimulationShell.tsx ← imported by: LabForgeApp
```

**Golden Rule:** If a file is not listed as being imported by another file above, it MUST NOT be imported by it. Any unlisted import is an architecture violation.

---

## COMMON MISTAKES — ALL 27 FIXED

**Bug 1 — Store `setSearchQuery` sets `activeClass: undefined`**
→ Fixed: now always sets `activeClass: 'all'` (not undefined)

**Bug 2 — `dynamic()` inside `useMemo` breaks**
→ Fixed: use `useState<ComponentType|null>` + `useEffect` that creates `dynamic(meta.load, ...)` when ID changes

**Bug 3 — No logger file**
→ Fixed: `lib/logger.ts` is now FILE 0.0, built before everything else

**Bug 4 — `OBJECT_PRESETS` as a constant with focal-length-dependent values**
→ Fixed: replaced with `getPresets(focalLengthCm)` function that returns fresh values

**Bug 5 — `registry/index.ts` missing ScienceClass/Level imports**
→ Fixed: `import type { InstrumentMeta, ScienceClass, Level } from './types'`

**Bug 6–13 — Missing instrument `index.ts` barrel exports**
→ Fixed: all 7 instrument index files explicitly specified (one line each)

**Bug 14 — No TopBar/hamburger for mobile**
→ Fixed: `shell/TopBar.tsx` added as FILE 1.3

**Bug 15 — ph-meter relatedIds had 'convex-lens'**
→ Fixed: `relatedIds: ['chem-lab']`

**Bug 16 — pendulum relatedIds had 'ohm-circuit'**
→ Fixed: `relatedIds: []`

**Bug 17 — Vernier engine returned canvas pixel positions**
→ Fixed: engine returns pure mm values only, SVG positions calculated in the App component

**Bug 18 — `getLevelOrder()` exported but not implemented**
→ Fixed: full implementation provided using `Record<Level, number>`

**Bug 19 — No ResizeObserver for canvas**
→ Fixed: ResizeObserver pattern specified in Wave 2 header, required in all canvas instruments

**Bug 20 — No ErrorBoundary**
→ Fixed: `shell/ErrorBoundary.tsx` added as FILE 1.1, wraps every instrument in SimulationShell

**Bug 21 — No app/page.tsx shown**
→ Fixed: INTEGRATION section at top of document shows exact `app/page.tsx` content

**Bug 22 — Sidebar behaviour when instrument is open not specified**
→ Fixed: Sidebar spec now states: desktop = stays visible; mobile = collapses; class tab click = closes instrument

**Bug 23 — No package.json verification**
→ Fixed: PRE-BUILD CHECKLIST section added at top

**Bug 24 — No tsconfig.json verification**
→ Fixed: PRE-BUILD CHECKLIST section includes tsconfig check

**Bug 25–27 — No per-file TypeScript check command**
→ Fixed: `npx tsc --noEmit` added after every file specification

---

## BUILD CHECKLIST — WAVE BY WAVE

### Pre-Build
```bash
# Verify dependencies present:
cat package.json | grep -E "zustand|recharts|lucide-react"

# Verify tsconfig:
cat tsconfig.json | grep -E "strict|paths"
# Must see: "strict": true  and  "@/*": ["./src/*"]

# Baseline check (existing chem-lab should have zero errors):
npx tsc --noEmit
```

### After Wave 0
```bash
npx tsc --noEmit   # must show 0 errors
```
- [ ] `getClassDef('unknown')` throws
- [ ] `thinLensEquation(0.1, -0.3, 0.05)` returns `imageDistance > 0` (real image, v > 0)
- [ ] `mirrorEquation(0.05, -0.15, 0.03)` returns `imageDistance < 0` (real image, v < 0 for concave mirror)
- [ ] `rk4Step(f, 0, [0, 1], 0.01)` with `f = (t, y) => [y[1], -y[0]]` gives `y[0] ≈ 0.00995` (sine start)
- [ ] `gaussian(5, 0.01)` returns numbers close to 5 (run 10x)
- [ ] `formatSI(0.00123, 'F')` returns `'1.230 mF'`

### After Wave 1
```bash
npx tsc --noEmit
```
- [ ] `LabForgeApp` renders without React errors
- [ ] Clicking a class tab shows correct instruments
- [ ] Search 'pendulum' returns Pendulum card
- [ ] Back button returns to grid (instrument ID becomes null)
- [ ] ErrorBoundary shows fallback when instrument throws
- [ ] Sidebar stays visible on desktop when instrument is open

### After Wave 2
```bash
npx tsc --noEmit
```
- [ ] Convex lens: u=2f → v=2f, m=−1 (real, inverted, same size)
- [ ] Convex lens: u=0.5f → virtual image, m>1 (virtual, erect, enlarged)
- [ ] Convex lens: u=f → `isAtInfinity=true`, warning shown
- [ ] Concave lens: any u → always virtual, erect, diminished
- [ ] Concave mirror: u beyond C → real, inverted, diminished
- [ ] Concave mirror: u between F and P → virtual, erect, enlarged
- [ ] All four instruments render ray diagrams without console errors

### After Wave 3
```bash
npx tsc --noEmit
```
- [ ] L=1m, g=9.81 → T ≈ 2.006s displayed
- [ ] L=1m, g=1.62 (Moon) → T ≈ 4.945s (much longer)
- [ ] KE + PE ≈ constant (< 1% variation without damping)
- [ ] At θ=0 (bottom): KE maximum, PE minimum
- [ ] At θ=initial angle: KE=0, PE=maximum
- [ ] Trail fades correctly (last point opaque, oldest point near-transparent)

### After Wave 4
```bash
npx tsc --noEmit
```
- [ ] Series: 220Ω + 330Ω, V=12V → R_total=550Ω, I=21.8mA, V_R1=4.80V, V_R2=7.20V
- [ ] Parallel: 220Ω ∥ 330Ω, V=12V → R_total=132Ω, I_total=90.9mA
- [ ] V-I graph: straight line, slope = 1/R_total
- [ ] Operating point dot moves as voltage slider changes

### After Wave 5
```bash
npx tsc --noEmit
```
- [ ] Width=21.26mm, zero error=0 → corrected reading=21.26mm
- [ ] Width=21.26mm, zero error=+0.02mm → corrected reading=21.24mm
- [ ] Width=21.26mm → coincidingDivision=13
- [ ] Reading guide shows correct step-by-step breakdown

### After Wave 6
```bash
npx tsc --noEmit
```
- [ ] pH 7.00, T=25°C → mV = `−(8.314 × 298.15 / 96485) × 2.303 × 7 × 1000` ≈ −414.1 mV
- [ ] pH 7.00, T=37°C → different mV (Nernst slope changes with T)
- [ ] Solution colour: red at pH 1, green at pH 7, purple at pH 14
- [ ] Probe submersion animates smoothly
- [ ] Calibration flow completes and shows ✓

### After Wave 7
```bash
npx tsc --noEmit
npm run build   # full production build — zero errors
```
- [ ] Chemistry Lab opens inside LabForge from Chemistry class
- [ ] Back button closes Chemistry Lab and returns to Chemistry grid
- [ ] Chemistry Lab AI and Web Workers function normally
- [ ] `chem-lab` appears in Chemistry class only (correct scienceClass)

---

## DEEPSEEK PROMPT TEMPLATE — v2

```
Build FILE [X.Y]: `[path]`

CONTRACT: [paste CONTRACT line from spec]

IMPORTS — use exactly these, no others:
[paste imports block from spec]

EXPORTS — implement every one of these:
[paste exports block from spec]

IMPLEMENTATION NOTES:
[paste any implementation notes from spec]

RULES (every rule is non-negotiable):
1. TypeScript strict mode — no `any`, all functions have explicit return types
2. No console.log anywhere — use: import { logger } from '../lib/logger' (adjust path)
3. Every physics formula has a JSDoc comment with the equation written as text
4. ctx.save() at start + ctx.restore() at end of every canvas draw function
5. All imports must match the IMPORTS list above exactly — no extra imports
6. Handle edge cases: NaN → return fallback value (specified per function), division by zero → throw RangeError with message
7. If this file uses a canvas, implement the ResizeObserver pattern from Wave 2 header

After writing the file, run:
  npx tsc --noEmit

Only confirm complete when output shows ZERO TypeScript errors.
Do NOT start the next file until this one is confirmed.

Confirm with: "FILE [X.Y] [path] — COMPLETE. Zero TypeScript errors."
```

---

## QUICK REFERENCE — ALL FORMULAS

```
Thin Lens:       1/v − 1/u = 1/f        f>0 convex, u<0 real object, v>0 real image
Mirror:          1/v + 1/u = 1/f        f>0 concave, u<0 real object, v<0 real image
Magnification:   m = −v/u               m<0 inverted, |m|>1 enlarged
Lens Power:      P = 1/f               dioptres, f in metres
Snell's Law:     n₁sinθ₁ = n₂sinθ₂
Critical angle:  θc = arcsin(n₂/n₁)    only when n₁ > n₂
Mirror focal:    f = R/2

Pendulum ODE:    θ̈ = −(g/L)sin(θ) − b·θ̇
Small-angle T:   T = 2π√(L/g)
Bob KE:          KE = ½·m·L²·ω²
Bob PE:          PE = m·g·L·(1 − cosθ)
Bob position:    x = L·sinθ,  y = −L·cosθ

Ohm's Law:       V = IR
Series R:        R_T = R₁ + R₂ + R₃
Parallel R:      1/R_T = 1/R₁ + 1/R₂ + 1/R₃
Power:           P = VI = I²R = V²/R

Nernst (pH):     E = E° − (RT/nF)·2.303·pH
Nernst slope:    2.303·RT/F = 59.16 mV/pH at 25°C
                             = 61.54 mV/pH at 37°C

Vernier LC:      LC = 1 MSD/N = 1mm/50 = 0.02mm
Corrected:       reading − zero_error
```

---

*End of LabForge Specification v2.0.0*  
*Total source files: 43*  
*Waves: 7 (Wave 0 = 12 files, Wave 1 = 8 files, Waves 2–7 = instrument files)*  
*Instruments in v1: 9 (convex-lens, concave-lens, concave-mirror, convex-mirror, pendulum, ohm-circuit, vernier-caliper, ph-meter, chem-lab)*  
*To add a future instrument: one new folder in `instruments/`, one entry in `registry/index.ts`. Zero other changes.*
