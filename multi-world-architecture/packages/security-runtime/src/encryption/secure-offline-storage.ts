// packages/security-runtime/src/encryption/secure-offline-storage.ts
/**
 * Secure Offline Storage
 * 
 * Responsibilities:
 * - Encrypt and persist data locally (IndexedDB/FileSystem) for offline use
 * - Ensure data integrity with checksums
 * - Support key rotation and migration
 * - Prevent unauthorized access from other origins/tools
 * 
 * Owned state:
 * - storage adapter (IndexedDB or similar)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - EncryptedCacheRuntime or direct crypto API
 * - Local storage backend
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none, local only
 * Recovery: encrypted data remains safe even if device compromised
 * Telemetry: storage size, write/read latency
 * Diagnostics: key status, corruption alerts
 * Accessibility: N/A
 * Performance: encrypts/decrypts on the fly
 * Forbidden: storing decryption key alongside data; using weak algos
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class SecureOfflineStorage {
  private db: any; // IndexedDB or SQLite adapter

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {
    // Initialize local encrypted database
    this.db = new EncryptedLocalDB();
  }

  async saveDocument(collection: string, id: string, data: unknown): Promise<void> {
    // Serialize, encrypt, store
    const encrypted = await this.encrypt(JSON.stringify(data));
    await this.db.put(collection, id, encrypted);
  }

  async loadDocument(collection: string, id: string): Promise<unknown> {
    const encrypted = await this.db.get(collection, id);
    if (!encrypted) return null;
    const plainJson = await this.decrypt(encrypted);
    return JSON.parse(plainJson);
  }

  async deleteDocument(collection: string, id: string): Promise<void> {
    await this.db.delete(collection, id);
  }

  private async encrypt(plaintext: string): Promise<ArrayBuffer> {
    // Use AEAD with a device-bound key
    const key = await this.getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  }

  private async decrypt(ciphertext: ArrayBuffer): Promise<string> {
    const key = await this.getOrCreateKey();
    // IV should be prepended; simplified
    const iv = new Uint8Array(12); // retrieve properly
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plain);
  }

  private async getOrCreateKey(): Promise<CryptoKey> {
    // In real app, use non-extractable key stored in IndexedDB or via Web Crypto
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
}

class EncryptedLocalDB {
  private store: Map<string, unknown> = new Map();
  async put(collection: string, id: string, data: unknown) { this.store.set(`${collection}:${id}`, data); }
  async get(collection: string, id: string) { return this.store.get(`${collection}:${id}`); }
  async delete(collection: string, id: string) { this.store.delete(`${collection}:${id}`); }
}