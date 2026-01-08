import { formatBytes } from '@/lib/bytes';
import { formatRelativeDate } from '@/lib/date';
import { clamp, clampPct } from '@/lib/number';

describe('formatBytes', () => {
  it('formats bytes across units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });
});

describe('formatRelativeDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-10T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('formats recent timestamps with relative labels', () => {
    expect(formatRelativeDate('2025-01-10T11:59:40Z')).toBe('Just now');
    expect(formatRelativeDate('2025-01-10T11:50:00Z')).toBe('10m ago');
    expect(formatRelativeDate('2025-01-10T08:00:00Z')).toBe('4h ago');
    expect(formatRelativeDate('2025-01-09T12:00:00Z')).toBe('Yesterday');
  });

  it('formats older timestamps as calendar dates', () => {
    expect(formatRelativeDate('2025-01-01T12:00:00Z')).toBe('Jan 1, 2025');
  });
});

describe('number helpers', () => {
  it('clamps values into a range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('clamps percentage values and returns undefined for invalid input', () => {
    expect(clampPct(42)).toBe(42);
    expect(clampPct(-3)).toBe(0);
    expect(clampPct(300)).toBe(100);
    expect(clampPct()).toBeUndefined();
  });
});
