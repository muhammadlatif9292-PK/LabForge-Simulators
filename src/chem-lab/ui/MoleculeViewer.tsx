import React, { useEffect, useRef, useId, useState } from 'react';
import { Loader2, Maximize2, RotateCw, Box } from 'lucide-react';

interface MoleculeViewerProps {
  smiles: string;
  width?: string;
  height?: number;
}

declare global {
  interface Window {
    $3Dmol: any;
  }
}

/**
 * 3D molecule structure viewer using 3Dmol.js.
 * Implements a fallback fetch chain for SDF data and session cache.
 */
export const MoleculeViewer: React.FC<MoleculeViewerProps> = ({ 
  smiles, 
  width = '100%', 
  height = 240 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const id = useId();
  const viewerId = `viewer-${id.replace(/:/g, '')}`;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<'stick' | 'sphere' | 'surface'>('stick');
  const [spin, setSpin] = useState(true);

  const fetchSDF = async (smilesStr: string): Promise<string> => {
    // 1. Check Session Cache
    const cached = sessionStorage.getItem(`sdf-${smilesStr}`);
    if (cached) return cached;

    // 2. Fetch Chain
    try {
      // Priority 1: NCI Cactus
      const cactusRes = await fetch(`https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smilesStr)}/sdf`);
      if (cactusRes.ok) {
        const data = await cactusRes.text();
        sessionStorage.setItem(`sdf-${smilesStr}`, data);
        return data;
      }

      // Priority 2: PubChem (Search by SMILES)
      const pubchemSearch = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smilesStr)}/sdf`);
      if (pubchemSearch.ok) {
        const data = await pubchemSearch.text();
        sessionStorage.setItem(`sdf-${smilesStr}`, data);
        return data;
      }
    } catch (e) {
      console.error('SDF Fetch Error:', e);
    }

    throw new Error('Fallback to formula text');
  };

  useEffect(() => {
    if (!containerRef.current || !window.$3Dmol) return;

    let isMounted = true;
    
    const initViewer = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const sdfData = await fetchSDF(smiles);
        
        if (!isMounted) return;

        if (!viewerRef.current) {
          viewerRef.current = window.$3Dmol.createViewer(containerRef.current, {
            backgroundColor: 'transparent',
          });
        }
        
        const viewer = viewerRef.current;
        viewer.clear();
        viewer.addModel(sdfData, "sdf");
        
        updateStyle(viewer, style);
        
        viewer.zoomTo();
        viewer.render();
        if (spin) viewer.spin(true);
        
      } catch (e) {
        if (isMounted) {
          setError(smiles); // Fallback to displaying SMILES/Formula as text
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initViewer();

    return () => {
      isMounted = false;
      if (viewerRef.current) {
        viewerRef.current.clear();
      }
    };
  }, [smiles]);

  const updateStyle = (viewer: any, newStyle: string) => {
    if (!viewer) return;
    viewer.setStyle({}, {}); // Reset
    if (newStyle === 'stick') viewer.setStyle({}, { stick: { radius: 0.2 } });
    if (newStyle === 'sphere') viewer.setStyle({}, { sphere: { scale: 0.3 } });
    if (newStyle === 'surface') viewer.setStyle({}, { stick: {}, surface: { opacity: 0.5, color: 'white' } });
    viewer.render();
  };

  useEffect(() => {
    if (viewerRef.current) {
      updateStyle(viewerRef.current, style);
    }
  }, [style]);

  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.spin(spin);
    }
  }, [spin]);

  const handleFullscreen = () => {
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen();
    }
  };

  return (
    <div className="relative border border-[var(--chem-border)] bg-[var(--chem-bg)]/50 rounded-lg overflow-hidden group shadow-2xl">
      {/* Header Controls */}
      <div className="absolute top-2 left-2 right-2 z-10 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1">
          {(['stick', 'sphere', 'surface'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-colors ${
                style === s ? 'bg-[var(--chem-teal)] text-white' : 'bg-[var(--chem-surface3)] text-gray-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 font-bold">
          <button 
            onClick={() => setSpin(!spin)}
            className={`p-1 rounded bg-[var(--chem-surface3)] ${spin ? 'text-[var(--chem-teal)]' : 'text-gray-500'}`}
          >
            <RotateCw className={`w-3 h-3 ${spin ? 'animate-spin-slow' : ''}`} />
          </button>
          <button onClick={handleFullscreen} className="p-1 rounded bg-[var(--chem-surface3)] text-gray-500 hover:text-white font-bold">
            <Maximize2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--chem-bg)]/80 z-20">
          <Loader2 className="w-8 h-8 text-[var(--chem-teal)] animate-spin mb-2" />
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Resolving 3D Geometry</span>
        </div>
      )}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-[var(--chem-bg)]/90">
          <Box className="w-10 h-10 text-gray-700 mb-3" />
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">No SDF Available</div>
          <div className="text-xl font-mono text-[var(--chem-teal)] break-all">{error}</div>
        </div>
      ) : null}

      <div 
        id={viewerId} 
        ref={containerRef} 
        style={{ width, height, position: 'relative' }} 
        className="cursor-move"
      />
    </div>
  );
};
