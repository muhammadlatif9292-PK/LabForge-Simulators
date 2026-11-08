// src/labforge/shell/Sidebar.tsx
'use client'

import { SCIENCE_CLASSES, getClassDef } from '../registry/classes'
import { INSTRUMENTS } from '../registry/index'
import { useLabForgeStore } from '../store/labforgeStore'
import type { ScienceClass } from '../registry/types'

export function Sidebar() {
  const { activeClass, setActiveClass, activeInstrumentId, sidebarCollapsed } = useLabForgeStore(s => ({
    activeClass: s.activeClass,
    setActiveClass: s.setActiveClass,
    activeInstrumentId: s.activeInstrumentId,
    sidebarCollapsed: s.sidebarCollapsed,
  }))

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  if (isMobile && sidebarCollapsed) return null

  const classesWithInstruments = SCIENCE_CLASSES.filter(cls =>
    INSTRUMENTS.some(i => i.scienceClass === cls.id)
  )

  const handleClassClick = (clsId: ScienceClass | 'all') => {
    setActiveClass(clsId)
  }

  const allCount = INSTRUMENTS.length

  return (
    <aside className="w-[220px] flex-shrink-0 border-r border-slate-800/50 bg-slate-950/30 h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚗️</span>
          <span className="font-mono text-emerald-400 font-bold tracking-tight">LabForge</span>
        </div>
      </div>
      <nav className="flex flex-col py-2">
        <button
          onClick={() => handleClassClick('all')}
          className={`flex justify-between items-center px-4 py-2 text-sm transition-colors ${activeClass === 'all' ? 'bg-slate-800/50 text-slate-100 border-l-2 border-slate-400' : 'text-slate-500 hover:bg-slate-800/30 hover:text-slate-300'}`}
        >
          <span className="flex items-center gap-2">🔭 All</span>
          <span className="text-xs text-slate-400">{allCount}</span>
        </button>
        {classesWithInstruments.map(cls => {
          const count = INSTRUMENTS.filter(i => i.scienceClass === cls.id).length
          const isActive = activeClass === cls.id
          return (
            <button
              key={cls.id}
              onClick={() => handleClassClick(cls.id)}
              className={`flex justify-between items-center px-4 py-2 text-sm transition-colors ${isActive ? `${cls.bgColor} ${cls.color} border-l-2` : 'text-slate-500 hover:bg-slate-800/30 hover:text-slate-300'}`}
              style={isActive ? { borderLeftColor: cls.color.replace('text-', ''), borderLeftWidth: 2 } : {}}
            >
              <span className="flex items-center gap-2">
                <span>{cls.icon}</span> {cls.label}
              </span>
              <span className="text-xs text-slate-400">{count}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}