// src/labforge/instruments/ohm-circuit/OhmCircuitApp.tsx
'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { computeCircuit, getVIData, getCircuitSummary } from './engine'
import type { ResistorConfig, CircuitMode, CircuitReadouts } from './types'
import { clearCanvas, drawGrid, physicsToCanvasX, physicsToCanvasY, drawLine, drawDataPoint } from '../../lib/canvas/grid'
import type { GridConfig } from '../../lib/canvas/grid'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'

export function OhmCircuitApp() {
  const [mode, setMode] = useState<CircuitMode>('series')
  const [voltage, setVoltage] = useState(12)
  const [resistors, setResistors] = useState<ResistorConfig[]>([
    { id: 'r1', resistance: 220, label: 'R1', color: '#10b981' },
    { id: 'r2', resistance: 330, label: 'R2', color: '#3b82f6' },
  ])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 300 })
  const [animationOffset, setAnimationOffset] = useState(0)

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

  const readouts = useMemo(() => computeCircuit(voltage, resistors, mode), [voltage, resistors, mode])
  const viData = useMemo(() => {
    if (!readouts) return []
    return getVIData(readouts.totalResistance, 30)
  }, [readouts])

  // Animate current flow dots
  useEffect(() => {
    if (!readouts || readouts.totalCurrent === 0) return
    let animId: number
    let start: number | null = null
    const speed = Math.min(0.02, readouts.totalCurrent * 0.002) // pixels per ms
    const loop = (now: number) => {
      if (!start) start = now
      const elapsed = now - start
      setAnimationOffset((elapsed * speed) % 200)
      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [readouts])

  // Draw circuit schematic (simple)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || canvasSize.width === 0 || !readouts) return
    canvas.width = canvasSize.width
    canvas.height = canvasSize.height

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)

    const w = canvasSize.width
    const h = canvasSize.height
    const startX = 50
    const endX = w - 50
    const yTop = 80
    const yBottom = h - 80

    // Battery on left
    ctx.fillStyle = '#ddd'
    ctx.fillRect(startX - 15, yTop - 15, 10, 30)
    ctx.fillRect(startX - 15, yTop - 20, 10, 10)
    ctx.fillStyle = '#f1f5f9'
    ctx.font = '10px monospace'
    ctx.fillText(`${voltage}V`, startX - 25, yTop)

    // Wires
    ctx.beginPath()
    ctx.strokeStyle = '#aaa'
    ctx.lineWidth = 2
    if (mode === 'series') {
      ctx.moveTo(startX, yTop)
      let x = startX
      for (let i = 0; i < resistors.length; i++) {
        const width = 40
        ctx.lineTo(x + 20, yTop)
        ctx.stroke()
        // Resistor box
        ctx.fillStyle = resistors[i].color + '80'
        ctx.fillRect(x + 20, yTop - 15, width, 30)
        ctx.fillStyle = '#fff'
        ctx.font = '9px monospace'
        ctx.fillText(`${resistors[i].label} ${resistors[i].resistance}Ω`, x + 25, yTop)
        x += width + 10
        ctx.beginPath()
        ctx.moveTo(x, yTop)
      }
      ctx.lineTo(endX, yTop)
      ctx.stroke()
      // Return wire bottom
      ctx.beginPath()
      ctx.moveTo(endX, yBottom)
      ctx.lineTo(startX, yBottom)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(startX, yTop)
      ctx.lineTo(startX, yBottom)
      ctx.stroke()
      ctx.moveTo(endX, yTop)
      ctx.lineTo(endX, yBottom)
      ctx.stroke()

      // Current dots on top wire
      const totalLength = endX - startX
      const dotPos = startX + (animationOffset % totalLength)
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.arc(dotPos, yTop, 3, 0, 2 * Math.PI)
      ctx.fill()
    } else {
      // Parallel layout
      const heightStep = (yBottom - yTop) / (resistors.length + 1)
      for (let i = 0; i < resistors.length; i++) {
        const y = yTop + heightStep * (i + 1)
        ctx.beginPath()
        ctx.moveTo(startX, y)
        ctx.lineTo(endX, y)
        ctx.stroke()
        ctx.fillStyle = resistors[i].color + '80'
        ctx.fillRect(endX - 50, y - 15, 40, 30)
        ctx.fillStyle = '#fff'
        ctx.fillText(`${resistors[i].label} ${resistors[i].resistance}Ω`, endX - 48, y)
        // Vertical wires
        ctx.beginPath()
        ctx.moveTo(startX, yTop)
        ctx.lineTo(startX, y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(endX, y)
        ctx.lineTo(endX, yTop)
        ctx.stroke()
      }
      ctx.beginPath()
      ctx.moveTo(startX, yTop)
      ctx.lineTo(startX, yBottom)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(endX, yTop)
      ctx.lineTo(endX, yBottom)
      ctx.stroke()
    }
  }, [canvasSize, mode, resistors, voltage, readouts, animationOffset])

  const addResistor = () => {
    if (resistors.length >= 3) return
    const newId = `r${resistors.length + 1}`
    setResistors([...resistors, { id: newId, resistance: 100, label: newId.toUpperCase(), color: '#f59e0b' }])
  }

  const removeResistor = (id: string) => {
    if (resistors.length <= 1) return
    setResistors(resistors.filter(r => r.id !== id))
  }

  const updateResistance = (id: string, value: number) => {
    setResistors(resistors.map(r => r.id === id ? { ...r, resistance: value } : r))
  }

  if (!readouts) return <div className="p-4 text-slate-400">Invalid circuit configuration</div>

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', padding: 16, gap: 16, overflow: 'auto' }}>
      <div style={{ flex: 2 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b' }} />
        <div className="mt-4 bg-slate-900/80 p-3 rounded-lg">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={viData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="v" label={{ value: 'Voltage (V)', fill: '#94a3b8' }} stroke="#94a3b8" />
              <YAxis label={{ value: 'Current (A)', angle: -90, fill: '#94a3b8' }} stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
              <Line type="monotone" dataKey="i" stroke="#10b981" strokeWidth={2} dot={false} />
              <ReferenceDot x={voltage} y={readouts.totalCurrent} r={6} fill="#f59e0b" stroke="#fff" />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-slate-400 text-center mt-1">● Operating point</div>
        </div>
      </div>

      <div style={{ flex: 1, background: '#0a0f1a', borderRadius: 8, padding: 16 }}>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setMode('series')} className={`px-3 py-1 rounded text-sm ${mode === 'series' ? 'bg-emerald-600' : 'bg-slate-700'}`}>Series</button>
          <button onClick={() => setMode('parallel')} className={`px-3 py-1 rounded text-sm ${mode === 'parallel' ? 'bg-emerald-600' : 'bg-slate-700'}`}>Parallel</button>
        </div>

        <label className="block text-sm mb-1">Voltage: {voltage} V</label>
        <input type="range" min="0" max="30" step="0.5" value={voltage} onChange={e => setVoltage(parseFloat(e.target.value))} className="w-full accent-emerald-400 mb-4" />

        {resistors.map((r, idx) => (
          <div key={r.id} className="mb-3 p-2 bg-slate-800/50 rounded">
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono" style={{ color: r.color }}>{r.label}</span>
              <button onClick={() => removeResistor(r.id)} className="text-red-400 text-xs">✕</button>
            </div>
            <input type="range" min="1" max="10000" step="1" value={r.resistance} onChange={e => updateResistance(r.id, parseFloat(e.target.value))} className="w-full accent-emerald-400 mt-1" />
            <div className="text-xs text-slate-400">{r.resistance} Ω</div>
            {readouts && (
              <div className="text-xs text-emerald-400 mt-1">
                {mode === 'series' ? `V = ${readouts.voltageDrops[idx].toFixed(2)} V` : `I = ${(readouts.currents[idx] * 1000).toFixed(1)} mA`}
              </div>
            )}
          </div>
        ))}

        {resistors.length < 3 && (
          <button onClick={addResistor} className="w-full mt-2 py-1 bg-slate-700 rounded text-sm hover:bg-slate-600">+ Add Resistor</button>
        )}

        <div className="mt-4 bg-slate-900/80 rounded-lg p-3 font-mono text-sm space-y-1.5">
          <div><span className="text-slate-500">R_total:</span> <span className="text-emerald-400">{readouts.totalResistance.toFixed(0)} Ω</span></div>
          <div><span className="text-slate-500">I_total:</span> <span className="text-emerald-400">{(readouts.totalCurrent * 1000).toFixed(1)} mA</span></div>
          <div><span className="text-slate-500">P_total:</span> <span className="text-emerald-400">{(readouts.totalPower * 1000).toFixed(0)} mW</span></div>
          <div className="text-slate-500 text-xs mt-2">{getCircuitSummary(readouts, mode, resistors.length)}</div>
        </div>
      </div>
    </div>
  )
}