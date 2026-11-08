// src/labforge/lib/constants.ts
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