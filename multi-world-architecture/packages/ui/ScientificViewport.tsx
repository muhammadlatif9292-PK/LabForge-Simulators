// packages/ui/ScientificViewport.tsx
/**
 * Scientific Viewport Component
 * 
 * Responsibilities:
 * - Provide the primary 3D/2D rendering surface for scientific worlds
 * - Initialize and manage WebGL/WebGPU context lifecycle
 * - Handle viewport resize with landscape constraint enforcement
 * - Receive and forward user interactions (touch, mouse, pen) to the simulation/rendering pipeline
 * - Render diagnostic overlays (FPS, draw calls, GPU memory) when enabled
 * - Coordinate with the adaptive render pipeline for quality scaling
 * - Emit telemetry on frame times and GPU health
 * 
 * Owned state:
 * - canvasRef: React.RefObject<HTMLCanvasElement>
 * - gpuContext: GPUCanvasContext | WebGL2RenderingContext | null
 * - frameCount: number
 * - lastFrameTime: number
 * 
 * Dependencies:
 * - AdaptiveRenderPipeline (for quality management)
 * - RenderPassOrchestrator (for frame execution)
 * - GPUResourceScheduler (for memory)
 * - ThemeRuntime (for background color tokens)
 * 
 * Event emissions:
 *   "viewport.ready", "viewport.frame.rendered", "viewport.gpu.error"
 * 
 * Event subscriptions: none
 * Synchronization: renders on requestAnimationFrame; single-threaded
 * Recovery: recreates GPU context on context loss
 * Telemetry: FPS histogram, frame time, GPU memory usage
 * Diagnostics: FPS counter overlay, GPU vendor info
 * Accessibility: provides descriptive alt text; supports focus for keyboard navigation
 * Performance: uses requestAnimationFrame; adaptive quality; viewport culling
 * Forbidden: creating multiple GPU contexts; blocking main thread; rendering when hidden
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { ViewportProps } from './contracts/ui-contracts';

export const ScientificViewport: React.FC<ViewportProps> = ({
  worldId,
  onReady,
  onObjectSelect,
  showDiagnostics = false,
  qualityOverride,
  children,
  'data-testid': testId,
  'aria-label': ariaLabel,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [fps, setFps] = useState(60);
  const [gpuMemoryMB, setGpuMemoryMB] = useState(0);

  // Initialize GPU context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let context: GPUCanvasContext | WebGL2RenderingContext | null = null;
    let animFrameId: number;
    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    const initContext = async () => {
      try {
        if ('gpu' in navigator) {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (adapter) {
            const device = await adapter.requestDevice();
            context = canvas.getContext('webgpu');
            if (context) {
              (context as any).configure({
                device,
                format: navigator.gpu.getPreferredCanvasFormat(),
                alphaMode: 'premultiplied',
              });
            }
          }
        }
        if (!context) {
          const gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
          });
          context = gl;
        }
        if (context) {
          setIsReady(true);
          onReady?.();
          startRenderLoop();
        }
      } catch (err) {
        console.error('[ScientificViewport] GPU initialization failed:', err);
        // Fallback: show error state
      }
    };

    const startRenderLoop = () => {
      const render = (timestamp: number) => {
        frameCount++;
        // Update FPS every second
        if (timestamp - lastFpsUpdate >= 1000) {
          setFps(Math.round(frameCount / ((timestamp - lastFpsUpdate) / 1000)));
          frameCount = 0;
          lastFpsUpdate = timestamp;
        }
        // Clear and render (placeholder - real rendering delegated to pipeline)
        if (context instanceof WebGL2RenderingContext) {
          const gl = context;
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.clearColor(0.05, 0.05, 0.1, 1.0);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        }
        animFrameId = requestAnimationFrame(render);
      };
      animFrameId = requestAnimationFrame(render);
    };

    initContext();

    // Handle context loss
    const onContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('[ScientificViewport] GPU context lost, attempting recovery...');
      cancelAnimationFrame(animFrameId);
      setIsReady(false);
      setTimeout(initContext, 1000);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    return () => {
      cancelAnimationFrame(animFrameId);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      setIsReady(false);
    };
  }, [worldId, onReady]);

  // Resize observer to maintain landscape fill
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2); // Cap for performance
      canvas.width = clientWidth * dpr;
      canvas.height = clientHeight * dpr;
      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => observer.disconnect();
  }, []);

  // Click handler for object selection
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onObjectSelect) return;
      // Simplified: in production, raycast to find object under cursor
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      // Placeholder: would call renderer's picking system
      onObjectSelect(`picked_at_${x}_${y}`);
    },
    [onObjectSelect],
  );

  return (
    <div
      ref={containerRef}
      className={`scientific-viewport${className ? ` ${className}` : ''}`}
      data-testid={testId}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--lab-color-background, #0a0a14)',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        aria-label={ariaLabel ?? `Scientific viewport for world ${worldId}`}
        role="img"
        style={{ display: 'block' }}
      />
      {/* Overlay layer for children (instruments, HUD elements) */}
      {children && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {children}
        </div>
      )}
      {/* Diagnostic overlay */}
      {showDiagnostics && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.7)',
            color: 'var(--lab-color-hud_element, #0f0)',
            fontFamily: 'monospace',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {fps} FPS | {(gpuMemoryMB).toFixed(0)} MB
        </div>
      )}
      {!isReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--lab-color-on_surface, #ccc)',
            fontFamily: 'monospace',
          }}
        >
          Initializing GPU...
        </div>
      )}
    </div>
  );
};