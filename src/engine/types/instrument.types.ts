// src/types/instrument.types.ts
import { BaseInstrument } from "../instruments/base-instrument";

export type InstrumentId = string;

export interface InstrumentConfig {
  id: InstrumentId;
  name: string;
  minInput?: number;
  maxInput?: number;
  defaultInput?: any;
  units?: string;
  precision?: number;
}

export interface InstrumentOutput {
  value: number;
  unit: string;
  error?: string;
}

export type InstrumentConstructor = new (config: InstrumentConfig) => BaseInstrument;