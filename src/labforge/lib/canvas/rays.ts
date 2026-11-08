// src/labforge/lib/canvas/rays.ts
import type { LightRay, OpticsResult } from '../physics/optics'
import type { GridConfig } from './grid'
import {
  physicsToCanvasX, physicsToCanvasY,
  drawArrow, drawDashedLine, drawLine, drawVerticalMarker
} from './grid'

export function drawPrincipalRays(
  ctx: CanvasRenderingContext2D,
  rays: LightRay[],
  cfg: GridConfig,
  opacity = 0.85
): void {
  if (!rays.length) return
  ctx.save()
  ctx.globalAlpha = opacity
  const colors = ['#f59e0b', '#10b981', '#3b82f6']
  rays.forEach((ray, idx) => {
    const color = colors[idx % colors.length]
    drawArrow(ctx, ray.start.x, ray.start.y, ray.end.x, ray.end.y, cfg, color, 6)
  })
  ctx.restore()
}

export function drawLensSymbol(
  ctx: CanvasRenderingContext2D,
  cfg: GridConfig,
  isConverging: boolean,
  heightPx?: number
): void {
  ctx.save()
  const x = physicsToCanvasX(0, cfg)
  const yTop = physicsToCanvasY(cfg.yMax * 0.9, cfg)
  const yBottom = physicsToCanvasY(cfg.yMin * 0.9, cfg)
  const h = heightPx ?? (yBottom - yTop) * 0.75
  const yCenter = (yTop + yBottom) / 2
  const yTopLens = yCenter - h / 2
  const yBottomLens = yCenter + h / 2

  ctx.beginPath()
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'
  ctx.lineWidth = 2
  if (isConverging) {
    // biconvex: two outward arcs
    const cp1x = x - 15, cp2x = x + 15
    ctx.moveTo(x, yTopLens)
    ctx.quadraticCurveTo(cp1x, yCenter, x, yBottomLens)
    ctx.moveTo(x, yTopLens)
    ctx.quadraticCurveTo(cp2x, yCenter, x, yBottomLens)
  } else {
    // biconcave: two inward arcs
    const cp1x = x + 15, cp2x = x - 15
    ctx.moveTo(x, yTopLens)
    ctx.quadraticCurveTo(cp1x, yCenter, x, yBottomLens)
    ctx.moveTo(x, yTopLens)
    ctx.quadraticCurveTo(cp2x, yCenter, x, yBottomLens)
  }
  ctx.stroke()
  ctx.restore()
}

export function drawMirrorSymbol(
  ctx: CanvasRenderingContext2D,
  cfg: GridConfig,
  isConcave: boolean,
  heightPx?: number
): void {
  ctx.save()
  const x = physicsToCanvasX(0, cfg)
  const yTop = physicsToCanvasY(cfg.yMax * 0.9, cfg)
  const yBottom = physicsToCanvasY(cfg.yMin * 0.9, cfg)
  const h = heightPx ?? (yBottom - yTop) * 0.75
  const yCenter = (yTop + yBottom) / 2
  const yTopMirror = yCenter - h / 2
  const yBottomMirror = yCenter + h / 2

  ctx.beginPath()
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 2
  if (isConcave) {
    // concave: curves to the left (toward object)
    const cpX = x - 20
    ctx.moveTo(x, yTopMirror)
    ctx.quadraticCurveTo(cpX, yCenter, x, yBottomMirror)
  } else {
    // convex: curves to the right (away from object)
    const cpX = x + 20
    ctx.moveTo(x, yTopMirror)
    ctx.quadraticCurveTo(cpX, yCenter, x, yBottomMirror)
  }
  ctx.stroke()
  // hatch lines on the back side
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  for (let i = -h/2; i <= h/2; i += 8) {
    ctx.moveTo(x + (isConcave ? -5 : 5), yCenter + i)
    ctx.lineTo(x + (isConcave ? -15 : 15), yCenter + i + 6)
  }
  ctx.stroke()
  ctx.restore()
}

