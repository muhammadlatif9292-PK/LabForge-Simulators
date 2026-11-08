// apps/web/src/rendering/lighting/lighting-runtime.ts
/**
 * Lighting Runtime
 * 
 * Responsibilities:
 * - Manage scene lighting: ambient, directional (sun), point, spot lights
 * - Compute shadow maps for directional and spot lights
 * - Provide lighting data as GPU uniform buffers for shader consumption
 * - Support day/night cycle and scientific environment lighting
 * - Integrate with frame graph as a lighting pass
 * 
 * Owned state:
 * - lights: (AmbientLight | DirectionalLight | PointLight | SpotLight)[]
 * - shadowMaps: Map<string, GPUTexture>
 * - lightUniformBuffer: GPUBuffer | null
 * 
 * Dependencies:
 * - GPUVisualizationRuntime (device, buffers)
 * - ShaderLibrary (shadow map shaders)
 * 
 * Event emissions: "lighting.changed", "shadow.map.updated"
 * Event subscriptions: "world.time.changed" (for day/night cycle)
 * Synchronization: single-threaded; uniform buffer updated per frame
 * Recovery: re-create shadow maps and uniform buffer on context loss
 * Telemetry: active light count, shadow map resolution, GPU memory used
 * Diagnostics: light list, shadow map status
 * Accessibility: N/A
 * Performance: shadow maps rendered at half resolution; cascade for directional
 * Forbidden: exceeding GPU memory with too many shadow maps; blocking frame loop
 */

import type { ILogger, IMeter } from '@labforge/observability-runtime';

interface AmbientLight {
  type: 'ambient';
  color: [number, number, number];
  intensity: number;
}

interface DirectionalLight {
  type: 'directional';
  direction: [number, number, number];
  color: [number, number, number];
  intensity: number;
  castShadows: boolean;
}

interface PointLight {
  type: 'point';
  position: [number, number, number];
  color: [number, number, number];
  intensity: number;
  radius: number;
}

interface SpotLight {
  type: 'spot';
  position: [number, number, number];
  direction: [number, number, number];
  color: [number, number, number];
  intensity: number;
  innerAngle: number;
  outerAngle: number;
  castShadows: boolean;
}

type Light = AmbientLight | DirectionalLight | PointLight | SpotLight;

export class LightingRuntime {
  private lights: Light[] = [];
  private shadowMaps: Map<string, GPUTexture> = new Map();
  private lightUbo: GPUBuffer | null = null;
  private device: GPUDevice | null = null;
  private readonly LIGHT_UBO_SIZE = 256; // enough for several lights

  constructor(
    private logger: ILogger,
    private meter: IMeter,
  ) {}

  async initialize(device: GPUDevice): Promise<void> {
    this.device = device;
    this.lightUbo = device.createBuffer({
      size: this.LIGHT_UBO_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    // Add default ambient + directional light
    this.addLight({ type: 'ambient', color: [0.2, 0.2, 0.25], intensity: 0.5 });
    this.addLight({
      type: 'directional',
      direction: [0.5, -0.8, 0.3],
      color: [1.0, 0.98, 0.95],
      intensity: 1.2,
      castShadows: true,
    });
  }

  addLight(light: Light): void {
    this.lights.push(light);
    if (light.type === 'directional' && light.castShadows) {
      this.allocateShadowMap('directional');
    }
    this.updateUniformBuffer();
    this.meter.incrementCounter('lighting.light.added', { type: light.type });
  }

  removeLight(index: number): void {
    this.lights.splice(index, 1);
    this.updateUniformBuffer();
  }

  setDayNightCycle(hour: number): void {
    // Simplified sun cycle: intensity varies sinusoidally
    const sunAngle = (hour - 6) * Math.PI / 12;
    const intensity = Math.max(0, Math.sin(sunAngle));
    // Find directional light and update
    const sunLight = this.lights.find(l => l.type === 'directional') as DirectionalLight | undefined;
    if (sunLight) {
      sunLight.intensity = 1.2 * intensity;
      sunLight.direction = [0.5, Math.sin(sunAngle), 0.3];
      this.updateUniformBuffer();
    }
    this.meter.incrementCounter('lighting.day_night_updated');
  }

  getLights(): ReadonlyArray<Light> {
    return this.lights;
  }

  getLightUBO(): GPUBuffer | null {
    return this.lightUbo;
  }

  renderShadowMaps(encoder: GPUCommandEncoder): void {
    // In production: render scene from light's perspective into shadow map textures
    // This is a placeholder for the shadow pass.
  }

  private updateUniformBuffer(): void {
    if (!this.device || !this.lightUbo) return;
    // Pack light data into uniform buffer (simplified)
    const data = new Float32Array(this.LIGHT_UBO_SIZE / 4);
    let offset = 0;
    for (const light of this.lights) {
      if (offset + 12 > data.length) break;
      if (light.type === 'directional') {
        data[offset++] = 1; // type tag: directional
        data[offset++] = light.direction[0];
        data[offset++] = light.direction[1];
        data[offset++] = light.direction[2];
        data[offset++] = light.color[0];
        data[offset++] = light.color[1];
        data[offset++] = light.color[2];
        data[offset++] = light.intensity;
        offset += 1; // padding
      } else if (light.type === 'ambient') {
        data[offset++] = 0;
        data[offset++] = light.color[0];
        data[offset++] = light.color[1];
        data[offset++] = light.color[2];
        data[offset++] = light.intensity;
        offset += 2; // padding
      }
    }
    this.device.queue.writeBuffer(this.lightUbo, 0, data);
  }

  private allocateShadowMap(id: string): void {
    if (!this.device || this.shadowMaps.has(id)) return;
    const texture = this.device.createTexture({
      size: [1024, 1024],
      format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.shadowMaps.set(id, texture);
  }

  getShadowMap(id: string): GPUTexture | undefined {
    return this.shadowMaps.get(id);
  }

  async shutdown(): Promise<void> {
    for (const tex of this.shadowMaps.values()) tex.destroy();
    this.shadowMaps.clear();
    this.lightUbo?.destroy();
    this.lights = [];
  }
}