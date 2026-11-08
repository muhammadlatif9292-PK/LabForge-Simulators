// src/state/slices/instrumentSlice.ts
import { StateCreator } from "zustand";

export interface InstrumentSlice {
  activeInstrumentId: string | null;
  instrumentInputs: Record<string, any>;
  instrumentOutputs: Record<string, any>;
  setActiveInstrument: (id: string | null) => void;
  setInstrumentInput: (id: string, input: any) => void;
  setInstrumentOutput: (id: string, output: any) => void;
  resetInstrument: (id: string) => void;
}

export const createInstrumentSlice: StateCreator<InstrumentSlice> = (set) => ({
  activeInstrumentId: null,
  instrumentInputs: {},
  instrumentOutputs: {},

  setActiveInstrument: (id) =>
    set({ activeInstrumentId: id, instrumentInputs: {}, instrumentOutputs: {} }),

  setInstrumentInput: (id, input) =>
    set((state) => ({
      instrumentInputs: { ...state.instrumentInputs, [id]: input },
    })),

  setInstrumentOutput: (id, output) =>
    set((state) => ({
      instrumentOutputs: { ...state.instrumentOutputs, [id]: output },
    })),

  resetInstrument: (id) =>
    set((state) => ({
      instrumentInputs: { ...state.instrumentInputs, [id]: {} },
      instrumentOutputs: { ...state.instrumentOutputs, [id]: {} },
    })),
});