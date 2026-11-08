// packages/design-system/runtime/scientific-UI-runtime.ts
/**
 * Scientific UI Runtime
 * 
 * Responsibilities:
 * - Enforce scientific UI conventions: significant figures display, unit formatting
 * - Provide data visualization color palettes (color-blind safe)
 * - Manage equation rendering settings
 * - Ensure numeric displays follow scientific notation rules
 * - Coordinate with accessibility systems for data descriptions
 * 
 * Owned state:
 * - settings: ScientificThemeSettings
 * - dataPalette: string[] (current palette)
 * 
 * Dependencies: ILogger, IMeter, ThemeRuntime
 * 
 * Event emissions: "design.scientific.settings.changed"
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: settings restored from theme
 * Telemetry: palette usage count
 * Diagnostics: current scientific settings
 * Accessibility: color-blind safe palettes enforced
 * Performance: lightweight formatting operations
 * Forbidden: displaying raw floats without formatting; inaccessible color choices
 */

import type { ScientificThemeSettings } from '../contracts/design-system-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';

const COLOR_BLIND_SAFE_PALETTES: Record<string, string[]> = {
  'tol-vibrant': ['#0077BB', '#33BBEE', '#009988', '#EE7733', '#CC3311', '#EE3377', '#BBBBBB'],
  'tol-muted': ['#332288', '#88CCEE', '#44AA99', '#117733', '#DDCC77', '#CC6677', '#AA4499'],
  'ibm': ['#648FFF', '#785EF0', '#DC267F', '#FE6100', '#FFB000'],
};

export class ScientificUIRuntime {
  private settings: ScientificThemeSettings = {
    highContrast: false,
    dataVisualizationPalette: COLOR_BLIND_SAFE_PALETTES['tol-vibrant'],
    equationFontSize: 16,
    significantDigits: 4,
    unitDisplay: 'inline',
  };

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
  ) {}

  updateSettings(partialSettings: Partial<ScientificThemeSettings>): void {
    this.settings = { ...this.settings, ...partialSettings };
    this.eventBus.publish('design.scientific.settings.changed', this.settings);
  }

  getSettings(): Readonly<ScientificThemeSettings> {
    return { ...this.settings };
  }

  // Format a number to the configured significant digits
  formatValue(value: number): string {
    if (value === 0) return '0';
    const digits = this.settings.significantDigits;
    return value.toPrecision(digits);
  }

  // Format value with unit
  formatMeasurement(value: number, unit: string, uncertainty?: number): string {
    const formattedValue = this.formatValue(value);
    const uncertaintyStr = uncertainty !== undefined ? ` ± ${this.formatValue(uncertainty)}` : '';
    switch (this.settings.unitDisplay) {
      case 'inline':
        return `${formattedValue}${uncertaintyStr} ${unit}`;
      case 'superscript':
        return `${formattedValue}${uncertaintyStr} ${unit}`; // superscript via HTML renderer
      case 'bracket':
        return `${formattedValue}${uncertaintyStr} [${unit}]`;
      default:
        return `${formattedValue}${uncertaintyStr} ${unit}`;
    }
  }

  // Get color for data series index (cycles palette)
  getDataColor(seriesIndex: number): string {
    const palette = this.settings.dataVisualizationPalette;
    return palette[seriesIndex % palette.length];
  }

  // Get all data colors
  getPalette(): string[] {
    return [...this.settings.dataVisualizationPalette];
  }

  // Use a named color-blind safe palette
  setPalette(paletteName: keyof typeof COLOR_BLIND_SAFE_PALETTES): void {
    this.settings.dataVisualizationPalette = COLOR_BLIND_SAFE_PALETTES[paletteName] ?? COLOR_BLIND_SAFE_PALETTES['tol-vibrant'];
    this.eventBus.publish('design.scientific.settings.changed', this.settings);
  }

  setSignificantDigits(digits: number): void {
    this.settings.significantDigits = Math.max(1, Math.min(10, digits));
    this.eventBus.publish('design.scientific.settings.changed', this.settings);
  }

  enableHighContrast(enabled: boolean): void {
    this.settings.highContrast = enabled;
    this.eventBus.publish('design.scientific.settings.changed', this.settings);
  }
}