// apps/web/src/rendering/pipeline/contracts/rendering-contracts.ts
/**
 * Rendering Pipeline Contracts
 * 
 * Responsibilities:
 * - Define strict interfaces for the rendering pipeline
 * - Provide types for frames, passes, GPU resources, and overlays
 * 
 * Owned state: none (pure types)
 * Dependencies: none
 * Event emissions: none
 * Event subscriptions: none
 * Synchronization: n/a
 * Recovery: n/a
 * Telemetry: n/a
 * Diagnostics: n/a
 * Accessibility: n/a
 * Performance: zero runtime overhead
 * Forbidden: any implementation logic
 */

export type FrameId = string;
export type PassId = string;
export type ShaderId = string;
export type TextureId = string;
export type GPUBufferId = string;
export type PipelineId = string;

export interface FrameDescriptor {
  id: FrameId;
  timestamp: number;
  sequenceNumber: number;
  width: number;
  height: number;
  pixelRatio: number;
  passes: RenderPassDescriptor[];
  metadata: Record<string, unknown>;
}

export interface RenderPassDescriptor {
  id: PassId;
  type: 'opaque' | 'transparent' | 'overlay' | 'postprocess' | 'debug';
  shaders: ShaderBindDescriptor[];
  inputs: TextureReference[];
  outputs: TextureReference[];
  clearColor?: [number, number, number, number];
  depthClear?: number;
  viewport?: ViewportRect;
  scissor?: ViewportRect;
  executionOrder: number;
}

export interface ShaderBindDescriptor {
  shaderId: ShaderId;
  vertexEntry: string;
  fragmentEntry: string;
  uniforms: Record<string, UniformValue>;
  textures: TextureBinding[];
}

export interface TextureReference {
  textureId: TextureId;
  width?: number;
  height?: number;
  format: 'rgba8' | 'depth24' | 'rgba16f' | 'r8';
  mipLevel: number;
}

export interface TextureBinding {
  name: string;
  textureId: TextureId;
  samplerType: 'linear' | 'nearest' | 'anisotropic';
}

export type UniformValue = number | [number, number] | [number, number, number] | [number, number, number, number] | Float32Array;

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GPUResourceHandle {
  id: TextureId | GPUBufferId;
  sizeBytes: number;
  lastUsedFrame: number;
  type: 'texture' | 'buffer';
}

export interface FrameGraphNode {
  pass: RenderPassDescriptor;
  dependencies: PassId[];
  dependents: PassId[];
}

export interface RenderPipelineConfig {
  maxFPS: number;
  lowEndMode: boolean;
  enableOverlays: boolean;
  memoryBudgetMB: number;
  enableDiagnostics: boolean;
}

export interface FrameDiff {
  changedRegions: ViewportRect[];
  diffPercentage: number;
  recomputeRequired: boolean;
}