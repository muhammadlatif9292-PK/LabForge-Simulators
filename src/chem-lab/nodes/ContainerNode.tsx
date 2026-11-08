import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types';
import { Beaker } from 'lucide-react';

/**
 * Visual node representing a mixing or containment vessel.
 */
export const ContainerNode: React.FC<NodeProps<NodeData>> = ({ data, selected }) => {
  return (
    <div className={`
      w-[240px] bg-[var(--chem-surface2)] rounded-[var(--chem-radius)] border-l-4 border-[var(--chem-node-container)] 
      p-3 shadow-xl transition-all duration-200 select-none
      ${selected ? 'ring-2 ring-[var(--chem-info)] scale-[1.02] shadow-[0_0_20px_rgba(59,130,246,0.3)]' : 'border-l-[var(--chem-node-container)]'}
    `}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-2.5 h-2.5 !bg-[var(--chem-node-container)] !border-2 !border-[var(--chem-border)] hover:scale-125 transition-transform"
      />

      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded bg-[var(--chem-node-container)]/10">
          <Beaker className="w-4 h-4 text-[var(--chem-node-container)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-gray-200 truncate uppercase tracking-wider">
            {data.label || 'Beaker #1'}
          </div>
          <div className="text-[9px] text-gray-500 font-mono italic">
            Reaction Vessel
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="space-y-1.5">
          <label className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest">
            Volume (mL)
          </label>
          <input 
            type="number" 
            defaultValue={data.volume || 100}
            className="w-full bg-[var(--chem-surface)] border border-[var(--chem-border)] rounded-[var(--chem-radius-sm)] px-2 py-1 text-xs font-mono text-[var(--chem-info)] focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest">
            Temp (K)
          </label>
          <input 
            type="number" 
            defaultValue={data.temperature || 298}
            className="w-full bg-[var(--chem-surface)] border border-[var(--chem-border)] rounded-[var(--chem-radius-sm)] px-2 py-1 text-xs font-mono text-[var(--chem-amber)] focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1 p-2 bg-[var(--chem-surface)] rounded border border-[var(--chem-border)]">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--chem-teal)] opacity-50 shrink-0" />
        ))}
        <div className="w-full text-center mt-1 text-[8px] text-gray-600 font-bold uppercase italic font-mono">
          Mixing In Progress
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-2.5 h-2.5 !bg-[var(--chem-node-container)] !border-2 !border-[var(--chem-border)] hover:scale-125 transition-transform"
      />
    </div>
  );
};
