import React from 'react';
import { 
  Plus, 
  Trash2, 
  Play, 
  X, 
  Keyboard, 
  MousePointer2 
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onClear: () => void;
  onRun: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onClear, onRun }) => {
  React.useEffect(() => {
    const handleClick = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed z-[1000] w-48 bg-[var(--chem-surface)] border border-[var(--chem-border)] rounded-md shadow-2xl overflow-hidden py-1"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="w-full px-3 py-2 text-left text-[11px] text-gray-300 hover:bg-[var(--chem-surface2)] hover:text-white flex items-center gap-2">
        <Plus className="w-3.5 h-3.5" /> Add note
      </button>
      <div className="h-px bg-[var(--chem-border)] my-1" />
      <button 
        onClick={() => {
          if (confirm('Clear all nodes and edges?')) {
            onClear();
            onClose();
          }
        }}
        className="w-full px-3 py-2 text-left text-[11px] text-red-500 hover:bg-red-500/10 flex items-center gap-2"
      >
        <Trash2 className="w-3.5 h-3.5" /> Clear canvas
      </button>
      <button 
        onClick={() => {
          onRun();
          onClose();
        }}
        className="w-full px-3 py-2 text-left text-[11px] text-[var(--chem-teal)] hover:bg-[var(--chem-teal)]/10 flex items-center gap-2"
      >
        <Play className="w-3.5 h-3.5" /> Run simulation
      </button>
    </div>
  );
};

export const ShortcutsOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const shortcuts = [
    { keys: ['Delete'], label: 'Remove selected node' },
    { keys: ['Ctrl', 'R'], label: 'Run simulation' },
    { keys: ['Esc'], label: 'Deselect / Close' },
    { keys: ['?'], label: 'Toggle shortcuts' },
  ];

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--chem-surface)] border border-[var(--chem-border)] rounded-xl w-full max-w-md shadow-2xl relative overflow-hidden">
        <div className="p-6 border-b border-[var(--chem-border)] flex justify-between items-center bg-[var(--chem-surface2)]/50">
          <div className="flex items-center gap-3">
            <Keyboard className="text-[var(--chem-teal)] w-5 h-5" />
            <h2 className="font-bold text-sm tracking-widest uppercase">Shortcuts</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--chem-surface3)]">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {shortcuts.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{s.label}</span>
              <div className="flex gap-1.5">
                {s.keys.map(k => (
                  <kbd key={k} className="px-2 py-1 rounded bg-[var(--chem-surface3)] border border-[var(--chem-border)] text-[10px] text-white font-bold min-w-[24px] text-center shadow-inner">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 bg-[var(--chem-surface2)] border-t border-[var(--chem-border)] flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
          <MousePointer2 className="w-3 h-3" />
          Click anywhere to close
        </div>
      </div>
    </div>
  );
};
