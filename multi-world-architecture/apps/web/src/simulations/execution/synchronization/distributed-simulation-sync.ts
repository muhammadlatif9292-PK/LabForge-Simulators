// apps/web/src/simulations/execution/synchronization/distributed-simulation-sync.ts
/**
 * Distributed Simulation Sync
 * 
 * Responsibilities:
 * - Synchronize simulation state across multiple nodes/workers
 * - Exchange state hashes at each tick to verify determinism
 * - Participate in global tick consensus (if using state machine replication)
 * - Manage leader/follower roles for simulation distribution
 * 
 * Owned state:
 * - peers: Map<NodeId, PeerSimState>
 * - leaderId: NodeId
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (for state hash exchange)
 * - DeterministicExecutionRuntime
 * 
 * Event emissions: "simulation.sync.hash", "simulation.sync.consensus"
 * Event subscriptions: "simulation.tick.completed" from other nodes
 * Synchronization: requires quorum for consensus on state before next tick
 * Recovery: if majority disagree, rollback minority to match
 * Telemetry: sync latency, peer count, agreement rate
 * Diagnostics: peer states, divergence history
 * Accessibility: N/A
 * Performance: lightweight hash exchange; no full state sync every tick
 * Forbidden: blocking tick loop waiting for slow peers; single peer dictating state
 */

import type { TickNumber, StateHash, SimulationState } from '../contracts/simulation-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export type NodeId = string;

interface PeerSimState {
  nodeId: NodeId;
  lastTick: TickNumber;
  lastHash: StateHash;
  lastSeen: number;
}

export class DistributedSimulationSync {
  private peers: Map<NodeId, PeerSimState> = new Map();

  constructor(
    private localNodeId: NodeId,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.eventBus.subscribe('simulation.sync.hash', this.onPeerHash.bind(this));
  }

  async broadcastHash(tick: TickNumber, hash: StateHash): Promise<void> {
    await this.eventBus.publish('simulation.sync.hash', {
      nodeId: this.localNodeId,
      tick,
      hash,
    });
  }

  private onPeerHash(event: any): void {
    const { nodeId, tick, hash } = event.payload;
    if (nodeId === this.localNodeId) return;
    this.peers.set(nodeId, {
      nodeId,
      lastTick: tick,
      lastHash: hash,
      lastSeen: Date.now(),
    });
    this.meter.incrementCounter('simulation.sync.hash_received');
  }

  async checkConsensus(tick: TickNumber, localHash: StateHash): Promise<boolean> {
    let agreement = 0;
    let total = 0;
    for (const peer of this.peers.values()) {
      if (peer.lastTick === tick) {
        total++;
        if (peer.lastHash === localHash) agreement++;
      }
    }
    // Consensus if all peers that have reported agree
    const consensus = total === 0 || agreement === total;
    if (!consensus) {
      this.logger.warn(`Consensus failed at tick ${tick}: ${agreement}/${total} agree`);
      this.meter.incrementCounter('simulation.sync.consensus_failed');
    }
    return consensus;
  }

  removeStalePeers(maxAgeMs: number = 30000): void {
    const now = Date.now();
    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeen > maxAgeMs) {
        this.peers.delete(id);
      }
    }
  }
}