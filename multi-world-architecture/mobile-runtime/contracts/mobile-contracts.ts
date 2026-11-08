// mobile-runtime/contracts/mobile-contracts.ts
/**
 * Mobile Optimization Contracts
 * 
 * Responsibilities:
 * - Define strict types for mobile memory management, thermal regulation,
 *   battery optimization, and low-end rendering
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

export enum DeviceTier {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  MINIMAL = 'minimal',
}

export enum ThermalState {
  NOMINAL = 'nominal',
  FAIR = 'fair',
  SERIOUS = 'serious',
  CRITICAL = 'critical',
}

export enum BatteryState {
  CHARGING = 'charging',
  DISCHARGING = 'discharging',
  FULL = 'full',
  LOW = 'low',       // < 20%
  CRITICAL = 'critical', // < 5%
}

export enum RenderingProfile {
  ULTRA = 'ultra',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  MINIMAL = 'minimal',
}

export interface DeviceCapabilities {
  tier: DeviceTier;
  gpuVendor: string;
  maxTextureSize: number;
  maxSamples: number;         // MSAA
  webGPUSupported: boolean;
  devicePixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  totalMemoryMB: number;      // approximate
  cpuCores: number;
}

export interface ThermalMetrics {
  state: ThermalState;
  cpuTemperature?: number;
  gpuTemperature?: number;
  lastUpdated: number;
}

export interface BatteryMetrics {
  state: BatteryState;
  level: number;              // 0-1
  charging: boolean;
  chargingTime?: number;      // seconds until full
  dischargingTime?: number;   // seconds until empty
  lastUpdated: number;
}

export interface MobileMemoryBudget {
  currentUsageBytes: number;
  peakUsageBytes: number;
  budgetBytes: number;
  warningThresholdBytes: number;
  criticalThresholdBytes: number;
}

export interface MobileHealth {
  deviceTier: DeviceTier;
  renderingProfile: RenderingProfile;
  thermalState: ThermalState;
  batteryState: BatteryState;
  memoryUsageFraction: number;
  fps: number;
  adaptiveQualityEnabled: boolean;
}