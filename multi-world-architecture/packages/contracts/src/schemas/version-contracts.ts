// packages/contracts/src/schemas/version-contracts.ts
/**
 * Version Contract Schemas
 * 
 * Responsibilities:
 * - Validate semantic version strings
 * - Check version compatibility ranges
 * - Provide version comparison utilities
 */

import { z } from 'zod';

export const SemVerSchema = z.string().regex(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*))?(?:\+([a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*))?$/,
  'Must follow semver (x.y.z) with optional pre-release and build metadata',
);

export const VersionRangeSchema = z.string().regex(
  /^(\^|~|>=|<=|>|<)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
  'Must be a valid version range (e.g., ^1.2.3, ~1.2.3, >=1.0.0)',
);

export type SemVer = z.infer<typeof SemVerSchema>;

/**
 * Parse a semver string into its numeric components.
 */
export function parseSemVer(version: string): { major: number; minor: number; patch: number; preRelease?: string } | null {
  const match = version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([a-zA-Z0-9.]+))?$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    preRelease: match[4],
  };
}

/**
 * Check if a version satisfies a range.
 * Supports: exact, ^ (compatible), ~ (approximately), >=, <=, >, <
 */
export function versionSatisfies(version: string, range: string): boolean {
  const parsed = parseSemVer(version);
  if (!parsed) return false;

  // Exact match
  if (/^\d+\.\d+\.\d+$/.test(range)) {
    return version === range;
  }

  // Caret (^): compatible with major version
  const caretMatch = range.match(/^\^(\d+)\.(\d+)\.(\d+)$/);
  if (caretMatch) {
    const [, rMajor, rMinor, rPatch] = caretMatch.map(Number);
    if (parsed.major !== rMajor) return false;
    if (rMajor === 0) {
      if (rMinor === 0) return parsed.patch >= rPatch;
      return parsed.minor === rMinor && parsed.patch >= rPatch;
    }
    return parsed.minor >= rMinor && (parsed.minor > rMinor || parsed.patch >= rPatch);
  }

  // Tilde (~): approximately equivalent
  const tildeMatch = range.match(/^~(\d+)\.(\d+)\.(\d+)$/);
  if (tildeMatch) {
    const [, rMajor, rMinor, rPatch] = tildeMatch.map(Number);
    if (parsed.major !== rMajor || parsed.minor !== rMinor) return false;
    return parsed.patch >= rPatch;
  }

  // Greater than or equal
  if (range.startsWith('>=')) {
    const min = parseSemVer(range.substring(2));
    if (!min) return false;
    return compareSemVer(parsed, min) >= 0;
  }

  // Greater than
  if (range.startsWith('>')) {
    const min = parseSemVer(range.substring(1));
    if (!min) return false;
    return compareSemVer(parsed, min) > 0;
  }

  // Less than or equal
  if (range.startsWith('<=')) {
    const max = parseSemVer(range.substring(2));
    if (!max) return false;
    return compareSemVer(parsed, max) <= 0;
  }

  // Less than
  if (range.startsWith('<')) {
    const max = parseSemVer(range.substring(1));
    if (!max) return false;
    return compareSemVer(parsed, max) < 0;
  }

  return false;
}

function compareSemVer(a: NonNullable<ReturnType<typeof parseSemVer>>, b: NonNullable<ReturnType<typeof parseSemVer>>): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  return 0;
}