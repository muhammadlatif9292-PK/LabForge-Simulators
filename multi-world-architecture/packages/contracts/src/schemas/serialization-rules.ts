// packages/contracts/src/schemas/serialization-rules.ts
/**
 * Serialization Rules
 * 
 * Responsibilities:
 * - Define deterministic serialization/deserialization rules for all complex types
 * - Handle Map, Set, Date, Float32Array, and other non-JSON-native types
 * - Enforce versioned migration of serialized formats
 * - Guarantee serialization round-trip integrity
 * 
 * Owned state: none
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: O(n) serialization; custom replacer/reviver for speed
 * Forbidden: losing data on round-trip; non-deterministic key ordering
 */

/**
 * Standard LABFORGE serialization format version.
 * Increment when the serialization protocol changes in a breaking way.
 */
export const SERIALIZATION_VERSION = '2.0.0';

/**
 * Custom JSON replacer that handles:
 * - Map → { __type: 'Map', entries: [[key, value], ...] }
 * - Set → { __type: 'Set', values: [...] }
 * - Date → { __type: 'Date', iso: date.toISOString() }
 * - Float32Array → { __type: 'Float32Array', data: Array.from(array) }
 * - undefined values → omitted (standard JSON behaviour)
 */
export function serializeReplacer(key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return {
      __type: 'Map',
      entries: Array.from(value.entries()).map(([k, v]) => [
        typeof k === 'object' ? serializeReplacer('', k) : k,
        v,
      ]),
    };
  }
  if (value instanceof Set) {
    return {
      __type: 'Set',
      values: Array.from(value).map(v => v),
    };
  }
  if (value instanceof Date) {
    return { __type: 'Date', iso: value.toISOString() };
  }
  if (value instanceof Float32Array) {
    return { __type: 'Float32Array', data: Array.from(value) };
  }
  if (value instanceof Float64Array) {
    return { __type: 'Float64Array', data: Array.from(value) };
  }
  if (typeof value === 'bigint') {
    return { __type: 'BigInt', value: value.toString() };
  }
  // Maintain sorted keys for deterministic output
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value).sort();
    for (const k of keys) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}

/**
 * Custom JSON reviver that reconstructs:
 * - Map from { __type: 'Map', entries }
 * - Set from { __type: 'Set', values }
 * - Date from { __type: 'Date', iso }
 * - Float32Array from { __type: 'Float32Array', data }
 */
export function deserializeReviver(key: string, value: unknown): unknown {
  if (typeof value === 'object' && value !== null && '__type' in value) {
    const typed = value as { __type: string };
    switch (typed.__type) {
      case 'Map':
        const map = new Map();
        const entries = (value as { entries: [unknown, unknown][] }).entries;
        if (Array.isArray(entries)) {
          for (const [k, v] of entries) {
            map.set(k, v);
          }
        }
        return map;
      case 'Set':
        const set = new Set();
        const values = (value as { values: unknown[] }).values;
        if (Array.isArray(values)) {
          for (const v of values) set.add(v);
        }
        return set;
      case 'Date':
        return new Date((value as { iso: string }).iso);
      case 'Float32Array':
        return new Float32Array((value as { data: number[] }).data);
      case 'Float64Array':
        return new Float64Array((value as { data: number[] }).data);
      case 'BigInt':
        return BigInt((value as { value: string }).value);
      default:
        return value;
    }
  }
  return value;
}

/**
 * Deterministic serialization function.
 * Guarantees: sorted keys, predictable Map/Set ordering, no undefined values.
 */
export function deterministicSerialize(data: unknown): string {
  return JSON.stringify(data, serializeReplacer);
}

/**
 * Deserialization with type reconstruction.
 */
export function deterministicDeserialize<T = unknown>(json: string): T {
  return JSON.parse(json, deserializeReviver) as T;
}

/**
 * Migration function type: transforms serialized data from one version to the next.
 */
export type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migration registry: maps from version strings to migration functions.
 */
export const MIGRATION_REGISTRY: Map<string, MigrationFn> = new Map();

/**
 * Apply migrations to bring serialized data up to the current version.
 */
export function migrateSerializedData(
  data: Record<string, unknown>,
  fromVersion: string,
  toVersion: string = SERIALIZATION_VERSION,
): Record<string, unknown> {
  let current = { ...data };
  const versions = Array.from(MIGRATION_REGISTRY.keys()).sort();
  let migrating = false;
  for (const version of versions) {
    if (version > fromVersion && version <= toVersion) {
      const migration = MIGRATION_REGISTRY.get(version);
      if (migration) {
        current = migration(current);
        migrating = true;
      }
    }
  }
  return migrating ? current : data;
}

/**
 * Compute checksum of serialized data for integrity validation.
 */
export async function computeSerializationChecksum(data: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}