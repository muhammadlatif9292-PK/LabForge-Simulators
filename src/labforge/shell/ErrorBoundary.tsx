// src/labforge/shell/ErrorBoundary.tsx
'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '../lib/logger'

interface Props {
  children: ReactNode
  instrumentName: string
  onReset: () => void
}

interface State {
  hasError: boolean
  errorMsg: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('ErrorBoundary', `Instrument crashed: ${error.message}`, {
      instrument: this.props.instrumentName,
      stack: info.componentStack,
    })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%',
        background: '#09090b', color: '#f1f5f9',
        gap: 16, padding: 32, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f1f5f9' }}>
          {this.props.instrumentName} encountered an error
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', maxWidth: 400 }}>
          {this.state.errorMsg || 'An unexpected error occurred in this instrument.'}
        </p>
        <button
          onClick={this.props.onReset}
          style={{
            marginTop: 8, padding: '10px 24px',
            background: '#10b981', border: 'none', borderRadius: 8,
            color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          }}
        >
          ← Back to Library
        </button>
      </div>
    )
  }
}