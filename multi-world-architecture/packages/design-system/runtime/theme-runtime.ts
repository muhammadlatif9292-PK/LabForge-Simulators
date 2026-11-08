// packages/design-system/runtime/theme-runtime.ts
/**
 * Theme Runtime
 * 
 * Responsibilities:
 * - Manage theme creation, registration, switching, and runtime updates
 * - Apply theme tokens as CSS custom properties on the document root
 * - Support dark/light mode toggle with system preference detection
 * - Provide reactive theme context for component consumption
 * - Validate theme completeness before activation
 * 
 * Owned state:
 * - themes: Map<ThemeId, Theme>
 * - activeThemeId: ThemeId
 * - darkMode: boolean
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - DesignTokenValidator
 * - DistributedEventBus (to emit theme changes)
 * 
 * Event emissions: "design.theme.changed", "design.theme.registered"
 * Event subscriptions: "system.prefers-color-scheme" (media query)
 * Synchronization: single active theme; transitions are CSS-driven
 * Recovery: re-apply CSS variables on context restore
 * Telemetry: theme switch count
 * Diagnostics: active theme, token coverage
 * Accessibility: ensure contrast ratios meet WCAG AA/AAA
 * Performance: CSS custom properties are hardware-accelerated; no layout thrash
 * Forbidden: applying incomplete themes; blocking UI on theme change
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ThemeId, Theme, ColorRole, TypographyScale, SpacingScale,
  ElevationLevel, MotionCurveId, BreakpointId,
  ColorToken, TypographyToken, ElevationToken, MotionToken,
} from '../contracts/design-system-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { DesignTokenValidator } from './design-token-validator';

export class ThemeRuntime {
  private themes: Map<ThemeId, Theme> = new Map();
  private activeThemeId: ThemeId | null = null;
  private darkMode = false;
  private prefersDarkQuery: MediaQueryList | null = null;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private validator: DesignTokenValidator,
  ) {
    if (typeof window !== 'undefined') {
      this.prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.darkMode = this.prefersDarkQuery.matches;
      this.prefersDarkQuery.addEventListener('change', (e) => {
        this.darkMode = e.matches;
        this.applyActiveTheme();
      });
    }
  }

  registerTheme(theme: Theme): void {
    const validation = this.validator.validateTheme(theme);
    if (!validation.valid) {
      this.logger.error(`Theme ${theme.id} validation failed`, { errors: validation.errors });
      throw new Error(`Theme validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    this.themes.set(theme.id, theme);
    this.meter.incrementCounter('design.theme.registered');
    this.eventBus.publish('design.theme.registered', { themeId: theme.id, name: theme.name });
    this.logger.info(`Theme registered: ${theme.name} (${theme.id})`);
  }

  async activateTheme(themeId: ThemeId): Promise<void> {
    const theme = this.themes.get(themeId);
    if (!theme) throw new Error(`Theme not found: ${themeId}`);
    this.activeThemeId = themeId;
    this.applyActiveTheme();
    this.meter.incrementCounter('design.theme.activated');
    this.eventBus.publish('design.theme.changed', { themeId, darkMode: this.darkMode });
    this.logger.info(`Theme activated: ${theme.name}`);
  }

  getActiveTheme(): Theme | undefined {
    if (!this.activeThemeId) return undefined;
    return this.themes.get(this.activeThemeId);
  }

  getAllThemes(): Theme[] {
    return Array.from(this.themes.values());
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
    this.applyActiveTheme();
  }

  setDarkMode(enabled: boolean): void {
    this.darkMode = enabled;
    this.applyActiveTheme();
  }

  isDarkMode(): boolean {
    return this.darkMode;
  }

  private applyActiveTheme(): void {
    const theme = this.getActiveTheme();
    if (!theme || typeof document === 'undefined') return;
    const root = document.documentElement;
    // Apply all tokens as CSS custom properties
    this.applyColorTokens(root, theme);
    this.applyTypographyTokens(root, theme);
    this.applySpacingTokens(root, theme);
    this.applyElevationTokens(root, theme);
    this.applyMotionTokens(root, theme);
    this.applyBreakpoints(root, theme);
    // Set dark mode class
    root.classList.toggle('dark', this.darkMode);
    root.classList.toggle('light', !this.darkMode);
  }

  private applyColorTokens(root: HTMLElement, theme: Theme): void {
    for (const [role, token] of theme.colors) {
      const colorValue = this.darkMode && token.darkModeValue
        ? token.darkModeValue
        : token.value;
      root.style.setProperty(`--lab-color-${role}`, colorValue);
      if (token.opacity < 1) {
        root.style.setProperty(`--lab-color-${role}-opacity`, String(token.opacity));
      }
      if (token.scientificVariant) {
        root.style.setProperty(`--lab-color-${role}-sci`, token.scientificVariant);
      }
    }
  }

  private applyTypographyTokens(root: HTMLElement, theme: Theme): void {
    for (const [scale, token] of theme.typography) {
      const prefix = `--lab-type-${scale}`;
      root.style.setProperty(`${prefix}-font`, token.fontFamily);
      root.style.setProperty(`${prefix}-size`, `${token.fontSize}px`);
      root.style.setProperty(`${prefix}-weight`, String(token.fontWeight));
      root.style.setProperty(`${prefix}-height`, String(token.lineHeight));
      root.style.setProperty(`${prefix}-spacing`, `${token.letterSpacing}px`);
    }
  }

  private applySpacingTokens(root: HTMLElement, theme: Theme): void {
    for (const [scale, value] of Object.entries(theme.spacing)) {
      if (typeof value === 'number') {
        root.style.setProperty(`--lab-space-${scale}`, `${value}px`);
      }
    }
  }

  private applyElevationTokens(root: HTMLElement, theme: Theme): void {
    for (const [level, token] of theme.elevation) {
      root.style.setProperty(`--lab-elevation-${level}-shadow`, token.shadow);
      root.style.setProperty(`--lab-elevation-${level}-z`, String(token.zIndex));
    }
  }

  private applyMotionTokens(root: HTMLElement, theme: Theme): void {
    for (const [id, token] of theme.motion) {
      root.style.setProperty(`--lab-motion-${id}-duration`, `${token.duration}ms`);
      root.style.setProperty(`--lab-motion-${id}-easing`, token.easing);
    }
  }

  private applyBreakpoints(root: HTMLElement, theme: Theme): void {
    for (const [id, value] of theme.breakpoints) {
      root.style.setProperty(`--lab-breakpoint-${id}`, `${value}px`);
    }
  }
}