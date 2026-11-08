// apps/web/src/HUD/runtime/HUD-mission-overlay.ts
/**
 * HUD Mission Overlay
 * 
 * Responsibilities:
 * - Display mission progress, objectives, and hints as styled overlays
 * - Integrate with mission guidance agent to show adaptive hints
 * - Provide interactive mission panel with collapsible objectives
 * - Animate objective completions and mission milestones
 * 
 * Owned state: none (reads from HUD state and mission events)
 * 
 * Dependencies: ILogger, IMeter, HUDOverlayEngine, MissionGuidanceAgent
 * 
 * Event emissions: none
 * Event subscriptions: "mission.objective.completed", "mission.completed"
 * Synchronization: none
 * Recovery: overlays ephemeral
 * Telemetry: mission interaction
 * Diagnostics: N/A
 * Accessibility: mission text must be screen-readable; interactive objectives keyboard-navigable
 * Performance: lightweight DOM updates
 * Forbidden: obstructing critical instrument viewports
 */

import type { HUDState } from '../contracts/hud-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { HUDOverlayEngine } from './HUD-overlay-engine';
import type { MissionGuidanceAgent } from '@labforge/AI-tutoring';
import { v4 as uuidv4 } from 'uuid';
import type { OverlayId } from '../contracts/hud-contracts';

export class HUDMissionOverlay {
  constructor(
    private overlayEngine: HUDOverlayEngine,
    private missionAgent: MissionGuidanceAgent,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  onObjectiveCompleted(payload: any, state: HUDState): void {
    this.overlayEngine.showTimed({
      id: uuidv4() as OverlayId,
      type: 'mission_update',
      position: 'top',
      content: `✓ Objective: ${payload.objectiveId}`,
      duration: 4000,
      priority: 90,
      timestamp: Date.now(),
    }, state);
  }

  onMissionCompleted(payload: any, state: HUDState): void {
    this.overlayEngine.showTimed({
      id: uuidv4() as OverlayId,
      type: 'mission_update',
      position: 'center',
      content: '🏆 Mission Complete!',
      duration: 10000,
      priority: 100,
      timestamp: Date.now(),
    }, state);
  }

  requestHint(objectiveId: string, sessionId: string, state: HUDState): void {
    const hint = this.missionAgent.getNextHint(objectiveId as any, { id: sessionId } as any);
    if (hint) {
      this.overlayEngine.showTimed({
        id: uuidv4() as OverlayId,
        type: 'hint',
        position: 'floating',
        content: hint,
        duration: 6000,
        priority: 85,
        timestamp: Date.now(),
      }, state);
    }
  }
}