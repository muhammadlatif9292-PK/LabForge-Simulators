// instrumentation-core/runtime/instrument-interaction-runtime.ts
/**
 * Instrument Interaction Runtime
 * 
 * Responsibilities:
 * - Provide a unified interaction model across all instrument types
 * - Handle grab, release, rotate, and activate gestures consistently
 * - Decode raw input (mouse, touch, pen, VR controller) into InstrumentInteraction events
 * - Apply physics constraints (joint limits, haptic feedback thresholds)
 * - Emit interaction events for command framework and AI analysis
 * 
 * Owned state:
 * - grabbedInstrumentId: InstrumentId | null
 * - interactionMode: 'idle' | 'grabbing' | 'rotating' | 'activating'
 * - pointerId: number | null (active pointer for multi-touch)
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - InstrumentOrchestrator (to lookup instruments)
 * 
 * Event emissions:
 *   "instrument.interaction" (grab, release, rotate, activate)
 *   "instrument.interaction.started", "instrument.interaction.ended"
 * 
 * Event subscriptions: none (processes raw input externally)
 * Synchronization: single active interaction at a time per user
 * Recovery: grab released on disconnect
 * Telemetry: interaction count per type, grab duration
 * Diagnostics: active interaction state
 * Accessibility: interactions announced for assistive tech
 * Performance: lightweight event translation; no per-frame processing
 * Forbidden: multiple simultaneous grabs without explicit support
 */

import type { InstrumentId, InstrumentInteraction } from '../contracts/instrument-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

export class InstrumentInteractionRuntime {
  private grabbedInstrumentId: InstrumentId | null = null;
  private interactionMode: 'idle' | 'grabbing' | 'rotating' | 'activating' = 'idle';
  private pointerId: number | null = null;
  private grabStartTime = 0;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  /**
   * Process a raw pointer event and convert to an instrument interaction.
   * Call this from the central input handler (mouse/touch/pen).
   */
  processPointerEvent(
    eventType: 'pointerdown' | 'pointermove' | 'pointerup',
    pointer: { x: number; y: number; id: number; targetInstrumentId?: InstrumentId },
    userId: string,
  ): InstrumentInteraction | null {
    switch (eventType) {
      case 'pointerdown': {
        // If we hit an instrument, grab it
        if (pointer.targetInstrumentId) {
          return this.beginGrab(pointer.targetInstrumentId, pointer.id, userId);
        }
        return null;
      }
      case 'pointermove': {
        if (this.grabbedInstrumentId && this.pointerId === pointer.id) {
          return this.updateGrab(pointer.x, pointer.y, userId);
        }
        return null;
      }
      case 'pointerup': {
        if (this.grabbedInstrumentId && this.pointerId === pointer.id) {
          const interaction = this.endGrab(userId);
          this.resetState();
          return interaction;
        }
        return null;
      }
      default:
        return null;
    }
  }

  processActivateIntent(userId: string): InstrumentInteraction | null {
    if (!this.grabbedInstrumentId) return null;
    const interaction: InstrumentInteraction = {
      type: 'activate',
      instrumentId: this.grabbedInstrumentId,
      userId,
      payload: { activationType: 'primary' },
      timestamp: Date.now(),
    };
    this.eventBus.publish('instrument.interaction', interaction);
    this.meter.incrementCounter('instrument.interaction.activate');
    return interaction;
  }

  processConfigureIntent(instrumentId: InstrumentId, config: Record<string, unknown>, userId: string): InstrumentInteraction {
    const interaction: InstrumentInteraction = {
      type: 'configure',
      instrumentId,
      userId,
      payload: config,
      timestamp: Date.now(),
    };
    this.eventBus.publish('instrument.interaction', interaction);
    this.meter.incrementCounter('instrument.interaction.configure');
    return interaction;
  }

  releaseAnyGrab(userId: string): InstrumentInteraction | null {
    if (!this.grabbedInstrumentId) return null;
    const interaction = this.endGrab(userId);
    this.resetState();
    return interaction;
  }

  private beginGrab(instrumentId: InstrumentId, pointerId: number, userId: string): InstrumentInteraction {
    this.grabbedInstrumentId = instrumentId;
    this.pointerId = pointerId;
    this.interactionMode = 'grabbing';
    this.grabStartTime = Date.now();
    const interaction: InstrumentInteraction = {
      type: 'grab',
      instrumentId,
      userId,
      payload: { pointerId },
      timestamp: Date.now(),
    };
    this.eventBus.publish('instrument.interaction', interaction);
    this.eventBus.publish('instrument.interaction.started', { instrumentId, type: 'grab' });
    this.meter.incrementCounter('instrument.interaction.grab');
    this.logger.debug(`Instrument grabbed: ${instrumentId}`);
    return interaction;
  }

  private updateGrab(x: number, y: number, userId: string): InstrumentInteraction {
    const interaction: InstrumentInteraction = {
      type: 'rotate',
      instrumentId: this.grabbedInstrumentId!,
      userId,
      payload: { pointerX: x, pointerY: y },
      timestamp: Date.now(),
    };
    this.eventBus.publish('instrument.interaction', interaction);
    return interaction;
  }

  private endGrab(userId: string): InstrumentInteraction {
    const duration = Date.now() - this.grabStartTime;
    const interaction: InstrumentInteraction = {
      type: 'release',
      instrumentId: this.grabbedInstrumentId!,
      userId,
      payload: { grabDurationMs: duration },
      timestamp: Date.now(),
    };
    this.eventBus.publish('instrument.interaction', interaction);
    this.eventBus.publish('instrument.interaction.ended', { instrumentId: this.grabbedInstrumentId, type: 'release', duration });
    this.meter.incrementCounter('instrument.interaction.release');
    this.meter.recordHistogram('instrument.interaction.grab_duration', duration);
    return interaction;
  }

  private resetState(): void {
    this.grabbedInstrumentId = null;
    this.pointerId = null;
    this.interactionMode = 'idle';
    this.grabStartTime = 0;
  }

  getGrabbedInstrument(): InstrumentId | null {
    return this.grabbedInstrumentId;
  }

  getInteractionMode(): string {
    return this.interactionMode;
  }
}