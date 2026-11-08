// apps/web/src/HUD/runtime/HUD-multiplayer-overlay.ts
/**
 * HUD Multiplayer Overlay
 * 
 * Responsibilities:
 * - Display real-time collaboration indicators on the HUD
 * - Show participant presence (who is online, what they're doing)
 * - Render annotation overlays from collaborators
 * - Support hand-raise notification and queue management
 * - Provide voice activity indicators
 * - Integrate with collaboration runtime for real-time updates
 * 
 * Owned state:
 * - participantWidgets: Map<ParticipantId, ParticipantWidget>
 * - handRaiseNotifications: HandRaiseNotification[]
 * - voiceActivityIndicators: Map<ParticipantId, VoiceIndicator>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus (to receive presence updates)
 * - HUDOverlayEngine (to show overlays)
 * - HUDLayoutEngine (to position widgets)
 * - CollaborationPresenceRuntime (for participant data)
 * - VoiceSessionRuntime (for voice activity)
 * 
 * Event emissions:
 *   "hud.multiplayer.participant.added", "hud.multiplayer.participant.removed"
 *   "hud.multiplayer.hand_raise.shown", "hud.multiplayer.hand_raise.dismissed"
 * 
 * Event subscriptions:
 *   "collaboration.presence.updated" (update participant list)
 *   "collaboration.hand.raised" / "collaboration.hand.lowered"
 *   "voice.activity" (update voice indicators)
 *   "annotation.created" / "annotation.removed" (render annotations)
 * 
 * Synchronization: read-only view of collaboration state; no writes
 * Recovery: widgets rebuilt on next presence update after reconnect
 * Telemetry: participant count, annotation overlay count
 * Diagnostics: active widgets, hand-raise queue
 * Accessibility: participant status announced via screen reader; keyboard navigation to participant list
 * Performance: virtualised participant list for large sessions; efficient DOM updates
 * Forbidden: revealing participant personal data without consent; blocking HUD with too many overlays
 */

import { v4 as uuidv4 } from 'uuid';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { HUDOverlayEngine } from './HUD-overlay-engine';
import type { HUDLayoutEngine } from './HUD-layout-engine';

type ParticipantId = string;

interface ParticipantWidget {
  participantId: ParticipantId;
  displayName: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  instrumentFocus?: string;
  handRaised: boolean;
  muted: boolean;
  videoEnabled: boolean;
  element: HTMLElement | null; // DOM reference
  position: { x: number; y: number };
}

interface HandRaiseNotification {
  id: string;
  participantId: ParticipantId;
  displayName: string;
  timestamp: number;
  dismissed: boolean;
}

interface VoiceIndicator {
  participantId: ParticipantId;
  speaking: boolean;
  level: number;
}

