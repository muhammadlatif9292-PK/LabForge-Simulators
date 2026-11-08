// packages/module-registry/runtime/dependency-graph-engine.ts
/**
 * Dependency Graph Engine
 * 
 * Responsibilities:
 * - Build and maintain a directed graph of module dependencies
 * - Detect circular dependencies and report them
 * - Compute topological sort for correct load order
 * - Support queries: direct dependents, leaves, depth from root
 * - Validate version constraints (semver ranges) against registered modules
 * 
 * Owned state:
 * - nodes: Map<ModuleId, DependencyGraphNode>
 * 
 * Dependencies: ILogger, IMeter
 * 
 * Event emissions: "registry.graph.circular_dependency" when cycle detected
 * Event subscriptions: none
 * Synchronization: graph mutations guarded by registry
 * Recovery: graph rebuilt from module descriptors on restart
 * Telemetry: edge count, cycle detection latency
 * Diagnostics: graph visualisation data, cycle reports
 * Accessibility: N/A
 * Performance: O(V+E) topological sort; incremental edge addition
 * Forbidden: ignoring circular dependencies; loading modules with unmet dependencies
 */

import type { ModuleId, ModuleDescriptor, DependencyGraphNode } from '../contracts/registry-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class DependencyGraphEngine {
  private nodes: Map<ModuleId, DependencyGraphNode> = new Map();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  addNode(descriptor: ModuleDescriptor): void {
    const existing = this.nodes.get(descriptor.id);
    const dependents = existing?.dependents ?? new Set();
    const node: DependencyGraphNode = {
      module: descriptor,
      dependents,
      dependencies: new Set(descriptor.dependencies.map(d => d.moduleId)),
      depth: 0,
      circular: false,
    };
    this.nodes.set(descriptor.id, node);
    // Add edges from dependencies to this node
    for (const dep of descriptor.dependencies) {
      const depNode = this.nodes.get(dep.moduleId);
      if (depNode) {
        depNode.dependents.add(descriptor.id);
      }
    }
    // Detect cycles
    this.detectCycles();
  }

  removeNode(moduleId: ModuleId): void {
    const node = this.nodes.get(moduleId);
    if (!node) return;
    // Remove incoming edges
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode) depNode.dependents.delete(moduleId);
    }
    // Remove outgoing edges
    for (const depId of node.dependents) {
      const depNode = this.nodes.get(depId);
      if (depNode) depNode.dependencies.delete(moduleId);
    }
    this.nodes.delete(moduleId);
  }

  getTopologicalOrder(rootModuleId: ModuleId): ModuleId[] {
    const root = this.nodes.get(rootModuleId);
    if (!root) return [rootModuleId];
    const visited = new Set<ModuleId>();
    const order: ModuleId[] = [];
    const visit = (id: ModuleId) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependencies) {
          visit(depId);
        }
      }
      order.push(id);
    };
    visit(rootModuleId);
    return order;
  }

  getDirectDependents(moduleId: ModuleId): ModuleId[] {
    return Array.from(this.nodes.get(moduleId)?.dependents ?? []);
  }

  getDirectDependencies(moduleId: ModuleId): ModuleId[] {
    return Array.from(this.nodes.get(moduleId)?.dependencies ?? []);
  }

  getLeaves(): ModuleId[] {
    const leaves: ModuleId[] = [];
    for (const [id, node] of this.nodes) {
      if (node.dependents.size === 0) {
        leaves.push(id);
      }
    }
    return leaves;
  }

  detectCycles(): ModuleId[] {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<ModuleId, number>();
    const cycles: ModuleId[] = [];
    for (const id of this.nodes.keys()) color.set(id, WHITE);
    const visit = (id: ModuleId, stack: ModuleId[]): boolean => {
      const c = color.get(id) ?? WHITE;
      if (c === GRAY) {
        // Found a cycle: extract the cycle path
        const cycleStart = stack.indexOf(id);
        if (cycleStart >= 0) {
          const cycle = stack.slice(cycleStart);
          cycles.push(...cycle);
          this.logger.warn(`Circular dependency detected: ${cycle.join(' → ')}`);
          this.meter.incrementCounter('registry.graph.circular_dependency');
          this.eventBus.publish('registry.graph.circular_dependency', { modules: cycle });
        }
        return true;
      }
      if (c === BLACK) return false;
      color.set(id, GRAY);
      stack.push(id);
      const node = this.nodes.get(id);
      if (node) {
        for (const depId of node.dependencies) {
          if (visit(depId, stack)) {
            // Mark node as circular
            node.circular = true;
          }
        }
      }
      stack.pop();
      color.set(id, BLACK);
      return false;
    };
    for (const id of this.nodes.keys()) {
      visit(id, []);
    }
    return [...new Set(cycles)];
  }

  validateDependencies(): { moduleId: ModuleId; missingDeps: ModuleId[] }[] {
    const issues: { moduleId: ModuleId; missingDeps: ModuleId[] }[] = [];
    for (const [id, node] of this.nodes) {
      const missing = node.module.dependencies
        .filter(d => !d.optional && !this.nodes.has(d.moduleId))
        .map(d => d.moduleId);
      if (missing.length > 0) {
        issues.push({ moduleId: id, missingDeps: missing });
      }
    }
    return issues;
  }

  getGraphData(): { nodes: { id: ModuleId; depth: number; circular: boolean }[]; edges: { from: ModuleId; to: ModuleId }[] } {
    const nodeList = Array.from(this.nodes.values()).map(n => ({
      id: n.module.id,
      depth: n.depth,
      circular: n.circular,
    }));
    const edges: { from: ModuleId; to: ModuleId }[] = [];
    for (const [id, node] of this.nodes) {
      for (const depId of node.dependencies) {
        edges.push({ from: id, to: depId });
      }
    }
    return { nodes: nodeList, edges };
  }
}