// packages/security-runtime/src/authorization/permission-reconciliation.ts
/**
 * Permission Reconciliation
 * 
 * Responsibilities:
 * - Evaluate if a principal has a required permission for a resource
 * - Support role-based and attribute-based access control (ABAC)
 * - Merge permissions from multiple sources (roles, direct grants, groups)
 * - Resolve conflicts (deny-override or allow-override)
 * 
 * Owned state:
 * - permissionIndex: Map<PrincipalId, Set<PermissionId>>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - Possibly a policy engine (e.g., OPA/Casbin) or integrated rules
 * 
 * Event emissions: "authz.decision" optionally
 * Event subscriptions: "role.updated", "permission.granted", "permission.revoked" to update index
 * Synchronization: eventual consistency via events
 * Recovery: rebuild index from event log or snapshots
 * Telemetry: decision latency, deny count
 * Diagnostics: permission set per principal
 * Accessibility: N/A
 * Performance: in-memory index with fast lookup; incremental updates
 * Forbidden: inconsistent decisions across nodes; stale permissions
 */

import type { PermissionCheck, PermissionVerdict } from '../contracts/security-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class PermissionReconciliation {
  private permissions: Map<string, Set<string>> = new Map(); // principalId -> set of "resource:action"

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  grantPermission(principalId: string, resource: string, action: string): void {
    const key = `${resource}:${action}`;
    if (!this.permissions.has(principalId)) this.permissions.set(principalId, new Set());
    this.permissions.get(principalId)!.add(key);
  }

  revokePermission(principalId: string, resource: string, action: string): void {
    const key = `${resource}:${action}`;
    this.permissions.get(principalId)?.delete(key);
  }

  checkPermission(check: PermissionCheck): PermissionVerdict {
    const key = `${check.resource}:${check.action}`;
    const userPerms = this.permissions.get(check.principalId);
    const allowed = userPerms?.has(key) ?? false;
    if (!allowed) this.meter.incrementCounter('authz.denied');
    return { allowed };
  }
}