# LabForge — Future Instruments Specification
**Version:** 1.0.0  
**Purpose:** Complete catalogue of every instrument to be built after the initial 8 are perfected.  
**Total instruments specified:** 43  
**Architecture:** All instruments follow the same pattern as the initial 8 — `types.ts`, `engine.ts`, `[Name]App.tsx`, `index.ts`, registered in `registry/index.ts`.

---

## HOW TO USE THIS DOCUMENT

For each instrument:
1. Add its registry entry to `src/labforge/registry/index.ts`
2. Create its folder under `src/labforge/instruments/[id]/`
3. Build in order: `types.ts` → `engine.ts` → `[Name]App.tsx` → `index.ts`
4. Run `npx tsc --noEmit` after every file

**Shared physics libraries to extend as you build:**
- Add new physics functions to the existing `lib/physics/` files when needed
- If a new physics domain is required, create a new file e.g. `lib/physics/nuclear.ts`
- Never write physics inside instrument files — always in `lib/physics/`

---

## BUILD PRIORITY ORDER

| Priority | Reason |
|----------|--------|
| 🥇 Tier 1 — Build next | Highest curriculum impact (KPTBB Class 9–10, O-Level) |
| 🥈 Tier 2 — Build after | University level, high student demand |
| 🥉 Tier 3 — Build later | Advanced / expert / specialised |

---

## CLASS 1 — OPTICS & LIGHT (5 more instruments)

---

### INSTRUMENT: `snells-law`
**Name:** Snell's Law & Refraction  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Light bends when crossing between two media. The degree of bending depends on the refractive indices of both media. Students adjust the incident angle and see refraction in real time. Total Internal Reflection (TIR) is demonstrated when the angle exceeds the critical angle.

**Physics engine — uses existing `lib/physics/optics.ts`:**
- `snellsLaw(n1, n2, angleDeg)` — already implemented
- `radiusToFocalLength` not needed here
- New function to add to optics.ts: `criticalAngle(n1, n2): number` — returns arcsin(n2/n1) in degrees when n1 > n2, else Infinity

**Controls:**
- Medium 1 selector: Air (1.000), Water (1.333), Glass (1.52), Diamond (2.417), Crown Glass (1.52), Flint Glass (1.62)
- Medium 2 selector: same list
- Angle of incidence slider: 0° to 89°

**Canvas — what to draw:**
- Two rectangular regions: top (medium 1), bottom (medium 2), divided by a horizontal boundary
- Incident ray: comes from top-left at user-set angle
- Normal line: vertical dashed line at the point of incidence
- Refracted ray: continues into medium 2 at calculated angle
- Reflected ray (always present): leaves at equal angle on the other side of normal
- When TIR occurs: no refracted ray, reflected ray only, boundary glows red
- Labels: θ₁ (incident angle arc), θ₂ (refracted angle arc)
- Medium labels at top/bottom with refractive index values

**Readouts:**
- n₁, n₂ values
- θ₁ (incident angle)
- θ₂ (refracted angle)  
- Critical angle (if n₁ > n₂)
- TIR indicator: "Total Internal Reflection!" warning banner when triggered
- Relative velocity: `c/n` for each medium

**Formula panel:**
```
n₁·sin(θ₁) = n₂·sin(θ₂)
sin(θ₂) = (n₁/n₂)·sin(θ₁)
θ₂ = arcsin((1.000/1.333) × sin(45°)) = 32.1°
```

**Applications:** Optical fibres, mirages, rainbows, swimming pool depth illusion

**Curricula:** KPTBB Class 10 Ch.12, O-Level Physics, A-Level Physics  
**Related IDs:** `convex-lens`, `prism-dispersion`, `fibre-optic`

---

### INSTRUMENT: `prism-dispersion`
**Name:** Prism & Dispersion  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
White light contains all colours. Different wavelengths refract at different angles through a prism, producing a visible spectrum (VIBGYOR). The refractive index of glass varies with wavelength — this is dispersion.

**Physics — add to `lib/physics/optics.ts`:**
```ts
/**
 * Cauchy's Equation: n(λ) = A + B/λ²
 * where λ is wavelength in nm, A and B are material constants.
 * For crown glass: A=1.523, B=4200
 * Returns refractive index at given wavelength.
 */
export function cauchyIndex(wavelengthNm: number, A: number, B: number): number

/**
 * Angle of deviation through a prism.
 * δ = (i + e) - A    where A = prism apex angle
 * i = angle of incidence, e = angle of emergence
 * Uses Snell's law twice (entry + exit faces).
 */
export function prismDeviation(
  apexAngleDeg: number,
  inciAngleDeg: number,
  refractiveIndex: number
): { deviationDeg: number; emergenceAngleDeg: number }
```

**Controls:**
- Prism apex angle: 30° to 70° (default 60°)
- Incident angle: 20° to 70°
- Material: Crown Glass, Flint Glass, Dense Flint Glass (different dispersion)
- Show: White light / Individual wavelengths / Both

