// src/utils/format.ts
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

export function formatSI(value: number, unit: string, decimals: number = 3): string {
  if (isNaN(value)) return "—";
  if (!isFinite(value)) return value > 0 ? "∞" : "—";
  if (value === 0) return `0.${"0".repeat(decimals)} ${unit}`;
  const absVal = Math.abs(value);
  const prefixes = [
    { symbol: "T", factor: 1e12 }, { symbol: "G", factor: 1e9 },
    { symbol: "M", factor: 1e6 }, { symbol: "k", factor: 1e3 },
    { symbol: "", factor: 1 },
    { symbol: "m", factor: 1e-3 }, { symbol: "μ", factor: 1e-6 },
    { symbol: "n", factor: 1e-9 }, { symbol: "p", factor: 1e-12 }
  ];
  const prefix = prefixes.find(p => absVal >= p.factor) || prefixes[prefixes.length - 1];
  const scaled = value / prefix.factor;
  return `${scaled.toFixed(decimals)} ${prefix.symbol}${unit}`;
}