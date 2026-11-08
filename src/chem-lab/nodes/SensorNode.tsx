import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types';
import { Eye, Activity } from 'lucide-react';

/**
 * Visual node for monitoring reaction variables.
 */
export const SensorNode: React.FC<NodeProps<NodeData>> = ({ data, selected }) => {
  return (
    <div className={`
      w-[210px] bg-[var(--chem-surface2)] rounded-[var(--chem-radius)] border-l-4 border-[var(--chem-node-sensor)] 
      p-3 shadow-xl transition-all duration-200 select-none
      ${selected ? 'ring-2 ring-[#8b5cf6] scale-[1.02] shadow-[0_0_20px_rgba(139,92,246,0.3)]' : 'border-l-[var(--chem-node-sensor)]'}
    `}>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-2.5 h-2.5 !bg-[var(--chem-node-sensor)] !border-2 !border-[var(--chem-border)] hover:scale-125 transition-transform"
      />

      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded bg-[var(--chem-node-sensor)]/10">
          <Eye className="w-4 h-4 text-[var(--chem-node-sensor)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-gray-200 truncate uppercase tracking-widest leading-none mb-1">
            Concentration Probe
          </div>
          <div className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">
            Real-time Telemetry
          </div>
        </div>
      </div>

      <div className="bg-[var(--chem-surface)] rounded border border-[var(--chem-border)] p-3 mb-3 text-center">
        <div className="text-[8px] text-gray-500 font-bold uppercase mb-1">Current Reading</div>
        <div className="text-2xl font-mono font-medium text-[var(--chem-node-sensor)] tracking-tight">
          {data.concentration?.toFixed(3) || '0.000'}
          <span className="text-xs ml-1 text-gray-600">M</span>
        </div>
      </div>

      {/* Sparkline Mock */}
      <div className="flex items-end gap-1 h-8 px-2 py-1 bg-[var(--chem-surface3)] rounded border border-[var(--chem-border)]">
        {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4].map((h, i) => (
          <div 
            key={i} 
            className="flex-1 bg-[var(--chem-node-sensor)]/30 rounded-t-sm" 
            style={{ height: `${h * 100}%` }}
          />
        ))}
        <Activity className="absolute bottom-1 right-2 w-3 h-3 text-[var(--chem-node-sensor)] opacity-20" />
      </div>
    </div>
  );
};
