// instrumentation-core/contracts/instrument-implementation-contracts.ts
/**
 * Instrument Implementation Contracts
 * 
 * Responsibilities:
 * - Define shared types for concrete scientific instruments
 * - Extend the base instrument contracts with domain-specific payloads
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

import type { InstrumentId, InstrumentType } from '../contracts/instrument-contracts';

export interface BeakerContents {
  substances: Array<{
    substanceId: string;
    name: string;
    amount: number; // moles
    concentration: number; // mol/L
    temperature: number; // K
  }>;
  totalVolume: number; // L
  pH: number;
}

export interface SpectrometerReading {
  wavelengths: number[]; // nm
  intensities: number[]; // arbitrary units
  peaks: Array<{ wavelength: number; intensity: number }>;
  integrationTime: number; // ms
}

export interface OscilloscopeFrame {
  timeBase: [number, number]; // start, end in seconds
  voltageScale: [number, number]; // min, max in volts
  samples: Array<{ time: number; voltage: number }>;
  triggerLevel: number;
  sampleRate: number; // Hz
}

export interface MultimeterReading {
  mode: 'voltage_dc' | 'voltage_ac' | 'current_dc' | 'current_ac' | 'resistance' | 'continuity';
  value: number;
  unit: string;
  range: number;
}

export interface LaserParameters {
  wavelength: number; // nm
  power: number; // mW
  beamRadius: number; // mm
  pulsed: boolean;
  pulseFrequency?: number; // Hz
  polarization: 'linear' | 'circular' | 'random';
}

export interface CentrifugeParameters {
  rpm: number;
  radius: number; // cm
  rcf: number; // relative centrifugal force
  duration: number; // seconds
  temperature: number; // °C
}

export interface PipetteVolume {
  targetVolume: number; // µL
  actualVolume: number; // µL (with uncertainty)
  uncertainty: number; // µL
  tipType: string;
}

export interface BurnerState {
  lit: boolean;
  temperature: number; // °C
  gasFlow: number; // L/min
  flameColor: string;
}

export interface BalanceReading {
  mass: number; // grams
  tare: number;
  precision: number; // decimal places
  stable: boolean;
}