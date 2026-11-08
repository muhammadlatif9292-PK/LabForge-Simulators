import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types';
import { FlaskConical } from 'lucide-react';

/**
 * Visual node representing a chemical substance.
 */
export const SubstanceNode: React.FC<NodeProps<NodeData>> = ({ data, selected }) => {
  return (
    <div className={`
      w-[220px] bg-[var(--chem-surface2)] rounded-[var(--chem-radius)] border-l-4 border-[var(--chem-node-substance)] 
      p-3 shadow-xl transition-all duration-200 select-none
      ${selected ? 'ring-2 ring-[var(--chem-teal-light)] scale-[1.02] shadow-[0_0_20px_rgba(26,158,122,0.3)]' : 'border-l-[var(--chem-node-substance)]'}
    `}>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded bg-[var(--chem-node-substance)]/10">
          <FlaskConical className="w-4 h-4 text-[var(--chem-node-substance)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-gray-200 truncate uppercase tracking-wider">
            {data.speciesId || 'Unknown'}
          </div>
          <div className="text-[9px] text-gray-500 font-mono italic">
            {data.label || 'Substance'}
          </div>
        </div>
        <div className="px-1.5 py-0.5 rounded bg-[var(--chem-surface3)] border border-[var(--chem-border)] text-[9px] font-bold text-[var(--chem-node-substance)]">
          {data.speciesId?.toUpperCase() || '??'}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest">
          Concentration (M)
        </label>
        <div className="relative">
          <input 
            type="number" 
            defaultValue={data.concentration}
            data-tutorial="concentration-input"
            className="w-full bg-[var(--chem-surface)] border border-[var(--chem-border)] rounded-[var(--chem-radius-sm)] px-2 py-1.5 text-xs font-mono text-[var(--chem-teal-light)] focus:outline-none focus:border-[var(--chem-teal)] transition-colors"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[var(--chem-node-substance)] animate-pulse" />
        <div className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">Ready for Reaction</div>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-2.5 h-2.5 !bg-[var(--chem-node-substance)] !border-2 !border-[var(--chem-border)] hover:scale-125 transition-transform"
      />
    </div>
  );
};
