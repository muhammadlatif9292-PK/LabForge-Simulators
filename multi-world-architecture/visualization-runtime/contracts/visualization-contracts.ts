// visualization-runtime/contracts/visualization-contracts.ts
/**
 * Scientific Visualization Contracts
 * 
 * Responsibilities:
 * - Define strict types for graphs, charts, 3D scientific visualization, and GPU-accelerated rendering
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type VisualizationId = string & { readonly __brand: 'VisualizationId' };
export type GraphId = string & { readonly __brand: 'GraphId' };
export type ChartSeriesId = string & { readonly __brand: 'ChartSeriesId' };

export enum VisualizationType {
  LINE_GRAPH = 'line_graph',
  BAR_CHART = 'bar_chart',
  SCATTER_PLOT = 'scatter_plot',
  HEATMAP = 'heatmap',
  MOLECULAR_3D = 'molecular_3d',
  VECTOR_FIELD = 'vector_field',
  WAVEFORM = 'waveform',
  PHASE_DIAGRAM = 'phase_diagram',
}

export interface GraphDescriptor {
  id: GraphId;
  title: string;
  type: VisualizationType;
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  zAxis?: AxisConfig;
  series: ChartSeries[];
  annotations: GraphAnnotation[];
}

export interface AxisConfig {
  label: string;
  unit: string;
  min?: number;
  max?: number;
  logarithmic: boolean;
}

export interface ChartSeries {
  id: ChartSeriesId;
  label: string;
  dataPoints: DataPoint[];
  color: string;
  lineWidth: number;
  dashPattern?: number[];
}

export interface DataPoint {
  x: number;
  y: number;
  z?: number;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphAnnotation {
  id: string;
  type: 'vertical_line' | 'horizontal_line' | 'region' | 'label';
  position: { x?: number; y?: number };
  label: string;
  color: string;
}

export interface Molecule3D {
  atoms: Atom3D[];
  bonds: Bond3D[];
  center: [number, number, number];
}

export interface Atom3D {
  id: string;
  element: string;
  position: [number, number, number];
  radius: number; // van der Waals radius in Å
  color: [number, number, number];
}

export interface Bond3D {
  atomA: string;
  atomB: string;
  order: 1 | 2 | 3;
}

export interface VisualizationHealth {
  activeGraphs: number;
  gpuMemoryMB: number;
  frameTimeMs: number;
  status: 'healthy' | 'degraded';
}