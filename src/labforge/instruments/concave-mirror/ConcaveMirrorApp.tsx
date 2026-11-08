// src/labforge/instruments/concave-mirror/ConcaveMirrorApp.tsx
'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { computeConcaveMirror, focalLengthFromRadius, getImageNature, formatImageDistance, getFormulaSubstituted } from './engine'
import { clearCanvas, drawGrid, drawVerticalMarker } from '../../lib/canvas/grid'
import {
  drawPrincipalRays, drawMirrorSymbol, drawObjectArrow,
  drawImageArrow, drawFocalPoints, drawPrincipalAxis
} from '../../lib/canvas/rays'
import { getPresets } from './types'
import type { GridConfig } from '../../lib/canvas/grid'

export function ConcaveMirrorApp() {
  const [radiusCm, setRadiusCm] = useState(20)
  const [objectDistCm, setObjectDistCm] = useState(30)
  const [objectHeightCm, setObjectHeightCm] = useState(3)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setCanvasSize({ width: Math.floor(width), height: Math.floor(height) })
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  const focalLengthCm = focalLengthFromRadius(radiusCm) * 100
  const result = useMemo(
    () => computeConcaveMirror(radiusCm, objectDistCm, objectHeightCm),
    [radiusCm, objectDistCm, objectHeightCm]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || canvasSize.width === 0) return

    canvas.width = canvasSize.width
    canvas.height = canvasSize.height

    const fM = focalLengthCm / 100
    const hM = objectHeightCm / 100
    const config: GridConfig = {
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      xMin: -fM * 0.2,
      xMax: fM * 3.5,
      yMin: -hM * 4,
      yMax: hM * 4,
      tickSpacingX: fM / 2,
      tickSpacingY: hM,
      labelUnitX: 'm',
      labelUnitY: 'm',
      backgroundColor: '#0f172a',
    }

    clearCanvas(ctx, config)
    drawGrid(ctx, config)
    drawPrincipalAxis(ctx, config)
    // F and C markers on left side (in front of mirror)
    drawVerticalMarker(ctx, -fM, config, '#ffaa44', 'F')
    drawVerticalMarker(ctx, -2*fM, config, '#ffaa44', 'C')
    drawMirrorSymbol(ctx, config, true)   // concave
    drawObjectArrow(ctx, -objectDistCm/100, hM, config)
    if (!result.isAtInfinity) {
      drawImageArrow(ctx, result, hM, config)
    }
    drawPrincipalRays(ctx, result.principalRays, config)
  }, [result, canvasSize, radiusCm, objectDistCm, objectHeightCm, focalLengthCm])

  const presets = getPresets(focalLengthCm)

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
      <canvas ref={canvasRef} style={{ flex: 2, background: '#0f172a', borderRadius: 8 }} />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto', background: '#0a0f1a', color: '#e2e8f0' }}>
        <h3 className="text-lg font-semibold mb-4">Concave Mirror (Converging)</h3>

        <label className="block text-sm mb-1">Radius of curvature (R): {radiusCm} cm</label>
        <input type="range" min="10" max="100" step="1" value={radiusCm} onChange={e => setRadiusCm(parseFloat(e.target.value))} className="w-full accent-emerald-400 mb-1" />
        <div className="text-xs text-slate-400 mb-3">Focal length f = R/2 = {focalLengthCm.toFixed(1)} cm</div>

        <label className="block text-sm mb-1">Object Distance (u): {objectDistCm} cm</label>
        <input type="range" min="5" max="100" step="0.5" value={objectDistCm} onChange={e => setObjectDistCm(parseFloat(e.target.value))} className="w-full accent-emerald-400 mb-3" />

        <label className="block text-sm mb-1">Object Height: {objectHeightCm} cm</label>
        <input type="range" min="1" max="10" step="0.5" value={objectHeightCm} onChange={e => setObjectHeightCm(parseFloat(e.target.value))} className="w-full accent-emerald-400 mb-4" />

        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map(p => (
            <button key={p.label} onClick={() => setObjectDistCm(Math.abs(p.objectDistCm))} className="px-2 py-1 bg-slate-800 rounded text-xs hover:bg-slate-700">
              {p.label}
            </button>
          ))}
        </div>

        <div className="bg-slate-900/80 rounded-lg p-3 font-mono text-sm space-y-1.5">
          <div><span className="text-slate-500">Image distance:</span> <span className="text-emerald-400">{formatImageDistance(result)}</span></div>
          <div><span className="text-slate-500">Magnification:</span> <span className="text-emerald-400">{result.magnification.toFixed(2)}×</span></div>
          <div><span className="text-slate-500">Nature:</span> <span className={result.isReal ? 'text-blue-400' : 'text-amber-400'}>{getImageNature(result)}</span></div>
          <div className="text-slate-500 text-xs mt-2">{getFormulaSubstituted(radiusCm, objectDistCm, result)}</div>
        </div>

        {result.isAtInfinity && (
          <div className="mt-3 p-2 bg-amber-500/20 border border-amber-500/40 rounded text-amber-300 text-sm">
            ⚠️ Object is at focal point — rays emerge parallel. No image is formed.
          </div>
        )}
      </div>
    </div>
  )
}