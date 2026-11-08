// packages/ui/AdaptiveLayoutContainer.tsx
/**
 * Adaptive Layout Container Component
 * 
 * Responsibilities:
 * - Arrange child elements according to the current breakpoint and landscape mode
 * - Use CSS Grid with design-system spacing tokens
 * - Reflow children when breakpoint changes without remounting
 * - Provide responsive gap and padding based on breakpoint
 * - Enforce that orientation is always landscape
 * 
 * Owned state: none (derived from props)
 * 
 * Dependencies:
 * - ThemeRuntime (for spacing tokens)
 * - AdaptiveSpacingEngine (breakpoint definitions)
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: N/A
 * Telemetry: N/A
 * Diagnostics: N/A
 * Accessibility: no impact; children retain their ARIA attributes
 * Performance: CSS-only responsiveness; no JS layout calculations
 * Forbidden: switching to portrait layout; overflowing viewport in landscape
 */

import React from 'react';
import type { AdaptiveLayoutContainerProps } from './contracts/ui-contracts';

const BREAKPOINT_COLUMNS: Record<string, number> = {
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 6,
};

const BREAKPOINT_GAP: Record<string, string> = {
  xs: 'var(--lab-space-sm, 8px)',
  sm: 'var(--lab-space-md, 16px)',
  md: 'var(--lab-space-lg, 24px)',
  lg: 'var(--lab-space-xl, 32px)',
  xl: 'var(--lab-space-xxl, 48px)',
};

export const AdaptiveLayoutContainer: React.FC<AdaptiveLayoutContainerProps> = ({
  breakpoint,
  isLandscape,
  children,
  'data-testid': testId,
  'aria-label': ariaLabel,
  className,
  style,
}) => {
  const columns = BREAKPOINT_COLUMNS[breakpoint] ?? 2;
  const gap = BREAKPOINT_GAP[breakpoint] ?? 'var(--lab-space-md, 16px)';

  if (!isLandscape) {
    // Force landscape message (should never happen in LABFORGE)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--lab-color-error, #f44336)',
          fontFamily: 'monospace',
          fontSize: 14,
        }}
      >
        Landscape orientation required
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      aria-label={ariaLabel ?? 'Adaptive layout'}
      role="group"
      className={`adaptive-layout-container${className ? ` ${className}` : ''}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        padding: 'var(--lab-space-md, 16px)',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};