// mobile-runtime/rendering/low-end-rendering-runtime.ts
/**
 * Low-End Rendering Runtime
 * 
 * Responsibilities:
 * - Detect device capabilities and assign an appropriate rendering profile
 * - Apply aggressive optimizations for low-end and minimal devices
 * - Reduce resolution, disable shadows/AA/post-processing, simplify shaders
 * - Use half-precision textures and compressed formats where available
 * - Ensure the application remains usable even on minimal hardware
 * 
 * Owned state:
 * - deviceCapabilities: DeviceCapabilities
 * - activeProfile: RenderingProfile
 * - optimizations: Set<LowEndOptimization>
 * 
 * Dependencies:
 * - ILogger, IMeter
 * - AdaptiveRenderPipeline (to apply profiles)
 * - GPUResourceScheduler (to reduce texture sizes)
 * - RenderMemoryBudgeter (to lower budget)
 * 
 * Event emissions:
 * - "mobile.rendering.profile.applied", "mobile.rendering.optimization.applied"
 * - "mobile.rendering.fallback" (when GPU features unavailable)
 * 
 * Event subscriptions:
 * - "device.capabilities.detected" (or detect on startup)
 * 
 * Synchronization: profile applied at startup; may change dynamically based on thermal/battery
 * Recovery: fall back to lower profile if rendering errors detected
 * Telemetry: current profile, optimization count
 * Diagnostics: device capabilities, active optimizations
 * Accessibility: ensure text remains readable at reduced resolution
 * Performance: all optimisations designed to increase frame rate
 * Forbidden: applying high-end features on low-tier devices
 */

import type { DeviceCapabilities, DeviceTier, RenderingProfile } from '../contracts/mobile-contracts';
import type { ILogger, IMeter } from '@labforge/observability-runtime';
import type { DistributedEventBus } from '@labforge/event-bus-runtime';
import type { AdaptiveRenderPipeline } from '@labforge/rendering-pipeline';
import type { GPUResourceScheduler } from '@labforge/rendering-pipeline';
import type { RenderMemoryBudgeter } from '@labforge/rendering-pipeline';

type LowEndOptimization =
  | 'half_resolution'
  | 'no_shadows'
  | 'no_antialiasing'
  | 'no_postprocessing'
  | 'simplified_shaders'
  | 'reduced_textures'
  | 'no_reflections'
  | 'static_lighting';

export class LowEndRenderingRuntime {
  private capabilities: DeviceCapabilities;
  private activeProfile: RenderingProfile;
  private optimizations: Set<LowEndOptimization> = new Set();

  constructor(
    private logger: ILogger,
    private meter: IMeter,
    private eventBus: DistributedEventBus,
    private renderPipeline: AdaptiveRenderPipeline,
    private resourceScheduler: GPUResourceScheduler,
    private memoryBudgeter: RenderMemoryBudgeter,
  ) {
    this.capabilities = this.detectCapabilities();
    this.activeProfile = this.determineProfile(this.capabilities.tier);
    this.applyProfile();
  }

  private detectCapabilities(): DeviceCapabilities {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    const memoryMB = (performance as any)?.memory?.jsHeapSizeLimit
      ? (performance as any).memory.jsHeapSizeLimit / 1024 / 1024
      : 1024;
    const maxTextureSize = gl?.getParameter(gl.MAX_TEXTURE_SIZE) ?? 2048;
    const gpuVendor = gl ? gl.getParameter(gl.RENDERER) : 'unknown';
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    let tier: DeviceTier = 'medium';
    if (!isMobile && maxTextureSize >= 16384 && memoryMB >= 4096) {
      tier = 'high';
    } else if (maxTextureSize <= 4096 || memoryMB <= 512) {
      tier = isMobile ? 'minimal' : 'low';
    } else if (memoryMB <= 1024) {
      tier = 'low';
    }
    return {
      tier,
      gpuVendor,
      maxTextureSize,
      maxSamples: gl?.getParameter(gl.MAX_SAMPLES) ?? 4,
      webGPUSupported: 'gpu' in navigator,
      devicePixelRatio: Math.min(window.devicePixelRatio ?? 1, 2),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      totalMemoryMB: memoryMB,
      cpuCores: navigator.hardwareConcurrency ?? 4,
    };
  }

  private determineProfile(tier: DeviceTier): RenderingProfile {
    const map: Record<DeviceTier, RenderingProfile> = {
      high: 'high',
      medium: 'medium',
      low: 'low',
      minimal: 'minimal',
    };
    return map[tier] ?? 'medium';
  }

  private applyProfile(): void {
    this.renderPipeline.setProfile(this.activeProfile);
    switch (this.activeProfile) {
      case 'minimal':
        this.optimizations = new Set(['half_resolution', 'no_shadows', 'no_antialiasing', 'no_postprocessing', 'simplified_shaders', 'reduced_textures', 'no_reflections', 'static_lighting']);
        this.memoryBudgeter.maxBudgetBytes = 32 * 1024 * 1024;
        break;
      case 'low':
        this.optimizations = new Set(['no_shadows', 'no_antialiasing', 'reduced_textures', 'simplified_shaders', 'static_lighting']);
        this.memoryBudgeter.maxBudgetBytes = 64 * 1024 * 1024;
        break;
      case 'medium':
        this.optimizations = new Set(['simplified_shaders']);
        this.memoryBudgeter.maxBudgetBytes = 128 * 1024 * 1024;
        break;
      case 'high':
      case 'ultra':
        this.optimizations = new Set();
        this.memoryBudgeter.maxBudgetBytes = 256 * 1024 * 1024;
        break;
    }
    // Apply memory limit
    // Reduce render target sizes
    const scale = this.activeProfile === 'minimal' ? 0.5 : this.activeProfile === 'low' ? 0.75 : 1;
    this.resourceScheduler['renderScale'] = scale;
    this.meter.incrementCounter('mobile.rendering.profile.applied', { profile: this.activeProfile });
    this.logger.info(`Low-end rendering profile applied: ${this.activeProfile} (tier: ${this.capabilities.tier})`);
    this.eventBus.publish('mobile.rendering.profile.applied', {
      profile: this.activeProfile,
      tier: this.capabilities.tier,
      optimizations: Array.from(this.optimizations),
    });
  }

  getCapabilities(): Readonly<DeviceCapabilities> {
    return { ...this.capabilities };
  }

  getProfile(): RenderingProfile {
    return this.activeProfile;
  }

  getOptimizations(): ReadonlySet<LowEndOptimization> {
    return this.optimizations;
  }

  isOptimizationEnabled(opt: LowEndOptimization): boolean {
    return this.optimizations.has(opt);
  }

  reduceResolution(factor: number): void {
    this.resourceScheduler['renderScale'] = Math.max(0.25, factor);
  }

  getHealth(): { profile: RenderingProfile; optimizations: LowEndOptimization[] } {
    return {
      profile: this.activeProfile,
      optimizations: Array.from(this.optimizations),
    };
  }
}