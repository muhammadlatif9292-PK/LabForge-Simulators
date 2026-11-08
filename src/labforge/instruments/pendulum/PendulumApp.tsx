// src/labforge/instruments/pendulum/PendulumApp.tsx
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { stepPendulum, smallAnglePeriod, kineticEnergy, potentialEnergy, bobPosition } from './engine'
import { GRAVITY_PRESETS } from './types'
import type { TrailPoint, PendulumReadouts } from './types'
import { degreesToRadians, radiansToDegrees, mapRange } from '../../lib/units'
import { clearCanvas, drawGrid, drawLine, physicsToCanvasX, physicsToCanvasY } from '../../lib/canvas/grid'
import type { GridConfig } from '../../lib/canvas/grid'

export function PendulumApp() {
  const [length, setLength] = useState(1.5)
  const [angleDeg, setAngleDeg] = useState(30)
  const [gravity, setGravity] = useState(9.81)
  const [damping, setDamping] = useState(0.02)
  const [isRunning, setIsRunning] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 })

  // Mutable refs for animation loop
  const thetaRef = useRef(degreesToRadians(angleDeg))
  const omegaRef = useRef(0)
  const timeRef = useRef(0)
  const trailRef = useRef<TrailPoint[]>([])
  const animFrameRef = useRef<number | null>(null)

  const [readouts, setReadouts] = useState<PendulumReadouts>({
    thetaDeg: angleDeg,
    omegaRadS: 0,
    periodS: smallAnglePeriod(length, gravity),
    frequencyHz: 1 / smallAnglePeriod(length, gravity),
    kineticJ: 0,
    potentialJ: 0,
    totalJ: 0,
  })

  const [chartData, setChartData] = useState<Array<{ length: number; period: number }>>([])

  // Reset simulation
  const reset = useCallback(() => {
    thetaRef.current = degreesToRadians(angleDeg)
    omegaRef.current = 0
    timeRef.current = 0
    trailRef.current = []
    setIsRunning(false)
  }, [angleDeg])

  // Update period when length/gravity changes
  useEffect(() => {
    setReadouts(prev => ({
      ...prev,
      periodS: smallAnglePeriod(length, gravity),
      frequencyHz: 1 / smallAnglePeriod(length, gravity),
    }))
  }, [length, gravity])

  // Draw function
  const drawFrame = useCallback((theta: number, trail: TrailPoint[], canvasCtx: CanvasRenderingContext2D, size: { width: number; height: number }) => {
    const pivotX = size.width / 2
    const pivotY = 40
    const bobPos = bobPosition(length, theta)
    const scale = Math.min(size.width, size.height - 80) / (length * 2.2)
    const bobX = pivotX + bobPos.x * scale
    const bobY = pivotY - bobPos.y * scale

    // Clear and draw grid
    const config: GridConfig = {
      canvasWidth: size.width,
      canvasHeight: size.height,
      xMin: -length * 1.2,
      xMax: length * 1.2,
      yMin: -length * 0.2,
      yMax: length * 0.2,
      backgroundColor: '#0f172a',
    }
    clearCanvas(canvasCtx, config)
    drawGrid(canvasCtx, config)

    // Draw trail
    canvasCtx.save()
    canvasCtx.beginPath()
    canvasCtx.strokeStyle = '#10b981'
    canvasCtx.lineWidth = 1.5
    canvasCtx.globalAlpha = 0.4
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i]
      if (i === 0) canvasCtx.moveTo(p.x, p.y)
      else canvasCtx.lineTo(p.x, p.y)
    }
    canvasCtx.stroke()
    canvasCtx.restore()

    // Draw string
    canvasCtx.beginPath()
    canvasCtx.moveTo(pivotX, pivotY)
    canvasCtx.lineTo(bobX, bobY)
    canvasCtx.strokeStyle = '#aaa'
    canvasCtx.lineWidth = 2
    canvasCtx.stroke()

    // Draw bob with color based on speed
    const speed = Math.abs(omegaRef.current)
    const t = Math.min(1, speed / 5)
    const r = 20 + 40 * t
    const g = 20 + 20 * (1 - t)
    const b = 80 - 40 * t
    canvasCtx.fillStyle = `rgb(${r}, ${g}, ${b})`
    canvasCtx.beginPath()
    canvasCtx.arc(bobX, bobY, 12, 0, 2 * Math.PI)
    canvasCtx.fill()
  }, [length])

  // Animation loop
  useEffect(() => {
    if (!isRunning) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      return
    }

    let lastTimestamp: number | null = null
    const loop = (now: number) => {
      if (!isRunning) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx || canvasSize.width === 0) {
        animFrameRef.current = requestAnimationFrame(loop)
        return
      }

      const frameDt = lastTimestamp ? Math.min((now - lastTimestamp) / 1000, 0.05) : 0.001
      lastTimestamp = now

      const subSteps = Math.max(1, Math.floor(frameDt / 0.001))
      let theta = thetaRef.current
      let omega = omegaRef.current
      let t = timeRef.current

      for (let i = 0; i < subSteps; i++) {
        const next = stepPendulum(theta, omega, t, 0.001, length, gravity, damping)
        theta = next.theta
        omega = next.omega
        t = next.t
      }

      thetaRef.current = theta
      omegaRef.current = omega
      timeRef.current = t

      // Update trail
      const pos = bobPosition(length, theta)
      const pivotX = canvasSize.width / 2
      const pivotY = 40
      const scale = Math.min(canvasSize.width, canvasSize.height - 80) / (length * 2.2)
      const trailPoint = { x: pivotX + pos.x * scale, y: pivotY - pos.y * scale }
      const newTrail = [...trailRef.current, trailPoint]
      if (newTrail.length > 60) newTrail.shift()
      trailRef.current = newTrail

      // Compute readouts
      const KE = kineticEnergy(0.1, length, omega)
      const PE = potentialEnergy(0.1, gravity, length, theta)
      setReadouts({
        thetaDeg: radiansToDegrees(theta),
        omegaRadS: omega,
        periodS: smallAnglePeriod(length, gravity),
        frequencyHz: 1 / smallAnglePeriod(length, gravity),
        kineticJ: KE,
        potentialJ: PE,
        totalJ: KE + PE,
      })

      drawFrame(theta, newTrail, ctx, canvasSize)
      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isRunning, length, gravity, damping, canvasSize, drawFrame])

  // ResizeObserver
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

  // Add chart data when length changes (optional)
  const addToChart = () => {
    setChartData(prev => {
      const existing = prev.find(d => Math.abs(d.length - length) < 0.01)
      if (existing) return prev
      return [...prev, { length, period: smallAnglePeriod(length, gravity) }].sort((a, b) => a.length - b.length)
    })
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
      <canvas ref={canvasRef} style={{ flex: 2, background: '#0f172a', borderRadius: 8 }} />
      <div style={{ flex: 1, padding: 16, overflowY: 'auto', background: '#0a0f1a', color: '#e2e8f0' }}>
        <h3 className="text-lg font-semibold mb-4">Simple Pendulum (Nonlinear RK4)</h3>

        <label className="block text-sm mb-1">Length: {length.toFixed(2)} m</label>
        <input type="range" min="0.1" max="5" step="0.01" value={length} onChange={e => { setLength(parseFloat(e.target.value)); addToChart(); }} className="w-full accent-emerald-400 mb-3" />

        <label className="block text-sm mb-1">Initial Angle: {angleDeg}°</label>
        <input type="range" min="1" max="85" step="1" value={angleDeg} onChange={e => { setAngleDeg(parseFloat(e.target.value)); reset(); }} className="w-full accent-emerald-400 mb-3" />

        <label className="block text-sm mb-1">Gravity: {gravity} m/s²</label>
        <div className="flex gap-2 mb-3">
          {GRAVITY_PRESETS.map(p => (
            <button key={p.body} onClick={() => { setGravity(p.g); reset(); }} className={`px-2 py-1 rounded text-xs ${gravity === p.g ? 'bg-emerald-600' : 'bg-slate-700'} hover:bg-emerald-500`}>
              {p.emoji} {p.body}
            </button>
          ))}
        </div>

        <label className="block text-sm mb-1">Damping: {damping.toFixed(3)}</label>
        <input type="range" min="0" max="0.1" step="0.001" value={damping} onChange={e => setDamping(parseFloat(e.target.value))} className="w-full accent-emerald-400 mb-4" />

        <div className="flex gap-2 mb-4">
          <button onClick={() => setIsRunning(true)} className="px-3 py-1 bg-emerald-600 rounded text-sm hover:bg-emerald-500">▶ Start</button>
          <button onClick={() => setIsRunning(false)} className="px-3 py-1 bg-slate-700 rounded text-sm hover:bg-slate-600">⏸ Pause</button>
          <button onClick={reset} className="px-3 py-1 bg-slate-700 rounded text-sm hover:bg-slate-600">↺ Reset</button>
        </div>

        <div className="bg-slate-900/80 rounded-lg p-3 font-mono text-sm space-y-1.5">
          <div><span className="text-slate-500">T (small-angle):</span> <span className="text-emerald-400">{readouts.periodS.toFixed(3)} s</span></div>
          <div><span className="text-slate-500">Frequency:</span> <span className="text-emerald-400">{readouts.frequencyHz.toFixed(3)} Hz</span></div>
          <div><span className="text-slate-500">θ =</span> <span className="text-emerald-400">{readouts.thetaDeg.toFixed(1)}°</span></div>
          <div><span className="text-slate-500">ω =</span> <span className="text-emerald-400">{readouts.omegaRadS.toFixed(3)} rad/s</span></div>
          <div><span className="text-slate-500">KE =</span> <span className="text-emerald-400">{readouts.kineticJ.toFixed(5)} J</span></div>
          <div><span className="text-slate-500">PE =</span> <span className="text-emerald-400">{readouts.potentialJ.toFixed(5)} J</span></div>
          <div><span className="text-slate-500">Total E =</span> <span className="text-emerald-400">{readouts.totalJ.toFixed(5)} J</span></div>
        </div>

        {/* Simple energy bars */}
        <div className="mt-4 space-y-1">
          <div className="text-xs">KE</div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-red-500" style={{ width: `${(readouts.kineticJ / (readouts.totalJ || 1)) * 100}%` }} />
          </div>
          <div className="text-xs">PE</div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${(readouts.potentialJ / (readouts.totalJ || 1)) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}