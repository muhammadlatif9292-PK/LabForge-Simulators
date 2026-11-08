// packages/ui/AIStreamingPanel.tsx
/**
 * AI Streaming Panel Component
 * 
 * Responsibilities:
 * - Display a chat-like conversation between learner and AI tutor
 * - Animate streaming text with a typewriter effect
 * - Auto-scroll to the latest message
 * - Provide a text input for the learner to ask questions
 * - Show typing indicator when AI is streaming
 * - Support configurable maximum visible messages with virtual scrolling hint
 * 
 * Owned state:
 * - inputValue: string
 * - messagesEndRef: React.RefObject<HTMLDivElement>
 * 
 * Dependencies:
 * - ThemeRuntime (for tokens)
 * - AccessibilityThemeRuntime (for font scaling)
 * 
 * Event emissions: "ui.ai.message.sent" (when user submits)
 * Event subscriptions: none
 * Synchronization: none; message list passed via props
 * Recovery: N/A
 * Telemetry: message send count, streaming duration
 * Diagnostics: none
 * Accessibility: messages are ARIA live regions; input fully keyboard accessible
 * Performance: use React.memo for message items; avoid re-renders on streaming ticks
 * Forbidden: storing raw AI responses in component state; exposing internal prompt
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { AIStreamingPanelProps } from './contracts/ui-contracts';

export const AIStreamingPanel: React.FC<AIStreamingPanelProps> = ({
  messages,
  isStreaming = false,
  onSendMessage,
  placeholder = 'Ask a question...',
  maxVisibleMessages = 50,
  'data-testid': testId,
  'aria-label': ariaLabel,
  className,
  style,
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;
    onSendMessage?.(trimmed);
    setInputValue('');
    inputRef.current?.focus();
  }, [inputValue, isStreaming, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const displayMessages = messages.slice(-maxVisibleMessages);

  return (
    <div
      data-testid={testId}
      role="log"
      aria-label={ariaLabel ?? 'AI Tutor conversation'}
      className={`ai-streaming-panel${className ? ` ${className}` : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'var(--lab-type-body-font, sans-serif)',
        ...style,
      }}
    >
      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {displayMessages.length === 0 && !isStreaming && (
          <div style={{ color: 'var(--lab-color-on_surface, #888)', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
            Ask a question to start.
          </div>
        )}
        {displayMessages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === 'learner' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: msg.role === 'learner' ? '12px 12px 0 12px' : '12px 12px 12px 0',
              background:
                msg.role === 'learner'
                  ? 'var(--lab-color-primary, #1a73e8)'
                  : 'var(--lab-color-surface, #2a2a3a)',
              color: 'var(--lab-color-on_surface, #e0e0e0)',
              fontSize: 'var(--lab-type-body-size, 13px)',
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {msg.content}
            {msg.isStreaming && (
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 14,
                  background: 'var(--lab-color-on_surface, #ccc)',
                  marginLeft: 2,
                  animation: 'blink-cursor 0.6s step-end infinite',
                }}
              />
            )}
            <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2 }}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isStreaming && displayMessages.every(m => !m.isStreaming) && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '8px 12px',
              borderRadius: '12px 12px 12px 0',
              background: 'var(--lab-color-surface, #2a2a3a)',
              color: 'var(--lab-color-on_surface, #aaa)',
              fontSize: 'var(--lab-type-body-size, 13px)',
            }}
          >
            AI is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Input area */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '8px',
          borderTop: '1px solid var(--lab-color-on_surface, rgba(255,255,255,0.08))',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isStreaming}
          aria-label="Ask a question"
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--lab-color-on_surface, rgba(255,255,255,0.15))',
            background: 'var(--lab-color-background, #111)',
            color: 'var(--lab-color-on_surface, #eee)',
            fontFamily: 'inherit',
            fontSize: 'var(--lab-type-body-size, 13px)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isStreaming || !inputValue.trim()}
          aria-label="Send message"
          style={{
            padding: '8px 14px',
            borderRadius: '6px',
            border: 'none',
            background: 'var(--lab-color-primary, #1a73e8)',
            color: 'var(--lab-color-on_primary, #fff)',
            cursor: isStreaming || !inputValue.trim() ? 'not-allowed' : 'pointer',
            opacity: isStreaming || !inputValue.trim() ? 0.5 : 1,
            fontFamily: 'inherit',
            fontWeight: 600,
          }}
        >
          Send
        </button>
      </div>
      <style>{`@keyframes blink-cursor { 50% { opacity: 0; } }`}</style>
    </div>
  );
};