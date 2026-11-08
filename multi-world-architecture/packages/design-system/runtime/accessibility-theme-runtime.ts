// packages/design-system/runtime/accessibility-theme-runtime.ts
/**
 * Accessibility Theme Runtime
 * 
 * Responsibilities:
 * - Enforce accessibility settings across the entire HUD and UI
 * - Apply system-level accessibility preferences (reduced motion, high contrast)
 * - Provide font scaling for vision-impaired users
 * - Ensure focus indicators are always visible when needed
 * - Coordinate with screen reader announcements for state changes
 * 
 * Owned state:
 * - settings: AccessibilitySettings
 * - liveRegion: HTMLElement | null
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DistributedEventBus
 * - ThemeRuntime (to apply contrast overrides)
 * 
 * Event emissions: "design.accessibility.changed"
 * Event subscriptions: "system.prefers-reduced-motion", "system.prefers-contrast"
 * Synchronization: none
 * Recovery: settings persisted in localStorage
 * Telemetry: accessibility feature usage
 * Diagnostics: current accessibility settings
 * Accessibility: core system ensuring the app is accessible
 * Performance: no impact; preference-based CSS toggles
 * Forbidden: ignoring system accessibility preferences
 */

import type { AccessibilitySettings } from '../contracts/design-system-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

const STORAGE_KEY = 'labforge_accessibility_settings';

export class AccessibilityThemeRuntime {
  private settings: AccessibilitySettings = {
    reducedMotion: false,
    highContrast: false,
    fontSizeScale: 1,
    focusRingVisible: true,
  };
  private liveRegion: HTMLElement | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {
    this.loadPreferences();
    this.setupSystemListeners();
    this.createLiveRegion();
  }

  private loadPreferences(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.settings = { ...this.settings, ...JSON.parse(raw) };
      }
    } catch (err) {
      this.logger.warn('Failed to load accessibility preferences');
    }
  }

  private savePreferences(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (err) {
      this.logger.warn('Failed to save accessibility preferences');
    }
  }

  private setupSystemListeners(): void {
    if (typeof window === 'undefined') return;
    const reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.settings.reducedMotion = reducedMotionMQ.matches;
    reducedMotionMQ.addEventListener('change', (e) => {
      this.settings.reducedMotion = e.matches;
      this.applySettings();
    });
    const highContrastMQ = window.matchMedia('(prefers-contrast: more)');
    this.settings.highContrast = highContrastMQ.matches;
    highContrastMQ.addEventListener('change', (e) => {
      this.settings.highContrast = e.matches;
      this.applySettings();
    });
  }

  private createLiveRegion(): void {
    if (typeof document === 'undefined') return;
    let region = document.getElementById('labforge-live-region');
    if (!region) {
      region = document.createElement('div');
      region.id = 'labforge-live-region';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      region.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
      document.body.appendChild(region);
    }
    this.liveRegion = region;
  }

  getSettings(): Readonly<AccessibilitySettings> {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<AccessibilitySettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.savePreferences();
    this.applySettings();
    this.eventBus.publish('design.accessibility.changed', this.settings);
    this.meter.incrementCounter('design.accessibility.changed');
  }

  private applySettings(): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    // Apply font scale
    root.style.setProperty('--lab-a11y-font-scale', String(this.settings.fontSizeScale));
    root.style.fontSize = `${this.settings.fontSizeScale * 100}%`;
    // High contrast
    root.classList.toggle('high-contrast', this.settings.highContrast);
    // Reduced motion
    root.classList.toggle('reduced-motion', this.settings.reducedMotion);
    // Focus ring
    root.classList.toggle('hide-focus-ring', !this.settings.focusRingVisible);
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.liveRegion) return;
    this.liveRegion.setAttribute('aria-live', priority);
    // Clear then set to trigger announcement
    this.liveRegion.textContent = '';
    requestAnimationFrame(() => {
      if (this.liveRegion) this.liveRegion.textContent = message;
    });
  }

  setFontScale(scale: number): void {
    const clampedScale = Math.max(0.75, Math.min(2.5, scale));
    this.updateSettings({ fontSizeScale: clampedScale });
  }

  toggleHighContrast(): void {
    this.updateSettings({ highContrast: !this.settings.highContrast });
  }

  toggleReducedMotion(): void {
    this.updateSettings({ reducedMotion: !this.settings.reducedMotion });
  }

  isReducedMotion(): boolean {
    return this.settings.reducedMotion;
  }

  isHighContrast(): boolean {
    return this.settings.highContrast;
  }
}