import React, { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  Connection,
  XYPosition,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes } from '../nodes';
import { useLabStore } from '../store/labStore';
import { ContextMenu, ShortcutsOverlay } from './LabUIComponents';
import { X } from 'lucide-react';

/**
 * Main interactive canvas for the lab experiment.
 */
const LabCanvasInner: React.FC = () => {
  const { nodes, edges, actions } = useLabStore();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [menuPostion, setMenuPosition] = useState<{ x: number, y: number } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [flashingNodes, setFlashingNodes] = useState<string[]>([]);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { project } = useReactFlow();

  const handleNodeMouseEnter = useCallback((_: React.MouseEvent, node: Node) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredNode(node);
    }, 200);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredNode(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');
      const substanceData = event.dataTransfer.getData('substance-data');

      if (!type) return;

      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: crypto.randomUUID(),
        type,
        position,
        data: { 
          label: `${type} node`,
          ...(substanceData ? JSON.parse(substanceData) : {})
        },
        className: 'node-pop-in'
      };

      actions.addNode(newNode);
    },
    [project, actions]
  );

  const isValidConnection = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);

    if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) return false;

    // VALID: 
    // substance -> container
    // condition -> container
    // container -> sensor/output/container
    const valid = (
      ((sourceNode.type === 'substance' || sourceNode.type === 'condition') && targetNode.type === 'container') ||
      (sourceNode.type === 'container' && ['sensor', 'output', 'container'].includes(targetNode.type || ''))
    );

    if (!valid) {
      setErrorMsg('Cannot connect these node types');
      
      // Visual feedback: Flash nodes red
      setFlashingNodes([sourceNode.id, targetNode.id]);
      setTimeout(() => setFlashingNodes([]), 400);
      setTimeout(() => setErrorMsg(null), 2000);
      return false;
    }

    return true;
  }, [nodes]);

  // Merge flashing class into nodes
  const nodesWithFlash = React.useMemo(() => {
    return nodes.map(n => ({
      ...n,
      className: `${n.className || ''} ${flashingNodes.includes(n.id) ? 'flash-red' : ''}`.trim()
    }));
  }, [nodes, flashingNodes]);

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setMenuPosition({ x: event.clientX, y: event.clientY });
    },
    []
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?') {
        setShowShortcuts(prev => !prev);
      }
      if (e.key === 'Delete') {
        // ReactFlow handles deletion if deleteKeyCode is set, 
        // but we are using controlled state.
      }
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        actions.updateSim({ phase: 'running' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions]);

  return (
    <div 
      ref={reactFlowWrapper} 
      className="w-full h-full relative" 
      style={{ backgroundColor: 'var(--chem-bg)' }}
      onContextMenu={onContextMenu}
    >
      <ReactFlow
        nodes={nodesWithFlash}
        edges={edges}
        onNodesChange={actions.onNodesChange}
        onEdgesChange={actions.onEdgesChange}
        onConnect={actions.onConnect}
        nodeTypes={nodeTypes}
        onDrop={onDrop}
        onDragOver={onDragOver}
        isValidConnection={isValidConnection}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        fitView
        className="chem-flow"
        colorMode="dark"
        deleteKeyCode={['Delete', 'Backspace']}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color="var(--chem-border)" 
        />
        <MiniMap 
          style={{ backgroundColor: 'var(--chem-surface2)' }}
          maskColor="rgba(0, 0, 0, 0.3)"
          nodeBorderRadius={2}
          nodeColor={(n) => {
            if (n.type === 'substance') return 'var(--chem-node-substance)';
            if (n.type === 'container') return 'var(--chem-node-container)';
            return 'var(--chem-surface3)';
          }}
        />
        <Controls 
          position="bottom-left" 
          className="bg-[var(--chem-surface2)] border-[var(--chem-border)] fill-white transition-all"
        />
        
        {/* Tooltip */}
        {hoveredNode && (
          <Panel position="top-left" className="pointer-events-none mb-10">
            <div className="bg-black/80 backdrop-blur shadow-2xl p-2 rounded border border-[var(--chem-teal)]/30 animate-in fade-in slide-in-from-bottom-1">
              <div className="text-[8px] font-bold text-[var(--chem-teal)] uppercase tracking-widest mb-1">{hoveredNode.type}</div>
              <div className="text-[11px] font-bold text-white">{hoveredNode.data?.name || hoveredNode.data?.label}</div>
              {hoveredNode.data?.concentration && (
                <div className="text-[9px] text-gray-400 mt-1 font-mono">Conc: {hoveredNode.data.concentration}</div>
              )}
            </div>
          </Panel>
        )}

        {/* Global UI Panels */}
        <Panel position="top-right" className="bg-[var(--chem-surface3)] p-2 rounded-lg border border-[var(--chem-border)] shadow-xl hidden md:block">
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Canvas Instructions</div>
          <ul className="text-[11px] text-gray-300 space-y-1">
            <li>• Drag tools from sidebar</li>
            <li>• Connect nodes to mix</li>
            <li>• Hit <kbd className="px-1 rounded bg-black/30 border border-white/10 text-[9px]">?</kbd> for shortcuts</li>
          </ul>
        </Panel>
      </ReactFlow>

      {/* Connection Error Message */}
      {errorMsg && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] px-6 py-3 bg-[var(--chem-danger)]/90 backdrop-blur-md rounded-lg border border-red-500/50 shadow-2xl flex items-center gap-3 animate-bounce shadow-red-500/20">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white uppercase tracking-widest">{errorMsg}</span>
        </div>
      )}

      {/* Overlays */}
      {menuPostion && (
        <ContextMenu 
          x={menuPostion.x} 
          y={menuPostion.y} 
          onClose={() => setMenuPosition(null)}
          onClear={actions.clearCanvas}
          onRun={() => actions.updateSim({ phase: 'running' })}
        />
      )}

      {showShortcuts && <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />}
    </div>
  );
};

export const LabCanvas: React.FC = () => (
  <ReactFlowProvider>
    <LabCanvasInner />
  </ReactFlowProvider>
);
