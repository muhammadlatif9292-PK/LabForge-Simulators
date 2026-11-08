import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types';
import { ThermometerSun, Zap, Gauge, Droplet } from 'lucide-react';

/**
 * Visual node for setting environment conditions (Temp, Pressure).
 */
export const ConditionNode: React.FC<NodeProps<NodeData>> = ({ data, selected }) => {
  return (
    <div className={`
      w-[210px] bg-[var(--chem-surface2)] rounded-[var(--chem-radius)] border-l-4 border-[var(--chem-node-condition)] 
      p-3 shadow-xl transition-all duration-200 select-none
      ${selected ? 'ring-2 ring-[var(--chem-amber)] scale-[1.02] shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'border-l-[var(--chem-node-condition)]'}
    `}>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded bg-[var(--chem-node-condition)]/10">
          <ThermometerSun className="w-4 h-4 text-[var(--chem-node-condition)]" />
        </div>
        <div className="flex-1">
          <select className="w-full bg-transparent text-[11px] font-bold text-gray-200 uppercase tracking-wider outline-none cursor-pointer">
            <option>Temperature</option>
            <option>Pressure</option>
            <option>Catalyst</option>
            <option>pH Buffer</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Target Value</label>
          <span className="text-[9px] font-mono text-gray-400 italic">KELVIN</span>
        </div>
        <input 
          type="number" 
          defaultValue={data.temperature || 298}
          className="w-full bg-[var(--chem-surface)] border border-[var(--chem-border)] rounded-[var(--chem-radius-sm)] px-2 py-2 text-sm font-mono text-[var(--chem-amber)] focus:outline-none"
        />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1">
        {[Zap, Gauge, Droplet, ThermometerSun].map((Icon, i) => (
          <div key={i} className={`p-1 rounded flex justify-center border transition-colors ${i === 3 ? 'bg-[var(--chem-node-condition)]/20 border-[var(--chem-node-condition)]/50' : 'bg-[var(--chem-surface3)] border-[var(--chem-border)] hover:bg-[var(--chem-surface)]'}`}>
            <Icon className={`w-3 h-3 ${i === 3 ? 'text-[var(--chem-node-condition)]' : 'text-gray-500'}`} />
          </div>
        ))}
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-2.5 h-2.5 !bg-[var(--chem-node-condition)] !border-2 !border-[var(--chem-border)] hover:scale-125 transition-transform"
      />
    </div>
  );
};
