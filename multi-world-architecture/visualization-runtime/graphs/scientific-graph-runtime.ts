// visualization-runtime/graphs/scientific-graph-runtime.ts
/**
 * Scientific Graph Runtime
 * 
 * Responsibilities:
 * - Render 2D scientific graphs (line, scatter, bar, heatmap) with WebGL/Canvas
 * - Manage graph lifecycle: create, update data series, annotate, destroy
 * - Support real-time data streaming into graphs
 * - Provide accessible alternatives (data tables, descriptions)
 * - Interpolate sparse data and apply error bars
 * 
 * Owned state:
 * - graphs: Map<GraphId, GraphDescriptor>
 * - renderTargets: Map<GraphId, { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D | WebGLRenderingContext }>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - GPUVisualizationRuntime (for GPU-accelerated graphs)
 * 
 * Event emissions: "graph.rendered", "graph.data.updated"
 * Event subscriptions:
 * - "instrument.measurement.recorded" (add data points)
 * - "simulation.tick.completed" (update time-series)
 * 
 * Synchronization: per-graph; updates are serialised via requestAnimationFrame
 * Recovery: graphs can be recreated from descriptor
 * Telemetry: graph count, render time
 * Diagnostics: active graph list
 * Accessibility: provide data table view alongside graph
 * Performance: use GPU for large datasets; decimate for distant views
 * Forbidden: blocking the main thread with slow rendering
 */

import type {
  GraphId, GraphDescriptor, ChartSeries, DataPoint, GraphAnnotation, VisualizationType,
} from '../contracts/visualization-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class ScientificGraphRuntime {
  private graphs: Map<GraphId, GraphDescriptor> = new Map();
  private canvases: Map<GraphId, HTMLCanvasElement> = new Map();
  private renderScheduled = false;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  createGraph(descriptor: GraphDescriptor, canvas: HTMLCanvasElement): void {
    this.graphs.set(descriptor.id, descriptor);
    this.canvases.set(descriptor.id, canvas);
    this.scheduleRender();
    this.meter.incrementCounter('visualization.graph.created', { type: descriptor.type });
  }

  updateSeries(graphId: GraphId, seriesId: string, points: DataPoint[]): void {
    const graph = this.graphs.get(graphId);
    if (!graph) return;
    const series = graph.series.find(s => s.id === seriesId);
    if (series) {
      series.dataPoints = [...series.dataPoints, ...points];
      // Clip old data if exceeding max
      const MAX_POINTS = 5000;
      if (series.dataPoints.length > MAX_POINTS) {
        series.dataPoints = series.dataPoints.slice(-MAX_POINTS);
      }
    }
    this.scheduleRender();
    this.meter.incrementCounter('visualization.graph.data_updated');
    this.eventBus.publish('graph.data.updated', { graphId, seriesId, newPoints: points.length });
  }

  appendDataPoint(graphId: GraphId, seriesId: string, point: DataPoint): void {
    this.updateSeries(graphId, seriesId, [point]);
  }

  removeGraph(graphId: GraphId): void {
    this.graphs.delete(graphId);
    this.canvases.delete(graphId);
    this.meter.incrementCounter('visualization.graph.removed');
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    requestAnimationFrame(() => {
      this.renderAll();
      this.renderScheduled = false;
    });
  }

  private renderAll(): void {
    const start = performance.now();
    for (const [graphId, graph] of this.graphs) {
      const canvas = this.canvases.get(graphId);
      if (!canvas) continue;
      this.renderGraph(graph, canvas);
    }
    const duration = performance.now() - start;
    this.meter.recordHistogram('visualization.render.time', duration);
  }

  private renderGraph(graph: GraphDescriptor, canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw axes
    this.drawAxes(ctx, width, height, graph);

    // Calculate ranges
    const xRange = this.calculateRange(graph.series.map(s => s.dataPoints.map(p => p.x)).flat(), graph.xAxis.min, graph.xAxis.max);
    const yRange = this.calculateRange(graph.series.map(s => s.dataPoints.map(p => p.y)).flat(), graph.yAxis.min, graph.yAxis.max);

    const mapX = (x: number) => ((x - xRange.min) / (xRange.max - xRange.min)) * (width - 60) + 40;
    const mapY = (y: number) => height - 40 - ((y - yRange.min) / (yRange.max - yRange.min)) * (height - 60);

    // Draw series
    for (const series of graph.series) {
      if (series.dataPoints.length < 2) continue;
      ctx.strokeStyle = series.color;
      ctx.lineWidth = series.lineWidth;
      ctx.beginPath();
      for (let i = 0; i < series.dataPoints.length; i++) {
        const point = series.dataPoints[i];
        const px = mapX(point.x);
        const py = mapY(point.y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Draw annotations
    for (const annotation of graph.annotations) {
      if (annotation.type === 'vertical_line' && annotation.position.x !== undefined) {
        const px = mapX(annotation.position.x);
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(px, 40);
        ctx.lineTo(px, height - 40);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = annotation.color;
        ctx.fillText(annotation.label, px + 5, 45);
      }
    }

    // Draw title
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px sans-serif';
    ctx.fillText(graph.title, width / 2 - 50, 20);

    this.eventBus.publish('graph.rendered', { graphId: graph.id });
  }

  private drawAxes(ctx: CanvasRenderingContext2D, width: number, height: number, graph: GraphDescriptor): void {
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 40);
    ctx.lineTo(40, height - 40);
    ctx.lineTo(width - 20, height - 40);
    ctx.stroke();
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '11px sans-serif';
    ctx.fillText(graph.xAxis.label, width / 2, height - 5);
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(graph.yAxis.label, 0, 0);
    ctx.restore();
  }

  private calculateRange(values: number[], minOverride?: number, maxOverride?: number): { min: number; max: number } {
    const min = minOverride ?? Math.min(...values);
    const max = maxOverride ?? Math.max(...values);
    const pad = (max - min) * 0.05 || 1;
    return { min: min - pad, max: max + pad };
  }

  getActiveGraphs(): GraphDescriptor[] {
    return Array.from(this.graphs.values());
  }
}