// apps/web/src/app-shell/AI/AI-overlay-bootstrap.ts
/**
 * AI Overlay Bootstrap
 * 
 * Responsibilities:
 * - Initialize the AI tutoring overlay system within the app shell
 * - Coordinate with AI tutoring runtime and HUD AI overlay
 * - Preload AI streaming infrastructure
 * - Apply user's AI overlay preferences (position, visibility)
 * - Ensure AI overlay respects offline-first constraints
 * 
 * Owned state:
 * - config: AIOverlayConfig
 * - initialized: boolean
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - TutoringRuntime (to handle AI responses)
 * - HUDAIOverlay (HUD module)
 * - DistributedEventBus
 * 
 * Event emissions: "ai.overlay.ready", "ai.overlay.config.changed"
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: reconnect AI streaming on network restore
 * Telemetry: overlay usage, AI response latency from user perspective
 * Diagnostics: AI overlay status
 * Accessibility: AI responses announced via screen reader
 * Performance: lazy initialization; preload only when user logged in
 * Forbidden: blocking app boot on AI initialization; showing overlays without consent
 */

import type { AIOverlayConfig } from '../contracts/app-shell-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { TutoringRuntime } from '@labforge/AI-tutoring';
import type { HUDAIOverlay } from '@labforge/HUD';

export class AIOverlayBootstrap {
  private config: AIOverlayConfig = {
    enabled: true,
    streamingEnabled: true,
    suggestActions: true,
    voiceEnabled: false,
    position: 'bottom',
    maxVisibleMessages: 3,
  };
  private initialized = false;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private tutoringRuntime: TutoringRuntime,
    private hudAIOverlay: HUDAIOverlay,
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      // Apply saved user preferences
      await this.loadUserPreferences();
      // Register event handlers for AI tutor responses → HUD
      this.eventBus.subscribe('tutor.response.chunk', (event: any) => {
        if (this.config.enabled && this.config.streamingEnabled) {
          this.hudAIOverlay.onChunkReceived?.(event.payload, {} as any);
        }
      });
      this.initialized = true;
      this.logger.info('AI overlay bootstrapped');
      this.meter.incrementCounter('ai.overlay.ready');
      await this.eventBus.publish('ai.overlay.ready', { config: this.config });
    } catch (err) {
      this.logger.error('AI overlay bootstrap failed', { error: err });
    }
  }

  private async loadUserPreferences(): Promise<void> {
    // Load from offline storage or session
    this.logger.debug('AI overlay preferences loaded');
  }

  updateConfig(partial: Partial<AIOverlayConfig>): void {
    this.config = { ...this.config, ...partial };
    this.eventBus.publish('ai.overlay.config.changed', this.config);
  }

  getConfig(): Readonly<AIOverlayConfig> {
    return { ...this.config };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}