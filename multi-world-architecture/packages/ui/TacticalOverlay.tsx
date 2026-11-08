// packages/ui/TacticalOverlay.tsx
/**
 * Tactical Overlay Component
 * 
 * Responsibilities:
 * - Render a floating or positioned overlay for alerts, AI responses, and HUD notifications
 * - Support auto-dismiss with configurable duration
 * - Animate entrance and exit using motion orchestrator
 * - Stack multiple overlays based on priority
 * - Respect accessibility settings (reduced motion, high contrast)
 * 
 * Owned state:
 * - isVisible: boolean (controlled by parent)
 * 
 * Dependencies:
 * - MotionOrchestrator (for animations)
 * - AccessibilityThemeRuntime (for reduced motion)
 * 
 * Event emissions:
 *   "ui.overlay.shown", "ui.overlay.dismissed"
 * 
 * Event subscriptions: none
 * Synchronization: none
 * Recovery: re-show if props change
 * Telemetry: overlay view duration
 * Diagnostics: none
 * Accessibility: ARIA live region for dynamic content; focus not trapped unless modal
 * Performance: GPU-composited transforms; no layout reflow on animation
 * Forbidden: multiple overlays with same priority competing for attention without stacking
 */

import React, { useEffect, useRef, useState } from 'react';
import type { OverlayProps } from './contracts/ui-contracts';

const POSITION_STYLES: Record<string, React.CSSProperties> = {
  top: {
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
  },
  bottom: {
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
  },
  center: {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
  floating: {
    // Position set dynamically by HUD overlay engine
  },
};

export const TacticalOverlay: React.FC<OverlayProps> = ({
  visible,
  position = 'top',
  duration = 0,
  priority = 0,
  onDismiss,
  children,
  backdrop = false,
  'data-testid': testId,
  'aria-label': ariaLabel,
  className,
  style,
}) => {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (visible) {
      setShow(true);
      // Auto-dismiss
      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          setShow(false);
          setTimeout(() => dismissRef.current?.(), 200); // after animation
        }, duration);
      }
    } else {
      setShow(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, duration]);

  if (!show) return null;

  const posStyles = POSITION_STYLES[position] ?? POSITION_STYLES.top;

  return (
    <>
      {backdrop && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 9998,
          }}
          onClick={() => {
            setShow(false);
            dismissRef.current?.();
          }}
        />
      )}
      <div
        data-testid={testId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={ariaLabel}
        className={`tactical-overlay position-${position}${className ? ` ${className}` : ''}`}
        style={{
          position: 'fixed',
          zIndex: 9999 + priority,
          maxWidth: '90vw',
          background: 'var(--lab-color-overlay, rgba(15, 15, 25, 0.95))',
          border: '1px solid var(--lab-color-primary, rgba(100, 180, 255, 0.3))',
          borderRadius: '6px',
          padding: '12px 16px',
          color: 'var(--lab-color-on_surface, #e0e0e0)',
          fontFamily: 'var(--lab-type-body-font, sans-serif)',
          fontSize: 'var(--lab-type-body-size, 13px)',
          boxShadow: 'var(--lab-elevation-5-shadow, 0 8px 32px rgba(0,0,0,0.6))',
          animation: 'overlay-slide-in 200ms var(--lab-motion-standard-easing, ease-out)',
          ...posStyles,
          ...style,
        }}
      >
        {children}
        {/* Inline keyframes */}
        <style>{`
          @keyframes overlay-slide-in {
            from { opacity: 0; transform: translate(-50%, -8px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .tactical-overlay { animation: none !important; }
          }
        `}</style>
      </div>
    </>
  );
};