import React, { useState, useMemo } from 'react';
import { 
  Plus, Beaker, Package, Thermometer, Eye, Zap, FileText, Search, 
  Filter, MoreVertical, ChevronRight, X, FlaskConical, Database
} from 'lucide-react';
import { MoleculeViewer } from './MoleculeViewer';

const PALETTE_TOOLS = [
  { id: 'substance', label: 'Substance', color: 'var(--chem-node-substance)', icon: Package },
  { id: 'container', label: 'Container', color: 'var(--chem-node-container)', icon: Beaker },
  { id: 'condition', label: 'Condition', color: 'var(--chem-node-condition)', icon: Thermometer },
  { id: 'sensor', label: 'Sensor', color: 'var(--chem-node-sensor)', icon: Eye },
  { id: 'action', label: 'Action', color: 'var(--chem-node-action)', icon: Zap },
  { id: 'output', label: 'Output', color: 'var(--chem-node-output)', icon: FileText },
];

const SUBSTANCE_LIBRARY = [
  { id: 'h2so4', category: 'Acids', name: 'Sulfuric Acid', formula: 'H2SO4', cas: '7664-93-9', smiles: 'OS(=O)(=O)O', color: '#FFD700' },
  { id: 'hcl', category: 'Acids', name: 'Hydrochloric Acid', formula: 'HCl', cas: '7647-01-0', smiles: 'Cl', color: '#B4F8C8' },
  { id: 'naoh', category: 'Bases', name: 'Sodium Hydroxide', formula: 'NaOH', cas: '1310-73-2', smiles: '[OH-].[Na+]', color: '#A0E7E5' },
  { id: 'nacl', category: 'Salts', name: 'Sodium Chloride', formula: 'NaCl', cas: '7647-14-5', smiles: '[Na+].[Cl-]', color: '#FBE7C6' },
  { id: 'h2o', category: 'Elements', name: 'Distilled Water', formula: 'H2O', cas: '7732-18-5', smiles: 'O', color: '#A2D2FF' },
];

/**
 * Sidebar for navigating tools, searching substances, and viewing details.
 */
