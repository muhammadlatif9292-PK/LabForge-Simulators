// src/labforge/shell/LevelBadge.tsx
import type { Level } from '../registry/types'

interface LevelBadgeProps {
  level: Level
  size?: 'sm' | 'md'
}

const levelStyles: Record<Level, { bg: string; text: string; border: string }> = {
  student: { bg: 'bg-green-400/15', text: 'text-green-400', border: 'border-green-400/30' },
  intermediate: { bg: 'bg-blue-400/15', text: 'text-blue-400', border: 'border-blue-400/30' },
  advanced: { bg: 'bg-amber-400/15', text: 'text-amber-400', border: 'border-amber-400/30' },
  expert: { bg: 'bg-red-400/15', text: 'text-red-400', border: 'border-red-400/30' },
}

export function LevelBadge({ level, size = 'sm' }: LevelBadgeProps) {
  const style = levelStyles[level]
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  const label = level.charAt(0).toUpperCase() + level.slice(1)
  return (
    <span className={`${style.bg} ${style.text} border ${style.border} rounded-full ${px} font-medium uppercase tracking-wide`}>
      {label}
    </span>
  )
}