// src/labforge/shell/SimulationShell.tsx
'use client'

import { lazy, Suspense, useState, useEffect } from 'react'
import { getInstrument } from '../registry/index'
import { getClassDef } from '../registry/classes'
import { useLabForgeStore } from '../store/labforgeStore'
import { LevelBadge } from './LevelBadge'
import { ErrorBoundary } from './ErrorBoundary'
import type { ComponentType } from 'react'

function LoadingScreen({ name }: { name: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%',
      background: '#09090b', gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '3px solid #10b981', borderTopColor: 'transparent',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading {name}…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function SimulationShell() {
  const activeId = useLabForgeStore(s => s.activeInstrumentId)
  const closeInstrument = useLabForgeStore(s => s.closeInstrument)

  const [InstrumentComponent, setInstrumentComponent] = useState<ComponentType | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activeId) {
      setInstrumentComponent(null)
      return
    }
    const meta = getInstrument(activeId)
    if (!meta) return

    setLoading(true)
    const Comp = lazy(meta.load)
    setInstrumentComponent(() => Comp)
    setLoading(false)
  }, [activeId])

  if (!activeId) return null

  const meta = getInstrument(activeId)
  if (!meta) return null

  const cls = getClassDef(meta.scienceClass)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        height: 48, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#0f172a',
      }}>
        <button onClick={closeInstrument} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>
          ←
        </button>
        <span>{cls.icon}</span>
        <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{meta.name}</span>
        <LevelBadge level={meta.level} />
        {meta.ai !== 'none' && <span style={{ fontSize: 11, color: '#10b981' }}>🤖 AI</span>}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <ErrorBoundary instrumentName={meta.name} onReset={closeInstrument}>
          {InstrumentComponent ? (
            <Suspense fallback={<LoadingScreen name={meta.name} />}>
              <InstrumentComponent />
            </Suspense>
          ) : (
            <LoadingScreen name={meta.name} />
          )}
        </ErrorBoundary>
      </div>
    </div>
  )
}