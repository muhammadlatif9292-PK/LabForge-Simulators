// packages/ui/RealtimePresencePanel.tsx
/**
 * Realtime Presence Panel Component
 * 
 * Responsibilities:
 * - Display a list of participants in the current collaboration session
 * - Show online/away/busy/offline status with appropriate indicators
 * - Indicate speaking state with an animated border/glyph
 * - Indicate hand raised state with a badge
 * - Support click to focus on a participant's instrument
 * - Enforce a maximum visible count with overflow scrolling
 * 
 * Owned state:
 * - scrollableListRef: React.RefObject<HTMLDivElement>
 * 
 * Dependencies:
 * - ThemeRuntime (for color tokens)
 * - MotionOrchestrator (for speaking animation)
 * 
 * Event emissions: "ui.participant.clicked" (when user clicks a participant)
 * Event subscriptions: none
 * Synchronization: renders from props; no internal sync
 * Recovery: N/A
 * Telemetry: participant click count
 * Diagnostics: none
 * Accessibility: each participant entry is a button with descriptive label
 * Performance: virtualized list if participants exceed maxVisible (simplified)
 * Forbidden: leaking participant IDs or personal data in DOM
 */

import React, { useRef } from 'react';
import type { PresencePanelProps } from './contracts/ui-contracts';

const STATUS_COLORS: Record<string, string> = {
  online: '#4caf50',
  away: '#ff9800',
  busy: '#f44336',
  offline: '#666',
};

export const RealtimePresencePanel: React.FC<PresencePanelProps> = ({
  participants,
  maxVisible = 15,
  onParticipantClick,
  'data-testid': testId,
  'aria-label': ariaLabel,
  className,
  style,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const displayList = participants.slice(0, maxVisible);

  const handleClick = (id: string) => {
    onParticipantClick?.(id);
  };

  return (
    <div
      data-testid={testId}
      role="list"
      aria-label={ariaLabel ?? 'Participants'}
      className={`realtime-presence-panel${className ? ` ${className}` : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        ...style,
      }}
    >
      {displayList.length === 0 && (
        <div style={{ color: 'var(--lab-color-on_surface, #888)', fontSize: 12, padding: '8px 0' }}>
          No participants
        </div>
      )}
      {displayList.map((participant) => (
        <button
          key={participant.id}
          type="button"
          role="listitem"
          onClick={() => handleClick(participant.id)}
          aria-label={`${participant.displayName} - ${participant.status}${participant.handRaised ? ', hand raised' : ''}${participant.isSpeaking ? ', speaking' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 8px',
            background: 'transparent',
            border: participant.isSpeaking
              ? '1px solid var(--lab-color-primary, #4a9eff)'
              : '1px solid transparent',
            borderRadius: '4px',
            cursor: 'pointer',
            color: 'var(--lab-color-on_surface, #ddd)',
            fontFamily: 'var(--lab-type-hud_label-font, monospace)',
            fontSize: 12,
            textAlign: 'left',
            width: '100%',
            transition: 'border-color 150ms ease',
          }}
        >
          {/* Status dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: STATUS_COLORS[participant.status] ?? '#666',
              flexShrink: 0,
              ...(participant.isSpeaking && {
                animation: 'pulse-speaking 1s ease-in-out infinite',
              }),
            }}
          />
          {/* Name */}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {participant.displayName}
          </span>
          {/* Instrument focus */}
          {participant.instrumentFocus && (
            <span style={{ fontSize: 10, color: 'var(--lab-color-scientific_highlight, #8ab4f8)', opacity: 0.8 }}>
              {participant.instrumentFocus}
            </span>
          )}
          {/* Hand raised badge */}
          {participant.handRaised && (
            <span style={{ fontSize: 14 }} aria-hidden="true">
              ✋
            </span>
          )}
        </button>
      ))}
      {participants.length > maxVisible && (
        <div style={{ fontSize: 10, color: '#888', textAlign: 'center', padding: '4px 0' }}>
          +{participants.length - maxVisible} more
        </div>
      )}
      <style>{`@keyframes pulse-speaking { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
};