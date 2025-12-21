export function clampPct(v?: number) {
  if (typeof v !== 'number') return undefined;
  return Math.max(0, Math.min(100, Math.round(v)));
}
