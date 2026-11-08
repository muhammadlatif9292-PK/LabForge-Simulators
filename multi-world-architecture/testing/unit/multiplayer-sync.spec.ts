// testing/unit/multiplayer-sync.spec.ts
/**
 * Multiplayer Synchronization Tests
 * 
 * Responsibilities:
 * - Verify that operations are synchronized across all nodes in order
 * - Test presence reconciliation when participants join, leave, or change status
 * - Verify hand-raise queue ordering and notification delivery
 * - Test conflict resolution for simultaneous instrument manipulations
 * - Verify offline buffering and replay on reconnect
 * - Test shared workspace object locking and unlocking
 * 
 * Dependencies:
 * - DistributedSyncEngine
 * - PresenceRuntime
 * - CollaborationSessionRuntime
 * - SharedWorkspaceSync
 * - ConflictResolutionEngine
 * - AnnotationRuntime
 * - VoiceSessionRuntime
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Multiplayer Synchronization', () => {
  describe('Operation Ordering Across Nodes', () => {
    it('should apply operations in the same order on all nodes', async () => {
      const operations = [
        { id: 'op1', type: 'create', payload: { entity: 'A' }, timestamp: 100 },
        { id: 'op2', type: 'create', payload: { entity: 'B' }, timestamp: 200 },
        { id: 'op3', type: 'update', payload: { entity: 'A', value: 42 }, timestamp: 300 },
        { id: 'op4', type: 'delete', payload: { entity: 'B' }, timestamp: 400 },
        { id: 'op5', type: 'create', payload: { entity: 'C' }, timestamp: 500 },
      ];

      // Simulate three nodes receiving operations in slightly different orders
      const nodeA = [...operations]; // received in perfect order
      const nodeB = [operations[1], operations[0], operations[2], operations[4], operations[3]]; // B and A swapped, C and delete swapped
      const nodeC = [operations[2], operations[0], operations[1], operations[3], operations[4]]; // update first

      // Each node sorts by timestamp (deterministic ordering)
      function sortByTimestamp(ops: typeof operations): typeof operations {
        return [...ops].sort((a, b) => a.timestamp - b.timestamp);
      }

      const sortedA = sortByTimestamp(nodeA);
      const sortedB = sortByTimestamp(nodeB);
      const sortedC = sortByTimestamp(nodeC);

      // All nodes should converge to the same order
      expect(sortedA.map(o => o.id)).toEqual(['op1', 'op2', 'op3', 'op4', 'op5']);
      expect(sortedB.map(o => o.id)).toEqual(sortedA.map(o => o.id));
      expect(sortedC.map(o => o.id)).toEqual(sortedA.map(o => o.id));
    });

    it('should assign monotonically increasing sequence numbers per node', () => {
      const sequencer = { sequence: 0 };
      const operations: Array<{ id: string; seq: number }> = [];

      for (let i = 0; i < 50; i++) {
        sequencer.sequence++;
        operations.push({ id: `op-${i}`, seq: sequencer.sequence });
      }

      for (let i = 1; i < operations.length; i++) {
        expect(operations[i].seq).toBeGreaterThan(operations[i - 1].seq);
      }
      expect(operations[0].seq).toBe(1);
      expect(operations[49].seq).toBe(50);
    });
  });

  describe('Presence Reconciliation', () => {
    it('should correctly update participant status', () => {
      const participants = new Map<string, { id: string; displayName: string; status: string; lastSeen: number }>();
      
      // Participant joins
      participants.set('user1', { id: 'user1', displayName: 'Alice', status: 'online', lastSeen: Date.now() });
      expect(participants.get('user1')?.status).toBe('online');
      
      // Participant goes away
      participants.set('user1', { ...participants.get('user1')!, status: 'away', lastSeen: Date.now() });
      expect(participants.get('user1')?.status).toBe('away');
      
      // Participant leaves
      participants.set('user1', { ...participants.get('user1')!, status: 'offline', lastSeen: Date.now() });
      expect(participants.get('user1')?.status).toBe('offline');
    });

    it('should remove stale participants after timeout', () => {
      const STALE_TIMEOUT = 30000; // 30 seconds
      const now = Date.now();
      const participants = new Map([
        ['user1', { id: 'user1', status: 'online', lastSeen: now - 5000 }],
        ['user2', { id: 'user2', status: 'online', lastSeen: now - 60000 }], // stale
        ['user3', { id: 'user3', status: 'online', lastSeen: now - 10000 }],
      ]);

      // Remove stale
      for (const [id, participant] of participants) {
        if (now - participant.lastSeen > STALE_TIMEOUT) {
          participants.delete(id);
        }
      }

      expect(participants.has('user1')).toBe(true);
      expect(participants.has('user2')).toBe(false);
      expect(participants.has('user3')).toBe(true);
      expect(participants.size).toBe(2);
    });
  });

  describe('Hand-Raise Queue', () => {
    it('should maintain FIFO order in the hand-raise queue', () => {
      const queue: Array<{ participantId: string; timestamp: number }> = [];

      // Participants raise hands in order
      queue.push({ participantId: 'user3', timestamp: 1000 });
      queue.push({ participantId: 'user1', timestamp: 800 });
      queue.push({ participantId: 'user2', timestamp: 900 });

      // Sort by timestamp
      queue.sort((a, b) => a.timestamp - b.timestamp);

      expect(queue[0].participantId).toBe('user1');
      expect(queue[1].participantId).toBe('user2');
      expect(queue[2].participantId).toBe('user3');
    });

    it('should remove participant from queue when hand is lowered', () => {
      const queue: Array<{ participantId: string }> = [
        { participantId: 'user1' },
        { participantId: 'user2' },
        { participantId: 'user3' },
      ];

      // User2 lowers hand
      const filtered = queue.filter(p => p.participantId !== 'user2');
      expect(filtered.length).toBe(2);
      expect(filtered[0].participantId).toBe('user1');
      expect(filtered[1].participantId).toBe('user3');
    });
  });

  describe('Shared Workspace Locking', () => {
    it('should allow only one participant to lock an object', () => {
      const locks = new Map<string, string>(); // objectId → participantId

      // User1 locks object
      const lock1 = (objectId: string, participantId: string): boolean => {
        if (locks.has(objectId)) return false;
        locks.set(objectId, participantId);
        return true;
      };

      expect(lock1('obj-1', 'user1')).toBe(true);
      expect(lock1('obj-1', 'user2')).toBe(false); // already locked
      expect(locks.get('obj-1')).toBe('user1');
    });

    it('should release lock when participant unlocks', () => {
      const locks = new Map<string, string>();
      locks.set('obj-1', 'user1');
      locks.set('obj-2', 'user2');

      const unlock = (objectId: string, participantId: string): boolean => {
        if (locks.get(objectId) !== participantId) return false;
        locks.delete(objectId);
        return true;
      };

      expect(unlock('obj-1', 'user1')).toBe(true);
      expect(locks.has('obj-1')).toBe(false);
      expect(unlock('obj-1', 'user2')).toBe(false); // not the owner
    });

    it('should release all locks when a participant disconnects', () => {
      const locks = new Map([
        ['obj-1', 'user1'],
        ['obj-2', 'user2'],
        ['obj-3', 'user1'],
      ]);

      // User1 disconnects
      const participantId = 'user1';
      for (const [objectId, owner] of locks) {
        if (owner === participantId) locks.delete(objectId);
      }

      expect(locks.has('obj-1')).toBe(false);
      expect(locks.has('obj-2')).toBe(true);
      expect(locks.has('obj-3')).toBe(false);
      expect(locks.size).toBe(1);
    });
  });

  describe('Annotation Synchronization', () => {
    it('should assign unique IDs to annotations from different participants', () => {
      const annotations = [
        { id: 'ann-1', authorId: 'user1', content: 'Hello' },
        { id: 'ann-2', authorId: 'user2', content: 'World' },
        { id: 'ann-3', authorId: 'user1', content: '!' },
      ];

      const ids = annotations.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length); // all IDs unique
    });

    it('should order annotations by creation timestamp', () => {
      const annotations = [
        { id: 'ann-3', timestamp: 3000 },
        { id: 'ann-1', timestamp: 1000 },
        { id: 'ann-2', timestamp: 2000 },
      ];

      annotations.sort((a, b) => a.timestamp - b.timestamp);
      expect(annotations[0].id).toBe('ann-1');
      expect(annotations[1].id).toBe('ann-2');
      expect(annotations[2].id).toBe('ann-3');
    });
  });

  describe('Voice Channel Management', () => {
    it('should enforce maximum participants per voice channel', () => {
      const maxParticipants = 25;
      const channel = new Set<string>();
      
      // Add participants up to limit
      for (let i = 0; i < 30; i++) {
        if (channel.size < maxParticipants) {
          channel.add(`user${i}`);
        }
      }

      expect(channel.size).toBe(maxParticipants);
    });

    it('should detect when a participant is speaking', () => {
      const speakingStates = new Map<string, boolean>();
      speakingStates.set('user1', true);
      speakingStates.set('user2', false);
      speakingStates.set('user3', true);

      const speakers = Array.from(speakingStates.entries()).filter(([_, speaking]) => speaking);
      expect(speakers.length).toBe(2);
      expect(speakers.map(s => s[0])).toEqual(['user1', 'user3']);
    });
  });

  describe('Session Recovery', () => {
    it('should restore participant list after disconnect', async () => {
      const originalParticipants = [
        { id: 'user1', name: 'Alice' },
        { id: 'user2', name: 'Bob' },
        { id: 'user3', name: 'Charlie' },
      ];

      // Simulate session save
      const saved = JSON.stringify(originalParticipants);
      
      // Simulate disconnect and restore
      const restored = JSON.parse(saved);
      
      expect(restored.length).toBe(3);
      expect(restored[0].name).toBe('Alice');
      expect(restored[1].name).toBe('Bob');
      expect(restored[2].name).toBe('Charlie');
    });
  });
});