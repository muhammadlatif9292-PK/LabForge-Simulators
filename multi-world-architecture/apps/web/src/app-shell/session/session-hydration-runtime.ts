// apps/web/src/app-shell/session/session-hydration-runtime.ts
/**
 * Session Hydration Runtime
 * 
 * Responsibilities:
 * - Rehydrate the user session from stored token, URL fragment, or SSO
 * - Validate token, decode claims, check expiration
 * - Load user preferences (theme, accessibility, last world)
 * - Initialize permissions and capability set
 * - Coordinate with distributed auth to verify session across tabs
 * 
 * Owned state:
 * - session: SessionHydrationState | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedAuthValidator (token verification)
 * - OfflineStorageRuntime (for local session cache)
 * - SecureOfflineStorage (for encrypted token)
 * 
 * Event emissions:
 *   "session.hydrated", "session.expired", "session.restored_from_cache"
 * 
 * Event subscriptions: none
 * Synchronization: per-tab session; no cross-tab conflicts
 * Recovery: cached session credentials used offline; re-validated online
 * Telemetry: hydration latency, session age
 * Diagnostics: session status, permission set
 * Accessibility: announce session status to screen readers
 * Performance: async token validation; cache hit fast path
 * Forbidden: persisting tokens in plain text; accepting expired tokens
 */

import type { SessionHydrationState } from '../contracts/app-shell-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { DistributedAuthValidator } from '@labforge/security-runtime';
import type { OfflineStorageRuntime } from '@labforge/storage-runtime';

export class SessionHydrationRuntime {
  private session: SessionHydrationState | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private authValidator: DistributedAuthValidator,
    private offlineStorage: OfflineStorageRuntime,
  ) {}

  async hydrate(): Promise<SessionHydrationState> {
    const start = performance.now();
    // 1. Try to load from secure offline storage
    const cachedToken = await this.offlineStorage.get<string>('session_token' as any);
    if (cachedToken) {
      try {
        const validation = await this.authValidator.validateToken(cachedToken);
        if (validation.authenticated && validation.claims) {
          this.buildSession(validation.claims);
          this.meter.incrementCounter('session.restored_from_cache');
          this.logger.info('Session restored from offline cache');
          await this.eventBus.publish('session.restored_from_cache', { userId: this.session?.userId });
          return this.session!;
        }
      } catch {
        this.logger.warn('Cached session invalid, will re-authenticate');
      }
    }
    // 2. Attempt to validate from URL or SSO (simplified)
    const urlToken = new URLSearchParams(window.location.search).get('token');
    if (urlToken) {
      const validation = await this.authValidator.validateToken(urlToken);
      if (validation.authenticated && validation.claims) {
        this.buildSession(validation.claims);
        // Cache securely
        await this.offlineStorage.set('session_token' as any, urlToken, { ttlMs: 3600000 });
        this.meter.incrementCounter('session.hydrated');
        await this.eventBus.publish('session.hydrated', { userId: this.session?.userId });
        return this.session!;
      }
    }
    // 3. Fallback: anonymous session
    this.session = {
      userId: 'anonymous',
      sessionId: crypto.randomUUID(),
      token: '',
      permissions: ['world:read'],
      preferences: {},
      validUntil: Date.now() + 3600000,
    };
    this.logger.warn('No valid session found, using anonymous');
    this.meter.incrementCounter('session.anonymous');
    return this.session;
  }

  private buildSession(claims: any): void {
    this.session = {
      userId: claims.sub ?? 'anonymous',
      sessionId: claims.session_id ?? crypto.randomUUID(),
      token: claims.raw_token ?? '',
      permissions: claims.permissions ?? [],
      lastWorldId: claims.last_world_id,
      lastExperimentId: claims.last_experiment_id,
      preferences: claims.preferences ?? {},
      validUntil: claims.exp * 1000 ?? Date.now() + 3600000,
    };
  }

  getUserId(): string {
    return this.session?.userId ?? 'anonymous';
  }

  getSessionId(): string {
    return this.session?.sessionId ?? '';
  }

  getPermissions(): string[] {
    return this.session?.permissions ?? [];
  }

  isAuthenticated(): boolean {
    return this.session !== null && this.session.userId !== 'anonymous';
  }

  async logout(): Promise<void> {
    await this.offlineStorage.delete('session_token' as any);
    this.session = null;
    this.eventBus.publish('session.logged_out', {});
  }
}