// apps/web/src/HUD/contracts/hud-contracts.ts
/**
 * Tactical HUD Contracts
 * 
 * Responsibilities:
 * - Define types for HUD panels, overlays, layouts, transitions, and missions
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type PanelId = string & { readonly __brand: 'PanelId' };
export type OverlayId = string & { readonly __brand: 'OverlayId' };
export type LayoutId = string & { readonly __brand: 'LayoutId' };

export interface HUDPanel {
  id: PanelId;
  type: 'instruments' | 'measurements' | 'missions' | 'notes' | 'settings' | 'collaboration' | 'ai';
  position: { x: number; y: number; width: number; height: number };
  zIndex: number;
  visible: boolean;
  opacity: number;
  data: Record<string, unknown>;
}

export interface HUDOverlay {
  id: OverlayId;
  type: 'ai_response' | 'measurement' | 'hint' | 'warning' | 'mission_update' | 'collaboration';
  targetPanelId?: PanelId;
  position: 'top' | 'bottom' | 'center' | 'floating';
  content: string;
  duration?: number; // ms, 0 = persistent
  priority: number; // higher = on top
  timestamp: number;
}

export interface HUDLayout {
  id: LayoutId;
  name: string;
  panels: HUDPanel[];
  orientation: 'landscape';
  layout: 'standard' | 'mission_focused' | 'tutoring' | 'minimal';
}

export interface TransitionEffect {
  type: 'fade' | 'slide' | 'scale' | 'none';
  durationMs: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface HUDState {
  activeLayout: LayoutId;
  panels: Map<PanelId, HUDPanel>;
  overlays: HUDOverlay[];
  transition: TransitionEffect | null;
  dimmed: boolean;
}