// packages/contracts/src/schemas/measurement-schemas.ts
/**
 * Measurement & Scientific Data Schemas (Zod)
 * 
 * Responsibilities:
 * - Validate scientific measurements, units, and calibration data
 * - Enforce dimensional consistency rules
 * - Guarantee serializable format for offline storage
 */

import { z } from 'zod';

export const MetricPrefixSchema = z.enum([
  'yotta', 'zetta', 'exa', 'peta', 'tera', 'giga', 'mega', 'kilo',
  'hecto', 'deka', 'none', 'deci', 'centi', 'milli', 'micro',
  'nano', 'pico', 'femto', 'atto', 'zepto', 'yocto',
]);

export const UnitDimensionSchema = z.enum([
  'length', 'mass', 'time', 'electric_current', 'temperature',
  'amount_of_substance', 'luminous_intensity', 'plane_angle',
  'solid_angle', 'dimensionless',
]);

export const UnitDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  symbol: z.string().min(1),
  dimension: UnitDimensionSchema,
  system: z.enum(['si', 'imperial', 'cgs', 'astronomical', 'custom']),
  baseFactor: z.number(),
  offset: z.number().default(0),
  prefixes: z.array(MetricPrefixSchema).default(['none']),
});

export const ScientificMeasurementSchema = z.object({
  id: z.string().min(1),
  value: z.number(),
  unit: z.string().min(1),
  standardUncertainty: z.number().min(0).default(0),
  timestamp: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
});

export const CalibrationPointSchema = z.object({
  reference: z.number(),
  measured: z.number(),
  timestamp: z.number().int().positive(),
});

export const CalibrationModelSchema = z.object({
  slope: z.number(),
  intercept: z.number(),
  rSquared: z.number().min(0).max(1),
  validUntil: z.number().int().positive(),
  points: z.array(CalibrationPointSchema).min(2, 'At least two calibration points required'),
});

export const BeakerContentsSchema = z.object({
  substances: z.array(z.object({
    substanceId: z.string(),
    name: z.string(),
    amount: z.number(),
    concentration: z.number(),
    temperature: z.number(),
  })),
  totalVolume: z.number().positive(),
  pH: z.number(),
});

export const SpectrometerReadingSchema = z.object({
  wavelengths: z.array(z.number()),
  intensities: z.array(z.number()),
  peaks: z.array(z.object({
    wavelength: z.number(),
    intensity: z.number(),
  })),
  integrationTime: z.number().int().positive(),
});

export const OscilloscopeFrameSchema = z.object({
  timeBase: z.tuple([z.number(), z.number()]),
  voltageScale: z.tuple([z.number(), z.number()]),
  samples: z.array(z.object({
    time: z.number(),
    voltage: z.number(),
  })),
  triggerLevel: z.number(),
  sampleRate: z.number().int().positive(),
});

export type ScientificMeasurement = z.infer<typeof ScientificMeasurementSchema>;
export type CalibrationModel = z.infer<typeof CalibrationModelSchema>;
export type BeakerContents = z.infer<typeof BeakerContentsSchema>;
export type SpectrometerReading = z.infer<typeof SpectrometerReadingSchema>;
export type OscilloscopeFrame = z.infer<typeof OscilloscopeFrameSchema>;