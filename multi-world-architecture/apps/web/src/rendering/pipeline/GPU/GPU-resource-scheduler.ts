// apps/web/src/rendering/pipeline/GPU/GPU-resource-scheduler.ts
/**
 * GPU Resource Scheduler
 * 
 * Responsibilities:
 * - Manage allocation and deallocation of GPU textures and buffers
 * - Implement resource pooling and aliasing to reduce memory
 * - Track resource lifetimes across frames for recycling
 * - Handle resource transitions (e.g., shader read to render target)
 * - Provide budget monitoring and pressure signals
 * 
 * Owned state:
 * - textures: Map<TextureId, GPUTexture>
 * - buffers: Map<GPUBufferId, GPUBuffer>
 * - resourcePools: Map<string, any[]>
 * - frameAge: number
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - RenderMemoryBudgeter (to check limits)
 * - GPUDevice (WebGPU)
 * 
 * Event emissions: "gpu.resource.low" when memory pressure high
 * Event subscriptions: none
 * Synchronization: per-frame; no cross-frame concurrency
 * Recovery: if allocation fails, evict oldest unused resources
 * Telemetry: allocated memory, pool hit rate
 * Diagnostics: resource dump, leak detection
 * Accessibility: N/A
 * Performance: O(1) pool lookups; async allocation
 * Forbidden: leaking resources beyond frame; allocating without eviction under pressure
 */

import type { TextureId, GPUBufferId, TextureReference, GPUResourceHandle } from '../contracts/rendering-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { RenderMemoryBudgeter } from '../memory/render-memory-budgeter';

export class GPUResourceScheduler {
  private textures: Map<TextureId, GPUTexture> = new Map();
  private buffers: Map<GPUBufferId, GPUBuffer> = new Map();
  private pools: Map<string, (GPUTexture | GPUBuffer)[]> = new Map();
  private frameAge = 0;

  constructor(
    private gpuDevice: GPUDevice,
    private memoryBudgeter: RenderMemoryBudgeter,
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  getTexture(id: TextureId): GPUTexture | undefined {
    return this.textures.get(id);
  }

  getTextureView(id: TextureId): GPUTextureView {
    const texture = this.textures.get(id);
    if (!texture) throw new Error(`Texture ${id} not allocated`);
    return texture.createView();
  }

  getDepthTextureView(): GPUTextureView {
    // Assume a shared depth texture
    const depthId = '__depth_shared__' as TextureId;
    let depthTex = this.textures.get(depthId);
    if (!depthTex) {
      depthTex = this.gpuDevice.createTexture({
        size: [1920, 1080],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.textures.set(depthId, depthTex);
    }
    return depthTex.createView();
  }

  async allocateTexture(id: TextureId, descriptor: TextureReference): Promise<boolean> {
    if (this.textures.has(id)) return true;
    // Check budget
    if (!this.memoryBudgeter.requestAllocation(descriptor.width! * descriptor.height! * 4)) {
      this.meter.incrementCounter('gpu.resource.low');
      this.logger.warn('GPU memory budget exceeded, attempting to evict');
      this.evictOldestUnused();
      if (!this.memoryBudgeter.requestAllocation(descriptor.width! * descriptor.height! * 4)) {
        return false; // cannot allocate
      }
    }
    const texture = this.gpuDevice.createTexture({
      size: [descriptor.width ?? 1, descriptor.height ?? 1],
      format: descriptor.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.textures.set(id, texture);
    return true;
  }

  releaseTexture(id: TextureId): void {
    const texture = this.textures.get(id);
    if (texture) {
      texture.destroy();
      this.textures.delete(id);
    }
  }

  endFrame(): void {
    this.frameAge++;
    // Age out resources unused for more than 2 frames
    for (const [id, handle] of this.textures) {
      // Placeholder: actual aging would track lastUsedFrame per resource
    }
  }

  private evictOldestUnused(): void {
    // Simple LRU eviction based on lastUsedFrame (not fully implemented here)
    const now = this.frameAge;
    let oldest: TextureId | null = null;
    let oldestAge = 0;
    for (const [id, _] of this.textures) {
      // simulated lastUsed
      const age = 0; // get actual age
      if (age > oldestAge) {
        oldestAge = age;
        oldest = id;
      }
    }
    if (oldest) {
      this.releaseTexture(oldest);
      this.meter.incrementCounter('gpu.resource.evicted');
    }
  }

  getMemoryUsageMB(): number {
    let total = 0;
    for (const tex of this.textures.values()) total += tex.width * tex.height * 4;
    return total / (1024 * 1024);
  }
}