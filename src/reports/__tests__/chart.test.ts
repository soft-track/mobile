import { linePath, makeScale } from '@/reports/chart';

describe('makeScale', () => {
  const scale = makeScale(200, 5, 10);

  it('puts the first point on the axis and the last at the right edge', () => {
    expect(scale.x(0)).toBeCloseTo(34, 5);
    expect(scale.x(4)).toBeCloseTo(34 + scale.innerWidth, 5);
  });

  it('draws zero on the baseline and the max at the top', () => {
    expect(scale.y(0)).toBeCloseTo(12 + scale.innerHeight, 5);
    expect(scale.y(10)).toBeCloseTo(12, 5);
  });

  it('survives a chart whose values are all zero', () => {
    // A cycle with nothing in it still has to draw an axis rather than divide
    // by zero.
    const flat = makeScale(200, 3, 0);
    expect(Number.isFinite(flat.y(0))).toBe(true);
    expect(flat.y(0)).toBeCloseTo(12 + flat.innerHeight, 5);
  });

  it('survives a single-point series', () => {
    const single = makeScale(200, 1, 5);
    expect(Number.isFinite(single.x(0))).toBe(true);
  });
});

describe('linePath', () => {
  it('moves to the first point and lines to the rest', () => {
    const scale = makeScale(200, 3, 10);
    const path = linePath([10, 5, 0], scale);
    expect(path.startsWith('M')).toBe(true);
    expect(path.match(/L/g)).toHaveLength(2);
  });

  it('is empty for no data, rather than a malformed path', () => {
    expect(linePath([], makeScale(200, 0, 1))).toBe('');
  });
});
