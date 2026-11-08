// src/core/simulation-engine.ts
import { BaseInstrument } from "../instruments/base-instrument";
import { validateInput } from "./validation";

type InstrumentRegistry = Map<string, BaseInstrument>;

const registry: InstrumentRegistry = new Map();

export function registerInstrument(instrument: BaseInstrument): void {
  registry.set(instrument.id, instrument);
}

export function getInstrument(id: string): BaseInstrument | undefined {
  return registry.get(id);
}

export function runSimulation(id: string, input: any): any {
  const instrument = registry.get(id);
  if (!instrument) throw new Error(`Instrument ${id} not found`);
  instrument.validate(input);
  return instrument.update(input);
}

export function updateInstrumentState(id: string, state: any): void {
  const instrument = registry.get(id);
  if (instrument) instrument.updateState(state);
}

export function resetInstrument(id: string): void {
  const instrument = registry.get(id);
  if (instrument) instrument.reset();
}