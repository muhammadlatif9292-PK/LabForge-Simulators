import React from 'react';
import { 
  ShieldCheck, AlertTriangle, Wind, Droplets, 
  Skull, Flame, Biohazard, Radiation, Info,
  ExternalLink
} from 'lucide-react';

/**
 * Panel for simulation safety monitoring and GHS hazard assessment.
 */
export const SafetyPanel: React.FC = () => {
  const ghsIcons = [
    { icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { icon: Skull, color: 'text-red-500', bg: 'bg-red-500/10' },
    { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { icon: Biohazard, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { icon: Radiation, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: Info, color: 'text-gray-400', bg: 'bg-gray-400/10' },
    { icon: Wind, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { icon: Droplets, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
  ];

  const exposureData = [
    { substance: 'HCl (Gas)', twa: '2 ppm', stel: '5 ppm' },
    { substance: 'NaOH (Mist)', twa: '2 mg/m³', stel: 'C 2 mg/m³' },
    { substance: 'NaCl (Dust)', twa: '10 mg/m³', stel: 'N/A' },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--chem-surface)] p-4 overflow-y-auto scrollbar-hide">
      {/* Risk Badge */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Protocol Status</span>
        <div className="px-3 py-1 rounded-full bg-[var(--chem-teal)]/10 border border-[var(--chem-teal)]/40 text-[var(--chem-teal)] text-[10px] font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(26,158,122,0.1)]">
          <ShieldCheck className="w-3 h-3" />
          SYSTEM STATE: SAFE
        </div>
      </div>

      {/* GHS Grid */}
      <div className="mb-6">
        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Hazard Class (GHS)</label>
        <div className="grid grid-cols-3 gap-2">
          {ghsIcons.map((item, i) => (
            <div key={i} className={`aspect-square rounded border border-[var(--chem-border)] flex items-center justify-center transition-all hover:scale-105 cursor-help ${i === 8 ? 'bg-green-500/10 border-green-500/30' : 'bg-[var(--chem-surface2)]'}`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
          ))}
        </div>
      </div>

      {/* Mock Warnings */}
      <div className="space-y-3 mb-6">
        <div className="p-3 rounded border border-orange-500/30 bg-orange-500/5 text-orange-200 text-[11px] flex gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 text-orange-500" />
          <div className="leading-relaxed">
            <span className="font-bold">CAUTION:</span> Exothermic neutralization detected. Monitor vessel pressure for thermal expansion.
          </div>
        </div>
        <div className="p-3 rounded border border-cyan-500/30 bg-cyan-500/5 text-cyan-200 text-[11px] flex gap-3">
          <Wind className="w-4 h-4 shrink-0 text-cyan-500" />
          <div className="leading-relaxed">
            <span className="font-bold">ADVISORY:</span> Local exhaust ventilation (LEV) recommended for HCl handling.
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { label: 'Stop', color: 'bg-red-500/20 border-red-500/50 text-red-500' },
          { label: 'Ventilate', color: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-500' },
          { label: 'Neutralize', color: 'bg-purple-500/20 border-purple-500/50 text-purple-500' },
        ].map((btn) => (
          <button key={btn.label} className={`py-1.5 rounded border text-[9px] font-bold uppercase tracking-wider transition-all hover:brightness-125 hover:scale-[1.02] ${btn.color}`}>
            {btn.label}
          </button>
        ))}
      </div>

      {/* Exposure Table */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Exposure Limits</label>
          <ExternalLink className="w-3 h-3 text-gray-600 hover:text-white cursor-pointer" />
        </div>
        <div className="rounded border border-[var(--chem-border)] overflow-hidden bg-[var(--chem-surface2)]">
          <table className="w-full text-left text-[9px]">
            <thead className="bg-[var(--chem-surface3)] text-gray-400 font-bold uppercase tracking-wider border-b border-[var(--chem-border)]">
              <tr>
                <th className="px-3 py-2">Substance</th>
                <th className="px-3 py-2 text-center text-[var(--chem-teal)]">TWA</th>
                <th className="px-3 py-2 text-center text-[var(--chem-info)]">STEL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--chem-border)] text-gray-300">
              {exposureData.map((row, i) => (
                <tr key={i} className="hover:bg-[var(--chem-surface3)] transition-colors">
                  <td className="px-3 py-2 font-medium">{row.substance}</td>
                  <td className="px-3 py-2 text-center font-mono opacity-80">{row.twa}</td>
                  <td className="px-3 py-2 text-center font-mono opacity-80">{row.stel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
