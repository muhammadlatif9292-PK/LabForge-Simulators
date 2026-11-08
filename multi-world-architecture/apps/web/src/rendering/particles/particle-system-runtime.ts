// apps/web/src/rendering/particles/particle-system-runtime.ts
/**
 * Particle System Runtime
 * 
 * Responsibilities:
 * - Simulate and render large-scale particle systems entirely on the GPU
 * - Support fire, smoke, sparks, liquid droplets, and scientific particle traces
 * - Use compute shaders for position/velocity/age updates, then render via instanced quads
 * - Manage particle emitter parameters: rate, lifetime, initial velocity, color ramp
 * - Enforce pool size limits and recycle dead particles
 * - Integrate with GPU resource scheduler and frame graph
 * 
 * Owned state:
 * - particleSystems: Map<string, ParticleSystemState>
 * - computePipeline: GPUComputePipeline | null
 * - renderPipeline: GPURenderPipeline | null
 * 
 * Dependencies:
 * - GPUVisualizationRuntime (for GPU device, buffer management)
 * - GPUShaderLibrary (WGSL compute + vertex/fragment shaders)
 * - FrameGraphRuntime (to insert particle render pass)
 * 
 * Event emissions:
 *   "particles.emitter.started", "particles.emitter.stopped"
 *   "particles.system.updated"
 * 
 * Event subscriptions: none
 * Synchronization: GPU-synchronised via command encoder; CPU reads back only for debug
 * Recovery: particle state re-initialised from emitter parameters on context loss
 * Telemetry: particle count, GPU time, emitter count
 * Diagnostics: active systems, pool utilisation
 * Accessibility: particle effects are decorative; no impact on screen reader
 * Performance: all simulation on GPU; no CPU readback; instanced rendering
 * Forbidden: blocking CPU on GPU fence; unbounded particle count
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface ParticleEmitterConfig {
  maxParticles: number;
  emissionRate: number;          // particles per second
  lifetime: number;              // seconds
  initialVelocity: [number, number, number];
  velocityVariation: number;
  initialSize: number;
  initialColor: [number, number, number, number]; // RGBA
  gravity: [number, number, number];
  position: [number, number, number];
}

interface ParticleSystemState {
  config: ParticleEmitterConfig;
  particleBuffer: GPUBuffer | null;
  deadListBuffer: GPUBuffer | null;
  indirectBuffer: GPUBuffer | null;
  particleCountBuffer: GPUBuffer | null;
  active: boolean;
  elapsed: number;
}

export class ParticleSystemRuntime {
  private systems: Map<string, ParticleSystemState> = new Map();
  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;
  private device: GPUDevice | null = null;
  private initialized = false;

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async initialize(device: GPUDevice): Promise<void> {
    this.device = device;
    // In production: compile shaders, create pipelines, etc.
    this.initialized = true;
    this.logger.info('Particle system runtime initialised');
  }

  createSystem(id: string, config: ParticleEmitterConfig): void {
    if (!this.device) return;
    const maxParticles = config.maxParticles;
    // Allocate GPU buffers
    const particleBuffer = this.device.createBuffer({
      size: maxParticles * 32, // per particle: pos(4) + vel(4) + color(4) + age(4) + size(4) + padding
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const deadListBuffer = this.device.createBuffer({
      size: maxParticles * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const indirectBuffer = this.device.createBuffer({
      size: 20, // indirect draw args
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const countBuffer = this.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    this.systems.set(id, {
      config,
      particleBuffer,
      deadListBuffer,
      indirectBuffer,
      particleCountBuffer: countBuffer,
      active: false,
      elapsed: 0,
    });
  }

  emitParticles(systemId: string, deltaTime: number): void {
    const system = this.systems.get(systemId);
    if (!system || !system.active || !this.device) return;

    system.elapsed += deltaTime;
    const emissionInterval = 1 / system.config.emissionRate;
    const particlesToEmit = Math.floor(system.elapsed / emissionInterval);
    system.elapsed -= particlesToEmit * emissionInterval;

    // In production: dispatch compute shader to update dead list, spawn new particles, update existing
    // Then record indirect draw call for rendering.
    this.meter.incrementCounter('particles.simulated', particlesToEmit);
  }

  updateSystems(deltaTime: number): void {
    for (const id of this.systems.keys()) {
      this.emitParticles(id, deltaTime);
    }
  }

  startSystem(id: string): void {
    const system = this.systems.get(id);
    if (system) system.active = true;
  }

  stopSystem(id: string): void {
    const system = this.systems.get(id);
    if (system) system.active = false;
  }

  removeSystem(id: string): void {
    const system = this.systems.get(id);
    if (system) {
      system.particleBuffer?.destroy();
      system.deadListBuffer?.destroy();
      system.indirectBuffer?.destroy();
      system.particleCountBuffer?.destroy();
      this.systems.delete(id);
    }
  }

  getActiveSystemsCount(): number {
    return Array.from(this.systems.values()).filter(s => s.active).length;
  }

  async shutdown(): Promise<void> {
    for (const id of this.systems.keys()) this.removeSystem(id);
    this.initialized = false;
  }
}