/**
 * Shared type definitions for the chemistry lab.
 */
export type SpeciesId = string; // ALWAYS lowercase: 'hcl','naoh'

export type AICallType = 'predict' | 'safety' | 'explain' | 'qa';

export type AIErrorCode =
  | 'VALIDATION_ERROR'
  | 'PARSE_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'DEDUPED_WAITING';

export interface AIError {
  code: AIErrorCode;
  message: string;
  raw?: unknown;
  attempt?: number;
}

export type AIResult<T> =
  | { status: 'success'; data: T; meta: AIMeta }
  | { status: 'fallback'; data: T; meta: AIMeta; fallbackReason: string }
  | { status: 'error'; error: AIError; meta: AIMeta };

export interface AIMeta {
  cacheHit: boolean;
  responseTimeMs: number;
  attempt: number;
  fallback: boolean;
  confidence?: ConfidenceScore;
}

export interface ConfidenceScore {
  level: 'low' | 'medium' | 'high';
  score: number;
  reasons: string[];
}

export interface ObsMetric {
  timestamp: number;
  type: AICallType;
  durationMs: number;
  cacheHit: boolean;
  retriesUsed: number;
  status: 'success' | 'error' | 'fallback' | 'rate_limit' | 'deduped';
  errorCode?: AIErrorCode;
}

export interface Species {
  id: SpeciesId;
  name: string;
  cas: string;
  smiles: string;
  formula: string;
  mw: number;
  phase: 'solid' | 'liquid' | 'gas' | 'plasma';
  color: string; // hex ONLY: #rrggbb
  thermo: { dHf: number; dGf: number; S: number; Cp: number };
  physical: { density: number; bp: number; mp: number; viscosity?: number };
  safety: { flammable: boolean; ghs: string[]; ld50?: number; explosive?: boolean };
  meta: Record<string, unknown>; // NEVER remove
}

export interface Reaction {
  id: string;
  name: string;
  type: 'acid-base' | 'redox' | 'precipitation' | 'combustion' | 'decomposition' | 'synthesis' | 'other';
  reactants: Array<{ id: SpeciesId; coeff: number }>; // id = lowercase species id
  products: Array<{ id: SpeciesId; coeff: number }>;
  byproducts?: Array<{ id: SpeciesId; coeff: number }>;
  mechanism: string[]; // REQUIRED — [] if unknown
  kinetics: { A: number; Ea: number; orders: Record<string, number> };
  conditions: { tempMin: number; tempMax: number; pressure: number; pH?: [number, number]; catalyst?: string };
  thermo: { dH: number; dG: number; dS: number; K: number };
  safety: { explosionRisk: boolean; toxicGas: string[]; pressureRisk: boolean };
  meta: Record<string, unknown>;
}

export interface SimState {
  time: number;
  concentrations: Record<SpeciesId, number>; // key = lowercase species id
  temperature: number; // KELVIN always
  pressure: number; // atm
  phase: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  events: SimEvent[];
}

export interface SimEvent {
  time: number;
  type: 'colorChange' | 'phaseChange' | 'explosion' | 'gasRelease' | 'precipitate' | 'complete';
  message: string;
  severity: 'info' | 'warning' | 'danger';
}

export interface NodeData {
  type: 'substance' | 'container' | 'condition' | 'sensor' | 'action' | 'output';
  speciesId?: SpeciesId; // ALWAYS speciesId — never substanceId
  concentration?: number; // mol/L
  temperature?: number; // Kelvin
  volume?: number;
  label?: string;
}

export interface SavedExperiment {
  id: string;
  name: string;
  createdAt: string;
  nodes: NodeData[];
  edges: unknown[];
  lastSimState?: SimState;
  aiCacheSnapshot?: Record<string, unknown>; // preserves AI cache across sessions
  version: '1.0';
}

export interface ExperimentTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: string;
  nodes: Array<{ speciesId: SpeciesId; concentration: number; x: number; y: number }>;
  conditions: { temperatureC: number; pressureAtm: number };
  learningGoal: string;
}

export interface ChemLabAppProps {
  initialSpecies?: Species[];
  initialReactions?: Reaction[];
  height?: string | number;
  width?: string | number;
  theme?: 'dark' | 'light' | 'auto';
  accentColor?: string;
  features?: {
    aiPrediction?: boolean;
    safetyAlerts?: boolean;
    moleculeViewer?: boolean;
    exportResults?: boolean;
    chatPanel?: boolean;
    tutorial?: boolean;
    observabilityPanel?: boolean;
  };
  onSimulationComplete?: (r: SimState[]) => void;
  onSafetyAlert?: (e: SimEvent) => void;
  onSpeciesAdded?: (s: Species) => void;
  className?: string;
}

export interface PredictResponse {
  reactionOccurs: boolean;
  noReactionReason?: string;
  products: Array<{ smiles: string; name: string; estimatedYield_pct: number }>;
  mechanism: string[];
  dH_kJ_per_mol: number;
  dG_kJ_per_mol: number;
  reactionType: string;
  confidence: 'high' | 'medium' | 'low';
  safetyFlags: string[];
  explanation: string;
}

export interface SafetyAnalysis {
  overallRisk: 'safe' | 'caution' | 'danger' | 'extreme';
  riskSummary: string;
  hazards: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    triggerConditions: string;
  }>;
  gasesProduced: Array<{ formula: string; toxic: boolean; threshold_ppm?: number }>;
  explosionRisk: boolean;
  ppe: string[];
  firstAid: string[];
  disposalMethod: string;
}
