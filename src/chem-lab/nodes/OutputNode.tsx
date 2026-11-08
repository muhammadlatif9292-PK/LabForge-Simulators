import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types';
import { FileText, Download, Share2 } from 'lucide-react';

/**
 * Visual node for displaying simulation results.
 */
export const OutputNode: React.FC<NodeProps<NodeData>> = ({ data, selected }) => {
  return (
    <div className={`
      w-[230px] bg-[var(--chem-surface2)] rounded-[var(--chem-radius)] border-l-4 border-[var(--chem-node-output)] 
      p-3 shadow-xl transition-all duration-200 select-none
      ${selected ? 'ring-2 ring-[var(--chem-success)] scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'border-l-[var(--chem-node-output)]'}
    `}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-2.5 h-2.5 !bg-[var(--chem-node-output)] !border-2 !border-[var(--chem-border)] hover:scale-125 transition-transform"
      />

      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded bg-[var(--chem-node-output)]/10">
          <FileText className="w-4 h-4 text-[var(--chem-node-output)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-gray-200 truncate uppercase tracking-wider">
            Data Output
          </div>
          <div className="text-[9px] text-gray-500 font-mono italic">
            JSON / CSV Export
          </div>
        </div>
      </div>

      <div className="bg-[var(--chem-surface)] rounded border border-[var(--chem-border)] mb-3 overflow-hidden">
        <div className="px-2 py-1 bg-[var(--chem-surface3)] border-b border-[var(--chem-border)] flex justify-between items-center">
          <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Live Stream</span>
          <div className="flex gap-2">
            <Download className="w-2.5 h-2.5 text-gray-600 hover:text-white cursor-pointer" />
            <Share2 className="w-2.5 h-2.5 text-gray-600 hover:text-white cursor-pointer" />
          </div>
        </div>
        <div className="h-24 overflow-y-auto p-2 scrollbar-hide text-[9px] font-mono text-[var(--chem-success)] leading-tight">
          <div className="opacity-50 tracking-tighter">[SYS] Handshake Successful</div>
          <div className="opacity-70 tracking-tighter">[T=0.00] Initialization...</div>
          <div className="opacity-90 tracking-tighter">[T=0.45] Reaction Detected</div>
          <div className="font-bold tracking-tighter animate-pulse">[T=1.20] delta_H: -45.2kJ</div>
          <div className="opacity-50 tracking-tighter">...</div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-[var(--chem-node-output)] hover:bg-[var(--chem-success)] text-[10px] font-bold text-white transition-colors cursor-pointer text-center uppercase tracking-widest">
        Generate Report
      </div>
    </div>
  );
};
