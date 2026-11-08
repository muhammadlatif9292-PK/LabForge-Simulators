// src/labforge/shell/TopBar.tsx
'use client'

import { useEffect, useState } from 'react'
import { useLabForgeStore } from '../store/labforgeStore'

export function TopBar() {
  const toggleSidebar = useLabForgeStore(s => s.toggleSidebar)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!isMobile) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80 md:hidden">
      <button onClick={toggleSidebar} className="text-slate-300 text-2xl">☰</button>
      <span className="font-mono text-emerald-400 tracking-tight">LabForge</span>
      <span className="text-xs text-slate-500">v2.0</span>
    </div>
  )
}