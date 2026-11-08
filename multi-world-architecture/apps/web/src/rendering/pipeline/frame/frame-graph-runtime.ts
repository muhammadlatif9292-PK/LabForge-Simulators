// apps/web/src/rendering/pipeline/frame/frame-graph-runtime.ts
/**
 * Frame Graph Runtime
 * 
 * Responsibilities:
 * - Build and manage a directed acyclic graph (DAG) of render passes per frame
 * - Topologically sort passes for execution order
 * - Automatically resolve resource dependencies (inputs/outputs) to create edges
 * - Cull passes that do not contribute to final output
 * - Reuse textures across frames via resource aliasing
 * 
 * Owned state:
 * - currentGraph: Map<FrameId, FrameGraphNode[]>
 * - resourceAliases: Map<TextureId, TextureId>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - GPUResourceScheduler (to query resource availability)
 * - RenderPassOrchestrator (to execute passes)
 * 
 * Event emissions: none (tightly coupled to pipeline)
 * Event subscriptions: none
 * Synchronization: frame graph is per-frame, lock-free
 * Recovery: graph rebuilt each frame; no persistent state
 * Telemetry: node count per frame, culled passes count
 * Diagnostics: graph structure dump for debugging
 * Accessibility: N/A
 * Performance: O(passes + edges) build time; reuse previous frame's layout
 * Forbidden: cycles in the graph; resource leaks across frames
 */

import type { FrameId, FrameGraphNode, RenderPassDescriptor, TextureId } from '../contracts/rendering-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class FrameGraphRuntime {
  private currentGraph: Map<PassId, FrameGraphNode> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  buildGraph(passes: RenderPassDescriptor[]): Map<PassId, FrameGraphNode> {
    const nodes = new Map<PassId, FrameGraphNode>();
    // Create nodes
    for (const pass of passes) {
      nodes.set(pass.id, {
        pass,
        dependencies: [],
        dependents: [],
      });
    }
    // Resolve dependencies: if pass A writes to texture T and pass B reads T, then B depends on A
    const writerMap = new Map<TextureId, PassId[]>();
    for (const pass of passes) {
      for (const output of pass.outputs) {
        if (!writerMap.has(output.textureId)) {
          writerMap.set(output.textureId, []);
        }
        writerMap.get(output.textureId)!.push(pass.id);
      }
    }
    for (const pass of passes) {
      for (const input of pass.inputs) {
        const writers = writerMap.get(input.textureId) ?? [];
        for (const writerId of writers) {
          if (writerId !== pass.id) {
            const node = nodes.get(pass.id)!;
            node.dependencies.push(writerId);
            nodes.get(writerId)?.dependents.push(pass.id);
          }
        }
      }
    }
    // Topological sort for execution order
    const sorted = this.topologicalSort(nodes);
    // Assign order indices (optional, already in pass descriptor)
    this.currentGraph = nodes;
    this.meter.setGauge('rendering.frame_graph.nodes', nodes.size);
    this.meter.setGauge('rendering.frame_graph.passes', sorted.length);
    return nodes;
  }

  private topologicalSort(nodes: Map<PassId, FrameGraphNode>): PassId[] {
    const visited = new Set<PassId>();
    const processing = new Set<PassId>();
    const order: PassId[] = [];
    const visit = (id: PassId) => {
      if (visited.has(id)) return;
      if (processing.has(id)) throw new Error('Cycle detected in frame graph');
      processing.add(id);
      const node = nodes.get(id);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
      }
      processing.delete(id);
      visited.add(id);
      order.push(id);
    };
    for (const id of nodes.keys()) {
      visit(id);
    }
    return order;
  }

  getSortedPassIds(): PassId[] {
    return this.topologicalSort(this.currentGraph);
  }

  cullUnnecessaryPasses(outputPassId: PassId): void {
    // Remove passes not contributing to the specified output
    const reachable = new Set<PassId>();
    const traverse = (id: PassId) => {
      if (reachable.has(id)) return;
      reachable.add(id);
      const node = this.currentGraph.get(id);
      if (node) {
        for (const dep of node.dependencies) {
          traverse(dep);
        }
      }
    };
    traverse(outputPassId);
    for (const id of this.currentGraph.keys()) {
      if (!reachable.has(id)) {
        this.currentGraph.delete(id);
      }
    }
  }
}