export function drawObjectArrow(
  ctx: CanvasRenderingContext2D,
  objectDistMetres: number,
  objectHeightMetres: number,
  cfg: GridConfig
): void {
  const x = physicsToCanvasX(objectDistMetres, cfg)
  const yBase = physicsToCanvasY(0, cfg)
  const yTip = physicsToCanvasY(objectHeightMetres, cfg)
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(x, yBase)
  ctx.lineTo(x, yTip)
  ctx.lineTo(x - 4, yTip - 8)
  ctx.lineTo(x + 4, yTip - 8)
  ctx.fill()
  ctx.fillStyle = '#aaa'
  ctx.font = '10px sans-serif'
  ctx.fillText('Object', x + 5, yTip - 5)
  ctx.restore()
}

export function drawImageArrow(
  ctx: CanvasRenderingContext2D,
  result: OpticsResult,
  objectHeightMetres: number,
  cfg: GridConfig
): void {
  if (result.isAtInfinity) return
  const v = result.imageDistance
  const x = physicsToCanvasX(v, cfg)
  const yBase = physicsToCanvasY(0, cfg)
  const imageHeight = Math.abs(result.imageHeight)
  const yTip = result.isInverted
    ? physicsToCanvasY(-imageHeight, cfg)
    : physicsToCanvasY(imageHeight, cfg)
  ctx.save()
  ctx.fillStyle = result.isReal ? '#10b981' : '#f59e0b'
  if (!result.isReal) ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(x, yBase)
  ctx.lineTo(x, yTip)
  ctx.lineTo(x - 4, yTip - 8)
  ctx.lineTo(x + 4, yTip - 8)
  ctx.fill()
  ctx.fillStyle = result.isReal ? '#10b981' : '#f59e0b'
  ctx.font = '10px sans-serif'
  ctx.fillText(result.isReal ? 'Real image' : 'Virtual image', x + 5, yTip - 5)
  ctx.restore()
}

export function drawFocalPoints(
  ctx: CanvasRenderingContext2D,
  focalLength: number,
  cfg: GridConfig,
  isLens: boolean
): void {
  const zeroX = physicsToCanvasX(0, cfg)
  const axisY = physicsToCanvasY(0, cfg)
  ctx.save()
  ctx.fillStyle = '#ffaa44'
  ctx.font = '12px monospace'
  if (isLens) {
    // lens: F at -f, F' at +f
    const xF = physicsToCanvasX(-focalLength, cfg)
    const xFprime = physicsToCanvasX(focalLength, cfg)
    ctx.beginPath()
    ctx.arc(xF, axisY, 3, 0, 2 * Math.PI)
    ctx.fill()
    ctx.fillStyle = '#ccc'
    ctx.fillText('F', xF - 10, axisY - 3)
    ctx.beginPath()
    ctx.arc(xFprime, axisY, 3, 0, 2 * Math.PI)
    ctx.fill()
    ctx.fillText("F'", xFprime + 5, axisY - 3)
  } else {
    // mirror: F at -f (in front), C at -2f
    const xF = physicsToCanvasX(-focalLength, cfg)
    const xC = physicsToCanvasX(-2 * focalLength, cfg)
    ctx.beginPath()
    ctx.arc(xF, axisY, 3, 0, 2 * Math.PI)
    ctx.fill()
    ctx.fillStyle = '#ccc'
    ctx.fillText('F', xF - 10, axisY - 3)
    ctx.beginPath()
    ctx.arc(xC, axisY, 3, 0, 2 * Math.PI)
    ctx.fill()
    ctx.fillText('C', xC - 10, axisY - 3)
  }
  ctx.restore()
}

export function drawPrincipalAxis(
  ctx: CanvasRenderingContext2D,
  cfg: GridConfig
): void {
  ctx.save()
  ctx.setLineDash([6, 6])
  const y = physicsToCanvasY(0, cfg)
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(cfg.canvasWidth, y)
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.stroke()
  ctx.restore()
}