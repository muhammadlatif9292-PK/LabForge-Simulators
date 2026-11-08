// packages/security-runtime/src/encryption/encrypted-cache-runtime.ts
/**
 * Encrypted Cache Runtime
 * 
 * Responsibilities:
 * - Provide a key-value cache with transparent encryption at rest
 * - Support TTL and encrypted eviction
 * - Use AES-256-GCM for confidentiality and integrity
 * - Integrate with distributed cache (Redis) with encryption wrapper
 * 
 * Owned state:
 * - localCache: Map<string, { ciphertext: ArrayBuffer; iv: Uint8Array }>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - EncryptionConfig (key management)
 * - External distributed cache client (optional)
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none (each instance has its own key)
 * Recovery: data is encrypted; lost on restart unless persisted
 * Telemetry: cache hit/miss rates, encryption latency
 * Diagnostics: key rotation status
 * Accessibility: N/A
 * Performance: hardware-accelerated AES via Web Crypto or native
 * Forbidden: storing keys in cache; exposing plaintext
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class EncryptedCacheRuntime {
  private cache: Map<string, { ciphertext: ArrayBuffer; iv: Uint8Array; expiresAt?: number }> = new Map();
  private cryptoKey: CryptoKey | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {
    this.initializeKey();
  }

  private async initializeKey(): Promise<void> {
    // Generate or load AES key from secure storage
    this.cryptoKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const start = Date.now();
    if (!this.cryptoKey) throw new Error('Key not initialized');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(value);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.cryptoKey,
      encoded,
    );
    this.cache.set(key, {
      ciphertext,
      iv,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
    this.meter.recordHistogram('cache.encrypt.latency', Date.now() - start);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    if (!this.cryptoKey) throw new Error('Key not initialized');
    const start = Date.now();
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: entry.iv },
      this.cryptoKey,
      entry.ciphertext,
    );
    this.meter.recordHistogram('cache.decrypt.latency', Date.now() - start);
    return new TextDecoder().decode(plaintext);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}