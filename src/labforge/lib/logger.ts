// src/labforge/lib/logger.ts
/**
 * LabForge structured logger.
 * Use this everywhere instead of console.log / console.error.
 * In production, swap the bodies to send to a telemetry service.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level:   LogLevel
  module:  string
  message: string
  data?:   unknown
  ts:      number   // Date.now()
}

const ICONS: Record<LogLevel, string> = {
  debug: '🔍',
  info:  'ℹ️',
  warn:  '⚠️',
  error: '❌',
}

function log(level: LogLevel, module: string, message: string, data?: unknown): void {
  const entry: LogEntry = { level, module, message, data, ts: Date.now() }
  const line = `${ICONS[level]} [${module}] ${message}`

  switch (level) {
    case 'debug': console.debug(line, ...(data !== undefined ? [data] : [])); break
    case 'info':  console.info(line,  ...(data !== undefined ? [data] : [])); break
    case 'warn':  console.warn(line,  ...(data !== undefined ? [data] : [])); break
    case 'error': console.error(line, ...(data !== undefined ? [data] : [])); break
  }
}

export const logger = {
  debug: (module: string, msg: string, data?: unknown): void => log('debug', module, msg, data),
  info:  (module: string, msg: string, data?: unknown): void => log('info',  module, msg, data),
  warn:  (module: string, msg: string, data?: unknown): void => log('warn',  module, msg, data),
  error: (module: string, msg: string, data?: unknown): void => log('error', module, msg, data),
}