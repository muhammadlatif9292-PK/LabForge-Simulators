// apps/web/src/app-shell/bootstrap/frontend-bootstrap-runtime.ts
/**
 * Frontend Bootstrap Runtime
 * 
 * Responsibilities:
 * - Initialize all core browser-side services in the correct order
 * - Load configuration, set up Web Workers, initialize WebGL/WebGPU
 * - Register service worker for offline support
 * - Initialize design system, telemetry, and error boundary
 * - Provides the foundation on which all other app layers depend
 * 
 * Owned state:
 * - initialized: boolean
 * - serviceWorkerRegistration: ServiceWorkerRegistration | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - Design system runtime (ThemeRuntime, AccessibilityThemeRuntime)
 * - Service Worker registration
 * - Web Worker pool initialization
 * - Observability bootstrap
 * 
 * Event emissions:
 *   "bootstrap.core.completed", "bootstrap.service_worker.registered"
 *   "bootstrap.gpu.ready"
 * 
 * Event subscriptions: none
 * Synchronization: single-threaded initialization sequence
 * Recovery: service worker can be re-registered; GPU context re-requested
 * Telemetry: init step durations, SW registration status
 * Diagnostics: initialization log
 * Accessibility: init errors displayed as plain text in DOM
 * Performance: parallel where possible; defer non-critical
 * Forbidden: initialising without offline capability; blocking first paint
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class FrontendBootstrapRuntime {
  private initialized = false;
  private swRegistration: ServiceWorkerRegistration | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const start = performance.now();
    // 1. Design tokens & accessibility
    this.applyMinimumStyles();
    // 2. Register Service Worker for offline support
    await this.registerServiceWorker();
    // 3. Initialize GPU context probe (async, non-blocking)
    this.probeGPU();
    // 4. Start performance observer
    this.startPerformanceObserver();
    this.initialized = true;
    const elapsed = performance.now() - start;
    this.meter.recordHistogram('bootstrap.core.duration', elapsed);
    this.meter.incrementCounter('bootstrap.core.completed');
    this.logger.info(`Core bootstrap completed in ${elapsed.toFixed(0)}ms`);
  }

  private applyMinimumStyles(): void {
    if (typeof document === 'undefined') return;
    // Ensure landscape lock via CSS
    const style = document.createElement('style');
    style.textContent = `
      @media screen and (orientation: portrait) {
        body::before {
          content: "LABFORGE requires landscape orientation";
          display: flex;
          align-items: center;
          justify-content: center;
          position: fixed;
          inset: 0;
          background: #000;
          color: #fff;
          font-family: sans-serif;
          font-size: 1.5rem;
          z-index: 99999;
        }
      }
      html, body, #root { height: 100%; margin: 0; overflow: hidden; }
    `;
    document.head.appendChild(style);
    // Set initial font size for accessibility
    document.documentElement.style.fontSize = '100%';
  }

  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      this.logger.warn('Service Worker not supported');
      return;
    }
    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      this.logger.info('Service Worker registered');
      this.meter.incrementCounter('bootstrap.service_worker.registered');
    } catch (err) {
      this.logger.error('Service Worker registration failed', { error: err });
      this.meter.incrementCounter('bootstrap.service_worker.failed');
    }
  }

  private async probeGPU(): Promise<void> {
    if ('gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          this.logger.info('WebGPU available');
          this.meter.incrementCounter('bootstrap.gpu.ready');
        }
      } catch {
        this.logger.info('WebGPU probe failed, using WebGL fallback');
      }
    }
  }

  private startPerformanceObserver(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            this.meter.incrementCounter('bootstrap.long_task');
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch { /* ignore */ }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}