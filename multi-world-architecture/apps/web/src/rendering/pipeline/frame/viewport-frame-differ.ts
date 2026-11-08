// apps/web/src/rendering/pipeline/frame/viewport-frame-differ.ts
/**
 * Viewport Frame Differ
 * 
 * Responsibilities:
 * - Compare current frame with previous frame to detect changed regions
 * - Compute minimal dirty rectangles to reduce rendering work
 * - Support tile-based differ for large viewports
 * - Track cumulative changes to decide full re-render
 * - Optimize rendering by only re-rendering changed parts (partial updates)
 * 
 * Owned state:
 * - previousFrameData: Uint8ClampedArray | null (pixel hash grid)
 * - tileGrid: number[][]
 * 
 * Dependencies:
 * - ILogger, IMeter
 * 
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: none (per-frame)
 * Recovery: if no previous frame, assume full re-render
 * Telemetry: diff percentage, number of dirty tiles
 * Diagnostics: dirty region visualization
 * Accessibility: N/A
 * Performance: hash-based comparison for speed; sparse updates
 * Forbidden: full pixel-by-pixel comparison (too slow); false negatives causing missed updates
 */

import type { ViewportRect, FrameDiff } from '../contracts/rendering-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';

export class ViewportFrameDiffer {
  private previousFrameHash: string | null = null;
  private tileSize = 64;
  private tileHashes: Map<string, string> = new Map(); // tile index -> hash

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  compareFrame(currentBuffer: Uint8ClampedArray, width: number, height: number): FrameDiff {
    const currentHash = this.computeSimpleHash(currentBuffer);
    if (!this.previousFrameHash) {
      this.previousFrameHash = currentHash;
      return { changedRegions: [{ x: 0, y: 0, width, height }], diffPercentage: 100, recomputeRequired: true };
    }

    if (currentHash === this.previousFrameHash) {
      return { changedRegions: [], diffPercentage: 0, recomputeRequired: false };
    }

    // Compute tile-based diff
    const changedRegions: ViewportRect[] = [];
    let changedTileCount = 0;
    const totalTiles = Math.ceil(width / this.tileSize) * Math.ceil(height / this.tileSize);

    // Simplified: divide into grid and compare tile hashes
    const tilesX = Math.ceil(width / this.tileSize);
    const tilesY = Math.ceil(height / this.tileSize);

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tileIdx = `${tx}_${ty}`;
        const tilePixels = this.extractTile(currentBuffer, tx, ty, width, height);
        const tileHash = this.computeSimpleHash(tilePixels);
        const prevTileHash = this.tileHashes.get(tileIdx);
        if (tileHash !== prevTileHash) {
          changedTileCount++;
          changedRegions.push({
            x: tx * this.tileSize,
            y: ty * this.tileSize,
            width: Math.min(this.tileSize, width - tx * this.tileSize),
            height: Math.min(this.tileSize, height - ty * this.tileSize),
          });
        }
        this.tileHashes.set(tileIdx, tileHash);
      }
    }

    this.previousFrameHash = currentHash;
    const diffPercentage = (changedTileCount / totalTiles) * 100;
    this.meter.recordHistogram('rendering.frame_diff.percentage', diffPercentage);
    return { changedRegions, diffPercentage, recomputeRequired: changedRegions.length > 0 };
  }

  private computeSimpleHash(data: Uint8ClampedArray): string {
    // Sum of all bytes as a quick hash (better: use murmur or similar)
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) { // sample every 4th pixel
      sum += data[i] + data[i + 1] + data[i + 2] + data[i + 3];
    }
    return sum.toString(16);
  }

  private extractTile(data: Uint8ClampedArray, tx: number, ty: number, width: number, height: number): Uint8ClampedArray {
    const x0 = tx * this.tileSize;
    const y0 = ty * this.tileSize;
    const tw = Math.min(this.tileSize, width - x0);
    const th = Math.min(this.tileSize, height - y0);
    const tile = new Uint8ClampedArray(tw * th * 4);
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const srcIdx = ((y0 + y) * width + (x0 + x)) * 4;
        const dstIdx = (y * tw + x) * 4;
        tile[dstIdx] = data[srcIdx];
        tile[dstIdx + 1] = data[srcIdx + 1];
        tile[dstIdx + 2] = data[srcIdx + 2];
        tile[dstIdx + 3] = data[srcIdx + 3];
      }
    }
    return tile;
  }

  reset(): void {
    this.previousFrameHash = null;
    this.tileHashes.clear();
  }
}