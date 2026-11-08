import { create } from 'zustand';
import { 
  Species, 
  Reaction, 
  SimState, 
  NodeData, 
  SavedExperiment, 
  ObsMetric 
} from '../types';
import { Node, Edge, addEdge, applyNodeChanges, applyEdgeChanges, Connection } from 'reactflow';

interface LabStore {
  species: Record<string, Species>;
  reactions: Record<string, Reaction>;
  simState: SimState;
  timeSeries: Array<{ t: number } & SimState>; // cap 500
  activeNodes: Record<string, NodeData>;
  nodes: Node[];
  edges: Edge[];
  savedExperiments: SavedExperiment[];
  obsMetrics: ObsMetric[]; // cap 200
  ui: {
    selectedNode: string | null;
    sidebarOpen: boolean;
    panel: 'output' | 'safety' | 'chart';
    chatOpen: boolean;
    saveLoadOpen: boolean;
    tutorialActive: boolean;
    obsOpen: boolean;
  };
  actions: {
    loadSpecies(s: Species[]): void;
    loadReactions(r: Reaction[]): void;
    updateSim(p: Partial<SimState>): void;
    appendTimeSeries(pt: { t: number } & SimState): void; // slice to 500
    appendObsMetric(m: ObsMetric): void; // slice to 200
    setUI(p: Partial<LabStore['ui']>): void;
    onNodesChange: (changes: any) => void;
    onEdgesChange: (changes: any) => void;
    onConnect: (connection: Connection) => void;
    addNode: (node: Node) => void;
    clearCanvas: () => void;
    resetSim(): void;
    setError(msg: string): void;
    saveCurrentExperiment(name: string, nodes: NodeData[], edges: unknown[]): void;
    loadExperiment(id: string): SavedExperiment | null;
    deleteExperiment(id: string): void;
  };
}

const DEFAULT_SIM_STATE: SimState = {
  time: 0,
  concentrations: {},
  temperature: 298,
  pressure: 1,
  phase: 'idle',
  events: [],
};

/**
 * Zustand store for the Chemistry Lab state management.
 */
export const useLabStore = create<LabStore>((set, get) => ({
  species: {},
  reactions: {},
  simState: DEFAULT_SIM_STATE,
  timeSeries: [],
  activeNodes: {},
  nodes: [],
  edges: [],
  savedExperiments: [],
  obsMetrics: [],
  ui: {
    selectedNode: null,
    sidebarOpen: true,
    panel: 'chart',
    chatOpen: false,
    saveLoadOpen: false,
    tutorialActive: false,
    obsOpen: false,
  },
  actions: {
    loadSpecies: (s) => set((state) => ({ 
      species: { ...state.species, ...Object.fromEntries(s.map(sp => [sp.id, sp])) } 
    })),
    loadReactions: (r) => set((state) => ({ 
      reactions: { ...state.reactions, ...Object.fromEntries(r.map(re => [re.id, re])) } 
    })),
    updateSim: (p) => set((state) => ({ simState: { ...state.simState, ...p } })),
    appendTimeSeries: (pt) => set((state) => ({
      timeSeries: [...state.timeSeries, pt].slice(-500)
    })),
    appendObsMetric: (m) => set((state) => ({
      obsMetrics: [...state.obsMetrics, m].slice(-200)
    })),
    setUI: (p) => set((state) => ({ ui: { ...state.ui, ...p } })),
    onNodesChange: (changes) => {
      set({
        nodes: applyNodeChanges(changes, get().nodes),
      });
    },
    onEdgesChange: (changes) => {
      set({
        edges: applyEdgeChanges(changes, get().edges),
      });
    },
    onConnect: (connection) => {
      set({
        edges: addEdge(connection, get().edges),
      });
    },
    addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
    clearCanvas: () => set({ nodes: [], edges: [] }),
    resetSim: () => set({ simState: DEFAULT_SIM_STATE, timeSeries: [] }),
    setError: (msg) => set((state) => ({ simState: { ...state.simState, phase: 'error' } })),
    saveCurrentExperiment: (name, nodes, edges) => {
      // Scaffolding: Implementation deferred
    },
    loadExperiment: (id) => {
      // Scaffolding: Implementation deferred
      return null;
    },
    deleteExperiment: (id) => set((state) => ({
      savedExperiments: state.savedExperiments.filter(e => e.id !== id)
    })),
  },
}));