export const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'library' | 'active'>('library');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubstance, setSelectedSubstance] = useState<typeof SUBSTANCE_LIBRARY[0] | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    Acids: true, Bases: true, Salts: true, Elements: true, Organics: true
  });

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredLibrary = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return SUBSTANCE_LIBRARY.filter(s => 
      s.name.toLowerCase().includes(term) || 
      s.formula.toLowerCase().includes(term) || 
      s.cas.includes(term)
    );
  }, [searchTerm]);

  const categories = useMemo(() => {
    const groups: Record<string, typeof SUBSTANCE_LIBRARY> = {};
    filteredLibrary.forEach(s => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    return groups;
  }, [filteredLibrary]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none bg-[var(--chem-surface)]">
      {/* Node Palette Area */}
      <div className="p-3 border-b border-[var(--chem-border)] shrink-0 bg-[var(--chem-surface2)]/50">
        <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Database className="w-3 h-3" /> GRAPH CONSTRUCTS
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {PALETTE_TOOLS.map((tool) => (
            <div 
              key={tool.id}
              draggable
              onDragStart={(e) => onDragStart(e, tool.id)}
              className="group flex flex-col items-center justify-center p-1.5 rounded border border-[var(--chem-border)] bg-[var(--chem-surface2)] hover:bg-[var(--chem-surface3)] cursor-grab active:cursor-grabbing transition-all hover:border-[var(--chem-teal)]/50"
            >
              <tool.icon className="w-3.5 h-3.5 mb-1 text-gray-400 group-hover:text-white transition-colors" style={{ color: tool.color }} />
              <span className="text-[8px] font-bold text-gray-500 group-hover:text-gray-200 truncate uppercase">{tool.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs Switch */}
      <div className="flex border-b border-[var(--chem-border)] bg-[var(--chem-surface2)] shrink-0">
        {(['library', 'active'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${
              activeTab === tab ? 'text-[var(--chem-teal)] border-[var(--chem-teal)] bg-[var(--chem-surface3)]' : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
        {activeTab === 'library' ? (
          <>
            {/* Search Input */}
            <div className="px-3 py-2 border-b border-[var(--chem-border)] sticky top-0 bg-[var(--chem-surface)] z-10 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-gray-600" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, formula, CAS..." 
                className="bg-transparent text-[11px] outline-none w-full text-gray-300 placeholder:text-gray-700"
              />
              {searchTerm && <X onClick={() => setSearchTerm('')} className="w-3 h-3 text-gray-600 hover:text-white cursor-pointer" />}
            </div>

            {/* Catalog */}
            <div className="p-2 space-y-4">
              {Object.keys(categories).length === 0 ? (
                <div className="p-8 text-center opacity-30 italic text-[10px] text-gray-500">No matching substances found.</div>
              ) : (
                (Object.entries(categories) as [string, typeof SUBSTANCE_LIBRARY][]).map(([cat, items]) => (
                  <div key={cat} className="space-y-1">
                    <button 
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center gap-1.5 px-1 py-1 text-[10px] font-bold text-gray-600 uppercase tracking-widest hover:text-gray-400"
                    >
                      <ChevronRight className={`w-3 h-3 transition-transform ${expandedCategories[cat] ? 'rotate-90 text-[var(--chem-teal)]' : ''}`} />
                      {cat} <span className="text-[8px] opacity-40 ml-auto">{items.length}</span>
                    </button>
                    {expandedCategories[cat] && items.map(s => (
                      <div 
                        key={s.id}
                        onClick={() => setSelectedSubstance(s)}
                        className={`group p-2 rounded-md cursor-pointer flex items-center gap-3 transition-all border ${
                          selectedSubstance?.id === s.id ? 'bg-[var(--chem-surface3)] border-[var(--chem-teal)]/30' : 'hover:bg-[var(--chem-surface2)] border-transparent'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full border border-white/5 shadow-inner shrink-0" style={{ backgroundColor: s.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <span className="text-[11px] font-bold text-gray-200 truncate">{s.name}</span>
                            <span className="text-[9px] font-mono font-bold text-[var(--chem-teal)] ml-2">{s.formula}</span>
                          </div>
                          <div className="text-[8px] text-gray-600 uppercase tracking-tighter">CAS: {s.cas}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* Active Nodes (Mocked for Scaffolding) */
          <div className="p-3 space-y-2 opacity-60">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">Graph Instances</div>
            <div className="p-2 rounded border border-[var(--chem-border)] bg-[var(--chem-surface2)] flex items-center gap-3">
              <FlaskConical className="w-4 h-4 text-[var(--chem-teal)]" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold truncate">H2SO4 Vessel</div>
                <div className="text-[8px] opacity-50">Substance Node #1</div>
              </div>
              <X className="w-3 h-3 text-gray-700 cursor-not-allowed" />
            </div>
            <div className="p-8 text-center text-[9px] italic text-gray-600">Active node synchronization via store state.</div>
          </div>
        )}
      </div>

      {/* Detail View + MoleculeViewer */}
      {selectedSubstance && (
        <div className="shrink-0 border-t border-[var(--chem-border)] bg-[var(--chem-surface2)] p-4 shadow-2xl relative">
          <button 
            onClick={() => setSelectedSubstance(null)}
            className="absolute top-2 right-2 p-1 rounded hover:bg-[var(--chem-surface3)] text-gray-500 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          
          <div className="mb-4">
            <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Structural Analysis</div>
            <div className="flex justify-between items-end">
              <h3 className="text-sm font-bold text-[var(--chem-teal)]">{selectedSubstance.name}</h3>
              <span className="text-[10px] font-mono text-gray-500">{selectedSubstance.smiles}</span>
            </div>
          </div>

          <MoleculeViewer smiles={selectedSubstance.smiles} height={180} />
          
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-2 py-1.5 rounded bg-[var(--chem-surface3)] border border-[var(--chem-border)] text-[9px] font-bold hover:bg-[var(--chem-surface)] transition-all uppercase tracking-widest">
              Details
            </button>
            <button 
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', 'substance');
                e.dataTransfer.setData('substance-data', JSON.stringify(selectedSubstance));
              }}
              className="flex items-center justify-center gap-2 py-1.5 rounded bg-[var(--chem-teal)] text-white text-[9px] font-bold hover:bg-[var(--chem-teal-light)] transition-all uppercase tracking-widest shadow-lg shadow-[var(--chem-teal)]/20"
            >
              <Plus className="w-3 h-3" /> Insert
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
