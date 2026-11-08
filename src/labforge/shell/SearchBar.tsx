// src/labforge/shell/SearchBar.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLabForgeStore } from '../store/labforgeStore'

export function SearchBar() {
  const setSearchQuery = useLabForgeStore(s => s.setSearchQuery)
  const [inputValue, setInputValue] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback((val: string) => {
    setInputValue(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setSearchQuery(val)
    }, 150)
  }, [setSearchQuery])

  const handleClear = () => {
    setInputValue('')
    setSearchQuery('')
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClear()
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search instruments..."
        className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-slate-500 focus:ring-1 focus:ring-slate-500 outline-none"
      />
      {inputValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-sm"
        >
          ✕
        </button>
      )}
    </div>
  )
}