export class HUDMultiplayerOverlay {
  private participantWidgets: Map<ParticipantId, ParticipantWidget> = new Map();
  private handRaiseQueue: HandRaiseNotification[] = [];
  private voiceIndicators: Map<ParticipantId, VoiceIndicator> = new Map();
  private maxParticipants = 20;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private overlayEngine: HUDOverlayEngine,
    private layoutEngine: HUDLayoutEngine,
  ) {
    this.eventBus.subscribe('collaboration.presence.updated', this.onPresenceUpdated.bind(this));
    this.eventBus.subscribe('collaboration.hand.raised', this.onHandRaised.bind(this));
    this.eventBus.subscribe('collaboration.hand.lowered', this.onHandLowered.bind(this));
    this.eventBus.subscribe('voice.activity', this.onVoiceActivity.bind(this));
    this.eventBus.subscribe('annotation.created', this.onAnnotationCreated.bind(this));
    this.eventBus.subscribe('annotation.removed', this.onAnnotationRemoved.bind(this));
  }

  private onPresenceUpdated(event: any): void {
    const { participants } = event.payload;
    // Update or add widgets for each participant
    for (const participant of participants) {
      const existing = this.participantWidgets.get(participant.id);
      if (existing) {
        this.updateWidget(existing, participant);
      } else if (this.participantWidgets.size < this.maxParticipants) {
        this.addWidget(participant);
      }
    }
    // Remove widgets for participants no longer present
    const presentIds = new Set(participants.map((p: any) => p.id));
    for (const [id, widget] of this.participantWidgets) {
      if (!presentIds.has(id)) {
        this.removeWidget(id);
      }
    }
    this.meter.setGauge('hud.multiplayer.participant_count', this.participantWidgets.size);
  }

  private addWidget(participant: any): void {
    const id = participant.id;
    const widget: ParticipantWidget = {
      participantId: id,
      displayName: participant.displayName,
      status: participant.status,
      instrumentFocus: participant.instrumentFocus,
      handRaised: participant.handRaised,
      muted: participant.muted,
      videoEnabled: participant.videoEnabled,
      element: null, // would create DOM element
      position: { x: 0, y: 0 },
    };
    this.participantWidgets.set(id, widget);
    this.meter.incrementCounter('hud.multiplayer.participant.added');
    this.eventBus.publish('hud.multiplayer.participant.added', {
      participantId: id,
      displayName: participant.displayName,
    });
    this.logger.debug(`Multiplayer widget added: ${participant.displayName}`);
  }

  private updateWidget(widget: ParticipantWidget, participant: any): void {
    widget.status = participant.status;
    widget.instrumentFocus = participant.instrumentFocus;
    widget.muted = participant.muted;
    widget.videoEnabled = participant.videoEnabled;
    if (participant.handRaised && !widget.handRaised) {
      widget.handRaised = true;
    } else if (!participant.handRaised && widget.handRaised) {
      widget.handRaised = false;
    }
  }

  private removeWidget(participantId: ParticipantId): void {
    this.participantWidgets.delete(participantId);
    this.meter.incrementCounter('hud.multiplayer.participant.removed');
    this.eventBus.publish('hud.multiplayer.participant.removed', { participantId });
  }

  private onHandRaised(event: any): void {
    const { participantId, displayName } = event.payload;
    const existing = this.handRaiseQueue.find(n => n.participantId === participantId && !n.dismissed);
    if (existing) return;
    const notification: HandRaiseNotification = {
      id: uuidv4(),
      participantId,
      displayName: displayName ?? 'Unknown',
      timestamp: Date.now(),
      dismissed: false,
    };
    this.handRaiseQueue.push(notification);
    this.showOverlayForHandRaise(notification);
    this.logger.info(`Hand raised by: ${notification.displayName}`);
  }

  private onHandLowered(event: any): void {
    const { participantId } = event.payload;
    const notification = this.handRaiseQueue.find(n => n.participantId === participantId && !n.dismissed);
    if (notification) {
      notification.dismissed = true;
    }
    this.handRaiseQueue = this.handRaiseQueue.filter(n => !n.dismissed);
  }

  private showOverlayForHandRaise(notification: HandRaiseNotification): void {
    this.overlayEngine.showTimed({
      id: `hand_raise_${notification.id}` as any,
      type: 'collaboration',
      position: 'top',
      content: `✋ ${notification.displayName} has a question`,
      duration: 10000,
      priority: 85,
      timestamp: Date.now(),
    }, {} as any);
  }

  private onVoiceActivity(event: any): void {
    const { participantId, speaking, level } = event.payload;
    this.voiceIndicators.set(participantId, { participantId, speaking, level });
    // Update widget visual
    const widget = this.participantWidgets.get(participantId);
    if (widget) {
      // Apply speaking animation class (handled by renderer)
    }
  }

  private onAnnotationCreated(event: any): void {
    const { annotation } = event.payload;
    this.overlayEngine.show({
      id: `annotation_${annotation.id}` as any,
      type: 'collaboration',
      position: 'floating',
      content: annotation.content,
      duration: annotation.expiresAt ? annotation.expiresAt - Date.now() : 0,
      priority: 50,
      timestamp: Date.now(),
    }, {} as any);
  }

  private onAnnotationRemoved(event: any): void {
    const { annotationId } = event.payload;
    this.overlayEngine.dismiss(`annotation_${annotationId}` as any, {} as any);
  }

  getParticipantWidgets(): ParticipantWidget[] {
    return Array.from(this.participantWidgets.values());
  }

  getRaiseHandQueue(): HandRaiseNotification[] {
    return this.handRaiseQueue.filter(n => !n.dismissed);
  }

  dismissHandRaise(participantId: ParticipantId): void {
    const notification = this.handRaiseQueue.find(n => n.participantId === participantId && !n.dismissed);
    if (notification) {
      notification.dismissed = true;
      this.eventBus.publish('hud.multiplayer.hand_raise.dismissed', { participantId });
    }
  }
}