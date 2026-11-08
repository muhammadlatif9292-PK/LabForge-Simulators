// instrumentation-core/contracts/instrument-contracts.ts
/**
 * Instrument Execution Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for scientific instruments, their lifecycle,
 *   interaction model, rendering hooks, and simulation coupling
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

export type InstrumentId = string & { readonly __brand: 'InstrumentId' };
export type InstrumentSessionId = string & { readonly __brand: 'InstrumentSessionId' };
export type MeasurementId = string & { readonly __brand: 'MeasurementId' };
export type CalibrationId = string & { readonly __brand: 'CalibrationId' };

export enum InstrumentType {
  MICROSCOPE = 'microscope',
  BEAKER = 'beaker',
  SPECTROMETER = 'spectrometer',
  OSCILLOSCOPE = 'oscilloscope',
  MULTIMETER = 'multimeter',
  LASER = 'laser',
  CENTRIFUGE = 'centrifuge',
  PIPETTE = 'pipette',
  BURNER = 'burner',
  BALANCE = 'balance',
  VOLTMETER = 'voltmeter',
  AMMETER = 'ammeter',
}

export enum InstrumentState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  IDLE = 'idle',
  ACTIVE = 'active',
  MEASURING = 'measuring',
  CALIBRATING = 'calibrating',
  ERROR = 'error',
  DISPOSED = 'disposed',
}

export interface InstrumentDescriptor {
  id: InstrumentId;
  type: InstrumentType;
  name: string;
  worldId: string;
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
  properties: Record<string, unknown>;
  maxMeasurementsPerSecond: number;
  requiresCalibration: boolean;
}

export interface InstrumentMeasurement {
  id: MeasurementId;
  instrumentId: InstrumentId;
  timestamp: number;
  value: number | number[] | Record<string, number>;
  unit: string;
  uncertainty: number;
  metadata: Record<string, unknown>;
}

export interface InstrumentCalibration {
  id: CalibrationId;
  instrumentId: InstrumentId;
  performedAt: number;
  validUntil: number;
  offset: number;
  scale: number;
  referenceValue: number;
  metadata: Record<string, unknown>;
}

export interface InstrumentInteraction {
  type: 'grab' | 'release' | 'rotate' | 'activate' | 'deactivate' | 'configure';
  instrumentId: InstrumentId;
  userId: string;
  payload: unknown;
  timestamp: number;
}

export interface InstrumentRenderState {
  visible: boolean;
  opacity: number;
  highlightIntensity: number;
  animationState: string;
  overlayText?: string;
}

export interface InstrumentHealth {
  status: 'healthy' | 'degraded' | 'faulty';
  lastCalibration?: number;
  measurementCount: number;
  errorCount: number;
  uptime: number;
}