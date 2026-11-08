import React from 'react';
import { useLabStore } from '../store/labStore';
import { 
  Terminal, Activity, AlertCircle, ShieldAlert, 
  Play, Pause, RotateCcw, ArrowRight, Zap 
} from 'lucide-react';
import { ChemChart } from './ChemChart';
import { SafetyPanel } from './SafetyPanel';

/**
 * Panel for real-time numeric output and visualization.
 */
export const OutputPanel: React.FC = () => {
  const { simState, ui, actions } = useLabStore();

  return (
    <div className="flex flex-col h-full bg-[var(--chem-surface)] overflow-hidden">
      {/* Simulation Controls */}
      <div className="p-3 bg-[var(--chem-surface2)] border-b border-[var(--chem-border)] flex gap-2">
        <button 
          onClick={() => actions.updateSim({ phase: 'running' })}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-[var(--chem-teal)] hover:bg-[var(--chem-teal-light)] text-xs font-bold transition-all"
        >
          <Play className="w-3 h-3 fill-current" /> RUN
        </button>
        <button 
          onClick={() => actions.updateSim({ phase: 'paused' })}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded bg-[var(--chem-surface3)] border border-[var(--chem-border)] hover:bg-[var(--chem-surface)] text-xs font-bold text-gray-300 transition-all"
        >
          <Pause className="w-3 h-3 fill-current" /> PAUSE
        </button>
        <button 
          onClick={() => actions.resetSim()}
          className="p-2 rounded bg-[var(--chem-surface3)] border border-[var(--chem-border)] hover:bg-[var(--chem-surface)] text-gray-400 transition-all"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Panel Headers */}
      <div className="flex border-b border-[var(--chem-border)] bg-[var(--chem-surface2)] shrink-0">
        {[
          { id: 'chart', icon: Activity, label: 'Kinetics' },
          { id: 'safety', icon: ShieldAlert, label: 'Safety' },
          { id: 'output', icon: Terminal, label: 'Logger' },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => actions.setUI({ panel: p.id as any })}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
              ui.panel === p.id 
                ? 'text-[var(--chem-teal)] border-[var(--chem-teal)] bg-[var(--chem-surface3)]' 
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            <p.icon className="w-3 h-3" />
            {p.label}
          </button>
        ))}
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {ui.panel === 'chart' && (
          <div className="h-full flex flex-col">
            {/* Thermo Summary Overlay (Optional/Static) */}
            <div className="p-3 bg-[var(--chem-bg)]/30 border-b border-[var(--chem-border)]">
              <div className="flex items-center justify-center gap-3 py-2 bg-[var(--chem-surface3)] rounded-md border border-[var(--chem-border)]">
                <span className="text-[10px] font-bold text-[var(--chem-teal)]">HCl + NaOH</span>
                <ArrowRight className="w-3 h-3 text-gray-600" />
                <span className="text-[10px] font-bold text-[var(--chem-info)]">NaCl + H₂O</span>
              </div>
            </div>
            {/* Actual Chart Component */}
            <div className="flex-1 p-2">
              <ChemChart />
            </div>
          </div>
        )}

        {ui.panel === 'safety' && (
          <SafetyPanel />
        )}

        {ui.panel === 'output' && (
          <div className="h-full flex flex-col p-4 scrollbar-hide overflow-y-auto">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Live Session Logs</div>
            {simState.events.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-20 grayscale text-center p-8">
                <Terminal className="w-12 h-12 mb-4" />
                <div className="text-xs font-bold uppercase tracking-widest">No Events Logged</div>
              </div>
            ) : (
              <div className="space-y-3">
                {simState.events.map((event, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded border text-[11px] leading-relaxed ${
                      event.severity === 'danger' 
                        ? 'bg-[var(--chem-danger)]/10 border-[var(--chem-danger)]/30 text-[var(--chem-danger)]'
                        : event.severity === 'warning'
                        ? 'bg-[var(--chem-amber)]/10 border-[var(--chem-amber)]/30 text-[var(--chem-amber)]'
                        : 'bg-[var(--chem-info)]/10 border-[var(--chem-info)]/30 text-[var(--chem-info)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 font-bold uppercase text-[9px] opacity-70">
                      <AlertCircle className="w-3 h-3" />
                      <span>T = {event.time.toFixed(2)}s</span>
                    </div>
                    {event.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Persistence Bar / Mini Stats */}
      <div className="p-3 border-t border-[var(--chem-border)] bg-[var(--chem-surface2)] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="px-2 py-0.5 rounded-full bg-[var(--chem-teal)]/10 border border-[var(--chem-teal)]/30 text-[var(--chem-teal)] text-[8px] font-bold uppercase tracking-widest flex items-center gap-1.5">
            <Zap className="w-2.5 h-2.5 fill-current" />
            SPONTANEOUS
          </div>
          <div className="text-[9px] font-mono text-gray-500 tracking-tighter">K = 1.2×10²⁰</div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'ΔH', val: '-114', color: 'text-red-500' },
            { label: 'ΔG', val: '-118.9', color: 'text-red-500' },
            { label: 'ΔS', val: '-16.4', color: 'text-gray-500' },
          ].map((s) => (
            <div key={s.label} className="p-1.5 rounded bg-[var(--chem-surface3)] border border-[var(--chem-border)] text-center">
              <div className="text-[8px] text-gray-600 font-bold uppercase">{s.label}</div>
              <div className={`text-[10px] font-mono font-bold ${s.color}`}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
