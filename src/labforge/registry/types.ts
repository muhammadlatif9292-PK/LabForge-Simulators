// src/labforge/registry/types.ts
import type React from 'react'

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
  description:      string
  longDescription:  string
  specs:            string[]
  tags:             string[]
  ai:               AIMode
  hasLiveAnimation: boolean
  curricularTopics: string[]
  relatedIds:       string[]
  load: () => Promise<{ default: React.ComponentType }>
}

export interface ScienceClassDef {
  id:          ScienceClass
  label:       string
  icon:        string
  color:       string
  bgColor:     string
  borderColor: string
  description: string
}

export interface LabForgeState {
  activeClass:        ScienceClass | 'all'
  activeInstrumentId: string | null
  searchQuery:        string
  sidebarCollapsed:   boolean
}