import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types';
import { Zap, Play, Square, Loader2 } from 'lucide-react';

/**
 * Visual node for triggering laboratory actions.
 */
export const ActionNode: React.FC<NodeProps<NodeData>> = ({ data, selected }) => {
  return (
    <div className={`
      w-[210px] bg-[var(--chem-surface2)] rounded-[var(--chem-radius)] border-l-4 border-[var(--chem-node-action)] 
      p-3 shadow-xl transition-all duration-200 select-none
      ${selected ? 'ring-2 ring-[var(--chem-danger)] scale-[1.02] shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'border-l-[var(--chem-node-action)]'}
    `}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-2.5 h-2.5 !bg-[var(--chem-node-action)] !border-2 !border-[var(--chem-border)]"
      />

      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded bg-[var(--chem-node-action)]/10">
          <Zap className="w-4 h-4 text-[var(--chem-node-action)]" />
        </div>
        <div className="flex-1">
          <select className="w-full bg-transparent text-[11px] font-bold text-gray-200 uppercase tracking-wider outline-none cursor-pointer">
            <option>Inject Sample</option>
            <option>Heat Pulse</option>
            <option>Cool Pulse</option>
            <option>Stir Rapidly</option>
          </select>
        </div>
      </div>

      <div className="p-2 bg-[var(--chem-surface)] rounded border border-[var(--chem-border)] flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3 h-3 text-[var(--chem-node-action)] animate-spin" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Awaiting Trigger</span>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--chem-node-action)] shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
      </div>

      <div className="flex gap-2">
        <button className="flex-1 bg-[var(--chem-node-action)]/20 hover:bg-[var(--chem-node-action)]/30 border border-[var(--chem-node-action)]/50 rounded py-1 flex justify-center transition-colors">
          <Play className="w-3 h-3 text-[var(--chem-node-action)]" />
        </button>
        <button className="flex-1 bg-[var(--chem-surface3)] hover:bg-[var(--chem-surface)] border border-[var(--chem-border)] rounded py-1 flex justify-center transition-colors">
          <Square className="w-3 h-3 text-gray-500" />
        </button>
      </div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-2.5 h-2.5 !bg-[var(--chem-node-action)] !border-2 !border-[var(--chem-border)]"
      />
    </div>
  );
};
