// apps/web/src/HUD/runtime/HUD-AI-overlay.ts
/**
 * HUD AI Overlay
 * 
 * Responsibilities:
 * - Render AI tutor responses as a chat-like overlay on the HUD
 * - Support streaming text (typewriter effect) and final answer display
 * - Provide interactive controls: ask follow-up, dismiss, request rephrase
 * - Coordinate with AI-streaming runtime for chunk delivery
 * 
 * Owned state:
 * - conversationHistory: AIResponseEntry[]
 * 
 * Dependencies: ILogger, IMeter, HUDOverlayEngine, AIStreamingRuntime
 * 
 * Event emissions: "learner.followup" when user asks a follow-up
 * Event subscriptions: "tutor.response.chunk"
 * Synchronization: none
 * Recovery: conversation history can be reloaded from session context
 * Telemetry: questions asked, response latency
 * Diagnostics: conversation log
 * Accessibility: chat messages must be ARIA live regions
 * Performance: virtualized message list for long conversations
 * Forbidden: showing raw AI internals; auto-dismissing educational content
 */

import type { HUDState } from '../contracts/hud-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { HUDOverlayEngine } from './HUD-overlay-engine';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import { v4 as uuidv4 } from 'uuid';
import type { OverlayId } from '../contracts/hud-contracts';

export class HUDAIOverlay {
  private history: Array<{ role: 'tutor' | 'learner'; content: string }> = [];
  private streamingBuffer = '';

  constructor(
    private overlayEngine: HUDOverlayEngine,
    private eventBus: DistributedEventBus,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  onChunkReceived(chunk: { chunk: string; isFinal: boolean }, state: HUDState): void {
    this.streamingBuffer += chunk.chunk;
    if (chunk.isFinal) {
      this.history.push({ role: 'tutor', content: this.streamingBuffer });
      this.streamingBuffer = '';
      // Show final overlay
      this.overlayEngine.showTimed({
        id: uuidv4() as OverlayId,
        type: 'ai_response',
        position: 'top',
        content: this.history[this.history.length - 1].content,
        duration: 15000,
        priority: 80,
        timestamp: Date.now(),
      }, state);
    } else {
      // Update streaming overlay
      this.overlayEngine.updateStreaming({
        id: '__ai_stream__' as OverlayId,
        type: 'ai_response',
        position: 'top',
        content: chunk.chunk,
        duration: 0,
        priority: 80,
        timestamp: Date.now(),
      }, state);
    }
  }

  askFollowUp(question: string): void {
    this.history.push({ role: 'learner', content: question });
    this.eventBus.publish('learner.followup', { question });
  }
}