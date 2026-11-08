// src/labforge/lib/canvas/grid.ts
export interface GridConfig {
  canvasWidth: number; canvasHeight: number; xMin: number; xMax: number; yMin: number; yMax: number;
  gridColor?: string; axisColor?: string; labelColor?: string; backgroundColor?: string;
  tickSpacingX?: number; tickSpacingY?: number; fontSize?: number; labelUnitX?: string;
  labelUnitY?: string; xAxisLabel?: string; yAxisLabel?: string;
}

export function physicsToCanvasX(px: number, cfg: GridConfig): number {
  return ((px - cfg.xMin) / (cfg.xMax - cfg.xMin)) * cfg.canvasWidth
}
export function physicsToCanvasY(py: number, cfg: GridConfig): number {
  return cfg.canvasHeight - ((py - cfg.yMin) / (cfg.yMax - cfg.yMin)) * cfg.canvasHeight
}
export function canvasToPhysicsX(cx: number, cfg: GridConfig): number {
  return cfg.xMin + (cx / cfg.canvasWidth) * (cfg.xMax - cfg.xMin)
}
export function canvasToPhysicsY(cy: number, cfg: GridConfig): number {
  return cfg.yMin + ((cfg.canvasHeight - cy) / cfg.canvasHeight) * (cfg.yMax - cfg.yMin)
}

export function drawGrid(ctx: CanvasRenderingContext2D, cfg: GridConfig): void {
  ctx.save()
  const bgColor = cfg.backgroundColor ?? '#0f172a'
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, cfg.canvasWidth, cfg.canvasHeight)

  const gridColor = cfg.gridColor ?? 'rgba(255,255,255,0.06)'
  const axisColor = cfg.axisColor ?? 'rgba(255,255,255,0.3)'
  const labelColor = cfg.labelColor ?? 'rgba(255,255,255,0.5)'
  const tickX = cfg.tickSpacingX ?? (cfg.xMax - cfg.xMin) / 5
  const tickY = cfg.tickSpacingY ?? (cfg.yMax - cfg.yMin) / 5

  ctx.beginPath()
  ctx.strokeStyle = gridColor
  ctx.lineWidth = 1
  for (let x = Math.ceil(cfg.xMin / tickX) * tickX; x <= cfg.xMax; x += tickX) {
    const cx = physicsToCanvasX(x, cfg)
    ctx.moveTo(cx, 0); ctx.lineTo(cx, cfg.canvasHeight)
  }
  for (let y = Math.ceil(cfg.yMin / tickY) * tickY; y <= cfg.yMax; y += tickY) {
    const cy = physicsToCanvasY(y, cfg)
    ctx.moveTo(0, cy); ctx.lineTo(cfg.canvasWidth, cy)
  }
  ctx.stroke()

  ctx.beginPath()
  ctx.strokeStyle = axisColor
  const x0 = physicsToCanvasX(0, cfg)
  ctx.moveTo(x0, 0); ctx.lineTo(x0, cfg.canvasHeight)
  const y0 = physicsToCanvasY(0, cfg)
  ctx.moveTo(0, y0); ctx.lineTo(cfg.canvasWidth, y0)
  ctx.stroke()

  ctx.font = `${cfg.fontSize ?? 11}px sans-serif`
  ctx.fillStyle = labelColor
  for (let x = Math.ceil(cfg.xMin / tickX) * tickX; x <= cfg.xMax; x += tickX) {
    const cx = physicsToCanvasX(x, cfg)
    ctx.fillText(x.toFixed(1), cx - 10, y0 + 12)
  }
  for (let y = Math.ceil(cfg.yMin / tickY) * tickY; y <= cfg.yMax; y += tickY) {
    const cy = physicsToCanvasY(y, cfg)
    ctx.fillText(y.toFixed(1), x0 + 5, cy + 3)
  }
  ctx.restore()
}

export function drawDataPoint(ctx: CanvasRenderingContext2D, px: number, py: number, cfg: GridConfig, color = 'rgb(16,185,129)', radius = 4): void {
  ctx.save()
  ctx.fillStyle = color
  const cx = physicsToCanvasX(px, cfg)
  const cy = physicsToCanvasY(py, cfg)
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI)
  ctx.fill()
  ctx.restore()
}

export function drawLine(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, cfg: GridConfig, color = 'rgb(16,185,129)', lineWidth = 2): void {
  if (points.length < 2) return
  ctx.save()
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  const first = points[0]
  ctx.moveTo(physicsToCanvasX(first.x, cfg), physicsToCanvasY(first.y, cfg))
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(physicsToCanvasX(points[i].x, cfg), physicsToCanvasY(points[i].y, cfg))
  }
  ctx.stroke()
  ctx.restore()
}

export function drawDashedLine(ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>, cfg: GridConfig, color = 'rgb(16,185,129)', lineWidth = 2, dashPattern = [6, 4]): void {
  ctx.save()
  ctx.setLineDash(dashPattern)
  drawLine(ctx, points, cfg, color, lineWidth)
  ctx.restore()
}

export function drawVerticalMarker(ctx: CanvasRenderingContext2D, physicsX: number, cfg: GridConfig, color: string, label?: string): void {
  ctx.save()
  const cx = physicsToCanvasX(physicsX, cfg)
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, cfg.canvasHeight)
  ctx.stroke()
  if (label) {
    ctx.fillStyle = color
    ctx.font = '12px sans-serif'
    ctx.fillText(label, cx + 5, physicsToCanvasY(0, cfg) - 5)
  }
  ctx.restore()
}

export function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, cfg: GridConfig, color: string, arrowHeadSize = 8): void {
  ctx.save()
  const fromX = physicsToCanvasX(x1, cfg), fromY = physicsToCanvasY(y1, cfg)
  const toX = physicsToCanvasX(x2, cfg), toY = physicsToCanvasY(y2, cfg)
  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(toX, toY)
  ctx.stroke()
  const angle = Math.atan2(toY - fromY, toX - fromX)
  const aX = toX - arrowHeadSize * Math.cos(angle - Math.PI / 6)
  const aY = toY - arrowHeadSize * Math.sin(angle - Math.PI / 6)
  const bX = toX - arrowHeadSize * Math.cos(angle + Math.PI / 6)
  const bY = toY - arrowHeadSize * Math.sin(angle + Math.PI / 6)
  ctx.beginPath()
  ctx.moveTo(toX, toY)
  ctx.lineTo(aX, aY)
  ctx.lineTo(bX, bY)
  ctx.fill()
  ctx.restore()
}

export function clearCanvas(ctx: CanvasRenderingContext2D, cfg: GridConfig): void {
  ctx.fillStyle = cfg.backgroundColor ?? '#0f172a'
  ctx.fillRect(0, 0, cfg.canvasWidth, cfg.canvasHeight)
}