// src/core/units-system.ts
type Unit = "mm" | "cm" | "m" | "km" | "A" | "V" | "Ω" | "pH";

const conversions: Record<Unit, Record<Unit, number>> = {
  mm: { mm: 1, cm: 0.1, m: 0.001, km: 0.000001 },
  cm: { mm: 10, cm: 1, m: 0.01, km: 0.00001 },
  m: { mm: 1000, cm: 100, m: 1, km: 0.001 },
  km: { mm: 1e6, cm: 1e5, m: 1000, km: 1 },
  A: { A: 1 },
  V: { V: 1 },
  Ω: { Ω: 1 },
  pH: { pH: 1 },
};

export function convert(value: number, from: Unit, to: Unit): number {
  if (!conversions[from] || !conversions[from][to]) {
    throw new Error(`Conversion from ${from} to ${to} not supported`);
  }
  return value * conversions[from][to];
}

export function normalize(value: number, unit: Unit, targetUnit: Unit): number {
  return convert(value, unit, targetUnit);
}