import React from 'react';
import './tokens.css';
import { Sidebar } from './ui/Sidebar';
import { LabCanvas } from './ui/LabCanvas';
import { OutputPanel } from './ui/OutputPanel';
import { useLabStore } from './store/labStore';
import { FlaskConical, Play, Save, Settings, Info, Activity, Pause, RotateCcw, FastForward } from 'lucide-react';

/**
 * Main entry component for the Chemistry Lab application.
 */
export const ChemLabApp: React.FC = () => {
  const { ui, simState, actions } = useLabStore();

  return (
    <div className="flex flex-col h-screen w-full bg-[var(--chem-bg)] text-white overflow-hidden font-sans">
      {/* Top Bar */}
      <header 
        className="h-12 border-b border-[var(--chem-border)] bg-[var(--chem-surface)] flex items-center justify-between px-4 z-50"
        data-tutorial="substance-panel"
      >
        <div className="flex items-center gap-3">
          <FlaskConical className="text-[var(--chem-teal)] w-5 h-5" />
          <h1 className="font-bold text-sm tracking-tight">VIRTUAL CHEM LAB <span className="text-[var(--chem-teal)] opacity-50">v1.0</span></h1>
        </div>

        {/* Node Palette */}
        <div className="hidden lg:flex items-center gap-2 bg-[var(--chem-surface3)] px-3 py-1 rounded-full border border-[var(--chem-border)]">
          {[
            { type: 'substance', color: 'var(--chem-node-substance)', label: 'Substance', icon: 'S' },
            { type: 'container', color: 'var(--chem-node-container)', label: 'Container', icon: 'C' },
            { type: 'condition', color: 'var(--chem-node-condition)', label: 'Condition', icon: 'T' },
            { type: 'sensor', color: 'var(--chem-node-sensor)', label: 'Sensor', icon: 'M' },
            { type: 'action', color: 'var(--chem-node-action)', label: 'Action', icon: 'A' },
            { type: 'output', color: 'var(--chem-node-output)', label: 'Output', icon: 'O' },
          ].map((node) => (
            <div
              key={node.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', node.type);
                e.dataTransfer.effectAllowed = 'move';
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold cursor-grab active:cursor-grabbing transition-transform hover:scale-110"
              style={{ backgroundColor: node.color, color: 'white' }}
              title={node.label}
            >
              {node.icon}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button 
            className="flex items-center gap-2 px-3 py-1 rounded bg-[var(--chem-teal)] hover:bg-[var(--chem-teal-light)] text-xs font-medium transition-colors"
            data-tutorial="run-button"
            onClick={() => actions.updateSim({ phase: 'running' })}
          >
            <Play className="w-3 h-3 fill-current" />
            RUN SIMULATION
          </button>
          <button className="p-1.5 rounded hover:bg-[var(--chem-surface2)] transition-colors">
            <Save className="w-4 h-4 text-gray-400" />
          </button>
          <button className="p-1.5 rounded hover:bg-[var(--chem-surface2)] transition-colors">
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {ui.sidebarOpen && (
          <aside className="w-[260px] border-r border-[var(--chem-border)] bg-[var(--chem-surface)] flex flex-col shrink-0">
            <Sidebar />
          </aside>
        )}

        {/* Canvas */}
        <section className="flex-1 relative bg-[var(--chem-bg)]" data-tutorial="canvas">
          <LabCanvas />
        </section>

        {/* Right Panels */}
        <aside className="w-[320px] border-l border-[var(--chem-border)] bg-[var(--chem-surface)] flex flex-col shrink-0">
          <OutputPanel />
        </aside>
      </main>

      {/* Status Bar / Control Bar */}
      <footer className="h-10 border-t border-[var(--chem-border)] bg-[var(--chem-surface2)] flex items-center justify-between px-4 text-[10px] font-medium text-gray-500 uppercase tracking-widest shrink-0">
        <div className="flex items-center gap-6">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(26,158,122,0.5)] ${
              simState.phase === 'running' ? 'bg-[var(--chem-teal)] animate-pulse' :
              simState.phase === 'idle' ? 'bg-gray-600' :
              simState.phase === 'paused' ? 'bg-[var(--chem-amber)]' :
              simState.phase === 'error' ? 'bg-red-500' : 'bg-[var(--chem-teal)]'
            }`}></span>
            <span className={
              simState.phase === 'running' ? 'text-[var(--chem-teal)]' :
              simState.phase === 'error' ? 'text-red-500' : ''
            }>
              SYSTEM {simState.phase}
            </span>
          </div>

          <div className="flex items-center gap-1.5 border-l border-[var(--chem-border)] pl-4">
            <Activity className="w-3.5 h-3.5" />
            SOLVER: RK4
          </div>
          
          <div className="border-l border-[var(--chem-border)] pl-4 flex items-center gap-3">
            <span className="text-gray-400 font-mono text-[11px] tabular-nums">T = {simState.time.toFixed(1)}s</span>
            <div className="flex gap-1">
              {[1, 5, 10].map(speed => (
                <button 
                  key={speed}
                  className="px-1.5 py-0.5 rounded border border-[var(--chem-border)] bg-[var(--chem-surface3)] hover:text-white transition-colors"
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Central Controls */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[var(--chem-surface3)] p-1 rounded-lg border border-[var(--chem-border)] shadow-xl">
          <button 
            onClick={() => actions.resetSim()}
            className="p-1.5 rounded hover:bg-[var(--chem-surface)] text-gray-400 hover:text-white transition-all active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-[var(--chem-border)] mx-1" />
          <button 
            data-tutorial="run-button"
            onClick={() => actions.updateSim({ phase: simState.phase === 'running' ? 'paused' : 'running' })}
            className={`flex items-center gap-2 px-4 py-1 rounded font-bold text-[9px] transition-all active:scale-95 ${
              simState.phase === 'running' ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-[var(--chem-teal)] text-white'
            }`}
          >
            {simState.phase === 'running' ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            {simState.phase === 'running' ? 'PAUSE' : 'RUN'}
          </button>
          <div className="w-px h-4 bg-[var(--chem-border)] mx-1" />
          <button className="p-1.5 rounded hover:bg-[var(--chem-surface)] text-gray-400 hover:text-white transition-all active:scale-95">
            <FastForward className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button className="hover:text-white transition-colors flex items-center gap-1">
            <Info className="w-3 h-3" />
            HELP
          </button>
          <div className="text-[var(--chem-teal)] font-bold font-mono">CHEM-RT@v0.8.2</div>
        </div>
      </footer>
    </div>
  );
};
