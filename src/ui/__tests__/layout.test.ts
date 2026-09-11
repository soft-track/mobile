import { sizeClassFor } from '@/ui/layout';

describe('sizeClassFor', () => {
  it('splits at the breakpoints the mockups are drawn to', () => {
    expect(sizeClassFor(0)).toBe('compact');
    expect(sizeClassFor(390)).toBe('compact'); // iPhone
    expect(sizeClassFor(599)).toBe('compact');
    expect(sizeClassFor(600)).toBe('medium'); // unfolded foldable
    expect(sizeClassFor(700)).toBe('medium');
    expect(sizeClassFor(839)).toBe('medium');
    expect(sizeClassFor(840)).toBe('expanded'); // tablet
    expect(sizeClassFor(1280)).toBe('expanded');
  });
});
