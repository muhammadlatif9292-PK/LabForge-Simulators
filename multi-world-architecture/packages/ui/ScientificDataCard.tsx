// packages/ui/ScientificDataCard.tsx
/**
 * Scientific Data Card Component
 * 
 * Responsibilities:
 * - Display a scientific measurement with value, unit, uncertainty, and label
 * - Show live indicator (pulsing dot) for streaming data
 * - Display trend arrow (up/down/stable)
 * - Format numbers according to scientific conventions (significant digits)
 * - Use an accent color bar for visual categorization
 * 
 * Owned state: none (stateless)
 * 
 * Dependencies:
 * - ThemeRuntime (for tokens)
 * - ScientificUIRuntime (for formatting numbers)
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: N/A
 * Telemetry: N/A
 * Diagnostics: N/A
 * Accessibility: value and unit are screen-readable; live region for streaming
 * Performance: pure component; no unnecessary re-renders
 * Forbidden: displaying raw unformatted floats; showing uncertainty without context
 */

import React from 'react';
import type { ScientificDataCardProps } from './contracts/ui-contracts';

export const ScientificDataCard: React.FC<ScientificDataCardProps> = ({
  value,
  unit,
  uncertainty,
  label,
  live = false,
  trend,
  accentColor = 'var(--lab-color-primary, #4a9eff)',
  'data-testid': testId,
  'aria-label': ariaLabel,
  className,
  style,
}) => {
  const formattedValue = typeof value === 'number' ? value.toPrecision(4) : value;
  const formattedUncertainty = uncertainty !== undefined ? `± ${uncertainty.toPrecision(2)}` : '';

  const trendSymbol: Record<string, string> = {
    up: '▲',
    down: '▼',
    stable: '●',
  };

  return (
    <div
      data-testid={testId}
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      aria-label={ariaLabel ?? `${label}: ${formattedValue} ${unit}${formattedUncertainty ? ` ${formattedUncertainty}` : ''}`}
      className={`scientific-data-card${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        padding: '12px 14px',
        borderRadius: '6px',
        background: 'var(--lab-color-surface, rgba(20,20,35,0.9))',
        border: `1px solid var(--lab-color-on_surface, rgba(255,255,255,0.1))`,
        borderLeft: `3px solid ${accentColor}`,
        color: 'var(--lab-color-on_surface, #e0e0e0)',
        fontFamily: 'var(--lab-type-hud_label-font, monospace)',
        minWidth: 120,
        ...style,
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: 'var(--lab-type-caption-size, 10px)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--lab-color-on_surface, #999)',
          marginBottom: 4,
        }}
      >
        {label}
        {live && (
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4caf50',
              marginLeft: 6,
              animation: 'pulse-live 1.5s ease-in-out infinite',
            }}
          />
        )}
      </div>
      {/* Value */}
      <div
        style={{
          fontSize: 'var(--lab-type-hud_numeric-size, 24px)',
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        {formattedValue}
        <span style={{ fontSize: '0.5em', fontWeight: 400, marginLeft: 3, opacity: 0.8 }}>
          {unit}
        </span>
      </div>
      {/* Uncertainty */}
      {formattedUncertainty && (
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
          {formattedUncertainty}
        </div>
      )}
      {/* Trend */}
      {trend && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            fontSize: 12,
            color:
              trend === 'up' ? '#4caf50' :
              trend === 'down' ? '#f44336' :
              '#ff9800',
          }}
        >
          {trendSymbol[trend]}
        </div>
      )}
      <style>{`@keyframes pulse-live { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
};