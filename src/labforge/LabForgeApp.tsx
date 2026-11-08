// src/labforge/LabForgeApp.tsx
'use client'

import { useLabForgeStore } from './store/labforgeStore'
import { Sidebar } from './shell/Sidebar'
import { TopBar } from './shell/TopBar'
import { SearchBar } from './shell/SearchBar'
import { InstrumentGrid } from './shell/InstrumentGrid'
import { SimulationShell } from './shell/SimulationShell'

interface LabForgeAppProps {
  className?: string
  style?: React.CSSProperties
}

export default function LabForgeApp({ className, style }: LabForgeAppProps) {
  const activeId = useLabForgeStore(s => s.activeInstrumentId)
  const sidebarCollapsed = useLabForgeStore(s => s.sidebarCollapsed)

  return (
    <div
      className={className}
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: '#09090b', color: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
        ...style,
      }}
    >
      <TopBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {!sidebarCollapsed && (
          <div style={{
            width: 220, flexShrink: 0,
            borderRight: '1px solid rgba(255,255,255,0.06)',
            overflowY: 'auto',
          }}>
            <Sidebar />
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeId && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <SearchBar />
            </div>
          )}

          <div style={{ flex: 1, overflow: 'auto' }}>
            {activeId ? <SimulationShell /> : <InstrumentGrid />}
          </div>
        </div>
      </div>
    </div>
  )
}