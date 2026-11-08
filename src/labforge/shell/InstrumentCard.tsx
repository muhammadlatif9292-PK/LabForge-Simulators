// src/labforge/shell/InstrumentCard.tsx
'use client'

import type { InstrumentMeta } from '../registry/types'
import { getClassDef } from '../registry/classes'
import { useLabForgeStore } from '../store/labforgeStore'
import { LevelBadge } from './LevelBadge'

interface InstrumentCardProps {
  instrument: InstrumentMeta
}

export function InstrumentCard({ instrument }: InstrumentCardProps) {
  const classDef = getClassDef(instrument.scienceClass)
  const openInstrument = useLabForgeStore(s => s.openInstrument)

  return (
    <div className="relative bg-slate-900 border border-slate-800 rounded-lg p-4 transition-all duration-150 hover:border-slate-600 hover:scale-[1.01]">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ background: classDef.color.replace('text-', '') }} />
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xl ${classDef.color}`}>{classDef.icon}</span>
        <h3 className="font-semibold text-slate-100 text-base">{instrument.name}</h3>
      </div>
      <p className="text-sm text-slate-400 line-clamp-1 overflow-hidden mb-3">{instrument.description}</p>
      <div className="flex items-center gap-2 mb-4">
        <LevelBadge level={instrument.level} size="sm" />
        {instrument.ai !== 'none' && (
          <span className="bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 rounded-full px-2 py-0.5 text-xs">🤖 AI</span>
        )}
      </div>
      <button
        onClick={() => openInstrument(instrument.id)}
        className="w-full py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 font-medium transition-colors"
      >
        Open →
      </button>
    </div>
  )
}