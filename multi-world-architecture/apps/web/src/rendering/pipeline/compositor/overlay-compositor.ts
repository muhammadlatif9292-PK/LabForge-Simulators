// apps/web/src/rendering/pipeline/compositor/overlay-compositor.ts
/**
 * Overlay Compositor
 * 
 * Responsibilities:
 * - Composite HUD overlays, AI responses, collaboration indicators on top of 3D scene
 * - Manage z-order and transparency of overlay elements
 * - Support dynamic overlay injection and removal
 * - Ensure overlays do not block interactive elements underneath (hit testing)
 * - Render overlays using a separate pass for performance isolation
 * 
 * Owned state:
 * - overlayPasses: Map<string, OverlayDescriptor>
 * - dirty: boolean
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - FrameGraphRuntime (to insert overlay pass)
 * - ShaderExecutionRuntime (for overlay shaders)
 * 
 * Event emissions: none
 * Event subscriptions: "hud.update", "ai.overlay.show", "collaboration.presence" to update overlays
 * Synchronization: none; updated from main thread
 * Recovery: overlays rebuilt each frame; no persistent state
 * Telemetry: overlay count, GPU time for overlay pass
 * Diagnostics: visible overlay list
 * Accessibility: overlay text is screen-readable
 * Performance: separate render pass avoids polluting main pass
 * Forbidden: overlays causing main scene re-renders; blocking user interaction
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { FrameGraphRuntime } from '../frame/frame-graph-runtime';
import type { RenderPassDescriptor } from '../contracts/rendering-contracts';

interface OverlayDescriptor {
  id: string;
  type: 'hud' | 'ai' | 'collaboration' | 'debug';
  content: any;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  visible: boolean;
  opacity: number;
}

export class OverlayCompositor {
  private overlays: Map<string, OverlayDescriptor> = new Map();
  private dirty = true;

  constructor(
    private frameGraph: FrameGraphRuntime,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  addOrUpdateOverlay(id: string, descriptor: Omit<OverlayDescriptor, 'id'>): void {
    this.overlays.set(id, { ...descriptor, id });
    this.dirty = true;
  }

  removeOverlay(id: string): void {
    this.overlays.delete(id);
    this.dirty = true;
  }

  getPassDescriptor(): RenderPassDescriptor | null {
    if (this.overlays.size === 0) return null;
    const sorted = Array.from(this.overlays.values()).sort((a, b) => a.zIndex - b.zIndex);
    // In a real engine, we'd construct a render pass that draws these overlays as quads
    // For now, return a simple pass descriptor
    return {
      id: 'overlay-pass' as any,
      type: 'overlay',
      shaders: [
        {
          shaderId: 'overlay-quad' as any,
          vertexEntry: 'vs_main',
          fragmentEntry: 'fs_main',
          uniforms: {},
          textures: [],
        },
      ],
      inputs: [],
      outputs: [{ textureId: 'overlay-output' as any, format: 'rgba8', mipLevel: 0 }],
      executionOrder: 100, // always last
    };
  }

  getOverlayCount(): number {
    return this.overlays.size;
  }
}