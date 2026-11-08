// src/labforge/shell/InstrumentGrid.tsx
'use client'

import { getInstrumentsByClass, searchInstruments } from '../registry/index'
import { getClassDef } from '../registry/classes'
import { useLabForgeStore } from '../store/labforgeStore'
import { InstrumentCard } from './InstrumentCard'

export function InstrumentGrid() {
  const { activeClass, searchQuery, setSearchQuery } = useLabForgeStore(s => ({
    activeClass: s.activeClass,
    searchQuery: s.searchQuery,
    setSearchQuery: s.setSearchQuery,
  }))

  const instruments = searchQuery.trim()
    ? searchInstruments(searchQuery)
    : getInstrumentsByClass(activeClass)

  const classDef = activeClass !== 'all' ? getClassDef(activeClass) : null

  return (
    <div className="p-4 h-full overflow-auto">
      {searchQuery ? (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-200">
            {instruments.length} results for "{searchQuery}"
          </h2>
          <button onClick={() => setSearchQuery('')} className="text-sm text-emerald-400 hover:text-emerald-300">
            Clear search
          </button>
        </div>
      ) : classDef ? (
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-2xl ${classDef.color}`}>{classDef.icon}</span>
          <h2 className="text-lg font-semibold text-slate-200">{classDef.label}</h2>
          <span className="text-sm text-slate-400">({instruments.length})</span>
        </div>
      ) : (
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-200">All Instruments ({instruments.length})</h2>
        </div>
      )}

      {instruments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-6xl mb-4">🔭</span>
          <p className="text-slate-300 text-lg mb-2">No instruments found</p>
          <p className="text-slate-400 text-sm mb-4">Try a different search or clear the query.</p>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-emerald-400 text-sm underline">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {instruments.map(instr => (
            <InstrumentCard key={instr.id} instrument={instr} />
          ))}
        </div>
      )}
    </div>
  )
}