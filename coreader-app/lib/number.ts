export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function clampPct(v?: number) {
  if (typeof v !== 'number') return undefined;
  return clamp(v, 0, 100);
}
