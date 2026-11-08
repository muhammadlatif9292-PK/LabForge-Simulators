// packages/design-system/contracts/design-system-contracts.ts
/**
 * Design System Contracts
 * 
 * Responsibilities:
 * - Define strict types for design tokens, themes, motion, typography,
 *   spacing, elevation, scientific UI, and accessibility
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

export type TokenId = string & { readonly __brand: 'TokenId' };
export type ThemeId = string & { readonly __brand: 'ThemeId' };
export type MotionCurveId = string & { readonly __brand: 'MotionCurveId' };
export type BreakpointId = string & { readonly __brand: 'BreakpointId' };

export enum ColorRole {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  TERTIARY = 'tertiary',
  SURFACE = 'surface',
  BACKGROUND = 'background',
  ERROR = 'error',
  WARNING = 'warning',
  SUCCESS = 'success',
  INFO = 'info',
  ON_PRIMARY = 'on_primary',
  ON_SURFACE = 'on_surface',
  SCIENTIFIC_HIGHLIGHT = 'scientific_highlight',
  HUD_ELEMENT = 'hud_element',
  OVERLAY = 'overlay',
}

export enum TypographyScale {
  CAPTION = 'caption',
  BODY_SMALL = 'body_small',
  BODY = 'body',
  BODY_LARGE = 'body_large',
  SUBTITLE = 'subtitle',
  TITLE = 'title',
  HEADLINE = 'headline',
  DISPLAY = 'display',
  HUD_NUMERIC = 'hud_numeric',
  HUD_LABEL = 'hud_label',
}

export enum SpacingScale {
  NONE = 0,
  XS = 4,
  SM = 8,
  MD = 16,
  LG = 24,
  XL = 32,
  XXL = 48,
  XXXL = 64,
}

export enum ElevationLevel {
  FLAT = 0,
  RAISED = 1,
  OVERLAY = 2,
  MODAL = 3,
  NOTIFICATION = 4,
  HUD = 5,
}

export enum MotionDuration {
  INSTANT = 0,
  FAST = 100,
  MEDIUM = 250,
  SLOW = 400,
  DELIBERATE = 600,
}

export enum MotionEasing {
  STANDARD = 'cubic-bezier(0.4, 0, 0.2, 1)',
  DECELERATE = 'cubic-bezier(0, 0, 0.2, 1)',
  ACCELERATE = 'cubic-bezier(0.4, 0, 1, 1)',
  SHARP = 'cubic-bezier(0.4, 0, 0.6, 1)',
  BOUNCE = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
}

export interface ColorToken {
  id: TokenId;
  role: ColorRole;
  value: string;       // hex, rgba, or HSL
  opacity: number;
  darkModeValue?: string;
  scientificVariant?: string; // high-contrast for data
}

export interface TypographyToken {
  id: TokenId;
  scale: TypographyScale;
  fontFamily: string;
  fontSize: number;        // px
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  monoVariant?: boolean;
}

export interface SpacingToken {
  scale: SpacingScale;
  value: number; // px
}

export interface ElevationToken {
  level: ElevationLevel;
  shadow: string;       // CSS box-shadow
  zIndex: number;
}

export interface MotionToken {
  id: MotionCurveId;
  duration: MotionDuration;
  easing: MotionEasing;
}

export interface Theme {
  id: ThemeId;
  name: string;
  colors: Map<ColorRole, ColorToken>;
  typography: Map<TypographyScale, TypographyToken>;
  spacing: Record<SpacingScale, number>;
  elevation: Map<ElevationLevel, ElevationToken>;
  motion: Map<MotionCurveId, MotionToken>;
  breakpoints: Map<BreakpointId, number>;
}

export interface ScientificThemeSettings {
  highContrast: boolean;
  dataVisualizationPalette: string[];  // color-blind safe ordered palette
  equationFontSize: number;
  significantDigits: number;
  unitDisplay: 'inline' | 'superscript' | 'bracket';
}

export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSizeScale: number;      // 1 = 100%
  focusRingVisible: boolean;
}

export interface DesignTokenValidationReport {
  valid: boolean;
  errors: TokenValidationError[];
  warnings: TokenValidationWarning[];
}

export interface TokenValidationError {
  tokenId: string;
  property: string;
  message: string;
}

export interface TokenValidationWarning {
  tokenId: string;
  property: string;
  message: string;
}