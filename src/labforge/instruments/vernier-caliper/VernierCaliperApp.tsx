// src/labforge/instruments/vernier-caliper/VernierCaliperApp.tsx
'use client'

import { useState } from 'react'
import { computeVernierReading } from './engine'

export function VernierCaliperApp() {
  const [objectWidth, setObjectWidth] = useState(21.26)
  const [zeroError, setZeroError] = useState(0)
  const [showGuide, setShowGuide] = useState(false)

  const reading = computeVernierReading(objectWidth, zeroError)

  const zeroErrorOptions = [-0.04, -0.02, 0, 0.02, 0.04]

  // SVG dimensions (fixed for simplicity, but container can scale)
  const svgWidth = 800
  const svgHeight = 300
  const mainScaleStart = 50
  const mainScaleEnd = 750
  const mainScaleLength = mainScaleEnd - mainScaleStart
  const maxWidth = 150
  const jawPos = mainScaleStart + (objectWidth / maxWidth) * mainScaleLength
  const vernierStart = jawPos
  const vernierWidth = 80

  return (
    <div style={{ padding: 16, background: '#0a0f1a', color: '#e2e8f0', height: '100%', overflow: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ background: '#1e293b', borderRadius: 8, marginBottom: 20 }}>
        {/* Fixed jaw */}
        <rect x={mainScaleStart - 20} y={50} width={20} height={150} fill="#64748b" />
        <rect x={mainScaleStart - 20} y={180} width={mainScaleLength + 20} height={20} fill="#475569" />
        {/* Main scale ticks */}
        {Array.from({ length: 16 }, (_, i) => {
          const x = mainScaleStart + (i * mainScaleLength) / 15
          return (
            <g key={`main-${i}`}>
              <line x1={x} y1={180} x2={x} y2={i % 5 === 0 ? 170 : 175} stroke="#cbd5e1" strokeWidth={1} />
              {i % 5 === 0 && (
                <text x={x - 5} y={165} fill="#cbd5e1" fontSize="10">{i * 10}</text>
              )}
            </g>
          )
        })}
        {/* Movable jaw */}
        <rect x={jawPos} y={50} width={15} height={150} fill="#94a3b8" />
        <rect x={vernierStart} y={180} width={vernierWidth} height={20} fill="#334155" />
        {/* Vernier scale ticks */}
        {Array.from({ length: 51 }, (_, i) => {
          const x = vernierStart + (i * vernierWidth) / 50
          const isCoinciding = reading.coincidingDivision === i
          return (
            <g key={`vernier-${i}`}>
              <line x1={x} y1={180} x2={x} y2={isCoinciding ? 170 : 175} stroke={isCoinciding ? '#10b981' : '#94a3b8'} strokeWidth={isCoinciding ? 2 : 1} />
              {i % 10 === 0 && (
                <text x={x - 3} y={195} fill={isCoinciding ? '#10b981' : '#94a3b8'} fontSize="8">{i}</text>
              )}
            </g>
          )
        })}
        {/* Object */}
        <rect x={mainScaleStart + 10} y={100} width={jawPos - mainScaleStart - 10} height={40} fill="#f59e0b" opacity={0.6} />
        <text x={mainScaleStart + 20} y={125} fill="#f59e0b" fontSize="10">Object</text>
      </svg>

      <div className="flex flex-col gap-4 max-w-xl mx-auto">
        <label className="text-sm">Object width: {objectWidth.toFixed(2)} mm</label>
        <input type="range" min={0} max={150} step={0.02} value={objectWidth} onChange={e => setObjectWidth(parseFloat(e.target.value))} className="w-full accent-emerald-400" />

        <label className="text-sm">Zero error: {zeroError > 0 ? `+${zeroError}` : zeroError} mm</label>
        <div className="flex gap-2 flex-wrap">
          {zeroErrorOptions.map(ze => (
            <button key={ze} onClick={() => setZeroError(ze)} className={`px-3 py-1 rounded text-sm ${zeroError === ze ? 'bg-emerald-600' : 'bg-slate-700'}`}>
              {ze === 0 ? 'None' : `${ze > 0 ? '+' : ''}${ze} mm`}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showGuide} onChange={e => setShowGuide(e.target.checked)} />
          Show Reading Guide
        </label>

        <div className="bg-slate-900/80 rounded-lg p-4 font-mono text-sm space-y-1">
          <div>Main scale: {reading.mainScaleReading} mm</div>
          <div>Vernier scale: {reading.vernierScaleReading.toFixed(2)} mm (division {reading.coincidingDivision} × 0.02)</div>
          <div>Raw reading: {reading.rawReading.toFixed(2)} mm</div>
          <div>Zero error: {zeroError > 0 ? `+${zeroError}` : zeroError} mm</div>
          <div className="text-emerald-400 font-bold">Corrected: {reading.correctedReading.toFixed(2)} mm</div>
        </div>

        {showGuide && (
          <div className="bg-slate-800/50 rounded-lg p-4 text-sm space-y-2">
            <div><strong>Step 1 — Main scale reading</strong><br/>The 0 of the vernier is past the {reading.mainScaleReading} mm mark → main scale = {reading.mainScaleReading} mm</div>
            <div><strong>Step 2 — Vernier scale reading</strong><br/>Division {reading.coincidingDivision} coincides with a main scale line<br/>{reading.coincidingDivision} × 0.02 = {reading.vernierScaleReading.toFixed(2)} mm</div>
            <div><strong>Step 3 — Total reading</strong><br/>{reading.mainScaleReading} + {reading.vernierScaleReading.toFixed(2)} = {reading.rawReading.toFixed(2)} mm</div>
            <div><strong>Step 4 — Zero error correction</strong><br/>Zero error = {zeroError > 0 ? `+${zeroError}` : zeroError} mm<br/>Corrected = {reading.rawReading.toFixed(2)} − {zeroError} = {reading.correctedReading.toFixed(2)} mm ✓</div>
          </div>
        )}
      </div>
    </div>
  )
}