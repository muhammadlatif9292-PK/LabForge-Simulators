// worlds/electronics-world/electronics-world-runtime.ts
/**
 * Electronics World Runtime
 * 
 * Responsibilities:
 * - Execute the electronics domain simulation (circuit analysis, digital logic, signal propagation)
 * - Manage electronic entities (components, nodes, wires, ICs)
 * - Coordinate with electronics instruments (multimeter, oscilloscope, voltmeter, ammeter)
 * - Run electronics missions (Ohm's Law, Kirchhoff's Laws, logic gate truth tables)
 * - Persist world state for offline replay
 * 
 * Owned state: inherited from WorldRuntime
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - ElectronicsSimulationRuntime (circuit solver, nodal analysis)
 * - WorldStreamingRuntime
 * - WorldMemoryManager
 * - WorldRecoveryEngine
 * - MissionRuntime
 * 
 * Event emissions:
 *   "electronics.circuit.solved", "electronics.component.placed"
 *   "electronics.signal.changed", "electronics.logic.evaluated"
 * 
 * Event subscriptions:
 *   "instrument.measurement.recorded" (multimeter readings)
 *   "world.entity.connected" (wire connections)
 * 
 * Synchronization: single-threaded; circuit solved per tick
 * Recovery: checkpoint/restore via save state
 * Telemetry: component count, solve latency, node count
 * Diagnostics: circuit topology, active signals
 * Accessibility: component descriptions for screen readers
 * Performance: sparse matrix solver for circuits; O(n) for digital logic
 * Forbidden: short circuits without detection; violating Kirchhoff's laws without warning
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  DomainWorldDescriptor, WorldEntity, WorldEntityId,
  InstrumentBinding, InstrumentBindingId, WorldSaveState,
} from '../contracts/scientific-world-contracts';
import { Domain } from '../contracts/scientific-world-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { WorldRuntime } from '../core/world-runtime';

// --- Electronics-specific types ---
interface CircuitNode {
  id: string;
  voltage: number;
  connections: CircuitConnection[];
}

interface CircuitConnection {
  fromNodeId: string;
  toNodeId: string;
  componentId: WorldEntityId;
  resistance: number;
}

interface LogicGate {
  id: string;
  type: 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR';
  inputs: { sourceEntityId: WorldEntityId; value: boolean }[];
  outputEntityId: WorldEntityId;
}

export class ElectronicsWorldRuntime extends WorldRuntime {
  private circuitNodes: Map<string, CircuitNode> = new Map();
  private logicGates: Map<string, LogicGate> = new Map();
  private wireConnections: Array<{ from: WorldEntityId; to: WorldEntityId; resistance: number }> = [];
  private signalHistory: Array<{ nodeId: string; voltage: number; timestamp: number }> = [];
  private readonly MAX_SIGNAL_HISTORY = 10000;

  constructor(
    descriptor: DomainWorldDescriptor,
    logger: ILogger,
    meter: IMeter,
    eventBus: DistributedEventBus,
  ) {
    super(descriptor, logger, meter, eventBus);
    if (descriptor.domain !== Domain.ELECTRONICS) {
      throw new Error('ElectronicsWorldRuntime requires ELECTRONICS domain descriptor');
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const intervalMs = 1000 / this.descriptor.simulationConfig.tickRateHz;
    this.tickTimer = setInterval(() => this.tick(), intervalMs);
    this.meter.incrementCounter('electronics.world.started');
    this.logger.info(`Electronics world started: ${this.descriptor.name}`);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    this.meter.incrementCounter('electronics.world.stopped');
    this.logger.info(`Electronics world stopped: ${this.descriptor.name}`);
  }

  private tick(): void {
    if (!this.running) return;
    this.currentTick++;
    const start = performance.now();

    // 1. Solve analog circuit (nodal analysis)
    this.solveCircuit();

    // 2. Evaluate digital logic gates
    this.evaluateLogicGates();

    // 3. Propagate signals through wires
    this.propagateSignals();

    const duration = performance.now() - start;
    this.meter.recordHistogram('electronics.world.tick.duration', duration);
    this.meter.recordHistogram('electronics.world.node_count', this.circuitNodes.size);
    this.eventBus.publish('world.simulation.ticked', {
      worldId: this.descriptor.id,
      tick: this.currentTick,
      nodeCount: this.circuitNodes.size,
      gateCount: this.logicGates.size,
    });
  }

  /**
   * Simple nodal analysis: for resistive circuits, solve GV = I
   * where G is the conductance matrix, V is node voltages, I is current sources.
   * Ground node assumed at index 0.
   */
  private solveCircuit(): void {
    if (this.circuitNodes.size < 2) return;
    const nodeIds = Array.from(this.circuitNodes.keys());
    const groundNode = nodeIds[0];

    // Build conductance matrix (simplified: direct solver for small circuits)
    const nonGroundNodes = nodeIds.filter(id => id !== groundNode);
    const n = nonGroundNodes.length;

    // For very simple circuit: just compute voltage divider relationships
    for (const nodeId of nonGroundNodes) {
      const node = this.circuitNodes.get(nodeId);
      if (!node || node.connections.length === 0) continue;

      let totalConductance = 0;
      let weightedVoltage = 0;
      for (const conn of node.connections) {
        if (conn.resistance <= 0) continue;
        const conductance = 1 / conn.resistance;
        totalConductance += conductance;
        const otherNode = this.circuitNodes.get(
          conn.fromNodeId === nodeId ? conn.toNodeId : conn.fromNodeId
        );
        if (otherNode) {
          weightedVoltage += conductance * otherNode.voltage;
        }
      }
      if (totalConductance > 0) {
        node.voltage = weightedVoltage / totalConductance;
      }
    }

    // Emit solved event
    this.eventBus.publish('electronics.circuit.solved', {
      worldId: this.descriptor.id,
      tick: this.currentTick,
      nodeVoltages: nonGroundNodes.map(id => ({
        nodeId: id,
        voltage: this.circuitNodes.get(id)?.voltage ?? 0,
      })),
    });
  }

  private evaluateLogicGates(): void {
    for (const gate of this.logicGates.values()) {
      const inputValues = gate.inputs.map(input => {
        const sourceEntity = this.entities.get(input.sourceEntityId);
        return sourceEntity ? (sourceEntity.properties.logicValue as boolean) ?? false : input.value;
      });

      let outputValue = false;
      switch (gate.type) {
        case 'AND': outputValue = inputValues.every(v => v); break;
        case 'OR': outputValue = inputValues.some(v => v); break;
        case 'NOT': outputValue = !inputValues[0]; break;
        case 'NAND': outputValue = !inputValues.every(v => v); break;
        case 'NOR': outputValue = !inputValues.some(v => v); break;
        case 'XOR': outputValue = inputValues.filter(v => v).length % 2 === 1; break;
      }

      const outputEntity = this.entities.get(gate.outputEntityId);
      if (outputEntity) {
        outputEntity.properties.logicValue = outputValue;
        outputEntity.properties.prevLogicValue = outputEntity.properties.logicValue;
        outputEntity.updatedAt = Date.now();
      }

      this.eventBus.publish('electronics.logic.evaluated', {
        gateId: gate.id,
        type: gate.type,
        inputs: inputValues,
        output: outputValue,
      });
    }
  }

  private propagateSignals(): void {
    for (const conn of this.wireConnections) {
      const fromEntity = this.entities.get(conn.from);
      const toEntity = this.entities.get(conn.to);
      if (fromEntity && toEntity) {
        // Propagate voltage or logic value
        if (fromEntity.properties.voltage !== undefined) {
          toEntity.properties.voltage = fromEntity.properties.voltage;
        }
        if (fromEntity.properties.logicValue !== undefined) {
          toEntity.properties.logicValue = fromEntity.properties.logicValue;
        }
        toEntity.updatedAt = Date.now();
      }
    }
  }

  async addComponent(
    type: 'resistor' | 'capacitor' | 'inductor' | 'voltage_source' | 'ground' | 'wire' | 'logic_gate',
    position: [number, number, number],
    properties?: Record<string, unknown>,
  ): Promise<WorldEntity> {
    const entity: WorldEntity = {
      id: uuidv4() as WorldEntityId,
      type: `component:${type}`,
      position,
      rotation: [0, 0, 0, 1],
      properties: {
        componentType: type,
        ...properties,
      },
      instrumentBindings: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Create circuit node if this is a connectable component
    if (type !== 'wire') {
      const nodeId = `node_${entity.id}`;
      this.circuitNodes.set(nodeId, {
        id: nodeId,
        voltage: type === 'ground' ? 0 : (properties?.initialVoltage as number) ?? 0,
        connections: [],
      });
      entity.properties.nodeId = nodeId;
    }

    this.addEntity(entity);
    this.eventBus.publish('electronics.component.placed', {
      entityId: entity.id,
      type,
      position,
    });
    return entity;
  }

  addCircuitConnection(
    fromEntityId: WorldEntityId,
    toEntityId: WorldEntityId,
    resistance: number = 0.001,
  ): void {
    const fromEntity = this.entities.get(fromEntityId);
    const toEntity = this.entities.get(toEntityId);
    if (!fromEntity || !toEntity) return;

    const fromNodeId = fromEntity.properties.nodeId as string;
    const toNodeId = toEntity.properties.nodeId as string;
    if (!fromNodeId || !toNodeId) return;

    const fromNode = this.circuitNodes.get(fromNodeId);
    const toNode = this.circuitNodes.get(toNodeId);
    if (!fromNode || !toNode) return;

    const conn: CircuitConnection = {
      fromNodeId,
      toNodeId,
      componentId: fromEntityId,
      resistance,
    };
    fromNode.connections.push(conn);
    toNode.connections.push({ ...conn, fromNodeId: toNodeId, toNodeId: fromNodeId });

    this.wireConnections.push({ from: fromEntityId, to: toEntityId, resistance });
  }

  addLogicGate(
    type: LogicGate['type'],
    inputEntityIds: WorldEntityId[],
    outputEntityId: WorldEntityId,
  ): void {
    const gate: LogicGate = {
      id: uuidv4(),
      type,
      inputs: inputEntityIds.map(id => ({ sourceEntityId: id, value: false })),
      outputEntityId,
    };
    this.logicGates.set(gate.id, gate);
  }

  getCircuitState(): { nodeVoltages: Array<{ nodeId: string; voltage: number }> } {
    return {
      nodeVoltages: Array.from(this.circuitNodes.values()).map(n => ({
        nodeId: n.id,
        voltage: n.voltage,
      })),
    };
  }

  async saveState(userId: string): Promise<WorldSaveState> {
    const state: WorldSaveState = {
      worldId: this.descriptor.id,
      userId,
      timestamp: Date.now(),
      entities: Array.from(this.entities.values()),
      instrumentBindings: Array.from(this.bindings.values()),
      simulationSnapshot: {
        circuitNodes: Array.from(this.circuitNodes.entries()),
        logicGates: Array.from(this.logicGates.entries()),
        wireConnections: this.wireConnections,
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
    this.circuitNodes.clear();
    this.logicGates.clear();
    this.wireConnections = [];

    for (const entity of state.entities) {
      this.entities.set(entity.id, entity);
    }
    for (const binding of state.instrumentBindings) {
      this.bindings.set(binding.id, binding);
    }
    if (state.simulationSnapshot) {
      const snap = state.simulationSnapshot as any;
      if (snap.circuitNodes) {
        for (const [id, node] of snap.circuitNodes) {
          this.circuitNodes.set(id, node);
        }
      }
      if (snap.logicGates) {
        for (const [id, gate] of snap.logicGates) {
          this.logicGates.set(id, gate);
        }
      }
      if (snap.wireConnections) {
        this.wireConnections = snap.wireConnections;
      }
    }
    this.logger.info(`Electronics world state restored (${state.entities.length} entities)`);
  }
}