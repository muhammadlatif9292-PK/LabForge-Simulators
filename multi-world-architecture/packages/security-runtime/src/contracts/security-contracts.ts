// packages/security-runtime/src/contracts/security-contracts.ts
/**
 * Security Contracts
 * 
 * Responsibilities:
 * - Define types for authentication, authorization, sandboxing, and threat detection
 * - Ensure consistent interfaces across security subsystems
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any runtime logic
 */

export type PrincipalId = string;
export type PermissionId = string;
export type RoleId = string;
export type AuthToken = string;
export type CapabilityId = string;

export interface AuthClaims {
  sub: PrincipalId;
  roles: RoleId[];
  permissions: PermissionId[];
  exp: number;
  iat: number;
  iss: string;
}

export interface AuthResult {
  authenticated: boolean;
  claims?: AuthClaims;
  error?: string;
}

export interface PermissionCheck {
  principalId: PrincipalId;
  resource: string;
  action: string;
  context?: Record<string, unknown>;
}

export interface PermissionVerdict {
  allowed: boolean;
  reason?: string;
}

export interface ThreatAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  source: string;
  timestamp: number;
  details: Record<string, unknown>;
}

export interface SandboxPolicy {
  maxMemoryMB: number;
  maxCpuPercent: number;
  networkAccess: boolean;
  allowedModules: string[];
  timeoutMs: number;
}

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm';
  key: CryptoKey;
}