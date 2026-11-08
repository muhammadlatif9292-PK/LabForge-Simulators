// apps/web/src/AI/runtime/AI-overlay-runtime.ts
/**
 * Frontend AI Overlay Runtime
 * 
 * Responsibilities:
 * - Manage the AI tutoring overlay UI state
 * - Handle streaming token display, finalise responses
 * - Accept user input, route to tutoring runtime
 * 
 * Owned state:
 * - messages: ChatMessage[]
 * - streamingText: string
 * 
 * Dependencies:
 * - AIStreamingRuntime
 * - TutoringRuntime
 * - HUDOverlayEngine
 * 
 * Event emissions: "ai.overlay.interaction"
 * Event subscriptions: "tutor.response.chunk"
 * Synchronization: none
 * Recovery: re-render from message history
 * Telemetry: message count, interaction rate
 * Diagnostics: overlay state
 * Accessibility: full ARIA live region for responses
 * Performance: virtualized message list
 * Forbidden: blocking UI during streaming
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export class AIOverlayRuntime {
  private messages: ChatMessage[] = [];
  private streamingText = '';

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {
    this.eventBus.subscribe('tutor.response.chunk', (event) => {
      const { chunk, isFinal } = event.payload;
      this.streamingText += chunk;
      if (isFinal) {
        this.messages.push({ id: 'msg_' + Date.now(), role: 'ai', content: this.streamingText, timestamp: Date.now() });
        this.streamingText = '';
      }
    });
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  getStreamingText(): string {
    return this.streamingText;
  }

  sendMessage(text: string): void {
    this.messages.push({ id: 'msg_' + Date.now(), role: 'user', content: text, timestamp: Date.now() });
    this.eventBus.publish('ai.overlay.interaction', { text });
  }
}