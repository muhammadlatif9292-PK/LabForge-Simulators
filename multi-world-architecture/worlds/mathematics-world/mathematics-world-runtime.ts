// worlds/mathematics-world/mathematics-world-runtime.ts
/**
 * Mathematics World Runtime
 * 
 * Responsibilities:
 * - Execute the mathematics domain simulation (function plotting, geometry, algebra, statistics)
 * - Manage mathematical entities (functions, shapes, data sets, vectors, matrices)
 * - Coordinate with mathematics instruments (graphing calculator, geometry tools)
 * - Run mathematics missions (derivative exploration, geometric proofs, statistical analysis)
 * - Persist world state for offline replay
 * 
 * Owned state: inherited from WorldRuntime
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - MathematicsSimulationRuntime (solvers, CAS engine)
 * - WorldStreamingRuntime
 * - WorldMemoryManager
 * - WorldRecoveryEngine
 * - MissionRuntime
 * 
 * Event emissions:
 *   "mathematics.function.plotted", "mathematics.geometry.transformed"
 *   "mathematics.statistics.computed"
 * 
 * Event subscriptions:
 *   "instrument.input.changed" (function entry, slider adjustment)
 * 
 * Synchronization: single-threaded; on-demand computation
 * Recovery: checkpoint/restore via save state
 * Telemetry: function count, computation latency
 * Diagnostics: active functions, cached results
 * Accessibility: function descriptions for screen readers; alt text for plots
 * Performance: lazy evaluation; cached function outputs; Web Worker for heavy computations
 * Forbidden: incorrect derivative/integral without disclaimer; numeric instability without warning
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  DomainWorldDescriptor, WorldEntity, WorldEntityId,
  WorldSaveState,
} from '../contracts/scientific-world-contracts';
import { Domain } from '../contracts/scientific-world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { WorldRuntime } from '../core/world-runtime';

// Mathematics-specific types
interface MathFunction {
  id: string;
  expression: string;
  variables: string[];
  domain: { min: number; max: number };
  color: [number, number, number];
  cachedPoints: Array<{ x: number; y: number }>;
}

interface GeometricShape {
  id: string;
  type: 'point' | 'line' | 'circle' | 'triangle' | 'rectangle' | 'polygon';
  vertices: Array<[number, number, number]>;
  transformations: Transformation[];
  color: [number, number, number];
}

interface Transformation {
  type: 'translate' | 'rotate' | 'scale' | 'reflect';
  params: number[];
}

interface DataSet {
  id: string;
  label: string;
  points: Array<{ x: number; y: number }>;
  statistics: DataSetStatistics;
}

interface DataSetStatistics {
  mean: { x: number; y: number };
  variance: { x: number; y: number };
  correlation: number;
  regression: { slope: number; intercept: number; rSquared: number };
}

export class MathematicsWorldRuntime extends WorldRuntime {
  private mathFunctions: Map<string, MathFunction> = new Map();
  private geometricShapes: Map<string, GeometricShape> = new Map();
  private dataSets: Map<string, DataSet> = new Map();
  private resultCache: Map<string, { result: number | number[]; timestamp: number }> = new Map();
  private readonly COMPUTATION_TTL_MS = 5000;

  constructor(
    descriptor: DomainWorldDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
  ) {
    super(descriptor, logger, meter, eventBus);
    if (descriptor.domain !== Domain.MATHEMATICS) {
      throw new Error('MathematicsWorldRuntime requires MATHEMATICS domain descriptor');
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    // Mathematics world is event-driven, not tick-based
    this.meter.incrementCounter('mathematics.world.started');
    this.logger.info(`Mathematics world started: ${this.descriptor.name}`);
  }

  async stop(): Promise<void> {
    this.running = false;
    this.meter.incrementCounter('mathematics.world.stopped');
    this.logger.info(`Mathematics world stopped: ${this.descriptor.name}`);
  }

  // Override tick — mathematics is on-demand, not continuous
  protected tick(): void {
    // No continuous simulation; computations are triggered by user interactions
  }

  // --- Function Plotting ---

  defineFunction(expression: string, variables: string[], domain: { min: number; max: number }, color?: [number, number, number]): MathFunction {
    const id = uuidv4();
    const fn: MathFunction = {
      id,
      expression,
      variables,
      domain,
      color: color ?? [100, 180, 255],
      cachedPoints: [],
    };
    this.mathFunctions.set(id, fn);

    // Generate initial plot points
    this.sampleFunction(fn, 200);

    this.eventBus.publish('mathematics.function.plotted', {
      functionId: id,
      expression,
      domain,
    });
    return fn;
  }

  private sampleFunction(fn: MathFunction, samples: number): void {
    const { min, max } = fn.domain;
    const step = (max - min) / (samples - 1);
    fn.cachedPoints = [];
    for (let i = 0; i < samples; i++) {
      const x = min + i * step;
      const y = this.evaluateFunction(fn.expression, fn.variables, [x]);
      fn.cachedPoints.push({ x, y });
    }
  }

  evaluateFunction(expression: string, variables: string[], args: number[]): number {
    const cacheKey = `${expression}:${args.join(',')}`;
    const cached = this.resultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.COMPUTATION_TTL_MS) {
      return cached.result as number;
    }
    // Simple expression evaluator (production would use a proper CAS)
    let result = NaN;
    try {
      const vars: Record<string, number> = {};
      variables.forEach((v, i) => { vars[v] = args[i] ?? 0; });
      const safeExpression = expression
        .replace(/\^/g, '**')
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/abs/g, 'Math.abs')
        .replace(/log/g, 'Math.log')
        .replace(/exp/g, 'Math.exp')
        .replace(/pi/g, String(Math.PI))
        .replace(/e(?![xp])/g, String(Math.E));
      const fn = new Function(...Object.keys(vars), `return ${safeExpression};`);
      result = fn(...Object.values(vars));
    } catch (err) {
      this.logger.warn(`Function evaluation failed: ${expression}`, { error: err });
    }
    this.resultCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  }

  getFunctionPoints(functionId: string): Array<{ x: number; y: number }> | undefined {
    return this.mathFunctions.get(functionId)?.cachedPoints;
  }

  recomputeFunction(functionId: string): void {
    const fn = this.mathFunctions.get(functionId);
    if (fn) this.sampleFunction(fn, 200);
  }

  // --- Geometry ---

  createShape(type: GeometricShape['type'], vertices: Array<[number, number, number]>, color?: [number, number, number]): GeometricShape {
    const shape: GeometricShape = {
      id: uuidv4(),
      type,
      vertices: vertices.map(v => [...v] as [number, number, number]),
      transformations: [],
      color: color ?? [200, 150, 100],
    };
    this.geometricShapes.set(shape.id, shape);
    this.eventBus.publish('mathematics.geometry.transformed', { shapeId: shape.id, type: 'created' });
    return shape;
  }

  applyTransformation(shapeId: string, transformation: Transformation): void {
    const shape = this.geometricShapes.get(shapeId);
    if (!shape) return;
    shape.transformations.push(transformation);
    this.applyTransformToVertices(shape, transformation);
    this.eventBus.publish('mathematics.geometry.transformed', {
      shapeId,
      type: transformation.type,
      params: transformation.params,
    });
  }

  private applyTransformToVertices(shape: GeometricShape, t: Transformation): void {
    switch (t.type) {
      case 'translate': {
        const [dx, dy, dz] = t.params;
        shape.vertices = shape.vertices.map(([x, y, z]) => [x + dx, y + dy, (z ?? 0) + (dz ?? 0)] as [number, number, number]);
        break;
      }
      case 'scale': {
        const [sx, sy, sz] = t.params;
        shape.vertices = shape.vertices.map(([x, y, z]) => [x * sx, y * sy, (z ?? 0) * (sz ?? 1)] as [number, number, number]);
        break;
      }
      case 'rotate': {
        const [angle, axis] = [t.params[0] ?? 0, t.params[1] ?? 2]; // axis: 0=x, 1=y, 2=z
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        shape.vertices = shape.vertices.map(([x, y, z]) => {
          const v = [x, y, z ?? 0];
          if (axis === 0) { // rotate around X
            return [v[0], v[1] * cos - v[2] * sin, v[1] * sin + v[2] * cos] as [number, number, number];
          } else if (axis === 1) { // rotate around Y
            return [v[0] * cos + v[2] * sin, v[1], -v[0] * sin + v[2] * cos] as [number, number, number];
          } else { // rotate around Z
            return [v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos, v[2]] as [number, number, number];
          }
        });
        break;
      }
    }
  }

  // --- Statistics ---

  createDataSet(label: string, points: Array<{ x: number; y: number }>): DataSet {
    const id = uuidv4();
    const statistics = this.computeStatistics(points);
    const ds: DataSet = { id, label, points, statistics };
    this.dataSets.set(id, ds);
    this.eventBus.publish('mathematics.statistics.computed', { dataSetId: id, label, pointCount: points.length });
    return ds;
  }

  private computeStatistics(points: Array<{ x: number; y: number }>): DataSetStatistics {
    const n = points.length;
    if (n === 0) return { mean: { x: 0, y: 0 }, variance: { x: 0, y: 0 }, correlation: 0, regression: { slope: 0, intercept: 0, rSquared: 0 } };

    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;

    const sumDx2 = points.reduce((s, p) => s + (p.x - meanX) ** 2, 0);
    const sumDy2 = points.reduce((s, p) => s + (p.y - meanY) ** 2, 0);
    const sumDxDy = points.reduce((s, p) => s + (p.x - meanX) * (p.y - meanY), 0);

    const varianceX = sumDx2 / n;
    const varianceY = sumDy2 / n;
    const covariance = sumDxDy / n;
    const stdX = Math.sqrt(varianceX);
    const stdY = Math.sqrt(varianceY);
    const correlation = stdX > 0 && stdY > 0 ? covariance / (stdX * stdY) : 0;

    const slope = sumDx2 > 0 ? sumDxDy / sumDx2 : 0;
    const intercept = meanY - slope * meanX;

    // R-squared
    const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
    const ssTot = sumDy2;
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 1;

    return {
      mean: { x: meanX, y: meanY },
      variance: { x: varianceX, y: varianceY },
      correlation,
      regression: { slope, intercept, rSquared },
    };
  }

  getDataSet(id: string): DataSet | undefined {
    return this.dataSets.get(id);
  }

  getFunction(id: string): MathFunction | undefined {
    return this.mathFunctions.get(id);
  }

  getShape(id: string): GeometricShape | undefined {
    return this.geometricShapes.get(id);
  }

  async saveState(userId: string): Promise<WorldSaveState> {
    const state: WorldSaveState = {
      worldId: this.descriptor.id,
      userId,
      timestamp: Date.now(),
      entities: Array.from(this.entities.values()),
      instrumentBindings: Array.from(this.bindings.values()),
      simulationSnapshot: {
        mathFunctions: Array.from(this.mathFunctions.entries()),
        geometricShapes: Array.from(this.geometricShapes.entries()),
        dataSets: Array.from(this.dataSets.entries()),
      },
      missionProgress: {},
      checksum: '',
    };
    const json = JSON.stringify(state);
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
    state.checksum = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return state;
  }

  async restoreState(state: WorldSaveState): Promise<void> {
    this.entities.clear();
    this.bindings.clear();
    this.mathFunctions.clear();
    this.geometricShapes.clear();
    this.dataSets.clear();
    this.resultCache.clear();

    for (const entity of state.entities) {
      this.entities.set(entity.id, entity);
    }
    for (const binding of state.instrumentBindings) {
      this.bindings.set(binding.id, binding);
    }
    if (state.simulationSnapshot) {
      const snap = state.simulationSnapshot as any;
      if (snap.mathFunctions) {
        for (const [id, fn] of snap.mathFunctions) this.mathFunctions.set(id, fn);
      }
      if (snap.geometricShapes) {
        for (const [id, shape] of snap.geometricShapes) this.geometricShapes.set(id, shape);
      }
      if (snap.dataSets) {
        for (const [id, ds] of snap.dataSets) this.dataSets.set(id, ds);
      }
    }
    this.logger.info(`Mathematics world state restored (${state.entities.length} entities, ${this.mathFunctions.size} functions)`);
  }
}