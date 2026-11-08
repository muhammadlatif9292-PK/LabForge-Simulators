// packages/state-machines/HUD-overlay.machine.ts
/**
 * HUD Overlay State Machine
 * 
 * Responsibilities:
 * - Formalise overlay lifecycle: hidden → showing → visible → hiding → hidden
 */

export enum OverlayState {
  HIDDEN = 'hidden',
  SHOWING = 'showing',
  VISIBLE = 'visible',
  HIDING = 'hiding',
}

export enum OverlayEvent {
  SHOW = 'show',
  SHOWN = 'shown',
  HIDE = 'hide',
  HIDDEN = 'hidden',
}

export class HUDOverlayMachine {
  private state: OverlayState = OverlayState.HIDDEN;

  private static transitions: Record<string, OverlayState> = {
    [`${OverlayState.HIDDEN}.${OverlayEvent.SHOW}`]: OverlayState.SHOWING,
    [`${OverlayState.SHOWING}.${OverlayEvent.SHOWN}`]: OverlayState.VISIBLE,
    [`${OverlayState.VISIBLE}.${OverlayEvent.HIDE}`]: OverlayState.HIDING,
    [`${OverlayState.HIDING}.${OverlayEvent.HIDDEN}`]: OverlayState.HIDDEN,
  };

  getState(): OverlayState { return this.state; }

  send(event: OverlayEvent): boolean {
    const key = `${this.state}.${event}`;
    const next = HUDOverlayMachine.transitions[key];
    if (!next) return false;
    this.state = next;
    return true;
  }
}