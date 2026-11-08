// src/labforge/instruments/ph-meter/PhMeterApp.tsx
'use client'

import { useState, useEffect } from 'react'
import { nernstPotential, phToColor, noisyPHReading, isMatchingBuffer, millivoltsToPH } from './engine'
import { SOLUTION_PRESETS } from './types'

export function PhMeterApp() {
  const [selectedPreset, setSelectedPreset] = useState(SOLUTION_PRESETS[5]) // pure water
  const [temperature, setTemperature] = useState(25)
  const [probeSubmerged, setProbeSubmerged] = useState(false)
  const [calibrationOffset, setCalibrationOffset] = useState(0)
  const [calibrationStep, setCalibrationStep] = useState<'none' | 'buffer1' | 'buffer2' | 'complete'>('none')
  const [customPH, setCustomPH] = useState(7.0)

  const isCustom = selectedPreset.id === 'custom'
  const currentPH = isCustom ? customPH : selectedPreset.ph

  const millivolts = nernstPotential(currentPH, temperature, calibrationOffset)
  const displayPH = (millivoltsToPH(millivolts, temperature, calibrationOffset) + calibrationOffset).toFixed(2)
  const liquidColor = phToColor(currentPH)

  // Calibration logic
  const startCalibration = () => setCalibrationStep('buffer1')
  const recordBuffer = (bufferPH: 4.01 | 7.0) => {
    const measuredMV = nernstPotential(currentPH, temperature, 0)
    const expectedMV = nernstPotential(bufferPH, temperature, 0)
    const newOffset = measuredMV - expectedMV
    if (calibrationStep === 'buffer1') {
      setCalibrationOffset(newOffset)
      setCalibrationStep('buffer2')
    } else if (calibrationStep === 'buffer2') {
      const finalOffset = (calibrationOffset + newOffset) / 2
      setCalibrationOffset(finalOffset)
      setCalibrationStep('complete')
    }
  }

  return (
    <div style={{ padding: 24, background: '#0a0f1a', color: '#e2e8f0', height: '100%', overflow: 'auto' }}>
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4">pH Meter Simulator</h2>

        {/* Beaker with liquid */}
        <div className="relative bg-slate-800 rounded-lg p-4 mb-6">
          <div className="absolute bottom-0 left-0 right-0 h-40 rounded-b-lg transition-colors duration-500" style={{ backgroundColor: liquidColor, opacity: 0.7 }} />
          <div className="relative z-10 flex justify-between items-end h-48">
            <div className="text-sm">Beaker</div>
            <div className="text-sm">{selectedPreset.name}</div>
          </div>
        </div>

        {/* Probe */}
        <div className="mb-6">
          <button
            onClick={() => setProbeSubmerged(!probeSubmerged)}
            className={`px-4 py-2 rounded transition-all ${probeSubmerged ? 'bg-emerald-600' : 'bg-slate-700'} hover:opacity-80`}
          >
            {probeSubmerged ? 'Probe submerged' : 'Submerge probe'}
          </button>
          {probeSubmerged && (
            <div className="mt-4 bg-slate-900/80 p-4 rounded-lg text-center">
              <div className="text-3xl font-mono">{displayPH} pH</div>
              <div className="text-sm text-slate-400">{millivolts.toFixed(1)} mV at {temperature}°C</div>
            </div>
          )}
        </div>

        {/* Solution presets */}
        <div className="mb-6">
          <label className="block text-sm mb-2">Solution</label>
          <select
            value={selectedPreset.id}
            onChange={e => setSelectedPreset(SOLUTION_PRESETS.find(p => p.id === e.target.value) || SOLUTION_PRESETS[5])}
            className="w-full bg-slate-800 border border-slate-700 rounded p-2"
          >
            {SOLUTION_PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.name} (pH {p.ph})</option>
            ))}
          </select>
          {!isCustom && <div className="text-xs text-slate-400 mt-1">{selectedPreset.description}</div>}
        </div>

        {/* Temperature */}
        <label className="block text-sm mb-2">Temperature: {temperature}°C</label>
        <input type="range" min={10} max={60} step={1} value={temperature} onChange={e => setTemperature(parseInt(e.target.value))} className="w-full accent-emerald-400 mb-6" />

        {/* Calibration */}
        <div className="bg-slate-800/50 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-2">Calibration</h3>
          {calibrationStep === 'none' && (
            <button onClick={startCalibration} className="px-3 py-1 bg-emerald-600 rounded text-sm">Start 2‑point calibration</button>
          )}
          {calibrationStep === 'buffer1' && (
            <div>
              <p className="text-sm mb-2">Submerge probe in pH 4.01 buffer</p>
              <button onClick={() => recordBuffer(4.01)} className="px-3 py-1 bg-blue-600 rounded text-sm">Record buffer 1</button>
            </div>
          )}
          {calibrationStep === 'buffer2' && (
            <div>
              <p className="text-sm mb-2">Submerge probe in pH 7.00 buffer</p>
              <button onClick={() => recordBuffer(7.0)} className="px-3 py-1 bg-blue-600 rounded text-sm">Record buffer 2</button>
            </div>
          )}
          {calibrationStep === 'complete' && (
            <div>
              <p className="text-sm text-emerald-400">✓ Calibration complete</p>
              <button onClick={() => setCalibrationStep('none')} className="mt-2 px-3 py-1 bg-slate-600 rounded text-sm">Reset calibration</button>
            </div>
          )}
          <div className="text-xs text-slate-400 mt-2">Current offset: {calibrationOffset.toFixed(1)} mV</div>
        </div>

        {/* Nernst info */}
        <div className="text-xs text-slate-500 border-t border-slate-700 pt-4">
          Nernst equation: E = E° − (RT/nF)·2.303·pH<br/>
          Slope at {temperature}°C = {(nernstSlope(temperature)).toFixed(2)} mV/pH
        </div>
      </div>
    </div>
  )
}