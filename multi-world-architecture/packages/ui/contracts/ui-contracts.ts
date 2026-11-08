// packages/ui/contracts/ui-contracts.ts
/**
 * UI Component Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for all shared UI components
 * - Provide types for viewport, panels, cards, overlays, and interactive elements
 * - Ensure consistent API across the tactical HUD layer
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

import type { ReactNode, CSSProperties } from 'react';

export type ComponentVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type HUDThemeMode = 'light' | 'dark' | 'high-contrast';

export interface BaseUIProps {
  /** Unique test identifier */
  'data-testid'?: string;
  /** ARIA label for screen readers */
  'aria-label'?: string;
  /** Additional CSS class names */
  className?: string;
  /** Inline styles (use sparingly; prefer design tokens) */
  style?: CSSProperties;
}

export interface ViewportProps extends BaseUIProps {
  /** The world ID this viewport renders */
  worldId: string;
  /** Callback when viewport is ready and rendering */
  onReady?: () => void;
  /** Callback when the user interacts with a 3D object */
  onObjectSelect?: (objectId: string) => void;
  /** Whether to show diagnostic overlays (FPS, draw calls) */
  showDiagnostics?: boolean;
  /** Rendering quality preset; overrides adaptive if set */
  qualityOverride?: 'low' | 'medium' | 'high' | 'ultra';
  /** Children injected into the viewport overlay layer */
  children?: ReactNode;
}

export interface PanelProps extends BaseUIProps {
  /** Panel title displayed in the header */
  title: string;
  /** Whether the panel can be collapsed */
  collapsible?: boolean;
  /** Initial collapsed state */
  defaultCollapsed?: boolean;
  /** Panel content */
  children?: ReactNode;
  /** Callback when panel is closed */
  onClose?: () => void;
  /** Minimum width in pixels */
  minWidth?: number;
  /** Minimum height in pixels */
  minHeight?: number;
}

export interface ButtonProps extends BaseUIProps {
  /** Visual variant */
  variant?: ComponentVariant;
  /** Size preset */
  size?: ComponentSize;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether the button shows a loading spinner */
  loading?: boolean;
  /** Icon to display before the label */
  icon?: ReactNode;
  /** Click handler */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Button label */
  children: ReactNode;
  /** Whether the button takes full width */
  fullWidth?: boolean;
  /** ARIA role override */
  role?: string;
}

export interface CardProps extends BaseUIProps {
  /** Card heading */
  title?: string;
  /** Card subtitle */
  subtitle?: string;
  /** Elevation level (0-5) */
  elevation?: number;
  /** Whether the card is interactive (hover/click effects) */
  interactive?: boolean;
  /** Click handler for interactive cards */
  onClick?: () => void;
  /** Card content */
  children: ReactNode;
  /** Optional footer content */
  footer?: ReactNode;
}

export interface OverlayProps extends BaseUIProps {
  /** Overlay visibility */
  visible: boolean;
  /** Position on screen */
  position?: 'top' | 'bottom' | 'center' | 'floating';
  /** Auto-dismiss timeout in milliseconds (0 = persistent) */
  duration?: number;
  /** Priority for stacking (higher = on top) */
  priority?: number;
  /** Callback when overlay is dismissed */
  onDismiss?: () => void;
  /** Overlay content */
  children: ReactNode;
  /** Whether to show a backdrop */
  backdrop?: boolean;
}

export interface PresencePanelProps extends BaseUIProps {
  /** List of participant display names and statuses */
  participants: Array<{
    id: string;
    displayName: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    isSpeaking?: boolean;
    handRaised?: boolean;
    instrumentFocus?: string;
  }>;
  /** Maximum number of participants to show before scrolling */
  maxVisible?: number;
  /** Callback when a participant is clicked */
  onParticipantClick?: (participantId: string) => void;
}

export interface AIStreamingPanelProps extends BaseUIProps {
  /** List of messages in the conversation */
  messages: Array<{
    id: string;
    role: 'tutor' | 'learner' | 'system';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
  }>;
  /** Whether the panel is currently receiving a stream */
  isStreaming?: boolean;
  /** Callback when user sends a message */
  onSendMessage?: (message: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Maximum number of visible messages */
  maxVisibleMessages?: number;
}

export interface AdaptiveLayoutContainerProps extends BaseUIProps {
  /** The current breakpoint (xs, sm, md, lg, xl) */
  breakpoint: string;
  /** Whether the layout is in landscape mode (always true for LABFORGE) */
  isLandscape: boolean;
  /** Children elements to arrange */
  children: ReactNode;
}

export interface ScientificDataCardProps extends BaseUIProps {
  /** Measurement value */
  value: number | string;
  /** Unit of measurement */
  unit: string;
  /** Uncertainty (±) */
  uncertainty?: number;
  /** Label describing the measurement */
  label: string;
  /** Whether the value is being streamed live */
  live?: boolean;
  /** Trend indicator */
  trend?: 'up' | 'down' | 'stable';
  /** Color for the accent bar */
  accentColor?: string;
}