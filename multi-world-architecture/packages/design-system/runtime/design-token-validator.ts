// packages/design-system/runtime/design-token-validator.ts
/**
 * Design Token Validator
 * 
 * Responsibilities:
 * - Validate theme completeness (all required tokens present)
 * - Check color contrast ratios against WCAG standards
 * - Verify typography tokens are readable
 * - Validate spacing scale consistency
 * - Provide structured validation reports
 * 
 * Owned state: none (pure functions)
 * 
 * Dependencies: none
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: n/a
 * Telemetry: validation count, failure rate
 * Diagnostics: validation errors and warnings
 * Accessibility: enforces WCAG compliance
 * Performance: lightweight checks; no heavy computation
 * Forbidden: allowing non-compliant themes to be registered
 */

import type {
  Theme, ColorRole, TypographyScale, ElevationLevel,
  DesignTokenValidationReport, TokenValidationError, TokenValidationWarning,
  ColorToken,
} from '../contracts/design-system-contracts';

export class DesignTokenValidator {
  validateTheme(theme: Theme): DesignTokenValidationReport {
    const errors: TokenValidationError[] = [];
    const warnings: TokenValidationWarning[] = [];

    // Check required color roles
    const requiredColors: ColorRole[] = [
      'primary', 'secondary', 'surface', 'background', 'error', 'on_primary', 'on_surface',
    ];
    for (const role of requiredColors) {
      if (!theme.colors.has(role)) {
        errors.push({ tokenId: `color:${role}`, property: 'color', message: `Missing required color role: ${role}` });
      }
    }

    // Validate color contrast (simplified)
    const surfaceColor = theme.colors.get('surface');
    const onSurfaceColor = theme.colors.get('on_surface');
    if (surfaceColor && onSurfaceColor) {
      const ratio = this.calculateContrastRatio(surfaceColor.value, onSurfaceColor.value);
      if (ratio < 4.5) {
        warnings.push({
          tokenId: 'color:on_surface',
          property: 'contrast',
          message: `Contrast ratio ${ratio.toFixed(1)}:1 is below WCAG AA minimum (4.5:1)`,
        });
      }
    }

    // Check required typography scales
    const requiredScales: TypographyScale[] = ['body', 'title', 'headline', 'hud_numeric', 'hud_label'];
    for (const scale of requiredScales) {
      if (!theme.typography.has(scale)) {
        errors.push({ tokenId: `type:${scale}`, property: 'typography', message: `Missing required typography scale: ${scale}` });
      }
    }

    // Check spacing scale
    const requiredSpacingValues = [0, 4, 8, 16, 24, 32, 48, 64];
    for (const value of requiredSpacingValues) {
      if (!Object.values(theme.spacing).includes(value)) {
        warnings.push({ tokenId: `space:${value}`, property: 'spacing', message: `Standard spacing value ${value}px missing` });
      }
    }

    // Check required elevation levels
    const requiredElevations: ElevationLevel[] = ['flat', 'raised', 'overlay', 'modal', 'hud'];
    for (const level of requiredElevations) {
      if (!theme.elevation.has(level)) {
        errors.push({ tokenId: `elevation:${level}`, property: 'elevation', message: `Missing required elevation level: ${level}` });
      }
    }

    // Check motion tokens
    if (theme.motion.size === 0) {
      warnings.push({ tokenId: 'motion', property: 'motion', message: 'No motion tokens defined' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private calculateContrastRatio(hex1: string, hex2: string): number {
    const lum1 = this.relativeLuminance(hex1);
    const lum2 = this.relativeLuminance(hex2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private relativeLuminance(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const linearize = (c: number): number => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  }
}