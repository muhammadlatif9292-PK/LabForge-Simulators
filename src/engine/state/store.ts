// src/state/store.ts
import { create } from "zustand";
import { createInstrumentSlice, InstrumentSlice } from "./slices/instrumentSlice";
import { createExperimentSlice, ExperimentSlice } from "./slices/experimentSlice";
import { createUISlice, UISlice } from "./slices/uiSlice";

export type AppState = InstrumentSlice & ExperimentSlice & UISlice;

export const useAppStore = create<AppState>((set, get, api) => ({
  ...createInstrumentSlice(set, get, api),
  ...createExperimentSlice(set, get, api),
  ...createUISlice(set, get, api),
}));