**Canvas — what to draw:**
- Equilateral prism triangle in centre
- White ray enters prism from left
- Seven coloured rays emerge from right face (one per colour):
  - Violet 380nm (#8B00FF), Indigo 420nm (#4B0082), Blue 460nm (#0000FF)
  - Green 520nm (#00AA00), Yellow 580nm (#FFFF00), Orange 620nm (#FF8C00), Red 700nm (#FF0000)
- Each colour drawn as a separate line with different exit angle
- Spectrum fan visualised
- Angle of deviation labelled for red and violet

**Readouts:**
- n for each wavelength (violet highest, red lowest)
- Angle of deviation for red, violet
- Angular dispersion: `δ_violet - δ_red`

**Curricula:** KPTBB Class 10, O-Level Physics  
**Related IDs:** `snells-law`, `stellar-spectrograph`

---

### INSTRUMENT: `human-eye`
**Name:** Human Eye & Vision Defects  
**Level:** Student 🥇  
**AI:** explain

**What it teaches:**  
The eye forms an image on the retina using a flexible lens. When the lens cannot adjust properly, defects occur. Myopia (short-sightedness) — eyeball too long, image forms in front of retina. Hyperopia (long-sightedness) — eyeball too short. Presbyopia — lens stiffens with age. Students see the image position shift and understand the corrective lens used.

**Physics:** Uses `thinLensEquation` from optics.ts for both the eye lens and corrective lens.

**Controls:**
- Eye state selector: Normal, Myopia, Hyperopia, Presbyopia
- Object distance: 25 cm to 600 cm
- Corrective lens power: adjustable (for "wear glasses" mode)

**Canvas — cross-section diagram:**
- Anatomically accurate eye cross-section (SVG, not Canvas — for quality)
- Cornea, lens, vitreous humour, retina labeled
- Incoming parallel rays showing refraction through cornea + lens
- Image formation point: highlighted dot
  - Normal: exactly on retina (green)
  - Myopia: in front of retina (red), eyeball visually elongated
  - Hyperopia: behind retina (red), eyeball visually shortened
- When corrective lens placed: additional lens shape in front of eye, image moves to retina

**Readouts:**
- Defect name and cause
- Image position relative to retina
- Required lens: "Concave lens, power = −2.0 D" or "Convex lens, power = +1.5 D"
- Near point and far point for selected condition

**AI context:** Explains why the specific defect occurs, what the corrective lens does physically, and real-world implications (driving, reading, careers).

**Curricula:** KPTBB Class 10 Biology Ch.15, O-Level Biology, A-Level Biology  
**Related IDs:** `convex-lens`, `concave-lens`

---

### INSTRUMENT: `optics-bench`
**Name:** Optics Bench  
**Level:** Intermediate 🥈  
**AI:** none

**What it teaches:**  
A 120 cm optical rail where students place components and observe real light ray paths. More flexible than individual lens/mirror simulators — combines multiple optical elements.

**Physics:** Chain of `thinLensEquation` calls. Output image of first element = input object for second. Implements sequential ray tracing.

**Components available (user drags onto rail):**
- Convex lens (focal length adjustable)
- Concave lens (focal length adjustable)
- Plane mirror (perpendicular to rail)
- Concave mirror
- Convex mirror
- Object (lit arrow)
- Screen

**Controls:**
- Drag components along 120 cm rail
- Adjust each lens focal length
- Object height adjustable

**Canvas — overhead view of rail:**
- Horizontal dashed line = principal axis = the bench rail
- Components shown as symbols at their positions
- Rays traced through each component in sequence
- Where final image forms, show on screen or indicate position
- Measurement markings along the rail (every 10 cm)

**Readouts:**
- Position of each component
- Final image distance from last component
- Final image magnification (total = product of individual magnifications)
- Nature of final image

**Curricula:** A-Level Physics Practical, University Optics Lab  
**Related IDs:** `convex-lens`, `concave-mirror`

---

### INSTRUMENT: `ripple-tank`
**Name:** Ripple Tank & Wave Interference  
**Level:** Intermediate 🥈  
**AI:** explain

**What it teaches:**  
Water waves from one or two point sources interfere. Constructive interference (waves add) produces bright lines. Destructive interference (waves cancel) produces dark lines. Also demonstrates diffraction through slits.

**Physics — add to `lib/physics/waves.ts` (new file):**
```ts
/**
 * Wave amplitude at point (x, y) from a single point source at (sx, sy).
 * y(x,y,t) = A·sin(k·r - ω·t)   where r = distance from source, k = 2π/λ, ω = 2πf
 * Returns amplitude at this point and time.
 */
export function waveAmplitude(
  x: number, y: number,        // field point (metres)
  sx: number, sy: number,      // source position (metres)
  amplitude: number,           // metres
  wavelength: number,          // metres
  frequency: number,           // Hz
  time: number                 // seconds
): number

/**
 * Total amplitude from multiple sources (superposition).
 * sum of waveAmplitude() for each source.
 */
export function superpositionAmplitude(
  x: number, y: number,
  sources: Array<{ x: number; y: number }>,
  amplitude: number,
  wavelength: number,
  frequency: number,
  time: number
): number
```

**Canvas — 2D colour map:**
- Grid of pixels representing the water surface
- Each pixel colour encodes amplitude: bright = constructive (white/cyan), dark = destructive (black/dark blue)
- Updated every animation frame — creates animated wave pattern
- Users can place 1 or 2 source points (tap/click on canvas)
- Slit barrier mode: a vertical grey bar with 1 or 2 gaps, placed between sources and the far field
- Source positions shown as pulsing circles

**Controls:**
- Wavelength: 0.5 cm to 5 cm
- Frequency: 1 Hz to 20 Hz
- Number of sources: 1 or 2
- Source separation: 1 to 10 cm (two-source mode)
- Mode: point sources / single slit / double slit
- Slit width: 0.5 to 5 cm
- Slit separation: 1 to 10 cm

**Readouts:**
- Path difference at cursor position
- Fringe spacing formula: `Δy = λD/d` (where D = distance to screen, d = slit separation)
- Order of maximum at cursor

**AI context:** Explains the interference pattern being displayed, connects to Young's double slit experiment, explains why diffraction pattern width changes with slit width.

**Curricula:** A-Level Physics Waves, University Physics  
**Related IDs:** `sonometer`, `optics-bench`

---

## CLASS 2 — MECHANICS (7 more instruments)

---

### INSTRUMENT: `spring-hookes-law`
**Name:** Hooke's Law Spring  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Extension is proportional to force applied (within elastic limit). F = k·x. Beyond the elastic limit, the spring deforms permanently (the graph goes nonlinear).

**Physics — add to `lib/physics/mechanics.ts` (new file):**
```ts
/**
 * Hooke's Law: F = k·x
 * Returns extension x given force F and spring constant k.
 * Returns negative (compression) if F is negative.
 */
export function hookeExtension(forceN: number, springConstant: number): number

/**
 * Simple harmonic motion when spring released from extension x0.
 * x(t) = x0·cos(ω·t)   where ω = sqrt(k/m)
 * Returns displacement at time t.
 */
export function shm(x0: number, k: number, mass: number, t: number): number

/** Angular frequency of spring-mass system: ω = sqrt(k/m) */
export function shmOmega(k: number, mass: number): number

/** Period: T = 2π/ω = 2π·sqrt(m/k) */
export function shmPeriod(k: number, mass: number): number

/** Is the spring beyond elastic limit? True if extension > elasticLimitM */
export function beyondElasticLimit(extension: number, elasticLimitM: number): boolean
```

**Controls:**
- Spring constant k: 1 N/m to 500 N/m
- Hanging mass: add/remove 100g weights (click + or − buttons, max 10 weights = 1 kg)
- Release for SHM: toggle
- Show elastic limit: toggle (marks a threshold on the spring)

**Canvas — vertical spring diagram:**
- Ceiling attachment at top
- Spring drawn as coil (coil spacing decreases as mass increases, increases when compressed)
- Mass (box) at bottom with weight label
- Extension arrow between natural length mark and current bob position
- Extension vs Force graph draws dynamically as masses added (Recharts LineChart)
- When elastic limit exceeded: spring colour changes to red, graph goes nonlinear

**Readouts:**
- Applied force (F = m·g)
- Extension (x)
- k displayed
- Period T (when SHM enabled)
- KE, PE, TE bars (same as pendulum, when oscillating)

**Curricula:** KPTBB Class 10, O-Level Physics  
**Related IDs:** `pendulum`

---

### INSTRUMENT: `projectile-motion`
**Name:** Projectile Motion  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Horizontal and vertical components of motion are independent. Horizontal: constant velocity. Vertical: constant acceleration due to gravity. The trajectory is parabolic.

**Physics — in `lib/physics/mechanics.ts`:**
```ts
/**
 * Projectile position at time t.
 * x(t) = v0·cos(θ)·t
 * y(t) = h0 + v0·sin(θ)·t - ½·g·t²
 *
 * @param v0    initial speed (m/s)
 * @param theta launch angle (radians)
 * @param h0    launch height above ground (m)
 * @param g     gravitational acceleration (m/s²)
 * @param t     time (seconds)
 */
export function projectilePosition(
  v0: number, theta: number, h0: number, g: number, t: number
): { x: number; y: number; vx: number; vy: number }

/**
 * Time to hit the ground (y=0).
 * Solve: h0 + v0·sin(θ)·T - ½g·T² = 0
 */
export function timeOfFlight(v0: number, theta: number, h0: number, g: number): number

/** Maximum height reached: H = h0 + (v0·sin(θ))²/(2g) */
export function maxHeight(v0: number, theta: number, h0: number, g: number): number

/** Horizontal range: R = vx · timeOfFlight */
export function range(v0: number, theta: number, h0: number, g: number): number
```

**Controls:**
- Launch angle: 0° to 90°
- Initial speed: 1 to 300 m/s
- Launch height: 0 to 50 m
- Gravity: Moon / Earth / Mars / Jupiter
- Air resistance: toggle (adds drag force −b·v)
- Slow motion: 0.1× speed

**Canvas — 2D trajectory field:**
- Ground line at y=0
- Launch point at left
- Parabolic trajectory drawn as dotted path (full path shown)
- Moving projectile dot (filled circle)
- Velocity vector arrow on the dot (shows direction and magnitude)
- Maximum height horizontal dashed line with value
- Range measurement along ground
- Up to 3 simultaneous launches with different angles for comparison

**Readouts:**
- Max height
- Range
- Time of flight
- Launch velocity components (vx, vy)
- Final velocity on impact

**Curricula:** KPTBB Class 10 Physics, O-Level, GCSE  
**Related IDs:** `pendulum`, `spring-hookes-law`

---

### INSTRUMENT: `lever`
**Name:** Lever (Simple Machine)  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
First, second, and third class levers. Mechanical advantage = Load/Effort. The principle of moments: Force × Distance = Force × Distance.

**Physics — in `lib/physics/mechanics.ts`:**
```ts
/**
 * Moment (torque): M = F × d
 * where d is perpendicular distance from pivot.
 */
export function moment(force: number, distance: number): number

/**
 * Mechanical advantage: MA = Load / Effort
 * At equilibrium: Load × dL = Effort × dE → MA = dE/dL
 */
export function mechanicalAdvantage(effortDist: number, loadDist: number): number

/**
 * Lever class classification.
 * Class 1: Fulcrum between effort and load (scissors, seesaw)
 * Class 2: Load between fulcrum and effort (wheelbarrow, bottle opener)
 * Class 3: Effort between fulcrum and load (tweezers, arm)
 */
export function leverClass(
  fulcrumPos: number, effortPos: number, loadPos: number
): 1 | 2 | 3
```

**Controls:**
- Class selector: Class 1 / Class 2 / Class 3
- Load force: 1 to 500 N
- Load position: drag along lever arm
- Effort position: drag
- Fulcrum position: drag (Class 1 only)

**Canvas — horizontal lever diagram:**
- Lever bar (long horizontal rectangle)
- Fulcrum (triangle) at its position
- Load arrow pointing down with weight label
- Effort arrow pointing down or up depending on class
- Distance measurements along lever
- Balance indicator: lever tilts left/right if not balanced
- When balanced: level + green indicator
- Real-world example images for each class

**Readouts:**
- MA (mechanical advantage)
- Effort required to balance
- Moment of load, moment of effort
- "Balanced" / "Unbalanced" indicator

**Curricula:** KPTBB Class 6–8, O-Level Physics, GCSE  
**Related IDs:** `pulley`, `inclined-plane`

---

### INSTRUMENT: `pulley`
**Name:** Pulley System  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Pulleys reduce the effort needed to lift a load by increasing the number of ropes supporting the load. MA = number of rope segments supporting the load.

**Physics — in `lib/physics/mechanics.ts`:**
```ts
/**
 * Mechanical advantage of a pulley system.
 * Equal to the number of rope segments supporting the movable pulley.
 * MA = n (where n = number of supporting ropes)
 */
export function pulleyMA(supportingRopes: number): number

/**
 * Effort required: E = W/MA (ignoring friction)
 */
export function pulleyEffort(load: number, ma: number): number

/**
 * Distance moved by effort for unit distance moved by load.
 * Effort distance = MA × load distance
 */
export function effortDistance(loadDist: number, ma: number): number
```

**Controls:**
- Pulley type: Fixed / Single movable / Compound (2 movable) / Block and tackle (4 ropes)
- Load: 10 N to 1000 N

**Canvas — pulley diagram:**
- Ceiling attachment
- Fixed and movable pulleys shown as circles
- Rope drawn correctly through each pulley
- Load hanging from movable pulley
- Effort applied at rope end
- Animated: user pulls effort rope, load rises proportionally

**Readouts:**
- MA
- Effort required
- Number of rope sections

**Curricula:** KPTBB Class 7–8, O-Level  
**Related IDs:** `lever`

---

### INSTRUMENT: `inclined-plane`
**Name:** Inclined Plane  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
An inclined plane reduces the effort required to raise a load by increasing the distance over which the force is applied. Resolving forces along and perpendicular to the slope.

**Physics — in `lib/physics/mechanics.ts`:**
```ts
/**
 * Force components on an inclined plane.
 * Normal force: N = m·g·cos(θ)
 * Parallel force (gravity component along slope): Fg = m·g·sin(θ)
 * Friction force: f = μ·N = μ·m·g·cos(θ)
 * Net force along slope (if no applied effort): F_net = Fg - f (or Fg + f if opposing)
 */
export function inclinedPlaneForces(
  massKg: number,
  angleRad: number,
  frictionCoeff: number,
  gravity: number
): { normal: number; parallelGravity: number; friction: number; effortRequired: number }

/**
 * Work done: going up slope vs going straight up.
 * W_slope = F_effort × slope_length
 * W_vertical = m·g·h   (same in ideal case — law of conservation of energy)
 */
export function workDone(force: number, distance: number): number
```

**Controls:**
- Angle slider: 0° to 75°
- Mass of object: 0.1 to 50 kg
- Friction coefficient: 0 to 0.8
- Show force arrows: toggle

**Canvas — inclined plane diagram:**
- Triangle (the plane)
- Block on the slope
- Force arrows: weight (down), normal force (perpendicular to slope), friction (opposing motion), effort (up the slope)
- Height and length measurements

**Readouts:**
- Effort required to push block up slope
- Normal force
- Friction force
- MA = load/effort

**Curricula:** KPTBB Class 7–8, O-Level  
**Related IDs:** `lever`, `pulley`

---

### INSTRUMENT: `newtons-cradle`
**Name:** Newton's Cradle  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Conservation of momentum and energy in elastic collisions. When you pull back N balls, exactly N balls come out the other side.

**Physics — in `lib/physics/mechanics.ts`:**
```ts
/**
 * Elastic collision between identical balls.
 * In an elastic 1D collision between identical masses:
 * Ball 1 stops, ball 2 moves with ball 1's original velocity.
 * For N balls hitting a stationary chain:
 * N balls leave the other end with the original velocity.
 */
export function cradleCollision(
  numBallsRaised: number,   // 1 to 4
  initialVelocity: number,  // m/s
  totalBalls: number        // default 5
): Array<{ ballIndex: number; velocity: number }>

/** Pendulum-style swing for each raised ball. Uses rk4Step internally. */
export function cradleBallPosition(
  ballIndex: number,
  phase: 'raised' | 'swinging' | 'stationary',
  time: number,
  length: number,
  gravity: number
): { x: number; y: number }
```

**Controls:**
- Balls to raise: 1 / 2 / 3 / 4 (buttons)
- Speed: 0.5× / 1× / 2× / slow motion
- Energy loss: toggle (adds damping — balls gradually stop)

**Canvas — side view:**
- 5 steel balls on strings from a frame
- Balls swing and collide with physically accurate timing
- String lines visible
- Sound effect: click sound on each collision (Web Audio API — single sine burst)
- Trail: faint path behind raised balls

**Readouts:**
- Number of balls raised
- Impact velocity
- Total momentum (conserved)
- Total KE (conserved in elastic, decreasing when damping on)

**Curricula:** KPTBB Class 10, O-Level, GCSE  
**Related IDs:** `spring-hookes-law`

---

### INSTRUMENT: `doppler-effect`
**Name:** Doppler Effect  
**Level:** Intermediate 🥈  
**AI:** none

**What it teaches:**  
When a source moves toward an observer, sound waves compress (higher pitch). When it moves away, they expand (lower pitch). The ambulance siren sounds different when approaching vs receding.

**Physics — add to `lib/physics/waves.ts`:**
```ts
/**
 * Observed frequency (Doppler equation).
 * f_obs = f_source × (v_sound + v_observer) / (v_sound - v_source)
 *
 * Sign convention:
 *   v_observer positive when moving toward source
 *   v_source positive when moving toward observer
 *
 * @param fSource   source frequency (Hz)
 * @param vSound    speed of sound in medium (m/s), default 343 m/s at 20°C
 * @param vSource   source velocity (m/s)
 * @param vObserver observer velocity (m/s)
 */
export function dopplerFrequency(
  fSource: number,
  vSound: number,
  vSource: number,
  vObserver: number
): number
```

**Controls:**
- Source: stationary / moving left / moving right
- Source velocity: 0 to 300 m/s
- Observer: stationary / moving
- Observer velocity: 0 to 100 m/s
- Source type: car horn (440 Hz) / ambulance siren (700 Hz) / train whistle (500 Hz)

**Canvas — horizontal view:**
- Source (car icon) moving along a road
- Concentric circles = sound wavefronts emitting from source
  - Front side: circles compressed (shorter wavelength)
  - Back side: circles stretched (longer wavelength)
- Observer (person icon)
- Dashed line from source to observer with frequency label

**Audio:** Web Audio API oscillator at the observed frequency, toggleable.

**Readouts:**
- Emitted frequency
- Observed frequency (approaching)
- Observed frequency (receding)
- Pitch shift in semitones

**Curricula:** A-Level Physics, University Physics  
**Related IDs:** `sonometer`, `resonance-tube`

---

## CLASS 3 — ELECTRICITY & MAGNETISM (5 more instruments)

---

### INSTRUMENT: `multimeter`
**Name:** Digital Multimeter  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
How to use a multimeter: mode selection, probe placement, range switching, reading the display. Simulates voltage, current, resistance, continuity, frequency, and temperature measurements.

**Physics:** Uses `ohmsCurrent`, `ohmsVoltage`, `ohmsResistance` from electricity.ts. Adds noise using `gaussian` from noise.ts.

**Modes:**
| Mode | Range | Resolution |
|------|-------|-----------|
| DC Voltage | 200mV / 2V / 20V / 200V / 750V | 0.1mV in finest |
| AC Voltage | 200mV / 2V / 20V / 200V / 750V | — |
| DC Current | 2mA / 20mA / 200mA / 10A | — |
| Resistance | 200Ω / 2kΩ / 20kΩ / 200kΩ / 2MΩ | — |
| Continuity | Beep when < 20Ω | — |
| Diode | Forward voltage | — |
| Frequency | 10Hz to 1MHz | — |
| Temperature | −20 to 400°C | — |

**Controls:**
- Rotary dial selector (SVG — looks exactly like a real dial)
- "Measure" circuit selector: preset circuits to probe (battery, resistor, LED circuit, continuity test)
- Range button (manual vs auto range)

**Canvas — instrument view:**
- Photo-realistic DMM face (SVG)
- 4-digit LCD display (segmented display style)
- Bar graph below display (analogue representation)
- Rotary dial at centre — user clicks segments to rotate
- Two probe terminals (COM, V/Ω/mA, 10A)
- Probes animate to virtual circuit on the right side of screen

**Readouts:**
- Main 4-digit display (with correct decimal placement for selected range)
- "OL" (overload) when measurement exceeds range
- Range indicator
- Mode indicator

**Notes for realism:**
- Measurement noise: `gaussian(trueValue, 0.003 × trueValue)` 
- Overload: measuring 12V on 2V range → display shows "OL"
- Auto-range: cycles ranges until reading fills display properly

**Curricula:** KPTBB Class 10, O-Level Physics Practical  
**Related IDs:** `ohm-circuit`, `oscilloscope`

---

### INSTRUMENT: `oscilloscope`
**Name:** Digital Oscilloscope (DSO)  
**Level:** Advanced 🥈  
**AI:** explain

**What it teaches:**  
Measuring waveform shape, frequency, amplitude, duty cycle, phase. Reading a live waveform on a screen with time/div and V/div controls.

**Physics — add to `lib/physics/signals.ts` (new file):**
```ts
/**
 * Generate waveform sample array.
 * Returns N samples of the waveform at given time offsets.
 *
 * Types: 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise'
 */
export function generateWaveform(
  type: WaveformType,
  frequency: number,   // Hz
  amplitude: number,   // Volts peak
  dcOffset: number,    // Volts
  phase: number,       // radians
  sampleRate: number,  // samples per second
  numSamples: number   // how many to generate
): number[]

/**
 * Auto-measurements from a waveform sample array.
 */
export function autoMeasure(samples: number[], sampleRate: number): {
  frequency: number    // Hz
  period: number       // seconds
  vpp: number          // Volts peak-to-peak
  vrms: number         // RMS voltage
  vmax: number         // maximum voltage
  vmin: number         // minimum voltage
  dutyCycle: number    // % (for square wave)
  risetime: number     // seconds (10% to 90%)
}

/**
 * FFT — compute frequency spectrum.
 * Returns array of { frequency, magnitude } pairs.
 */
export function computeFFT(
  samples: number[],
  sampleRate: number
): Array<{ freq: number; mag: number }>
```

**Controls:**
- Channel 1 waveform: sine / square / triangle / sawtooth / DC / noise
- CH1 frequency: 0.1 Hz to 10 MHz
- CH1 amplitude: 10 mV to 10 V
- CH1 V/div: 1mV to 10V (10 steps)
- CH1 DC offset: ±10V
- Channel 2 same controls + phase offset vs CH1
- Time/div: 1ns to 10s (20 steps)
- Trigger: Auto / Normal / Single. Level and slope.
- Display mode: CH1 / CH2 / Both / FFT / X-Y (Lissajous)

**Canvas — oscilloscope display:**
- 8×10 division graticule (grid of 80 cells)
- Background: near-black `#0a0f0a`, grid lines: `rgba(0,200,0,0.15)`
- CH1 trace: bright green `#00ff41`
- CH2 trace: yellow `#ffff00`
- Trigger level: horizontal dashed red line, user drags
- Horizontal cursor pair (drag to measure time)
- Vertical cursor pair (drag to measure voltage)
- Auto-measurement panel below graticule (7 values)
- CH1/CH2 position arrows on left edge

**FFT mode:** Replace graticule with frequency domain plot. X = frequency (log scale), Y = magnitude (dB).

**AI context:** Explains what the displayed waveform represents, how to read Vpp/frequency, what a clipped waveform means.

**Readouts:**
- CH1 frequency, period, Vpp, Vrms, Vmax, Vmin, duty cycle
- CH2 same set
- Δ values when both channels shown (ΔV between cursors, Δt between cursors)
- FFT mode: dominant frequency, THD %, noise floor
- Overload indicator: "!OvL" when signal clips rail voltage
- Trigger status: Auto / Trig'd / Stop

**Curricula:** A-Level Physics Practical, University Electronics Lab  
**Related IDs:** `function-generator`, `multimeter`

---

### INSTRUMENT: `function-generator`
**Name:** Function Generator  
**Level:** Advanced 🥈  
**AI:** none

**What it teaches:**  
How to configure a signal source: waveform type, frequency, amplitude, DC offset. Paired with oscilloscope — generator makes the signal, oscilloscope displays it.

**Physics:** Uses `generateWaveform` from signals.ts

**Controls:**
- Waveform: Sine / Square / Triangle / Sawtooth / Pulse / Arbitrary
- Frequency: 0.01 Hz to 10 MHz (numeric keypad entry + coarse/fine rotary)
- Amplitude: 0 to 20 Vpp
- DC offset: −10 to +10 V
- Duty cycle: 5% to 95% (pulse/square only)
- Sweep mode: frequency sweeps from start to stop frequency over a set time

**Canvas — instrument face (SVG):**
- Looks like a real bench function generator (Rigol DG1000Z style)
- LCD display showing: waveform icon, frequency, amplitude, offset
- 6 waveform buttons (one per type)
- Numeric keypad (0–9, ., ×1k, ×1M, Enter)
- Rotary encoder simulation (click/drag to adjust highlighted parameter)
- Output BNC connector (with virtual cable to oscilloscope)

**When paired with oscilloscope:**
- Both can be open as a split view
- Signal from function generator automatically appears on CH1 of oscilloscope

**Readouts:**
- Active waveform type
- Frequency (Hz / kHz / MHz with auto prefix)
- Amplitude Vpp
- DC offset
- Duty cycle (pulse/square only)
- Output status: ON / OFF
- Impedance: 50Ω / High-Z indicator

**Curricula:** A-Level Physics, University Electronics  
**Related IDs:** `oscilloscope`

---

### INSTRUMENT: `wheatstone-bridge`
**Name:** Wheatstone Bridge  
**Level:** Intermediate 🥈  
**AI:** none

**What it teaches:**  
A circuit for precise resistance measurement. Balance condition: R1/R2 = R3/R4. When balanced, galvanometer reads zero. Used to find unknown resistance.

**Physics — in `lib/physics/electricity.ts`:**
```ts
/**
 * Wheatstone bridge galvanometer current.
 * Uses Kirchhoff's laws to find current through galvanometer arm.
 * Returns 0 when R1/R2 = R3/Rx (balanced).
 */
export function wheatstoneCurrent(
  R1: number, R2: number, R3: number, Rx: number,
  voltage: number, Rg: number
): number

/**
 * Unknown resistance at balance: Rx = R3 × R2/R1
 */
export function wheatstoneUnknown(R1: number, R2: number, R3: number): number
```

**Controls:**
- R1, R2 (ratio arms): 10Ω to 10kΩ
- R3 (variable arm): 1Ω to 10kΩ
- Rx (unknown): reveal after balancing

**Canvas — diamond circuit:**
- Four nodes connected in diamond shape
- Four resistors on the four arms
- Battery connected across one diagonal
- Galvanometer across the other diagonal
- Galvanometer needle deflects left/right based on bridge imbalance
- Galvanometer reads zero at balance (needle central)

**Readouts:**
- Galvanometer current (positive = deflects right, negative = left)
- Ratio R1/R2
- Balance indicator
- Calculated Rx when balanced

**Curricula:** A-Level Physics, University Lab  
**Related IDs:** `ohm-circuit`, `multimeter`

---

### INSTRUMENT: `dc-power-supply`
**Name:** DC Power Supply  
**Level:** Intermediate 🥈  
**AI:** none

**What it teaches:**  
How a bench power supply works: constant voltage (CV) mode, constant current (CC) mode, voltage and current limiting, over-voltage protection.

**Physics:**
- CV mode: output voltage = set value, current limited by load R
- CC mode: output current = set value, voltage adjusts to maintain it
- Mode switches when: CV: load R drops below V_set/I_limit → switches to CC

**Controls:**
- Voltage knob (coarse + fine): 0 to 30 V
- Current knob: 0 to 3 A
- Output ON/OFF
- Load selector: connect to virtual resistor (1Ω to 1kΩ) or short circuit

**Canvas — instrument face:**
- Looks like a dual-output bench PSU
- Two voltmeters (V) and two ammeters (A) for each channel — large numeric displays
- CV/CC indicator LED (green = CV, amber = CC)
- OUTPUT button

**Readouts:**
- Actual output voltage
- Actual output current
- Power delivered = V × I
- Mode: CV / CC

**Curricula:** University Electronics Lab  
**Related IDs:** `ohm-circuit`, `oscilloscope`

---

## CLASS 4 — WAVES & SOUND (4 instruments)

---

### INSTRUMENT: `sonometer`
**Name:** Sonometer (Melde's Experiment)  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
A stretched string vibrates at its fundamental frequency. f = (1/2L)·sqrt(T/μ) where L = length, T = tension, μ = linear density. Harmonics (overtones) produce standing waves with nodes and antinodes.

**Physics — add to `lib/physics/waves.ts`:**
```ts
/**
 * Fundamental frequency of a vibrating string.
 * f = (1/2L)·sqrt(T/μ)
 *
 * @param L  length in metres
 * @param T  tension in Newtons
 * @param mu linear mass density kg/m
 */
export function stringFrequency(L: number, T: number, mu: number): number

/**
 * nth harmonic frequency.
 * fn = n · f1
 */
export function harmonicFrequency(f1: number, n: number): number

/**
 * Position of nodes for nth harmonic.
 * Nodes at: 0, L/n, 2L/n, ..., L
 * Returns array of node positions (metres from left end).
 */
export function nodePositions(L: number, n: number): number[]

/** Standing wave displacement at position x and time t. */
export function standingWave(
  x: number, t: number, L: number,
  amplitude: number, frequency: number, harmonic: number
): number
```

**Controls:**
- String length: 20 cm to 200 cm (adjust with peg)
- Tension: add masses (100g each, up to 5 kg)
- Linear density: select wire gauge (3 options)
- Harmonic mode: 1st / 2nd / 3rd / 4th
- Driving frequency: match slider to fundamental for resonance

**Canvas — horizontal string view:**
- String stretched between two pegs
- Standing wave animation: string oscillates with nodes and antinodes visible
- Node points: filled circles on string where amplitude = 0
- Antinode points: maximum oscillation amplitude
- Mass hanging below one peg (shows tension)
- Frequency readout updates live as controls change

**Readouts:**
- Fundamental frequency f₁
- Selected harmonic fn
- Wave speed v = f·λ
- Wavelength λ = 2L/n

**Audio:** Plays a tone at the fundamental frequency (Web Audio oscillator).

**Curricula:** KPTBB Class 10, O-Level Physics  
**Related IDs:** `resonance-tube`, `doppler-effect`

---

### INSTRUMENT: `resonance-tube`
**Name:** Resonance Tube  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Sound resonates in a tube at specific lengths. For a closed tube: L = λ/4, 3λ/4, 5λ/4... For an open tube: L = λ/2, λ, 3λ/2... Used to measure the speed of sound.

**Physics — uses `stringFrequency` pattern, add:**
```ts
/**
 * Resonant lengths for closed pipe (closed at one end).
 * Resonance when L = (2n-1)λ/4   (n = 1, 2, 3...)
 * Returns array of resonant lengths for n = 1 to maxN.
 */
export function closedPipeResonantLengths(
  wavelength: number, maxN?: number
): number[]

/**
 * Resonant lengths for open pipe (open at both ends).
 * Resonance when L = n·λ/2
 */
export function openPipeResonantLengths(
  wavelength: number, maxN?: number
): number[]

/**
 * Speed of sound from resonance experiment.
 * v = f × λ.  λ determined from two successive resonance lengths: λ = 2·(L2 - L1)
 */
export function speedOfSound(f: number, L1: number, L2: number): number
```

**Controls:**
- Tuning fork frequency: 256 Hz / 320 Hz / 384 Hz / 512 Hz (standard forks)
- Tube length: 0 to 120 cm (adjustable)
- Tube type: closed / open
- Water level (closed tube) — fills from bottom, adjusting effective length

**Canvas — vertical tube view:**
- Glass tube, vertical
- Water level shown in blue (for closed tube variant)
- Tuning fork at top vibrating
- Standing wave pattern inside tube: displacement nodes/antinodes shown as colour overlay
- Resonance indicator: tube glows when at resonant length

**Readouts:**
- Current tube length
- Resonant lengths for first 3 harmonics
- Calculated speed of sound (from resonance positions)
- Frequency

**Curricula:** KPTBB Class 10, O-Level  
**Related IDs:** `sonometer`

---

### INSTRUMENT: `wave-properties`
**Name:** Wave Properties  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
All the vocabulary and properties of waves: amplitude, wavelength, frequency, period, speed, crests, troughs. Transverse vs longitudinal. Speed = frequency × wavelength.

**Physics:**
```ts
/** v = f × λ */
export function waveSpeed(frequency: number, wavelength: number): number
/** f = 1/T */
export function frequencyFromPeriod(period: number): number
/** y(x,t) = A·sin(2π(x/λ - t/T)) */
export function waveDisplacement(x,t,A,lambda,period): number
```

**Controls:**
- Amplitude: 0.5 to 5 units
- Wavelength: 1 to 10 units
- Frequency: 0.1 to 5 Hz
- Type: Transverse / Longitudinal
- Show labels: toggle (crest, trough, amplitude, wavelength arrows)

**Canvas:**
- Transverse: classic sine wave with labelled features
- Longitudinal: compression/rarefaction animated particle dots

**Readouts:**
- Wave speed
- Period
- All user-set values displayed

**Curricula:** KPTBB Class 10, O-Level, GCSE first waves lesson  
**Related IDs:** `sonometer`, `ripple-tank`

---

### INSTRUMENT: `spectrum-analyser`
**Name:** Spectrum Analyser  
**Level:** Advanced 🥉  
**AI:** none

**What it teaches:**  
Real-time frequency domain display of a signal. Shows which frequency components are present and their relative magnitudes. Uses FFT.

**Physics:** Uses `computeFFT` from signals.ts.

**Controls:**
- Input: select preset signals (pure sine / square / triangle / music note / voice approximation)
- Frequency range: 20 Hz to 20 kHz (audio) or 0 to 10 MHz (RF mode)
- Time window: 1 ms to 100 ms
- Window function: Rectangular / Hanning / Hamming / Blackman

**Canvas — frequency domain display:**
- X axis: frequency (linear or log)
- Y axis: magnitude in dBV or linear
- Vertical bars or line trace for spectrum
- Peak markers with frequency labels
- Noise floor visible (when selected)

**Readouts:**
- Fundamental frequency
- Top 5 harmonics with magnitudes
- THD (Total Harmonic Distortion) %

**Curricula:** University DSP, Electronics Engineering  
**Related IDs:** `oscilloscope`, `function-generator`

---

## CLASS 5 — CHEMISTRY (5 more instruments)

---

### INSTRUMENT: `titration`
**Name:** Acid-Base Titration  
**Level:** Student 🥇  
**AI:** explain

**What it teaches:**  
Adding base to acid (or vice versa) until neutralisation is complete. The equivalence point is determined by an indicator colour change. The S-curve of pH vs volume added is the signature of a titration.

**Physics — add to `lib/physics/chemistry.ts` (new file):**
```ts
/**
 * pH during titration of strong acid with strong base.
 *
 * Before equivalence: pH from excess acid
 * At equivalence: pH = 7.0 (strong-strong)
 * After equivalence: pH from excess base
 *
 * @param molesSA  moles of strong acid (initial)
 * @param molesSB  moles of strong base added so far
 * @param totalVolL total volume of solution in litres
 */
export function titrationPH(
  molesSA: number, molesSB: number, totalVolL: number
): number

/**
 * pH during titration of weak acid with strong base.
 * Uses Henderson-Hasselbalch equation near equivalence.
 * Henderson-Hasselbalch: pH = pKa + log([A-]/[HA])
 */
export function weakAcidTitrationPH(
  molesWA: number, molesSB: number, totalVolL: number, pKa: number
): number

/** Indicator colour at given pH */
export function indicatorColor(ph: number, indicator: IndicatorType): string
```

**Indicator types and colour changes:**
| Indicator | Acid colour | Transition range | Base colour |
|-----------|-------------|-----------------|-------------|
| Phenolphthalein | Colourless | pH 8.0–10.0 | Pink |
| Methyl Orange | Red | pH 3.1–4.4 | Yellow |
| Litmus | Red | pH 6.0–8.0 | Blue |
| Bromothymol Blue | Yellow | pH 6.0–7.6 | Blue |

**Controls:**
- Acid type: HCl / H₂SO₄ / CH₃COOH (weak)
- Acid concentration: 0.01 to 2 mol/L
- Acid volume: 10 to 50 mL
- Base type: NaOH / KOH
- Base concentration: 0.01 to 2 mol/L
- Indicator: 4 choices
- Add base: 1 drop (0.05 mL) / 0.1 mL / 1 mL / 5 mL buttons

**Canvas — left side:**
- 50 mL burette with base, graduation markings
- Burette reading (liquid level)
- Conical flask with acid + indicator (colour changes during titration)
- Base dripping from burette tip (animated drops)

**Chart — right side:**
- Recharts LineChart: X = volume added (mL), Y = pH
- S-curve building as user adds base
- Equivalence point marked with vertical dashed line at the inflection
- Indicator colour range shaded on chart
- Buffer region highlighted for weak acid titration

**AI context:** Explains what is happening chemically at each stage, identifies equivalence point, explains indicator choice.

**Readouts:**
- Volume of titrant added (mL, 2 decimal places)
- Current pH of solution in flask
- Equivalence point volume (shown after inflection detected)
- Moles of acid, moles of base added
- Calculated concentration of unknown (if acid conc known)
- Buffer capacity at current point (weak acid mode only)
- Indicator colour name: "Colourless → Pale Pink (endpoint)"

**Curricula:** KPTBB Class 10 Chemistry, O-Level Chemistry, A-Level Chemistry  
**Related IDs:** `ph-meter`, `chem-lab`

---

### INSTRUMENT: `colorimeter`
**Name:** Colorimeter  
**Level:** Intermediate 🥈  
**AI:** none

**What it teaches:**  
Beer-Lambert Law: A = ε·c·l. Absorbance is proportional to concentration. Used to determine unknown concentrations from a calibration curve.

**Physics — in `lib/physics/chemistry.ts`:**
```ts
/**
 * Beer-Lambert Law: A = ε·c·l
 * A = absorbance (dimensionless)
 * ε = molar absorptivity (L/(mol·cm))
 * c = concentration (mol/L)
 * l = path length (cm)
 */
export function absorbance(epsilon: number, concentration: number, pathLength: number): number

/**
 * Percent transmittance: %T = 10^(2-A) × 100 ≈ 100 × 10^(-A)
 */
export function transmittance(absorbance: number): number

/**
 * Unknown concentration from measured absorbance using calibration gradient.
 * c = A / (ε·l)
 */
export function concentrationFromAbsorbance(A: number, epsilon: number, l: number): number
```

**Controls:**
- Solution: select from 10 coloured solutions (copper sulfate, potassium permanganate, etc.)
- Filter wavelength: 430nm (blue) / 470nm (cyan) / 565nm (green) / 635nm (red)
- Concentration: build calibration curve by entering known concentrations
- Unknown mode: set unknown concentration, read from graph

**Canvas — instrument + calibration chart:**
- Colorimeter SVG: box with LED, sample cuvette, detector
- Display: %T and A values
- Recharts ScatterChart: calibration curve (A vs concentration)
- Straight line fit to calibration points
- Unknown sample marked on line → reads off concentration

**Readouts:**
- %T (percent transmittance)
- A (absorbance)
- Calculated concentration

**Curricula:** A-Level Chemistry, University Analytical Chemistry  
**Related IDs:** `ph-meter`

---

### INSTRUMENT: `electrolysis`
**Name:** Electrolysis Cell  
**Level:** Intermediate 🥈  
**AI:** explain

**What it teaches:**  
Passing electric current through an electrolyte decomposes it. Faraday's Laws: mass deposited ∝ charge passed. Different electrode and electrolyte combinations give different products.

**Physics — in `lib/physics/chemistry.ts`:**
```ts
/**
 * Faraday's First Law: m = (M × I × t) / (n × F)
 * m = mass deposited (grams)
 * M = molar mass of element (g/mol)
 * I = current (Amperes)
 * t = time (seconds)
 * n = number of electrons transferred
 * F = Faraday constant
 */
export function massDeposited(
  molarMass: number, current: number, timeS: number,
  electrons: number, faraday: number
): number

/**
 * Volume of gas produced at electrode (dm³ at STP).
 * V = (moles of gas) × 22.4
 */
export function gasVolume(moles: number): number
```

**Controls:**
- Electrolyte: copper sulfate / sodium chloride / sulfuric acid / silver nitrate / water / lead bromide
- Anode material: copper / platinum / graphite / zinc / silver / gold
- Cathode material: same list
- Current: 0.1 to 5 A (set voltage + resistance)
- Time: pause/play, speed ×1 / ×5 / ×10

**Canvas — cell view:**
- Two electrodes in a beaker of electrolyte
- Electrode colour changes as metal deposits (copper cathode turns orange as copper plates)
- Gas bubbles at electrodes (H₂ at cathode, O₂ or Cl₂ at anode depending on electrolyte)
- Electrolyte colour fades over time (copper sulfate becomes pale as Cu²⁺ depletes)
- Wires connect to battery/power supply

**Readouts:**
- Charge passed (Q = I × t)
- Mass deposited at cathode
- Gas volume produced
- Products at each electrode (identified by substance)

**AI context:** Names the electrode reactions (half-equations), explains why certain products form, connects to industrial applications.

**Curricula:** KPTBB Class 10 Chemistry, O-Level Chemistry  
**Related IDs:** `chem-lab`, `dc-power-supply`

---

### INSTRUMENT: `chromatography`
**Name:** Paper Chromatography  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Different compounds travel different distances through paper as solvent moves. Rf value = distance moved by compound / distance moved by solvent front. Used to identify unknowns.

**Physics:**
- Rf = d_compound / d_solvent (dimensionless, 0 to 1)
- Each compound has a characteristic Rf for a given solvent polarity

**Controls:**
- Sample spots: add up to 6 coloured compounds from a list of 15
- Solvent polarity: non-polar / medium / polar (changes all Rf values)
- Time: watch chromatogram develop (animated)

**Canvas — vertical paper strip:**
- White paper strip
- Sample spots at bottom (coloured dots)
- Solvent front line moving up
- Compound spots moving up at different rates (each with its Rf × solvent distance)
- Ruler along the side
- Rf measurement tool: user clicks a spot to read its Rf

**Readouts:**
- Rf values for each spot
- Solvent front distance
- Identification: if Rf matches reference, name shown

**Curricula:** KPTBB Class 9–10, O-Level Chemistry  
**Related IDs:** `colorimeter`

---

### INSTRUMENT: `distillation`
**Name:** Distillation Apparatus  
**Level:** Intermediate 🥈  
**AI:** none

**What it teaches:**  
Separation of mixtures by boiling point difference. Simple distillation for widely different boiling points. Fractional distillation for closer boiling points (e.g. ethanol/water, crude oil).

**Physics — in `lib/physics/chemistry.ts`:**
```ts
/**
 * Vapour pressure at temperature T (Antoine equation).
 * log10(P) = A - B/(C+T)   where T in Celsius, P in mmHg.
 * Antoine constants A, B, C are substance-specific.
 */
export function vapourPressure(tempC: number, A: number, B: number, C: number): number

/**
 * Boiling point: temperature where vapour pressure = atmospheric pressure.
 * Solve antonine equation for T where P = 760 mmHg.
 */
export function boilingPoint(A: number, B: number, C: number, pressureMMHg?: number): number
```

**Controls:**
- Mixture: ethanol/water / seawater / crude oil fractions / acetone/water
- Heat rate: low / medium / high
- Fractional column: on/off

**Canvas — apparatus diagram (SVG):**
- Round-bottom flask with mixture + heating mantle
- Thermometer in flask neck
- Liebig condenser (cold water in, cold water out)
- Collection flask(s) for distillate
- Temperature gauge reading rises during heating
- Vapour rises up flask neck and through condenser
- Liquid collects in collection flask
- Crude oil mode: multiple collection points at different temperature ranges

**Readouts:**
- Current temperature
- Fraction being collected
- Volume collected
- Purity estimate

**Curricula:** KPTBB Class 10 Chemistry, O-Level Chemistry  
**Related IDs:** `chem-lab`

---

## CLASS 6 — BIOLOGY & MEDICINE (4 instruments)

---

### INSTRUMENT: `microscope`
**Name:** Light Microscope  
**Level:** Student 🥇  
**AI:** identify

**What it teaches:**  
How a compound microscope works. Objective magnification × eyepiece magnification = total magnification. Coarse and fine focus. Different specimens at different magnifications.

**Controls:**
- Objective: ×4 / ×10 / ×40 / ×100 (oil immersion)
- Eyepiece: ×10 (fixed in most school scopes)
- Coarse focus: large slider (big blur to rough focus)
- Fine focus: small slider (fine adjustment, ±1 unit range)
- Illumination: 0 to 100%
- Slide selector: 16 prepared slides

**Canvas — circular microscope field of view:**
- Real photomicrograph images scaled to correct magnification
- Blur filter applied — user adjusts focus until sharp
- Dark vignette at edges (the circular field of view)
- Scale bar in the field of view (updates with magnification)

**16 prepared slides:**
- Onion cell (shows cell wall, vacuole)
- Cheek cell (shows nucleus, cell membrane)
- Blood smear (erythrocytes, leukocytes, platelets)
- Root tip (mitosis stages visible at ×40/×100)
- Leaf cross-section (palisade, spongy mesophyll, stomata)
- Paramecium (cilia, food vacuoles)
- Bacteria (rod, sphere, spiral at ×100)
- Cork cells (Robert Hooke's original observation)
- Spirogyra (spiral chloroplasts)
- Pollen grains (variety of shapes)
- Potato starch (stained with iodine)
- Muscle fibres (striated)
- Neuron smear
- Hydra cross-section
- Kidney tissue (glomerulus)
- Stem cross-section (vascular bundles)

**Readouts:**
- Total magnification
- Scale bar value
- Slide name and brief description

**AI context:** When user asks "what am I looking at?", AI identifies the structures visible at the current magnification and explains their function.

**Physics:**
```ts
// No ODE solver needed — microscope is optical/geometric.
// Key relationships:

/**
 * Total magnification = objective × eyepiece
 * totalMag(4, 10) → 40
 */
export function totalMagnification(objective: number, eyepiece: number): number

/**
 * Scale bar length in micrometres for display.
 * scaleBarMicrons(40) → 25μm (a 25μm bar fits cleanly at ×40)
 */
export function scaleBarMicrons(totalMag: number): number

/**
 * Focus blur factor: 0 = perfect, 1 = completely blurred.
 * blur = |focusPosition - sharpPosition| / maxOffset
 * Used to apply CSS blur filter: blur(blurFactor × 8px)
 */
export function focusBlur(
  focusSliderValue: number,    // 0 to 1000
  sharpValue: number,          // correct value for current slide+objective
  maxOffset: number            // range within which focus is valid (± this)
): number   // 0 = sharp, 1 = max blur
```

**Curricula:** KPTBB Class 9 Biology, O-Level Biology  
**Related IDs:** `ecg-monitor`

---

### INSTRUMENT: `ecg-monitor`
**Name:** ECG Monitor (Electrocardiograph)  
**Level:** Intermediate 🥈  
**AI:** identify

**What it teaches:**  
The heart's electrical activity traced over time. How to read a 12-lead ECG. P wave (atrial depolarisation), QRS complex (ventricular depolarisation), T wave (ventricular repolarisation). Identifying normal and abnormal rhythms.

**Physics — add to `lib/physics/biosignals.ts` (new file):**
```ts
/**
 * Generate ECG waveform sample for a given rhythm.
 * Returns array of voltage samples at the given sample rate.
 *
 * Each cardiac cycle contains: P wave, PR segment, QRS complex, ST segment, T wave
 * Mathematical model: sum of Gaussian peaks at correct time positions.
 */
export function generateECG(
  rhythm: ECGRhythm,
  durationS: number,
  sampleRate: number  // default 500 Hz (2ms resolution)
): number[]

/** Auto-measure ECG: HR, PR interval, QRS duration, QT interval */
export function measureECG(samples: number[], sampleRate: number): {
  heartRateBPM: number
  prIntervalMs: number
  qrsDurationMs: number
  qtIntervalMs: number
  qtcMs: number        // Bazett's correction: QTc = QT/sqrt(RR)
  rhythm: ECGRhythm
}
```

**Rhythm types:**
| ID | Name | HR | Description |
|----|------|----|-------------|
| `nsr` | Normal Sinus Rhythm | 60–100 | Regular P→QRS→T sequence |
| `tachy` | Sinus Tachycardia | 101–150 | Fast but regular |
| `brady` | Sinus Bradycardia | 40–60 | Slow but regular |
| `afib` | Atrial Fibrillation | 60–160 | Irregular, no clear P waves |
| `vtach` | Ventricular Tachycardia | 120–200 | Wide QRS, fast |
| `vfib` | Ventricular Fibrillation | — | Chaotic, no recognisable complexes |
| `hb1` | 1st Degree Heart Block | 60–80 | Prolonged PR interval (>200ms) |
| `hb2` | 2nd Degree Heart Block | Variable | Some P waves not followed by QRS |
| `hb3` | 3rd Degree Heart Block | 20–40 | P and QRS completely dissociated |

**Controls:**
- Rhythm selector
- Paper speed: 25 mm/s / 50 mm/s
- Lead: I / II / III / aVR / aVL / aVF / V1–V6

**Canvas — ECG trace:**
- Pink/cream background with 1mm and 5mm grid lines (authentic ECG paper colours)
- Trace scrolls continuously from right to left
- Lead label in top-left
- HR and current time displayed
- User can pause and use calipers (vertical lines) to measure intervals

**Readouts:**
- Heart rate (BPM)
- PR interval (ms)
- QRS duration (ms)
- QT interval (ms)
- Rhythm interpretation

**AI context:** Identifies the rhythm, names the key features visible, explains clinical significance.

**Curricula:** A-Level Biology, Nursing, Pre-med, MBBS  
**Related IDs:** `blood-pressure-monitor`, `spirometer`

---

### INSTRUMENT: `blood-pressure-monitor`
**Name:** Blood Pressure Monitor  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Systolic and diastolic pressure. Korotkoff sounds. Normal ranges and what high/low BP means.

**Physics:**
```ts
/**
 * Korotkoff sounds appear when cuff pressure drops below systolic
 * and disappear when it drops below diastolic.
 * Model the pressure-time trace as an exponential decay.
 */
export function cuffPressureAtTime(
  startPressure: number,   // mmHg (start inflation, e.g. 180)
  deflateRate: number,     // mmHg/s
  time: number             // seconds
): number

export function korotkoffSound(
  cuffPressure: number,
  systolic: number,
  diastolic: number
): 'silent' | 'sound'
```

**Controls:**
- Patient: Normal / Hypertensive / Hypotensive / Athletic
- Inflation: user presses inflate button (cuff inflates to 180 mmHg)
- Deflation: user slowly releases (slider or auto-deflate button)

**Canvas — sphygmomanometer:**
- Cuff on arm illustration
- Pressure gauge dial with needle
- Korotkoff sound waveform (small scope showing sounds as pulses)
- When sound starts: mark systolic
- When sound ends: mark diastolic

**Readouts:**
- Systolic/Diastolic (revealed after correct measurement)
- MAP (mean arterial pressure) = Diastolic + ⅓(Systolic − Diastolic)
- Classification: Normal / Elevated / Stage 1 HT / Stage 2 HT

**Curricula:** KPTBB Class 9 Biology, O-Level Biology, Nursing  
**Related IDs:** `ecg-monitor`

---

### INSTRUMENT: `spirometer`
**Name:** Spirometer  
**Level:** Intermediate 🥈  
**AI:** identify

**What it teaches:**  
Lung volumes and capacities. Tidal volume (normal breathing), FVC (forced vital capacity), FEV1 (forced expiratory volume in 1 second). Identifying obstructive vs restrictive patterns.

**Physics:**
```ts
/**
 * FEV1/FVC ratio indicates lung function pattern.
 * Normal: > 0.70
 * Obstructive (asthma, COPD): < 0.70 (FVC near normal, FEV1 reduced)
 * Restrictive (pulmonary fibrosis): > 0.70 (both FVC and FEV1 reduced)
 */
export function fev1FvcRatio(fev1: number, fvc: number): number

/** Predicted FVC based on age, height, sex (simplified Knudson equations) */
export function predictedFVC(ageyears: number, heightCm: number, male: boolean): number
```

**Controls:**
- Patient: Normal adult / Asthma / COPD / Pulmonary fibrosis / Athlete
- Manoeuvre buttons:
  - [Normal Breathing] — user presses repeatedly for tidal breathing
  - [Deep Breath + Forced Exhale] — FVC manoeuvre

**Canvas — volume-time and flow-volume loop:**
- Upper chart: Volume vs Time (volume-time spirogram)
  - Normal breathing shown as regular oscillation
  - FVC manoeuvre: rapid rise to TLC then forced exhale to RV
  - FEV1 marked at 1 second point
- Lower chart: Flow-Volume loop (Flow on Y, Volume on X)
  - Shape changes with pathology

**Readouts:**
- FVC, FEV1, FEV1/FVC
- TLC estimate, RV estimate
- Pattern interpretation: "Obstructive pattern" / "Normal" / "Restrictive"
- % predicted values

**AI context:** Explains what the flow-volume curve shape indicates, names the pattern, connects to clinical conditions.

**Curricula:** A-Level Biology, Pre-med  
**Related IDs:** `ecg-monitor`

---

## CLASS 7 — THERMODYNAMICS (3 instruments)

---

### INSTRUMENT: `boyles-law`
**Name:** Boyle's Law  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
At constant temperature, pressure × volume = constant (for an ideal gas). P₁V₁ = P₂V₂.

**Physics — add to `lib/physics/thermodynamics.ts` (new file):**
```ts
/**
 * Ideal Gas Law: PV = nRT
 * P in Pa, V in m³, T in K, n in mol, R = 8.314 J/(mol·K)
 */
export function idealGasPressure(n: number, T: number, V: number): number

/**
 * Boyle's Law: P2 = P1V1/V2 (constant T and n)
 */
export function boylesP2(P1: number, V1: number, V2: number): number

/**
 * Charles's Law: V2 = V1T2/T1 (constant P and n)
 */
export function charlesV2(V1: number, T1: number, T2: number): number
```

**Controls:**
- Temperature: held constant (shown but not adjustable — distinguishes from Charles's)
- Piston position: drag to change volume (0.1 L to 5 L)
- Number of gas molecules: 0.01 to 1 mol

**Canvas:**
- Gas cylinder with movable piston (SVG)
- Piston position shows volume
- Gas particle dots inside cylinder (density increases as compressed)
- P vs V graph (Recharts): hyperbola y = k/x as piston moves
- Current state marked as dot on graph

**Readouts:**
- Current P and V
- P × V constant (stays constant to verify law)
- Pressure gauge visual (dial)

**Curricula:** KPTBB Class 10, O-Level Physics/Chemistry  
**Related IDs:** `charles-law`

---

### INSTRUMENT: `charles-law`
**Name:** Charles's Law  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
At constant pressure, volume is proportional to absolute temperature. V₁/T₁ = V₂/T₂. Extrapolating to V=0 gives absolute zero at −273°C.

**Physics:** Uses `charlesV2` from thermodynamics.ts.

**Controls:**
- Temperature: drag or type (−50°C to 500°C)
- Pressure: held constant
- Gas amount: fixed

**Canvas:**
- Vertical cylinder with piston that rises as temperature increases
- Flame/ice bath visual under cylinder (changes with temperature)
- V vs T graph (Celsius): user sees straight line
- V vs T graph (Kelvin): toggle to see it pass through origin

**Readouts:**
- Current V and T (both Celsius and Kelvin)
- V/T constant
- Extrapolated absolute zero (shown on graph)

**Curricula:** KPTBB Class 10, O-Level  
**Related IDs:** `boyles-law`

---

### INSTRUMENT: `carnot-engine`
**Name:** Carnot Engine  
**Level:** Advanced 🥈  
**AI:** explain

**What it teaches:**  
The theoretical maximum efficiency of a heat engine depends only on the temperatures of the hot and cold reservoirs. η = 1 − T_cold/T_hot. Real engines are always less efficient.

**Physics — in `lib/physics/thermodynamics.ts`:**
```ts
/**
 * Carnot efficiency: η = 1 - T_cold/T_hot  (temperatures in Kelvin)
 */
export function carnotEfficiency(T_hot: number, T_cold: number): number

/**
 * Work output per cycle: W = η × Q_hot
 */
export function carnotWork(efficiency: number, Q_hot: number): number

/**
 * PV diagram for Carnot cycle — 4 processes.
 * Returns array of {P, V} points for the full cycle.
 * Processes: Isothermal expansion → Adiabatic expansion → Isothermal compression → Adiabatic compression
 */
export function carnotPVCycle(
  n: number, T_hot: number, T_cold: number, V1: number
): Array<{ P: number; V: number; process: string }>
```

**Controls:**
- Hot reservoir temperature: 300 K to 2000 K
- Cold reservoir temperature: 100 K to 500 K (must be < hot)
- Heat input Q_hot: 100 J to 10000 J per cycle
- Speed: slow / medium / fast animation

**Canvas:**
- PV diagram with Carnot cycle traced
- The four processes traced in different colours with labels
- Shaded area = net work done per cycle
- Hot reservoir (flame at top), cold reservoir (ice at bottom)
- Animated: working fluid goes through 4 strokes

**Readouts:**
- η (efficiency, %)
- Q_hot (heat absorbed from hot reservoir)
- Q_cold (heat rejected to cold reservoir)
- W (net work output)
- Entropy change

**AI context:** Explains each of the 4 processes, why Carnot is the theoretical maximum, connects to real engines (petrol, diesel, steam).

**Curricula:** A-Level Physics, University Thermodynamics  
**Related IDs:** `boyles-law`, `charles-law`

---

## CLASS 8 — NUCLEAR & RADIATION (4 instruments)

---

### INSTRUMENT: `geiger-counter`
**Name:** Geiger-Müller Counter  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Detecting ionising radiation. Count rate. Inverse square law. Shielding effectiveness. Background radiation. Units: CPM and μSv/h.

**Physics — add to `lib/physics/nuclear.ts` (new file):**
```ts
/**
 * Count rate with distance: follows inverse square law for point sources.
 * N(d) = N0 × (d0/d)²
 */
export function countRateAtDistance(N0: number, d0: number, d: number): number

/**
 * Shielding reduction factor.
 * I = I0 × e^(-μx)
 * where μ is the linear attenuation coefficient (cm⁻¹) and x is thickness (cm).
 *
 * Approximate μ values:
 * Paper: alpha stops in <1mm, beta requires ~2mm Al, gamma requires cm of Pb
 */
export function shieldingFactor(
  mu: number,          // linear attenuation coefficient
  thickness: number    // cm
): number

/**
 * Simulate Geiger counter clicks using Poisson distribution.
 * Actual count in interval follows Poisson(lambda=meanCPM/60 × intervalSeconds).
 */
export function simulateClicks(meanCPM: number, intervalS: number): number
```

**Sources:**
| Source | Mean CPM | Radiation type |
|--------|----------|---------------|
| Background | 10–25 | Mixed |
| Alpha (Am-241) | 800 | Alpha |
| Beta (Sr-90) | 3,500 | Beta |
| Gamma (Cs-137) | 12,000 | Gamma |
| X-ray machine | 18,000 | X-ray |

**Controls:**
- Source selector
- Distance: 1 cm to 100 cm slider
- Shield: None / Paper (1mm) / Aluminium (3mm) / Lead (2mm) / Lead (10mm)

**Canvas:**
- Geiger tube on the right (cylindrical shape)
- Source on the left (radioactive symbol)
- Radiation particles (dots) flying from source to detector
- Detector clicks: a counter increments + click sound (Web Audio, short burst)
- Distance ruler between source and detector
- Count rate display (numerical + scrolling bar chart)

**Readouts:**
- CPM (counts per minute)
- Dose rate (μSv/h)
- Total counts since start
- Statistical variation shown (bar chart flickers — realistic Poisson scatter)

**Curricula:** KPTBB Class 10 Physics, O-Level Physics, A-Level Physics  
**Related IDs:** `cloud-chamber`, `radiation-dose`

---

### INSTRUMENT: `cloud-chamber`
**Name:** Wilson Cloud Chamber  
**Level:** Intermediate 🥈  
**AI:** identify

**What it teaches:**  
Particle tracks left in supersaturated vapour. Track characteristics identify particle type. Alpha: short, thick, straight. Beta: thin, curving, random. Gamma/X-ray: sparse, thin. Muons: long, straight.

**Physics — in `lib/physics/nuclear.ts`:**
```ts
/**
 * Particle track simulation.
 * Returns array of {x, y} points representing the track.
 *
 * Alpha: straight line, length ∝ energy, thick
 * Beta: curved line (random direction changes), thin
 * Muon: long straight line through full chamber
 */
export function generateTrack(
  type: 'alpha' | 'beta' | 'gamma' | 'muon',
  chamberWidth: number,
  chamberHeight: number,
  magneticField?: number  // Tesla — causes curvature of charged tracks
): Array<{ x: number; y: number; thickness: number; opacity: number }>
```

**Controls:**
- Source: Americium (alpha) / Strontium (beta) / Caesium (gamma) / Cosmic (muons)
- Magnetic field: 0 to 0.5 T (shows curvature of charged tracks)
- Cloud density: toggle (bright vs dim tracks)

**Canvas — chamber view (rectangular):**
- Dark background
- Tracks appear randomly at intervals (Poisson timing)
- Each track drawn as a curved path with appropriate width
- Tracks fade after 2–3 seconds (vapour re-condenses)
- Magnetic field: beta tracks curve left or right depending on charge sign
- Source icon at appropriate edge

**AI context:** User clicks on a track. AI identifies the particle type from the track characteristics and explains the physics.

**Readouts:**
- Source type active
- Approximate track type identified (alpha / beta / muon / gamma)
- Magnetic field strength (T)
- Track curvature: "Left curve = positive charge, Right = negative"
- Estimated particle momentum (from track radius in magnetic field)
- Track count per minute (live)

**Curricula:** A-Level Physics, University Nuclear Physics  
**Related IDs:** `geiger-counter`, `radiation-dose`

---

### INSTRUMENT: `radiation-dose`
**Name:** Radiation Dose Meter  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Dose vs dose rate. Cumulative exposure. Shielding. Annual limits. Natural background vs medical vs occupational.

**Controls:**
- Environment: Background / Medical X-ray / Nuclear plant worker / Radon in basement / Cosmic radiation at altitude
- Duration: 1 minute to 1 year simulation
- Shielding: none / lead apron / full lead room

**Canvas:**
- A personal dosimeter badge on the left
- Dose rate gauge (dial)
- Cumulative dose counter (digital display)
- Historical exposure bar chart (daily doses)
- Warning indicator when approaching limits

**Readouts:**
- Current dose rate (μSv/h)
- Total cumulative dose (mSv)
- Annual limit comparison (colour bar: green/amber/red)
- Context comparison: "= X chest X-rays" / "= Y transatlantic flights"

**Physics:**
```ts
// In lib/physics/nuclear.ts (already created for geiger-counter):

/**
 * Dose rate in μSv/h for a given source and distance.
 * Background: ~0.12 μSv/h
 * Chest X-ray: ~0.1 mSv per exposure (not per hour)
 */
export function doseRate(
  sourceType: 'background' | 'xray_chest' | 'ct_scan' | 'nuclear_plant_worker' | 'radon' | 'cosmic_flight',
  distanceCm: number,
  shielded: boolean
): number   // μSv/h

/**
 * Annual effective dose limit (mSv/year) by occupation.
 * Public: 1 mSv/year
 * Radiation worker: 20 mSv/year (averaged over 5 years)
 * Emergency worker: 100 mSv/year
 */
export function annualDoseLimit(type: 'public' | 'worker' | 'emergency'): number
```

**Readouts:**
- Current dose rate (μSv/h)
- Cumulative dose this session (μSv)
- Annual total if this rate continued (mSv/year)
- % of annual public limit used
- Context comparison: "= 0.5 chest X-rays" / "= 3 hours at altitude"
- Risk classification: Negligible / Low / Moderate / High

**Curricula:** KPTBB Class 10, O-Level  
**Related IDs:** `geiger-counter`

---

### INSTRUMENT: `nuclear-reactor`
**Name:** Nuclear Reactor Model  
**Level:** Advanced 🥉  
**AI:** explain

**What it teaches:**  
Fission chain reaction. Critical mass / subcritical / supercritical states. Role of control rods and moderator. Power output regulation. Types: PWR, BWR, CANDU.

**Physics — in `lib/physics/nuclear.ts`:**
```ts
/**
 * Neutron multiplication factor k (k-effective).
 * k = 1: critical (steady power)
 * k < 1: subcritical (power decreases)
 * k > 1: supercritical (power increases — controlled by rods)
 *
 * k depends on: enrichment, moderator, control rod insertion, geometry
 */
export function neutronMultiplication(
  controlRodInsertion: number,   // 0 = fully out, 1 = fully in
  enrichment: number,            // 0–1 (fraction U-235)
  moderatorType: 'water' | 'heavy-water' | 'graphite'
): number

/**
 * Power output model.
 * Power changes as: dP/dt = P × (k-1) / generation_time
 * where generation_time ≈ 0.1s for prompt neutrons
 */
export function reactorPowerStep(
  currentPower: number,
  k: number,
  dt: number
): number
```

**Controls:**
- Control rod insertion: 0% (fully withdrawn) to 100% (fully inserted) — slider
- Moderator: Water / Heavy water / Graphite
- Fuel enrichment: 3.5% (commercial) to 20% (research)
- Coolant flow: 0 to 100%
- Reactor type: PWR / BWR / CANDU

**Canvas:**
- Cross-section of reactor core
- Fuel rods (yellow cylinders) arranged in grid
- Control rods (blue bars) moving in and out with slider
- Moderator (light blue) filling the core
- Neutron animations: dots flying between fuel rods
- Coolant loops (pipe animations)
- Temperature colour map of core (blue=cool, red=hot)
- Power gauge

**Readouts:**
- k-effective
- Reactor state: SUBCRITICAL / CRITICAL / SUPERCRITICAL
- Power output (MW)
- Core temperature (°C)
- Coolant temperature in/out
- Neutron generation time

**AI context:** Explains what is happening at the current control rod position, why the power is changing, what would happen in a SCRAM (emergency shutdown).

**Curricula:** A-Level Physics, University Nuclear Engineering  
**Related IDs:** `geiger-counter`, `cloud-chamber`

---

## CLASS 9 — MEASUREMENT (7 more instruments)

---

### INSTRUMENT: `ruler`
**Name:** Ruler & Scale  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Reading a ruler correctly. Parallax error. Significant figures. Metric and imperial.

**Controls:**
- Object width: 0 to 30 cm
- Unit: mm / cm / inches
- Parallax angle: view from above/below
- Worn ruler (zero doesn't start at edge): toggle

**Canvas:**
- Ruler across top
- Object (coloured bar) below ruler
- Correct reading line (vertical dashed)
- Parallax demo: when viewing angle shifts, the reading shifts

**Readouts:**
- Correct reading
- Error introduced by parallax

**Physics:**
```ts
// In lib/physics/mechanics.ts:

/**
 * Parallax reading error.
 * When eye is not directly above the mark,
 * apparent reading shifts by: error = height × tan(viewAngle)
 * height = distance from scale to object surface (mm)
 * viewAngle = angle of observation from vertical (radians)
 */
export function parallaxError(
  heightMm: number,
  viewAngleRad: number
): number   // mm of reading error
```

**Readouts:**
- Correct reading (mm and cm)
- Parallax error introduced (when angle ≠ 0)
- Reading with parallax applied
- Uncertainty: ±0.5 mm (half the smallest division)
- Significant figures in reading

**Curricula:** KPTBB Class 6–7  
**Related IDs:** `vernier-caliper`, `micrometer`

---

### INSTRUMENT: `micrometer`
**Name:** Micrometer Screw Gauge  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
The rotating thimble advances by 0.5mm per revolution (pitch). 50 divisions on thimble = 0.01mm precision. Zero error correction. Lock nut.

**Physics:**
```ts
/**
 * Micrometer reading:
 * Main scale (mm, 0.5mm steps) + thimble scale (×0.01mm) − zero error
 */
export function micrometerReading(
  mainScaleReading: number,    // nearest 0.5mm mark (e.g. 5.5)
  thimbleDivision: number,     // 0 to 49
  zeroError: number            // mm
): number
```

**Controls:**
- Object width: 0 to 25 mm
- Zero error: −0.02 to +0.02 mm

**Canvas — SVG micrometer:**
- Frame, anvil, spindle, thimble, ratchet
- Thimble rotates as object changes
- Main scale: 0–25mm with 0.5mm markings
- Thimble scale: 0–50 divisions (circular)
- Lock nut
- Object (sphere or wire) between anvil and spindle
- Reading guide similar to vernier

**Readouts:**
- Main scale reading (mm, to nearest 0.5mm)
- Thimble division (0–49)
- Thimble scale contribution (× 0.01mm)
- Raw reading = main + thimble (mm, 2 decimal places)
- Zero error (mm)
- Corrected reading = raw − zero error (mm)
- Uncertainty: ±0.01 mm
- Step-by-step reading breakdown (toggle)

**Curricula:** KPTBB Class 9  
**Related IDs:** `vernier-caliper`

---

### INSTRUMENT: `triple-beam-balance`
**Name:** Triple Beam Balance  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Measuring mass by adding three sliding riders on three beams. Total mass = sum of all three beam readings.

**Controls:**
- Object to weigh: select from 10 preset objects OR enter custom mass
- Beam 1 (100g increments): slide rider 0 to 500g
- Beam 2 (10g increments): slide rider 0 to 100g
- Beam 3 (1g increments, 0.1g): slide rider 0 to 10g

**Canvas:**
- Three horizontal beams with sliding riders
- Pivot at left
- Pan on left with object
- Pointer at right end of beam — deflects up/down when not balanced
- At balance: pointer aligned with zero mark

**Readouts:**
- Each beam reading
- Total mass
- Balance indicator

**Physics:**
```ts
// In lib/physics/mechanics.ts:

/**
 * Triple beam balance principle of moments.
 * Sum of beam reading moments = object weight moment
 * All beams share same pivot.
 *
 * Beam 1: 100g increments (riders snap to 0, 100, 200, 300, 400, 500g)
 * Beam 2: 10g increments (riders snap to 0–100g in 10g steps)
 * Beam 3: 0–10g continuous (reads to 0.1g)
 *
 * totalMass = beam1 + beam2 + beam3
 * Balance: pointer aligns with zero when total beam reading = object mass
 */
export function beamBalance(
  beam1g: number,   // 0 to 500, multiples of 100
  beam2g: number,   // 0 to 100, multiples of 10
  beam3g: number    // 0.0 to 10.0, continuous
): {
  totalReadingG: number
  isBalanced: boolean        // true when reading = object mass
  pointerDeflection: number  // mm, positive = tips toward beam side
}
```

**Curricula:** KPTBB Class 7–8  
**Related IDs:** `analytical-balance`

---

### INSTRUMENT: `analytical-balance`
**Name:** Analytical Balance  
**Level:** Intermediate 🥈  
**AI:** none

**What it teaches:**  
4-decimal-place mass measurement. Tare function. Draught shield doors. Auto-calibration. Reading a slowly settling display. Understanding environmental factors.

**Controls:**
- Object: preset chemicals or custom mass
- Tare button: zeros the display with container
- Open/close draught shield doors
- Calibration (simulated with animated 100g calibration weight)

**Canvas — instrument face:**
- Photo-realistic analytical balance SVG
- Digital display (4 decimal places: e.g. 0.0000 g)
- Draught shield glass doors (animate open/close)
- Pan visible through glass
- Door-open indicator (balance reading unstable when doors open)

**Behaviour:**
- When doors open: reading fluctuates ±0.0020g (air current noise)
- When doors closed: reading drifts slowly using `driftValue(mass, 0.0002, timestamp)`
- After 3 seconds: settles to stable reading
- Overload: pan capacity 100g — placing >100g shows "OvR"

**Physics:**
```ts
// In lib/physics/mechanics.ts:

/**
 * Analytical balance display simulation.
 * Real balances take 3–5 seconds to settle after placing object.
 * Settling modelled as exponential decay toward true value plus drift noise.
 *
 * display(t) = trueMass + (initialDeviation × e^(-t/τ)) + gaussian(0, drift)
 *
 * @param trueMassG    actual mass in grams
 * @param timeSincePlace seconds since object placed on pan
 * @param tau          time constant for settling (default 1.2s)
 * @param doorsOpen    true = wind noise multiplier ×10
 */
export function balanceReading(
  trueMassG: number,
  timeSincePlace: number,
  tau?: number,
  doorsOpen?: boolean
): number   // grams, 4 decimal places
```

**Readouts:**
- Live display: `0.0000 g` updating every 0.1s
- Stable indicator: flashing asterisk * while settling, solid ✓ when stable
- Tare value (subtracted from all readings)
- Net mass (display − tare)
- Units toggle: g / mg
- Over-range indicator: "OvR" when > pan capacity (100g typical)
- Door status: OPEN / CLOSED indicator (open = reading unstable)

**Curricula:** University Chemistry Lab  
**Related IDs:** `triple-beam-balance`

---

### INSTRUMENT: `graduated-cylinder`
**Name:** Graduated Cylinder & Meniscus  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Reading liquid volume correctly. Meniscus: water concave (read bottom), mercury convex (read top). Parallax error.

**Controls:**
- Volume: 0 to 100 mL
- Liquid type: water / mercury / oil
- Cylinder size: 10 / 25 / 50 / 100 mL
- Parallax: view angle slider

**Canvas:**
- Vertical glass cylinder with graduation markings
- Liquid fills to set level
- Meniscus shape correct for liquid type (concave vs convex)
- Eye level indicator for correct reading
- Reading line marks the meniscus bottom (water) or top (mercury)

**Physics:**
```ts
// In lib/physics/chemistry.ts:

/**
 * Meniscus reading depends on liquid-glass contact angle.
 * Water (aqueous): concave meniscus — read the BOTTOM of the curve
 * Mercury: convex meniscus — read the TOP of the curve
 * Oil: near-flat, read mid-point
 *
 * True volume = volume at the bottom of meniscus (water)
 *             = volume at the top of meniscus (mercury)
 */
export function correctMeniscusReading(
  liquidType: 'water' | 'mercury' | 'oil',
  markedVolumeMl: number   // volume at the line the user reads
): number   // true volume in mL

/**
 * Parallax shift in mL when eye is above/below liquid level.
 * shift ≈ (cylinderDiameterMm / 2) × tan(viewAngleDeg × π/180) / scaleSpacingMmPerMl
 */
export function cylinderParallax(
  viewAngleDeg: number,
  cylinderDiameterMm: number,
  scaleSpacingMmPerMl: number
): number   // apparent error in mL
```

**Readouts:**
- Marked reading (where graduation line is)
- Meniscus correction applied
- True volume (mL)
- Parallax error when angle ≠ 0°
- Uncertainty: ±0.5 of smallest division
- Cylinder size and graduation interval

**Curricula:** KPTBB Class 7–8  
**Related IDs:** `triple-beam-balance`

---

### INSTRUMENT: `stopwatch`
**Name:** Stopwatch & Timer  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Precision timing. Human reaction time error (~0.2s). Lap timing. Statistical analysis of repeated measurements.

**Controls:**
- Start / Stop / Lap / Reset buttons
- Countdown mode: set target time
- Companion mode: overlay on pendulum or projectile

**Canvas:**
- Large digital display (stopwatch face)
- Analogue sweep second hand (cosmetic)
- Lap time list (up to 20 laps)
- Statistical analysis: mean, standard deviation, range of lap times

**Readouts:**
- Elapsed time (0.001s resolution)
- Lap times
- Mean lap time ± standard deviation

**Physics:**
```ts
// No physics equations needed — time measurement is direct.
// Statistical analysis of lap times:

/**
 * Mean of an array of measurements.
 */
export function mean(values: number[]): number

/**
 * Sample standard deviation (uses n-1 denominator — Bessel's correction).
 * s = sqrt(Σ(xi - x̄)² / (n-1))
 */
export function sampleStdDev(values: number[]): number

/**
 * Standard error of the mean: SE = s / sqrt(n)
 * Used to express uncertainty on the mean timing.
 */
export function standardError(values: number[]): number

/**
 * Human reaction time model.
 * Typical: 180–250ms for visual stimulus, 140–180ms for auditory.
 * Used to explain why first/last lap times may differ from true value.
 */
export const TYPICAL_REACTION_TIME_MS = 200
```

**Curricula:** Every practical physics experiment  
**Related IDs:** `pendulum`

---

### INSTRUMENT: `protractor`
**Name:** Protractor & Angle Measurement  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Measuring angles. Inner and outer scale. Reflex angles. Acute, obtuse, reflex classification.

**Controls:**
- Angle: 0° to 360°
- Arm 1: fixed horizontal
- Arm 2: rotate

**Canvas:**
- 360° protractor SVG
- Two arms meeting at centre
- Both inner (0–180) and outer (180–360) scales
- Highlighted angle arc
- Angle type label: Acute / Right / Obtuse / Straight / Reflex

**Physics:**
```ts
// In lib/physics/mechanics.ts:

/**
 * Classify an angle.
 * < 90° → 'acute'
 * = 90° → 'right'
 * > 90° and < 180° → 'obtuse'
 * = 180° → 'straight'
 * > 180° and < 360° → 'reflex'
 * = 360° → 'full'
 */
export function classifyAngle(degrees: number): 'acute'|'right'|'obtuse'|'straight'|'reflex'|'full'

/**
 * Supplementary angle: 180° − θ
 * Complementary angle: 90° − θ (only valid when θ < 90°)
 */
export function supplementary(degrees: number): number
export function complementary(degrees: number): number | null
```

**Readouts:**
- Angle shown: degrees and radians
- Classification: Acute / Right / Obtuse / Straight / Reflex
- Supplementary angle
- Complementary angle (shown as "—" if > 90°)
- Inner scale reading and outer scale reading (both shown to avoid confusion)

**Curricula:** KPTBB Class 6  
**Related IDs:** `ruler`

---

## CLASS 10 — ASTRONOMY (5 instruments)

---

### INSTRUMENT: `solar-orrery`
**Name:** Solar System Orrery  
**Level:** Student 🥇  
**AI:** none

**What it teaches:**  
Relative sizes, orbital periods, orbital shapes of all planets. Kepler's laws. Retrograde motion.

**Physics — add to `lib/physics/astronomy.ts` (new file):**
```ts
/**
 * Kepler's Third Law: T² ∝ a³ (a = semi-major axis in AU, T in years)
 * T = a^(3/2) years
 */
export function keplerPeriod(semiMajorAxisAU: number): number

/**
 * Planet position at time t.
 * Uses simplified circular orbits for visual clarity.
 * Returns { x, y } in AU from Sun.
 */
export function planetPosition(
  semiMajorAxisAU: number,
  orbitalPeriodYears: number,
  timeYears: number,
  inclination?: number
): { x: number; y: number }
```

**Planet data (all 8 planets + 5 dwarf planets):**
| Planet | a (AU) | Period (yr) | Radius (km) |
|--------|--------|-------------|-------------|
| Mercury | 0.387 | 0.241 | 2,440 |
| Venus | 0.723 | 0.615 | 6,052 |
| Earth | 1.000 | 1.000 | 6,371 |
| Mars | 1.524 | 1.881 | 3,390 |
| Jupiter | 5.203 | 11.86 | 71,492 |
| Saturn | 9.537 | 29.46 | 60,268 |
| Uranus | 19.19 | 84.01 | 25,559 |
| Neptune | 30.07 | 164.8 | 24,622 |

**Controls:**
- Time speed: real-time / ×1 day/s / ×1 month/s / ×1 year/s / ×10 year/s
- Focus: click any body to centre and show data panel
- Show: orbits / planet names / relative sizes / current date
- Inner solar system / Full solar system zoom

**Canvas:**
- Top-down view of solar system
- Sun at centre (glowing yellow)
- Orbital paths as ellipses
- Planet dots (colour-coded) moving along orbits
- Scale shows 1 AU marker

**Data panel (when planet clicked):**
- Distance from Sun
- Orbital period
- Orbital velocity
- Day length
- Moons count
- Surface temperature range
- Fun fact

**Readouts (shown when planet is selected — click to focus):**
- Planet name
- Current distance from Sun (AU and km)
- Current orbital speed (km/s)
- Days since last perihelion
- Sidereal orbital period
- Synodic period (time between Earth oppositions)
- Surface temperature (approx range)
- Number of confirmed moons
- Interesting fact (one sentence, rotates through 5 facts)
- Distance from Earth right now

**Global readouts (always visible):**
- Current simulated date
- Time scale: "1 second = X Earth days"

**Curricula:** KPTBB Class 7, O-Level  
**Related IDs:** `star-chart`

---

### INSTRUMENT: `star-chart`
**Name:** Interactive Star Chart  
**Level:** Student 🥇  
**AI:** identify

**What it teaches:**  
Navigation by stars. Constellation patterns. Magnitude scale. How to find North using Polaris.

**Data:** Uses Yale Bright Star Catalogue (9,096 stars to magnitude 6.5). Pre-bundled as a compressed JSON (~200KB). Constellation line data for 88 constellations.

**Controls:**
- Date/time: adjust (changes which stars are above horizon)
- Location: lat/long input or preset cities
- View direction: N/E/S/W or drag to pan
- Field of view: pinch/scroll to zoom
- Toggle: constellation lines / constellation names / grid / Milky Way

**Canvas — circular sky view:**
- Black background with stars as dots (size ∝ brightness)
- Constellation stick-figure lines in dim blue
- Horizon line
- Cardinal points (N/S/E/W) at edge
- Milky Way as a diffuse band
- Moon position if visible
- Planets marked distinctly (not as stars)

**AI context:** User taps a star or constellation — AI identifies it, gives name, mythology, distance, notable features.

**Physics:**
```ts
// In lib/physics/astronomy.ts:

/**
 * Convert equatorial coordinates (RA, Dec) to altitude-azimuth (Alt, Az)
 * for a given observer location and time.
 *
 * @param raDeg    Right Ascension in degrees (0–360)
 * @param decDeg   Declination in degrees (−90 to +90)
 * @param latDeg   Observer latitude (degrees)
 * @param lstDeg   Local Sidereal Time in degrees
 * @returns { altDeg, azDeg } — altitude above horizon, azimuth from North
 */
export function equatorialToHorizon(
  raDeg: number, decDeg: number,
  latDeg: number, lstDeg: number
): { altDeg: number; azDeg: number }

/**
 * Local Sidereal Time from longitude and UTC date.
 * Simplified version using J2000 epoch.
 */
export function localSiderealTime(
  longitudeDeg: number,
  utcDate: Date
): number   // degrees (0–360)

/**
 * Star magnitude to display radius (pixels).
 * Bright stars (magnitude < 1) → radius 4px
 * Faint stars (magnitude 6) → radius 1px
 * starRadius(0) → 4.5, starRadius(6) → 1
 */
export function starRadius(magnitude: number): number
```

**Readouts (when star/object clicked):**
- Name (proper name + Bayer designation e.g. "Sirius / α Canis Majoris")
- Constellation
- Right Ascension and Declination
- Visual magnitude
- Distance (light-years)
- Spectral type and colour class
- Current altitude above horizon (°)
- Rise time, transit time, set time for today
- Interesting fact

**Global readouts:**
- Current simulated date and time
- Observer location (city or lat/long)
- Direction facing (N/S/E/W)
- Number of stars visible (above horizon, magnitude < 6.5)

**Curricula:** KPTBB Class 7, O-Level, Astronomy GCSE  
**Related IDs:** `solar-orrery`, `stellar-spectrograph`

---

### INSTRUMENT: `refracting-telescope`
**Name:** Refracting Telescope  
**Level:** Intermediate 🥈  
**AI:** none

**What it teaches:**  
How a refractor works: objective lens forms image, eyepiece magnifies it. Magnification = f_objective / f_eyepiece. Chromatic aberration. Resolving power.

**Physics:**
```ts
/** Magnification: M = f_obj / f_eye */
export function telescopeMagnification(fObj: number, fEye: number): number

/** Field of view: FOV = FOV_eye / M (in degrees) */
export function telescopeFOV(fovEyepiece: number, magnification: number): number

/** Angular resolving power (Rayleigh criterion): θ = 1.22λ/D (radians) */
export function resolvingPower(wavelengthM: number, aperturM: number): number
```

**Controls:**
- Aperture: 60 / 80 / 100 / 120 / 150 mm
- Focal length: 700 / 900 / 1000 / 1200 mm
- Eyepiece: 6mm / 12mm / 25mm / 40mm (4 choices)
- Target: point at any star chart object

**Canvas — circular eyepiece view:**
- Shows what the target looks like at the calculated magnification
- Field of view matches calculation
- Moon: 16 detailed surface image tiles, correct scale
- Deep sky objects: Messier catalogue images (public domain Hubble/ground images)
- Stars: Airy disk at very high magnification showing diffraction limit
- Atmospheric turbulence simulation: toggle

**Readouts:**
- Magnification
- Field of view
- Limiting magnitude
- Resolving power (arcseconds)

**Curricula:** A-Level Physics, Astronomy clubs  
**Related IDs:** `reflecting-telescope`, `star-chart`

---

### INSTRUMENT: `reflecting-telescope`
**Name:** Reflecting Telescope (Newtonian)  
**Level:** Intermediate 🥈  
**AI:** none

**What it teaches:**  
Mirrors instead of lenses — no chromatic aberration. Collimation — aligning the mirrors for sharp images. Larger apertures possible. Deep-sky object observation.

Same as refracting telescope but:
- No chromatic aberration (advantage over refractor)
- Includes collimation simulation: misaligned mirrors → blurry/off-centre image, user adjusts three collimation screws
- Secondary mirror shadow (small dark spot in field of view)
- Apertures: 100 / 150 / 200 / 300 / 400 mm

**Physics:** Same functions as `refracting-telescope` — uses:
```ts
telescopeMagnification(fObj, fEye)
telescopeFOV(fovEyepiece, magnification)
resolvingPower(wavelengthM, apertureM)
```

Additional function for collimation:
```ts
// In lib/physics/optics.ts — add:
/**
 * Image quality degradation from mirror misalignment.
 * 0 = perfect collimation, 1 = completely off-axis (unusable).
 * Each of 3 collimation screws has a value 0–1.
 * perfectCollimation when all three = 0.5 (centred).
 */
export function collimationQuality(
  screw1: number,   // 0 to 1
  screw2: number,
  screw3: number
): number   // 0 = perfect, 1 = worst
```

**Controls:**
- Aperture: 100 / 150 / 200 / 300 / 400 mm
- Focal length: 1000 / 1200 / 1500 / 2000 mm
- Eyepiece: same 4 choices as refractor (6mm / 12mm / 25mm / 40mm)
- Target: select from star chart objects
- Collimation screws: 3 sliders (each 0–100%) — simulate alignment
- Atmospheric seeing: 1 (terrible) to 5 (excellent) Antoniadi scale

**Canvas — circular eyepiece view:**
- Same as refracting telescope BUT:
- Small central shadow (secondary mirror obstruction) — dark circle ~25% of field width
- No chromatic aberration (advantage over refractor — no colour fringing)
- When collimation is off: star images appear as arcs or elongated blobs instead of points
- At perfect collimation + high seeing: Airy disk visible on bright stars

**Readouts:**
- Magnification
- True field of view (°)
- Exit pupil (mm) = aperture / magnification (useful for night vision)
- Limiting magnitude = 2 + 5 × log₁₀(apertureMm)
- Resolving power (arcseconds)
- Collimation quality: "Perfect" / "Acceptable" / "Needs adjustment"
- Seeing quality and its effect on performance

**Curricula:** A-Level Physics, Astronomy clubs  
**Related IDs:** `refracting-telescope`

---

### INSTRUMENT: `stellar-spectrograph`
**Name:** Stellar Spectrograph  
**Level:** Expert 🥉  
**AI:** identify

**What it teaches:**  
Each element produces characteristic absorption lines. Stars are classified by spectral type (OBAFGKM). Measuring line shifts gives recession velocity (redshift). The Sun's spectrum reveals its composition.

**Physics — in `lib/physics/astronomy.ts`:**
```ts
/**
 * Doppler redshift: z = Δλ/λ = v/c (for v << c)
 * Recession velocity from measured vs rest wavelength.
 */
export function recessionVelocity(
  measuredWavelengthNm: number,
  restWavelengthNm: number
): number  // m/s

/** Spectral type classification by temperature */
export function spectralType(tempK: number): 'O'|'B'|'A'|'F'|'G'|'K'|'M'
```

**Absorption line data (built-in):**
- Hydrogen Balmer series: Hα 656.3nm, Hβ 486.1nm, Hγ 434.0nm, Hδ 410.2nm
- Sodium D lines: 589.0 / 589.6 nm
- Calcium H&K: 396.8 / 393.3 nm
- Magnesium b: 518.4 nm
- Iron: many lines 400–500nm
- All 92 naturally occurring elements spectra included

**Controls:**
- Target star: select from 50 bright stars (or point from star chart)
- Zoom into spectrum at any wavelength region
- Identify mode: user clicks on a dark line → AI names the element
- Compare: overlay solar spectrum vs selected star

**Canvas — spectrum display:**
- Horizontal bar showing visible spectrum (380–700nm) with correct colours
- Dark vertical absorption lines at correct wavelengths
- User drags a measurement cursor over a line
- Wavelength and element name shown

**AI context:** Identifies which element produced the line clicked, explains Balmer series, classifies the star's spectral type, computes recession velocity from measured vs rest wavelength shift.

**Readouts (when absorption line clicked):**
- Element name
- Rest wavelength (nm)
- Measured wavelength (nm) — shifted if star is moving
- Velocity shift: `v = (Δλ/λ) × c` km/s
- "Approaching" (blue-shifted) or "Receding" (red-shifted)
- Doppler shift in km/s

**Global readouts:**
- Star name and spectral type (O/B/A/F/G/K/M)
- Surface temperature inferred from spectral type
- Luminosity class (I–V)
- Lines identified count vs total visible
- Strongest element present

**Curricula:** A-Level Physics, University Astrophysics  
**Related IDs:** `star-chart`, `prism-dispersion`

---

## CLASS 11 — ADVANCED RESEARCH (4 instruments)

---

### INSTRUMENT: `mass-spectrometer`
**Name:** Mass Spectrometer  
**Level:** Expert 🥉  
**AI:** interpret

**What it teaches:**  
Ionisation, acceleration, deflection in magnetic field, detection. m/z ratio identification. Fragmentation patterns reveal molecular structure. Isotope abundance.

**Physics — add to `lib/physics/analytical.ts` (new file):**
```ts
/**
 * Radius of circular path in magnetic field.
 * r = mv / (qB)  →  m/z = r²B²/(2V) × (e/1)
 * where V = accelerating voltage, B = magnetic field strength
 */
export function massToChargeRadius(
  mOverZ: number,
  acceleratingVoltage: number,
  magneticField: number
): number  // metres

/** Predict fragmentation ions for a molecular formula (simplified). */
export function predictFragments(
  formula: string,
  molecularWeight: number
): Array<{ mz: number; relativeIntensity: number; assignment: string }>
```

**Controls:**
- Compound: select from library of 100 common compounds, OR enter molecular formula
- Ionisation: EI (electron ionisation, 70 eV) / CI (chemical ionisation)
- Accelerating voltage: 100 to 10,000 V
- Magnetic field: adjustable

**Canvas — mass spectrum:**
- X axis: m/z (1 to 500 Da)
- Y axis: relative intensity (0 to 100%)
- Vertical bars at each fragment m/z
- M⁺ (molecular ion peak) labelled
- Base peak labelled
- Common fragments identified: m/z 15 (CH₃⁺), 43 (CH₃CO⁺), 77 (C₆H₅⁺), etc.

**AI context:** User asks "what does this peak at m/z 77 mean?" — AI explains the benzene ring cation fragment and what it indicates about the molecular structure.

**Readouts:**
- Molecular ion peak (M⁺): m/z value and molecular formula
- Base peak: m/z and relative intensity (100%)
- Top 10 peaks listed with: m/z, relative intensity (%), fragment assignment
- Molecular weight
- Degree of unsaturation (calculated from formula): `DoU = (2C + 2 + N - H) / 2`
- Suggested functional groups from fragment pattern
- Library match confidence % (when compound selected from database)
- Isotope pattern: M, M+1, M+2 intensities (visible for Cl/Br compounds)

**Curricula:** A-Level Chemistry, University Analytical Chemistry  
**Related IDs:** `nmr-spectrometer`

---

### INSTRUMENT: `nmr-spectrometer`
**Name:** NMR Spectrometer  
**Level:** Expert 🥉  
**AI:** interpret

**What it teaches:**  
Chemical shifts, integration ratios, spin-spin coupling (J-coupling), multiplicity rules (n+1 rule). 1H and 13C NMR. How to determine molecular structure from a spectrum.

**Physics:**
```ts
/**
 * Predict 1H NMR chemical shifts using tabulated shielding constants.
 * Returns array of peaks: { delta (ppm), numProtons, multiplicity, J (Hz) }
 */
export function predictHNMR(
  formula: string
): Array<{ delta: number; numH: number; multiplicity: string; jHz: number }>

/** Larmor frequency: f = γ·B₀/(2π) where γ is gyromagnetic ratio */
export function larmorFrequency(B0Tesla: number, gamma: number): number  // MHz
```

**Controls:**
- Compound selector (50 organic compounds from ethanol to aspirin)
- Field strength: 60 / 100 / 200 / 300 / 400 / 600 MHz
- Nucleus: ¹H / ¹³C
- Expansion: click and drag to zoom into any region

**Canvas — spectrum display:**
- TMS reference peak at 0 ppm
- X axis: chemical shift (δ) in ppm, right to left (convention)
- Peaks with integration curves below (heights proportional to number of H)
- Multiplicity shown as split peaks (singlet, doublet, triplet, quartet, multiplet)
- Peak labels: chemical group e.g. "CH₃", "OH", "ArH"

**AI context:** User asks about a specific peak — AI names the functional group, explains the chemical shift value, explains the coupling pattern.

**Readouts (for each peak/signal):**
- Chemical shift δ (ppm) — click peak to get value
- Integration (relative number of protons)
- Multiplicity: s / d / t / q / m / dd / dt (abbreviations)
- J coupling constant (Hz) for split peaks
- Assignment: which proton / carbon in the molecule

**Global readouts:**
- Number of distinct chemical environments
- Molecular formula (from database)
- Total integration (normalized to smallest group)
- TMS reference: 0.00 ppm

**Curricula:** University Organic Chemistry  
**Related IDs:** `mass-spectrometer`

---

### INSTRUMENT: `xrd`
**Name:** X-Ray Diffractometer  
**Level:** Expert 🥉  
**AI:** none

**What it teaches:**  
Bragg's Law: nλ = 2d·sinθ. X-rays diffract from crystal planes at angles determined by d-spacing. Powder XRD gives a pattern unique to each crystalline material.

**Physics — in `lib/physics/analytical.ts`:**
```ts
/**
 * Bragg's Law: nλ = 2d·sinθ
 * Given λ and d-spacing, find the Bragg angles for n = 1, 2, 3
 */
export function braggAngles(
  wavelengthNm: number,   // X-ray wavelength (CuKα = 0.15406 nm)
  dSpacingNm: number,     // interplanar spacing
  maxN?: number
): Array<{ n: number; twoTheta: number }>

/** d-spacing from Miller indices for cubic crystal: d = a/sqrt(h²+k²+l²) */
export function cubicDSpacing(a: number, h: number, k: number, l: number): number
```

**Controls:**
- Sample: NaCl / Silicon / Quartz / Alumina / Iron / Calcite / Hydroxyapatite / [20 total]
- X-ray source: CuKα (0.154nm) / MoKα (0.071nm)
- 2θ scan range: 5° to 90°
- Scan speed: fast / medium / slow

**Canvas — diffractogram:**
- X axis: 2θ (5 to 90°)
- Y axis: intensity (counts)
- Peaks at Bragg angles for all reflecting planes
- Peak labels: Miller indices (hkl) of each reflection
- Reference pattern overlay from JCPDS database (simplified)

**Readouts:**
- Peak positions: list of all 2θ values with d-spacings (using Bragg's law)
- d-spacing for each peak (nm)
- Miller indices (hkl) for each reflection
- Crystal system: cubic / tetragonal / orthorhombic / hexagonal / monoclinic / triclinic
- Lattice parameter a (nm) — calculated from peaks for cubic systems: `a = d × sqrt(h²+k²+l²)`
- Phase identification: name of matching phase from reference database
- Crystallite size from peak broadening: Scherrer equation `D = Kλ/(β·cosθ)` where β = FWHM
- % crystallinity if amorphous hump visible

**Curricula:** University Materials Science, Chemistry  
**Related IDs:** `afm`

---

### INSTRUMENT: `afm`
**Name:** Atomic Force Microscope  
**Level:** Expert 🥉  
**AI:** none

**What it teaches:**  
Nanoscale surface topography. Contact / tapping / non-contact modes. Tip-sample interaction. Resolution in the nm range. Force-distance curve.

**Controls:**
- Sample: 20 options (silicon wafer / graphene / DNA / polymer film / cell membrane / gold surface / etc.)
- Mode: Contact / Tapping / Non-contact
- Scan size: 1 nm to 10 μm
- Scan speed: slow / medium / fast
- Z range: adjust colour scale

**Canvas — 3D height map:**
- 2D colour map of the scanned area (false colour: dark=low, bright=high)
- 3D rendered height map (WebGL — React Three Fiber)
- Cross-section profile along a line
- Scan line cursor moving across sample during acquisition
- RMS roughness measurement

**Force-distance curve:**
- Separate Recharts LineChart panel
- Shows cantilever deflection vs tip-sample distance
- Approach / contact / retract regions labelled
- Snap-to-contact and pull-off events

**Physics:**
```ts
// In lib/physics/analytical.ts:

/**
 * Tip-sample force in contact mode.
 * Approximated by Hertzian contact model.
 * F = (4/3) × E* × sqrt(R) × δ^(3/2)
 * where E* = reduced modulus, R = tip radius, δ = indentation depth
 */
export function hertzianForce(
  reducedModulus: number,   // GPa
  tipRadiusNm: number,      // nm
  indentationNm: number     // nm
): number   // nN

/**
 * RMS roughness of a surface from a height map.
 * Rq = sqrt( (1/N) × Σ(zi - z̄)² )
 * where zi = height at each pixel, z̄ = mean height
 */
export function rmsRoughness(heightMap: number[][]): number   // nm

/**
 * Generate simulated height map for a given sample type.
 * Returns 2D array of heights in nm.
 * Each sample has characteristic roughness and feature size.
 */
export function generateHeightMap(
  sampleId: string,          // e.g. 'silicon_wafer', 'graphene', 'dna'
  widthPixels: number,       // e.g. 256
  scanSizeNm: number         // physical size of scan area
): number[][]   // heights in nm
```

**Readouts:**
- Scan size (nm or μm)
- Z range (nm) — height difference between highest and lowest point
- RMS roughness Rq (nm)
- Maximum peak height (nm)
- Maximum valley depth (nm)
- Scan speed (lines/second)
- Mode: Contact / Tapping / Non-contact
- Set point force (nN) — contact mode
- Phase shift (°) — tapping mode (reveals material stiffness contrast)
- X, Y, Z values at cursor position (when cursor dragged over height map)

---

## COMPLETE SECTION — Per-Instrument DeepSeek Build Template

When building each future instrument, use this template with the spec:

```
Build instrument: `[instrument-id]`
Folder: src/labforge/instruments/[instrument-id]/

FILES TO BUILD IN ORDER:
1. types.ts
2. engine.ts  
3. [InstrumentName]App.tsx
4. index.ts → export { [InstrumentName]App as default } from './[InstrumentName]App'

REGISTRY: Add the registry entry from LABFORGE_FUTURE_INSTRUMENTS.md to registry/index.ts

PHYSICS LIBRARY:
  - If this instrument needs new physics functions, add them to lib/physics/[domain].ts first
  - New lib files to create if not existing: [list from spec]
  - Run npx tsc --noEmit after every lib change

RULES (same as always):
- strict TypeScript, no any, all functions have explicit return types
- No console.log — use logger from lib/logger.ts
- Canvas draw functions: ctx.save() at start, ctx.restore() at end
- All canvases need ResizeObserver pattern (from Wave 2 header in LABFORGE_SPEC_COMPLETE.md)
- Physics equations: JSDoc comment with formula written out
- Engine file: only physics, no React, no canvas calls
- App component: only UI, imports engine and lib/canvas/

After each file: npx tsc --noEmit
After all 4 files: verify instrument opens in LabForge without errors
```

---

## COMPLETE INSTRUMENT CATALOGUE TABLE

> Final reference for all 52 instruments across the platform.

| # | ID | Name | Class | Level | AI | Tier |
|---|----|----|-------|-------|-----|------|
| 1 | convex-lens | Convex Lens | Optics | Student | explain | Built |
| 2 | concave-lens | Concave Lens | Optics | Student | explain | Built |
| 3 | concave-mirror | Concave Mirror | Optics | Student | explain | Built |
| 4 | convex-mirror | Convex Mirror | Optics | Student | explain | Built |
| 5 | pendulum | Simple Pendulum | Mechanics | Student | none | Built |
| 6 | ohm-circuit | Ohm's Law & Circuits | Electricity | Student | none | Built |
| 7 | vernier-caliper | Vernier Caliper | Measurement | Student | none | Built |
| 8 | ph-meter | pH Meter | Chemistry | Student | none | Built |
| 9 | chem-lab | Chemistry Lab Simulator | Chemistry | Advanced | explain | Built |
| 10 | ruler | Ruler & Scale Reading | Measurement | Student | none | 🥇 |
| 11 | micrometer | Micrometer Screw Gauge | Measurement | Student | none | 🥇 |
| 12 | graduated-cylinder | Graduated Cylinder | Measurement | Student | none | 🥇 |
| 13 | stopwatch | Stopwatch & Timer | Measurement | Student | none | 🥇 |
| 14 | protractor | Protractor | Measurement | Student | none | 🥇 |
| 15 | triple-beam-balance | Triple Beam Balance | Measurement | Student | none | 🥇 |
| 16 | lever | Lever (Simple Machine) | Mechanics | Student | none | 🥇 |
| 17 | pulley | Pulley System | Mechanics | Student | none | 🥇 |
| 18 | inclined-plane | Inclined Plane | Mechanics | Student | none | 🥇 |
| 19 | snells-law | Snell's Law & Refraction | Optics | Student | none | 🥇 |
| 20 | projectile-motion | Projectile Motion | Mechanics | Student | none | 🥇 |
| 21 | spring-hookes-law | Hooke's Law Spring | Mechanics | Student | none | 🥇 |
| 22 | newtons-cradle | Newton's Cradle | Mechanics | Student | none | 🥇 |
| 23 | wave-properties | Wave Properties Explorer | Waves | Student | none | 🥇 |
| 24 | boyles-law | Boyle's Law | Thermo | Student | none | 🥇 |
| 25 | charles-law | Charles's Law | Thermo | Student | none | 🥇 |
| 26 | geiger-counter | Geiger-Müller Counter | Nuclear | Student | none | 🥇 |
| 27 | radiation-dose | Radiation Dose Meter | Nuclear | Student | none | 🥇 |
| 28 | multimeter | Digital Multimeter | Electricity | Student | none | 🥇 |
| 29 | titration | Acid-Base Titration | Chemistry | Student | explain | 🥇 |
| 30 | chromatography | Paper Chromatography | Chemistry | Student | none | 🥇 |
| 31 | microscope | Light Microscope | Biology | Student | identify | 🥇 |
| 32 | blood-pressure-monitor | Blood Pressure Monitor | Biology | Student | none | 🥇 |
| 33 | solar-orrery | Solar System Orrery | Astronomy | Student | none | 🥇 |
| 34 | star-chart | Interactive Star Chart | Astronomy | Student | identify | 🥇 |
| 35 | prism-dispersion | Prism & Light Dispersion | Optics | Student | none | 🥈 |
| 36 | human-eye | Human Eye & Vision Defects | Optics | Student | explain | 🥈 |
| 37 | wheatstone-bridge | Wheatstone Bridge | Electricity | Intermediate | none | 🥈 |
| 38 | dc-power-supply | DC Power Supply | Electricity | Intermediate | none | 🥈 |
| 39 | sonometer | Sonometer | Waves | Student | none | 🥈 |
| 40 | resonance-tube | Resonance Tube | Waves | Student | none | 🥈 |
| 41 | colorimeter | Colorimeter | Chemistry | Intermediate | none | 🥈 |
| 42 | electrolysis | Electrolysis Cell | Chemistry | Intermediate | explain | 🥈 |
| 43 | distillation | Distillation Apparatus | Chemistry | Intermediate | none | 🥈 |
| 44 | ecg-monitor | ECG Monitor | Biology | Intermediate | identify | 🥈 |
| 45 | spirometer | Spirometer | Biology | Intermediate | identify | 🥈 |
| 46 | doppler-effect | Doppler Effect | Mechanics | Intermediate | none | 🥈 |
| 47 | carnot-engine | Carnot Heat Engine | Thermo | Advanced | explain | 🥈 |
| 48 | cloud-chamber | Wilson Cloud Chamber | Nuclear | Intermediate | identify | 🥈 |
| 49 | nuclear-reactor | Nuclear Reactor Model | Nuclear | Advanced | explain | 🥈 |
| 50 | refracting-telescope | Refracting Telescope | Astronomy | Intermediate | none | 🥈 |
| 51 | reflecting-telescope | Reflecting Telescope | Astronomy | Intermediate | none | 🥈 |
| 52 | analytical-balance | Analytical Balance | Measurement | Intermediate | none | 🥈 |
| 53 | ripple-tank | Ripple Tank | Optics | Intermediate | explain | 🥉 |
| 54 | optics-bench | Optics Bench | Optics | Intermediate | none | 🥉 |
| 55 | oscilloscope | Digital Oscilloscope | Electricity | Advanced | explain | 🥉 |
| 56 | function-generator | Function Generator | Electricity | Advanced | none | 🥉 |
| 57 | spectrum-analyser | Spectrum Analyser | Waves | Advanced | none | 🥉 |
| 58 | mass-spectrometer | Mass Spectrometer | Advanced Research | Expert | interpret | 🥉 |
| 59 | nmr-spectrometer | NMR Spectrometer | Advanced Research | Expert | interpret | 🥉 |
| 60 | xrd | X-Ray Diffractometer | Advanced Research | Expert | none | 🥉 |
| 61 | afm | Atomic Force Microscope | Advanced Research | Expert | none | 🥉 |
| 62 | stellar-spectrograph | Stellar Spectrograph | Astronomy | Expert | identify | 🥉 |

**Total: 62 instruments. 9 built. 53 specified.**

---

## NEW LIB PHYSICS FUNCTIONS — CONSOLIDATED LIST

> Every new physics function needed across all future instruments. Add to the specified file.

### `lib/physics/mechanics.ts` — CREATE THIS FILE

```ts
// Hooke's Law
export function hookeExtension(forceN, springConstant): number
export function shm(x0, k, mass, t): number
export function shmOmega(k, mass): number
export function shmPeriod(k, mass): number
export function beyondElasticLimit(extension, limitM): boolean

// Projectile
export function projectilePosition(v0, theta, h0, g, t): {x,y,vx,vy}
export function timeOfFlight(v0, theta, h0, g): number
export function maxHeight(v0, theta, h0, g): number
export function range(v0, theta, h0, g): number

// Simple machines
export function moment(force, distance): number
export function mechanicalAdvantage(effortDist, loadDist): number
export function leverClass(fulcrumPos, effortPos, loadPos): 1|2|3
export function pulleyMA(supportingRopes): number
export function pulleyEffort(load, ma): number
export function effortDistance(loadDist, ma): number
export function inclinedPlaneForces(massKg, angleRad, frictionCoeff, gravity): object
export function workDone(force, distance): number

// Newton's Cradle
export function cradleCollision(numBallsRaised, velocity, totalBalls): Array<{ballIndex,velocity}>

// Statistical (for stopwatch)
export function mean(values: number[]): number
export function sampleStdDev(values: number[]): number
export function standardError(values: number[]): number
export const TYPICAL_REACTION_TIME_MS = 200

// Angle (for protractor)
export function classifyAngle(degrees): string
export function supplementary(degrees): number
export function complementary(degrees): number|null

// Parallax (for ruler)
export function parallaxError(heightMm, viewAngleRad): number

// Triple beam balance
export function beamBalance(beam1g, beam2g, beam3g): {totalReadingG, isBalanced, pointerDeflection}

// Analytical balance settling
export function balanceReading(trueMassG, timeSincePlace, tau?, doorsOpen?): number
```

### `lib/physics/waves.ts` — CREATE THIS FILE

```ts
// Wave fundamentals
export function waveSpeed(frequency, wavelength): number
export function frequencyFromPeriod(period): number
export function waveDisplacement(x, t, A, lambda, period): number

// Ripple tank — superposition
export function waveAmplitude(x, y, sx, sy, amplitude, wavelength, frequency, time): number
export function superpositionAmplitude(x, y, sources, amplitude, wavelength, frequency, time): number

// Sonometer
export function stringFrequency(L, T, mu): number
export function harmonicFrequency(f1, n): number
export function nodePositions(L, n): number[]
export function standingWave(x, t, L, amplitude, frequency, harmonic): number

// Resonance tube
export function closedPipeResonantLengths(wavelength, maxN?): number[]
export function openPipeResonantLengths(wavelength, maxN?): number[]
export function speedOfSound(f, L1, L2): number

// Doppler
export function dopplerFrequency(fSource, vSound, vSource, vObserver): number
```

### `lib/physics/signals.ts` — CREATE THIS FILE

```ts
export type WaveformType = 'sine'|'square'|'triangle'|'sawtooth'|'noise'|'dc'

export function generateWaveform(type, frequency, amplitude, dcOffset, phase, sampleRate, numSamples): number[]
export function autoMeasure(samples, sampleRate): {frequency,period,vpp,vrms,vmax,vmin,dutyCycle,risetime}
export function computeFFT(samples, sampleRate): Array<{freq,mag}>
```

### `lib/physics/chemistry.ts` — CREATE THIS FILE

```ts
// Titration
export function titrationPH(molesSA, molesSB, totalVolL): number
export function weakAcidTitrationPH(molesWA, molesSB, totalVolL, pKa): number
export function indicatorColor(ph, indicator): string

// Beer-Lambert
export function absorbance(epsilon, concentration, pathLength): number
export function transmittance(absorbance): number
export function concentrationFromAbsorbance(A, epsilon, l): number

// Faraday
export function massDeposited(molarMass, current, timeS, electrons, faraday): number
export function gasVolume(moles): number

// Distillation
export function vapourPressure(tempC, A, B, C): number
export function boilingPoint(A, B, C, pressureMMHg?): number

// Microscope focus
export function totalMagnification(objective, eyepiece): number
export function scaleBarMicrons(totalMag): number
export function focusBlur(focusSliderValue, sharpValue, maxOffset): number

// Graduated cylinder
export function correctMeniscusReading(liquidType, markedVolumeMl): number
export function cylinderParallax(viewAngleDeg, cylinderDiameterMm, scaleSpacingMmPerMl): number
```

### `lib/physics/biosignals.ts` — CREATE THIS FILE

```ts
export type ECGRhythm = 'nsr'|'tachy'|'brady'|'afib'|'vtach'|'vfib'|'hb1'|'hb2'|'hb3'

export function generateECG(rhythm, durationS, sampleRate): number[]
export function measureECG(samples, sampleRate): {heartRateBPM,prIntervalMs,qrsDurationMs,qtIntervalMs,qtcMs,rhythm}
export function fev1FvcRatio(fev1, fvc): number
export function predictedFVC(ageyears, heightCm, male): number
export function cuffPressureAtTime(startPressure, deflateRate, time): number
export function korotkoffSound(cuffPressure, systolic, diastolic): 'silent'|'sound'
```

### `lib/physics/thermodynamics.ts` — CREATE THIS FILE

```ts
export function idealGasPressure(n, T, V): number
export function boylesP2(P1, V1, V2): number
export function charlesV2(V1, T1, T2): number
export function carnotEfficiency(T_hot, T_cold): number
export function carnotWork(efficiency, Q_hot): number
export function carnotPVCycle(n, T_hot, T_cold, V1): Array<{P,V,process}>
```

### `lib/physics/nuclear.ts` — CREATE THIS FILE

```ts
export function countRateAtDistance(N0, d0, d): number
export function shieldingFactor(mu, thickness): number
export function simulateClicks(meanCPM, intervalS): number
export function doseRate(sourceType, distanceCm, shielded): number
export function annualDoseLimit(type): number
export function generateTrack(type, chamberWidth, chamberHeight, magneticField?): Array<{x,y,thickness,opacity}>
export function neutronMultiplication(controlRodInsertion, enrichment, moderatorType): number
export function reactorPowerStep(currentPower, k, dt): number
```

### `lib/physics/astronomy.ts` — CREATE THIS FILE

```ts
export function keplerPeriod(semiMajorAxisAU): number
export function planetPosition(semiMajorAxisAU, orbitalPeriodYears, timeYears, inclination?): {x,y}
export function equatorialToHorizon(raDeg, decDeg, latDeg, lstDeg): {altDeg,azDeg}
export function localSiderealTime(longitudeDeg, utcDate): number
export function starRadius(magnitude): number
export function recessionVelocity(measuredWavelengthNm, restWavelengthNm): number
export function spectralType(tempK): 'O'|'B'|'A'|'F'|'G'|'K'|'M'
```

### `lib/physics/analytical.ts` — CREATE THIS FILE

```ts
export function massToChargeRadius(mOverZ, acceleratingVoltage, magneticField): number
export function predictFragments(formula, molecularWeight): Array<{mz,relativeIntensity,assignment}>
export function predictHNMR(formula): Array<{delta,numH,multiplicity,jHz}>
export function larmorFrequency(B0Tesla, gamma): number
export function braggAngles(wavelengthNm, dSpacingNm, maxN?): Array<{n,twoTheta}>
export function cubicDSpacing(a, h, k, l): number
export function hertzianForce(reducedModulus, tipRadiusNm, indentationNm): number
export function rmsRoughness(heightMap): number
export function generateHeightMap(sampleId, widthPixels, scanSizeNm): number[][]
```

---

## FINAL COMPLETION CHECKLIST

After this patch is merged into `LABFORGE_FUTURE_INSTRUMENTS.md`:

**Every instrument now has:**
- [ ] Physics section (equations + function signatures)
- [ ] Controls section (user-facing inputs)
- [ ] Canvas section (what to draw and how)
- [ ] Readouts section (what values to display)
- [ ] Curricula section (which courses use it)
- [ ] Related IDs (for navigation)
- [ ] Registry entry (in the registry block)

**All 9 new lib/physics files specified:**
- [ ] mechanics.ts — 20 functions
- [ ] waves.ts — 12 functions
- [ ] signals.ts — 3 functions + type
- [ ] chemistry.ts — 14 functions
- [ ] biosignals.ts — 7 functions + type
- [ ] thermodynamics.ts — 6 functions
- [ ] nuclear.ts — 8 functions
- [ ] astronomy.ts — 8 functions
- [ ] analytical.ts — 9 functions

**Grand total platform:**
- 62 instruments specified across 11 science classes
- 9 built, 53 to build in priority order
- Every instrument: types + engine + App + index = 4 files each
- Total future source files: 53 × 4 = 212 files + 9 lib files = 221 files

**Curricula:** University Physics/Materials/Biology  
**Related IDs:** `xrd`

---

## REGISTRY ENTRIES — COMPLETE

> Add all of the following to `src/labforge/registry/index.ts` after the existing 9 entries.

```ts
// ─── OPTICS (additional) ──────────────────────────────────────────────────
{ id: 'snells-law',       scienceClass: 'optics',    level: 'student',      ai: 'none',     load: () => import('../instruments/snells-law') },
{ id: 'prism-dispersion', scienceClass: 'optics',    level: 'student',      ai: 'none',     load: () => import('../instruments/prism-dispersion') },
{ id: 'human-eye',        scienceClass: 'optics',    level: 'student',      ai: 'explain',  load: () => import('../instruments/human-eye') },
{ id: 'optics-bench',     scienceClass: 'optics',    level: 'intermediate', ai: 'none',     load: () => import('../instruments/optics-bench') },
{ id: 'ripple-tank',      scienceClass: 'optics',    level: 'intermediate', ai: 'explain',  load: () => import('../instruments/ripple-tank') },

// ─── MECHANICS ────────────────────────────────────────────────────────────
{ id: 'spring-hookes-law',scienceClass: 'mechanics', level: 'student',      ai: 'none',     load: () => import('../instruments/spring-hookes-law') },
{ id: 'projectile-motion',scienceClass: 'mechanics', level: 'student',      ai: 'none',     load: () => import('../instruments/projectile-motion') },
{ id: 'lever',            scienceClass: 'mechanics', level: 'student',      ai: 'none',     load: () => import('../instruments/lever') },
{ id: 'pulley',           scienceClass: 'mechanics', level: 'student',      ai: 'none',     load: () => import('../instruments/pulley') },
{ id: 'inclined-plane',   scienceClass: 'mechanics', level: 'student',      ai: 'none',     load: () => import('../instruments/inclined-plane') },
{ id: 'newtons-cradle',   scienceClass: 'mechanics', level: 'student',      ai: 'none',     load: () => import('../instruments/newtons-cradle') },
{ id: 'doppler-effect',   scienceClass: 'mechanics', level: 'intermediate', ai: 'none',     load: () => import('../instruments/doppler-effect') },

// ─── ELECTRICITY ──────────────────────────────────────────────────────────
{ id: 'multimeter',       scienceClass: 'electricity', level: 'student',    ai: 'none',     load: () => import('../instruments/multimeter') },
{ id: 'oscilloscope',     scienceClass: 'electricity', level: 'advanced',   ai: 'explain',  load: () => import('../instruments/oscilloscope') },
{ id: 'function-generator',scienceClass:'electricity', level: 'advanced',   ai: 'none',     load: () => import('../instruments/function-generator') },
{ id: 'wheatstone-bridge',scienceClass: 'electricity', level: 'intermediate',ai:'none',     load: () => import('../instruments/wheatstone-bridge') },
{ id: 'dc-power-supply',  scienceClass: 'electricity', level: 'intermediate',ai:'none',     load: () => import('../instruments/dc-power-supply') },

// ─── WAVES & SOUND ────────────────────────────────────────────────────────
{ id: 'sonometer',        scienceClass: 'waves',     level: 'student',      ai: 'none',     load: () => import('../instruments/sonometer') },
{ id: 'resonance-tube',   scienceClass: 'waves',     level: 'student',      ai: 'none',     load: () => import('../instruments/resonance-tube') },
{ id: 'wave-properties',  scienceClass: 'waves',     level: 'student',      ai: 'none',     load: () => import('../instruments/wave-properties') },
{ id: 'spectrum-analyser',scienceClass: 'waves',     level: 'advanced',     ai: 'none',     load: () => import('../instruments/spectrum-analyser') },

// ─── CHEMISTRY (additional) ───────────────────────────────────────────────
{ id: 'titration',        scienceClass: 'chemistry', level: 'student',      ai: 'explain',  load: () => import('../instruments/titration') },
{ id: 'colorimeter',      scienceClass: 'chemistry', level: 'intermediate', ai: 'none',     load: () => import('../instruments/colorimeter') },
{ id: 'electrolysis',     scienceClass: 'chemistry', level: 'intermediate', ai: 'explain',  load: () => import('../instruments/electrolysis') },
{ id: 'chromatography',   scienceClass: 'chemistry', level: 'student',      ai: 'none',     load: () => import('../instruments/chromatography') },
{ id: 'distillation',     scienceClass: 'chemistry', level: 'intermediate', ai: 'none',     load: () => import('../instruments/distillation') },

// ─── BIOLOGY & MEDICINE ───────────────────────────────────────────────────
{ id: 'microscope',        scienceClass: 'biology',  level: 'student',      ai: 'identify', load: () => import('../instruments/microscope') },
{ id: 'ecg-monitor',       scienceClass: 'biology',  level: 'intermediate', ai: 'identify', load: () => import('../instruments/ecg-monitor') },
{ id: 'blood-pressure-monitor',scienceClass:'biology',level:'student',       ai: 'none',     load: () => import('../instruments/blood-pressure-monitor') },
{ id: 'spirometer',        scienceClass: 'biology',  level: 'intermediate', ai: 'identify', load: () => import('../instruments/spirometer') },

// ─── THERMODYNAMICS ───────────────────────────────────────────────────────
{ id: 'boyles-law',       scienceClass: 'thermodynamics', level: 'student', ai: 'none',     load: () => import('../instruments/boyles-law') },
{ id: 'charles-law',      scienceClass: 'thermodynamics', level: 'student', ai: 'none',     load: () => import('../instruments/charles-law') },
{ id: 'carnot-engine',    scienceClass: 'thermodynamics', level: 'advanced',ai: 'explain',  load: () => import('../instruments/carnot-engine') },

// ─── NUCLEAR ──────────────────────────────────────────────────────────────
{ id: 'geiger-counter',   scienceClass: 'nuclear',   level: 'student',      ai: 'none',     load: () => import('../instruments/geiger-counter') },
{ id: 'cloud-chamber',    scienceClass: 'nuclear',   level: 'intermediate', ai: 'identify', load: () => import('../instruments/cloud-chamber') },
{ id: 'radiation-dose',   scienceClass: 'nuclear',   level: 'student',      ai: 'none',     load: () => import('../instruments/radiation-dose') },
{ id: 'nuclear-reactor',  scienceClass: 'nuclear',   level: 'advanced',     ai: 'explain',  load: () => import('../instruments/nuclear-reactor') },

// ─── MEASUREMENT (additional) ─────────────────────────────────────────────
{ id: 'ruler',            scienceClass: 'measurement', level: 'student',    ai: 'none',     load: () => import('../instruments/ruler') },
{ id: 'micrometer',       scienceClass: 'measurement', level: 'student',    ai: 'none',     load: () => import('../instruments/micrometer') },
{ id: 'triple-beam-balance',scienceClass:'measurement',level: 'student',    ai: 'none',     load: () => import('../instruments/triple-beam-balance') },
{ id: 'analytical-balance',scienceClass:'measurement', level: 'intermediate',ai:'none',     load: () => import('../instruments/analytical-balance') },
{ id: 'graduated-cylinder',scienceClass:'measurement', level: 'student',    ai: 'none',     load: () => import('../instruments/graduated-cylinder') },
{ id: 'stopwatch',         scienceClass:'measurement', level: 'student',    ai: 'none',     load: () => import('../instruments/stopwatch') },
{ id: 'protractor',        scienceClass:'measurement', level: 'student',    ai: 'none',     load: () => import('../instruments/protractor') },

// ─── ASTRONOMY ────────────────────────────────────────────────────────────
{ id: 'solar-orrery',     scienceClass: 'astronomy', level: 'student',      ai: 'none',     load: () => import('../instruments/solar-orrery') },
{ id: 'star-chart',       scienceClass: 'astronomy', level: 'student',      ai: 'identify', load: () => import('../instruments/star-chart') },
{ id: 'refracting-telescope',scienceClass:'astronomy',level:'intermediate',  ai: 'none',     load: () => import('../instruments/refracting-telescope') },
{ id: 'reflecting-telescope',scienceClass:'astronomy',level:'intermediate',  ai: 'none',     load: () => import('../instruments/reflecting-telescope') },
{ id: 'stellar-spectrograph',scienceClass:'astronomy',level:'expert',        ai: 'identify', load: () => import('../instruments/stellar-spectrograph') },

// ─── ADVANCED RESEARCH ────────────────────────────────────────────────────
{ id: 'mass-spectrometer',scienceClass:'advanced-research',level:'expert',   ai:'interpret', load: () => import('../instruments/mass-spectrometer') },
{ id: 'nmr-spectrometer', scienceClass:'advanced-research',level:'expert',   ai:'interpret', load: () => import('../instruments/nmr-spectrometer') },
{ id: 'xrd',              scienceClass:'advanced-research',level:'expert',   ai: 'none',     load: () => import('../instruments/xrd') },
{ id: 'afm',              scienceClass:'advanced-research',level:'expert',   ai: 'none',     load: () => import('../instruments/afm') },
```

---

## NEW LIB FILES TO CREATE

When building future instruments, create these new `lib/physics/` files as needed:

| File | Created when | Instruments that use it |
|------|-------------|------------------------|
| `lib/physics/mechanics.ts` | When building spring / projectile / lever | spring, projectile, lever, pulley, inclined-plane, cradle |
| `lib/physics/waves.ts` | When building ripple-tank / sonometer | ripple-tank, sonometer, resonance-tube, wave-properties, doppler |
| `lib/physics/signals.ts` | When building oscilloscope | oscilloscope, function-generator, spectrum-analyser |
| `lib/physics/chemistry.ts` | When building titration | titration, colorimeter, electrolysis, distillation |
| `lib/physics/biosignals.ts` | When building ECG | ecg-monitor, spirometer |
| `lib/physics/thermodynamics.ts` | When building Boyle's | boyles-law, charles-law, carnot-engine |
| `lib/physics/nuclear.ts` | When building Geiger | geiger-counter, cloud-chamber, nuclear-reactor |
| `lib/physics/astronomy.ts` | When building orrery | solar-orrery, star-chart, stellar-spectrograph |
| `lib/physics/analytical.ts` | When building mass spec | mass-spectrometer, nmr-spectrometer, xrd |

**Rule:** Add to an existing file if < 3 new functions. Create a new file if > 3.

---

## BUILD PRIORITY SUMMARY

### 🥇 Tier 1 — Build Immediately After Initial 8

These are in the KPTBB Class 6–10 curriculum and will be used by the most students.

```
1.  ruler
2.  micrometer
3.  graduated-cylinder
4.  stopwatch
5.  protractor
6.  triple-beam-balance
7.  lever
8.  pulley
9.  inclined-plane
10. snells-law
11. projectile-motion
12. spring-hookes-law
13. newtons-cradle
14. wave-properties
15. boyles-law
16. charles-law
17. geiger-counter
18. radiation-dose
19. multimeter
20. titration
21. chromatography
22. microscope
23. blood-pressure-monitor
24. solar-orrery
25. star-chart
```

### 🥈 Tier 2 — University & Advanced School

```
26. prism-dispersion
27. human-eye
28. wheatstone-bridge
29. dc-power-supply
30. sonometer
31. resonance-tube
32. colorimeter
33. electrolysis
34. distillation
35. ecg-monitor
36. spirometer
37. doppler-effect
38. carnot-engine
39. cloud-chamber
40. nuclear-reactor
41. refracting-telescope
42. reflecting-telescope
43. analytical-balance
```

### 🥉 Tier 3 — Expert / Research Level

```
44. ripple-tank
45. optics-bench
46. oscilloscope
47. function-generator
48. spectrum-analyser
49. mass-spectrometer
50. nmr-spectrometer
51. xrd
52. afm
53. stellar-spectrograph
```

---

## TOTAL INSTRUMENT COUNT

| Status | Count |
|--------|-------|
| Built (initial 8 + chem-lab) | 9 |
| Specified in this document | 43 |
| **Total platform** | **52** |

---

## USER-FACING LABEL FOR EACH INSTRUMENT

> These are the exact strings to use in registry `name` field and UI cards.

| ID | User-Facing Name |
|----|-----------------|
| snells-law | Snell's Law & Refraction |
| prism-dispersion | Prism & Light Dispersion |
| human-eye | Human Eye & Vision Defects |
| optics-bench | Optics Bench |
| ripple-tank | Ripple Tank & Wave Interference |
| spring-hookes-law | Hooke's Law Spring |
| projectile-motion | Projectile Motion |
| lever | Lever (Simple Machine) |
| pulley | Pulley System |
| inclined-plane | Inclined Plane |
| newtons-cradle | Newton's Cradle |
| doppler-effect | Doppler Effect |
| multimeter | Digital Multimeter |
| oscilloscope | Digital Oscilloscope |
| function-generator | Function Generator |
| wheatstone-bridge | Wheatstone Bridge |
| dc-power-supply | DC Power Supply |
| sonometer | Sonometer |
| resonance-tube | Resonance Tube |
| wave-properties | Wave Properties Explorer |
| spectrum-analyser | Spectrum Analyser |
| titration | Acid-Base Titration |
| colorimeter | Colorimeter |
| electrolysis | Electrolysis Cell |
| chromatography | Paper Chromatography |
| distillation | Distillation Apparatus |
| microscope | Light Microscope |
| ecg-monitor | ECG Monitor |
| blood-pressure-monitor | Blood Pressure Monitor |
| spirometer | Spirometer |
| boyles-law | Boyle's Law |
| charles-law | Charles's Law |
| carnot-engine | Carnot Heat Engine |
| geiger-counter | Geiger-Müller Counter |
| cloud-chamber | Wilson Cloud Chamber |
| radiation-dose | Radiation Dose Meter |
| nuclear-reactor | Nuclear Reactor Model |
| ruler | Ruler & Scale Reading |
| micrometer | Micrometer Screw Gauge |
| triple-beam-balance | Triple Beam Balance |
| analytical-balance | Analytical Balance |
| graduated-cylinder | Graduated Cylinder |
| stopwatch | Stopwatch & Timer |
| protractor | Protractor |
| solar-orrery | Solar System Orrery |
| star-chart | Interactive Star Chart |
| refracting-telescope | Refracting Telescope |
| reflecting-telescope | Reflecting Telescope |
| stellar-spectrograph | Stellar Spectrograph |
| mass-spectrometer | Mass Spectrometer |
| nmr-spectrometer | NMR Spectrometer |
| xrd | X-Ray Diffractometer |
| afm | Atomic Force Microscope |

---

*End of LabForge Future Instruments Specification v1.0.0*  
*Use alongside LABFORGE_SPEC_COMPLETE.md*  
*To build any instrument: create its folder, add registry entry, build in order: types → engine → App → index*


---

## COMPLETE SECTION — Per-Instrument DeepSeek Build Template

When building each future instrument, use this template with the spec:

```
Build instrument: `[instrument-id]`
Folder: src/labforge/instruments/[instrument-id]/

FILES TO BUILD IN ORDER:
1. types.ts
2. engine.ts  
3. [InstrumentName]App.tsx
4. index.ts → export { [InstrumentName]App as default } from './[InstrumentName]App'

REGISTRY: Add the registry entry from LABFORGE_FUTURE_INSTRUMENTS.md to registry/index.ts

PHYSICS LIBRARY:
  - If this instrument needs new physics functions, add them to lib/physics/[domain].ts first
  - New lib files to create if not existing: [list from spec]
  - Run npx tsc --noEmit after every lib change

RULES (same as always):
- strict TypeScript, no any, all functions have explicit return types
- No console.log — use logger from lib/logger.ts
- Canvas draw functions: ctx.save() at start, ctx.restore() at end
- All canvases need ResizeObserver pattern (from Wave 2 header in LABFORGE_SPEC_COMPLETE.md)
- Physics equations: JSDoc comment with formula written out
- Engine file: only physics, no React, no canvas calls
- App component: only UI, imports engine and lib/canvas/

After each file: npx tsc --noEmit
After all 4 files: verify instrument opens in LabForge without errors
```

---

## COMPLETE INSTRUMENT CATALOGUE TABLE

> Final reference for all 52 instruments across the platform.

| # | ID | Name | Class | Level | AI | Tier |
|---|----|----|-------|-------|-----|------|
| 1 | convex-lens | Convex Lens | Optics | Student | explain | Built |
| 2 | concave-lens | Concave Lens | Optics | Student | explain | Built |
| 3 | concave-mirror | Concave Mirror | Optics | Student | explain | Built |
| 4 | convex-mirror | Convex Mirror | Optics | Student | explain | Built |
| 5 | pendulum | Simple Pendulum | Mechanics | Student | none | Built |
| 6 | ohm-circuit | Ohm's Law & Circuits | Electricity | Student | none | Built |
| 7 | vernier-caliper | Vernier Caliper | Measurement | Student | none | Built |
| 8 | ph-meter | pH Meter | Chemistry | Student | none | Built |
| 9 | chem-lab | Chemistry Lab Simulator | Chemistry | Advanced | explain | Built |
| 10 | ruler | Ruler & Scale Reading | Measurement | Student | none | 🥇 |
| 11 | micrometer | Micrometer Screw Gauge | Measurement | Student | none | 🥇 |
| 12 | graduated-cylinder | Graduated Cylinder | Measurement | Student | none | 🥇 |
| 13 | stopwatch | Stopwatch & Timer | Measurement | Student | none | 🥇 |
| 14 | protractor | Protractor | Measurement | Student | none | 🥇 |
| 15 | triple-beam-balance | Triple Beam Balance | Measurement | Student | none | 🥇 |
| 16 | lever | Lever (Simple Machine) | Mechanics | Student | none | 🥇 |
| 17 | pulley | Pulley System | Mechanics | Student | none | 🥇 |
| 18 | inclined-plane | Inclined Plane | Mechanics | Student | none | 🥇 |
| 19 | snells-law | Snell's Law & Refraction | Optics | Student | none | 🥇 |
| 20 | projectile-motion | Projectile Motion | Mechanics | Student | none | 🥇 |
| 21 | spring-hookes-law | Hooke's Law Spring | Mechanics | Student | none | 🥇 |
| 22 | newtons-cradle | Newton's Cradle | Mechanics | Student | none | 🥇 |
| 23 | wave-properties | Wave Properties Explorer | Waves | Student | none | 🥇 |
| 24 | boyles-law | Boyle's Law | Thermo | Student | none | 🥇 |
| 25 | charles-law | Charles's Law | Thermo | Student | none | 🥇 |
| 26 | geiger-counter | Geiger-Müller Counter | Nuclear | Student | none | 🥇 |
| 27 | radiation-dose | Radiation Dose Meter | Nuclear | Student | none | 🥇 |
| 28 | multimeter | Digital Multimeter | Electricity | Student | none | 🥇 |
| 29 | titration | Acid-Base Titration | Chemistry | Student | explain | 🥇 |
| 30 | chromatography | Paper Chromatography | Chemistry | Student | none | 🥇 |
| 31 | microscope | Light Microscope | Biology | Student | identify | 🥇 |
| 32 | blood-pressure-monitor | Blood Pressure Monitor | Biology | Student | none | 🥇 |
| 33 | solar-orrery | Solar System Orrery | Astronomy | Student | none | 🥇 |
| 34 | star-chart | Interactive Star Chart | Astronomy | Student | identify | 🥇 |
| 35 | prism-dispersion | Prism & Light Dispersion | Optics | Student | none | 🥈 |
| 36 | human-eye | Human Eye & Vision Defects | Optics | Student | explain | 🥈 |
| 37 | wheatstone-bridge | Wheatstone Bridge | Electricity | Intermediate | none | 🥈 |
| 38 | dc-power-supply | DC Power Supply | Electricity | Intermediate | none | 🥈 |
| 39 | sonometer | Sonometer | Waves | Student | none | 🥈 |
| 40 | resonance-tube | Resonance Tube | Waves | Student | none | 🥈 |
| 41 | colorimeter | Colorimeter | Chemistry | Intermediate | none | 🥈 |
| 42 | electrolysis | Electrolysis Cell | Chemistry | Intermediate | explain | 🥈 |
| 43 | distillation | Distillation Apparatus | Chemistry | Intermediate | none | 🥈 |
| 44 | ecg-monitor | ECG Monitor | Biology | Intermediate | identify | 🥈 |
| 45 | spirometer | Spirometer | Biology | Intermediate | identify | 🥈 |
| 46 | doppler-effect | Doppler Effect | Mechanics | Intermediate | none | 🥈 |
| 47 | carnot-engine | Carnot Heat Engine | Thermo | Advanced | explain | 🥈 |
| 48 | cloud-chamber | Wilson Cloud Chamber | Nuclear | Intermediate | identify | 🥈 |
| 49 | nuclear-reactor | Nuclear Reactor Model | Nuclear | Advanced | explain | 🥈 |
| 50 | refracting-telescope | Refracting Telescope | Astronomy | Intermediate | none | 🥈 |
| 51 | reflecting-telescope | Reflecting Telescope | Astronomy | Intermediate | none | 🥈 |
| 52 | analytical-balance | Analytical Balance | Measurement | Intermediate | none | 🥈 |
| 53 | ripple-tank | Ripple Tank | Optics | Intermediate | explain | 🥉 |
| 54 | optics-bench | Optics Bench | Optics | Intermediate | none | 🥉 |
| 55 | oscilloscope | Digital Oscilloscope | Electricity | Advanced | explain | 🥉 |
| 56 | function-generator | Function Generator | Electricity | Advanced | none | 🥉 |
| 57 | spectrum-analyser | Spectrum Analyser | Waves | Advanced | none | 🥉 |
| 58 | mass-spectrometer | Mass Spectrometer | Advanced Research | Expert | interpret | 🥉 |
| 59 | nmr-spectrometer | NMR Spectrometer | Advanced Research | Expert | interpret | 🥉 |
| 60 | xrd | X-Ray Diffractometer | Advanced Research | Expert | none | 🥉 |
| 61 | afm | Atomic Force Microscope | Advanced Research | Expert | none | 🥉 |
| 62 | stellar-spectrograph | Stellar Spectrograph | Astronomy | Expert | identify | 🥉 |

**Total: 62 instruments. 9 built. 53 specified.**

---

## NEW LIB PHYSICS FUNCTIONS — CONSOLIDATED LIST

> Every new physics function needed across all future instruments. Add to the specified file.

### `lib/physics/mechanics.ts` — CREATE THIS FILE

```ts
// Hooke's Law
export function hookeExtension(forceN, springConstant): number
export function shm(x0, k, mass, t): number
export function shmOmega(k, mass): number
export function shmPeriod(k, mass): number
export function beyondElasticLimit(extension, limitM): boolean

// Projectile
export function projectilePosition(v0, theta, h0, g, t): {x,y,vx,vy}
export function timeOfFlight(v0, theta, h0, g): number
export function maxHeight(v0, theta, h0, g): number
export function range(v0, theta, h0, g): number

// Simple machines
export function moment(force, distance): number
export function mechanicalAdvantage(effortDist, loadDist): number
export function leverClass(fulcrumPos, effortPos, loadPos): 1|2|3
export function pulleyMA(supportingRopes): number
export function pulleyEffort(load, ma): number
export function effortDistance(loadDist, ma): number
export function inclinedPlaneForces(massKg, angleRad, frictionCoeff, gravity): object
export function workDone(force, distance): number

// Newton's Cradle
export function cradleCollision(numBallsRaised, velocity, totalBalls): Array<{ballIndex,velocity}>

// Statistical (for stopwatch)
export function mean(values: number[]): number
export function sampleStdDev(values: number[]): number
export function standardError(values: number[]): number
export const TYPICAL_REACTION_TIME_MS = 200

// Angle (for protractor)
export function classifyAngle(degrees): string
export function supplementary(degrees): number
export function complementary(degrees): number|null

// Parallax (for ruler)
export function parallaxError(heightMm, viewAngleRad): number

// Triple beam balance
export function beamBalance(beam1g, beam2g, beam3g): {totalReadingG, isBalanced, pointerDeflection}

// Analytical balance settling
export function balanceReading(trueMassG, timeSincePlace, tau?, doorsOpen?): number
```

### `lib/physics/waves.ts` — CREATE THIS FILE

```ts
// Wave fundamentals
export function waveSpeed(frequency, wavelength): number
export function frequencyFromPeriod(period): number
export function waveDisplacement(x, t, A, lambda, period): number

// Ripple tank — superposition
export function waveAmplitude(x, y, sx, sy, amplitude, wavelength, frequency, time): number
export function superpositionAmplitude(x, y, sources, amplitude, wavelength, frequency, time): number

// Sonometer
export function stringFrequency(L, T, mu): number
export function harmonicFrequency(f1, n): number
export function nodePositions(L, n): number[]
export function standingWave(x, t, L, amplitude, frequency, harmonic): number

// Resonance tube
export function closedPipeResonantLengths(wavelength, maxN?): number[]
export function openPipeResonantLengths(wavelength, maxN?): number[]
export function speedOfSound(f, L1, L2): number

// Doppler
export function dopplerFrequency(fSource, vSound, vSource, vObserver): number
```

### `lib/physics/signals.ts` — CREATE THIS FILE

```ts
export type WaveformType = 'sine'|'square'|'triangle'|'sawtooth'|'noise'|'dc'

export function generateWaveform(type, frequency, amplitude, dcOffset, phase, sampleRate, numSamples): number[]
export function autoMeasure(samples, sampleRate): {frequency,period,vpp,vrms,vmax,vmin,dutyCycle,risetime}
export function computeFFT(samples, sampleRate): Array<{freq,mag}>
```

### `lib/physics/chemistry.ts` — CREATE THIS FILE

```ts
// Titration
export function titrationPH(molesSA, molesSB, totalVolL): number
export function weakAcidTitrationPH(molesWA, molesSB, totalVolL, pKa): number
export function indicatorColor(ph, indicator): string

// Beer-Lambert
export function absorbance(epsilon, concentration, pathLength): number
export function transmittance(absorbance): number
export function concentrationFromAbsorbance(A, epsilon, l): number

// Faraday
export function massDeposited(molarMass, current, timeS, electrons, faraday): number
export function gasVolume(moles): number

// Distillation
export function vapourPressure(tempC, A, B, C): number
export function boilingPoint(A, B, C, pressureMMHg?): number

// Microscope focus
export function totalMagnification(objective, eyepiece): number
export function scaleBarMicrons(totalMag): number
export function focusBlur(focusSliderValue, sharpValue, maxOffset): number

// Graduated cylinder
export function correctMeniscusReading(liquidType, markedVolumeMl): number
export function cylinderParallax(viewAngleDeg, cylinderDiameterMm, scaleSpacingMmPerMl): number
```

### `lib/physics/biosignals.ts` — CREATE THIS FILE

```ts
export type ECGRhythm = 'nsr'|'tachy'|'brady'|'afib'|'vtach'|'vfib'|'hb1'|'hb2'|'hb3'

export function generateECG(rhythm, durationS, sampleRate): number[]
export function measureECG(samples, sampleRate): {heartRateBPM,prIntervalMs,qrsDurationMs,qtIntervalMs,qtcMs,rhythm}
export function fev1FvcRatio(fev1, fvc): number
export function predictedFVC(ageyears, heightCm, male): number
export function cuffPressureAtTime(startPressure, deflateRate, time): number
export function korotkoffSound(cuffPressure, systolic, diastolic): 'silent'|'sound'
```

### `lib/physics/thermodynamics.ts` — CREATE THIS FILE

```ts
export function idealGasPressure(n, T, V): number
export function boylesP2(P1, V1, V2): number
export function charlesV2(V1, T1, T2): number
export function carnotEfficiency(T_hot, T_cold): number
export function carnotWork(efficiency, Q_hot): number
export function carnotPVCycle(n, T_hot, T_cold, V1): Array<{P,V,process}>
```

### `lib/physics/nuclear.ts` — CREATE THIS FILE

```ts
export function countRateAtDistance(N0, d0, d): number
export function shieldingFactor(mu, thickness): number
export function simulateClicks(meanCPM, intervalS): number
export function doseRate(sourceType, distanceCm, shielded): number
export function annualDoseLimit(type): number
export function generateTrack(type, chamberWidth, chamberHeight, magneticField?): Array<{x,y,thickness,opacity}>
export function neutronMultiplication(controlRodInsertion, enrichment, moderatorType): number
export function reactorPowerStep(currentPower, k, dt): number
```

### `lib/physics/astronomy.ts` — CREATE THIS FILE

```ts
export function keplerPeriod(semiMajorAxisAU): number
export function planetPosition(semiMajorAxisAU, orbitalPeriodYears, timeYears, inclination?): {x,y}
export function equatorialToHorizon(raDeg, decDeg, latDeg, lstDeg): {altDeg,azDeg}
export function localSiderealTime(longitudeDeg, utcDate): number
export function starRadius(magnitude): number
export function recessionVelocity(measuredWavelengthNm, restWavelengthNm): number
export function spectralType(tempK): 'O'|'B'|'A'|'F'|'G'|'K'|'M'
```

### `lib/physics/analytical.ts` — CREATE THIS FILE

```ts
export function massToChargeRadius(mOverZ, acceleratingVoltage, magneticField): number
export function predictFragments(formula, molecularWeight): Array<{mz,relativeIntensity,assignment}>
export function predictHNMR(formula): Array<{delta,numH,multiplicity,jHz}>
export function larmorFrequency(B0Tesla, gamma): number
export function braggAngles(wavelengthNm, dSpacingNm, maxN?): Array<{n,twoTheta}>
export function cubicDSpacing(a, h, k, l): number
export function hertzianForce(reducedModulus, tipRadiusNm, indentationNm): number
export function rmsRoughness(heightMap): number
export function generateHeightMap(sampleId, widthPixels, scanSizeNm): number[][]
```

---

## FINAL COMPLETION CHECKLIST

After this patch is merged into `LABFORGE_FUTURE_INSTRUMENTS.md`:

**Every instrument now has:**
- [ ] Physics section (equations + function signatures)
- [ ] Controls section (user-facing inputs)
- [ ] Canvas section (what to draw and how)
- [ ] Readouts section (what values to display)
- [ ] Curricula section (which courses use it)
- [ ] Related IDs (for navigation)
- [ ] Registry entry (in the registry block)

**All 9 new lib/physics files specified:**
- [ ] mechanics.ts — 20 functions
- [ ] waves.ts — 12 functions
- [ ] signals.ts — 3 functions + type
- [ ] chemistry.ts — 14 functions
- [ ] biosignals.ts — 7 functions + type
- [ ] thermodynamics.ts — 6 functions
- [ ] nuclear.ts — 8 functions
- [ ] astronomy.ts — 8 functions
- [ ] analytical.ts — 9 functions

**Grand total platform:**
- 62 instruments specified across 11 science classes
- 9 built, 53 to build in priority order
- Every instrument: types + engine + App + index = 4 files each
- Total future source files: 53 × 4 = 212 files + 9 lib files = 221 files

---

*End of LABFORGE_FUTURE_INSTRUMENTS completion patch v1.1*  
*Merge: LABFORGE_FUTURE_INSTRUMENTS.md + this patch = complete specification*
