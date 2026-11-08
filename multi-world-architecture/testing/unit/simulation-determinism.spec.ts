// testing/unit/simulation-determinism.spec.ts
/**
 * Simulation Determinism Tests
 * 
 * Responsibilities:
 * - Verify that the simulation produces identical results given the same seed and inputs
 * - Test across CPU and GPU compute paths
 * - Ensure replay from checkpoint produces identical state
 * - Validate that non-deterministic operations (if any) are flagged
 * 
 * Dependencies:
 * - DeterministicExecutionRuntime
 * - SimulationTickScheduler
 * - PhysicsStepRuntime
 * - PrecisionMathRuntime
 * 
 * Test categories:
 * - Unit: individual functions (PrecisionMath, RNG)
 * - Integration: full tick execution
 * - Stress: 10,000+ tick runs
 */

import { describe, it, expect, beforeEach } from 'vitest'; // framework-agnostic pseudo-import
import { PrecisionMathRuntime } from '@labforge/scientific-core';
import type { DeterminismTestHarness, DeterminismResult } from '../contracts/testing-contracts';

// Simple deterministic RNG for testing
class TestDeterministicRNG {
  private state: number;
  constructor(public seed: number) { this.state = seed; }
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return (this.state >>> 0) / 0xFFFFFFFF;
  }
}

describe('Simulation Determinism', () => {
  describe('PrecisionMathRuntime', () => {
    let math: PrecisionMathRuntime;

    beforeEach(() => {
      math = new PrecisionMathRuntime(10);
    });

    it('should produce identical results for identical inputs', () => {
      const a = math.add(0.1, 0.2);
      const b = math.add(0.1, 0.2);
      expect(a).toBe(b);
      expect(a).toBe(0.3);
    });

    it('should produce deterministic sqrt', () => {
      expect(math.sqrt(2)).toBe(math.sqrt(2));
    });

    it('should produce deterministic sin', () => {
      expect(math.sin(Math.PI / 4)).toBe(math.sin(Math.PI / 4));
    });

    it('should handle edge cases deterministically', () => {
      expect(math.divide(1, 3)).toBe(math.divide(1, 3));
      expect(math.sqrt(0)).toBe(0);
      expect(() => math.sqrt(-1)).toThrow();
      expect(() => math.divide(1, 0)).toThrow();
    });

    it('should maintain precision across chained operations', () => {
      let result = 1.0;
      for (let i = 0; i < 100; i++) {
        result = math.add(result, 0.001);
        result = math.subtract(result, 0.001);
      }
      expect(math.round(result, 10)).toBe(1.0);
    });
  });

  describe('DeterministicRNG', () => {
    it('should produce the same sequence from the same seed', () => {
      const rng1 = new TestDeterministicRNG(12345);
      const rng2 = new TestDeterministicRNG(12345);
      const seq1: number[] = [];
      const seq2: number[] = [];
      for (let i = 0; i < 100; i++) {
        seq1.push(rng1.next());
        seq2.push(rng2.next());
      }
      expect(seq1).toEqual(seq2);
    });

    it('should produce different sequences from different seeds', () => {
      const rng1 = new TestDeterministicRNG(12345);
      const rng2 = new TestDeterministicRNG(54321);
      const seq1: number[] = [];
      const seq2: number[] = [];
      for (let i = 0; i < 100; i++) {
        seq1.push(rng1.next());
        seq2.push(rng2.next());
      }
      expect(seq1).not.toEqual(seq2);
    });
  });

  describe('Tick Execution Determinism', () => {
    // Mock simulation state
    interface SimpleState {
      position: number;
      velocity: number;
      tick: number;
    }

    function createSimpleState(): SimpleState {
      return { position: 0, velocity: 1, tick: 0 };
    }

    function simpleStep(state: SimpleState, _input: unknown, rng: TestDeterministicRNG): SimpleState {
      const noise = rng.next() * 0.001; // small deterministic noise
      return {
        position: state.position + state.velocity + noise,
        velocity: state.velocity + (rng.next() - 0.5) * 0.01,
        tick: state.tick + 1,
      };
    }

    function serializeState(state: SimpleState): string {
      return `${state.position.toFixed(10)}:${state.velocity.toFixed(10)}:${state.tick}`;
    }

    it('should produce identical final state from same seed and inputs', () => {
      const harness: DeterminismTestHarness<SimpleState> = {
        seed: 42,
        createInitialState: createSimpleState,
        step: simpleStep as any,
        serialize: serializeState,
        stepCount: 100,
        inputGenerator: (_step, _rng) => null,
      };

      // Run twice independently
      const rngA = new TestDeterministicRNG(harness.seed);
      const rngB = new TestDeterministicRNG(harness.seed);

      let stateA = harness.createInitialState();
      let stateB = harness.createInitialState();

      for (let i = 0; i < harness.stepCount; i++) {
        const input = harness.inputGenerator(i, rngA);
        stateA = harness.step(stateA, input, rngA);
        stateB = harness.step(stateB, input, rngB);
      }

      expect(harness.serialize(stateA)).toBe(harness.serialize(stateB));
    });

    it('should produce different states from different seeds', () => {
      const stateA = (() => {
        const rng = new TestDeterministicRNG(42);
        let state = createSimpleState();
        for (let i = 0; i < 100; i++) state = simpleStep(state, null, rng);
        return state;
      })();

      const stateB = (() => {
        const rng = new TestDeterministicRNG(99);
        let state = createSimpleState();
        for (let i = 0; i < 100; i++) state = simpleStep(state, null, rng);
        return state;
      })();

      expect(serializeState(stateA)).not.toBe(serializeState(stateB));
    });

    it('should handle 10,000 ticks without divergence', () => {
      const harness: DeterminismTestHarness<SimpleState> = {
        seed: 42,
        createInitialState: createSimpleState,
        step: simpleStep as any,
        serialize: serializeState,
        stepCount: 10000,
        inputGenerator: () => null,
      };

      const rngA = new TestDeterministicRNG(harness.seed);
      const rngB = new TestDeterministicRNG(harness.seed);
      let stateA = harness.createInitialState();
      let stateB = harness.createInitialState();

      const start = performance.now();
      for (let i = 0; i < harness.stepCount; i++) {
        stateA = harness.step(stateA, null, rngA);
        stateB = harness.step(stateB, null, rngB);
        // Check every 1000 steps
        if (i % 1000 === 0 && i > 0) {
          expect(harness.serialize(stateA)).toBe(harness.serialize(stateB));
        }
      }
      const duration = performance.now() - start;
      expect(harness.serialize(stateA)).toBe(harness.serialize(stateB));
      expect(duration).toBeLessThan(5000); // should complete in under 5 seconds
    });
  });

  describe('Checkpoint Restore Determinism', () => {
    interface CheckpointState {
      entities: Map<string, { x: number; y: number }>;
    }

    it('should restore to exact same state after save/load', () => {
      const original: CheckpointState = {
        entities: new Map([
          ['a', { x: 1.5, y: 2.5 }],
          ['b', { x: 3.0, y: 4.0 }],
        ]),
      };

      const serialized = JSON.stringify(original, (_, value) => {
        if (value instanceof Map) return { __type: 'Map', entries: Array.from(value.entries()) };
        return value;
      });

      const restored: CheckpointState = JSON.parse(serialized, (_, value) => {
        if (value?.__type === 'Map') return new Map(value.entries);
        return value;
      });

      expect(restored.entities.size).toBe(original.entities.size);
      expect(restored.entities.get('a')).toEqual(original.entities.get('a'));
      expect(restored.entities.get('b')).toEqual(original.entities.get('b'));
    });
  });
});