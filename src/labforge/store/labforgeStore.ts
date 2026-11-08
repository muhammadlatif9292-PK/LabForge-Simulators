// src/labforge/store/labforgeStore.ts
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

  setSearchQuery: (query) =>
    set({ searchQuery: query, activeClass: 'all' }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}))