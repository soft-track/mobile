import { suggestKey } from '@/team/new-team-sheet';

describe('suggestKey', () => {
  it('takes initials from a multi-word name', () => {
    expect(suggestKey('Mobile Platform')).toBe('MP');
    expect(suggestKey('Site Reliability Engineering')).toBe('SRE');
  });

  it('truncates a single word', () => {
    expect(suggestKey('Engineering')).toBe('ENG');
    expect(suggestKey('Ops')).toBe('OPS');
  });

  it('stops at three initials, since the key caps at six characters', () => {
    expect(suggestKey('One Two Three Four Five')).toBe('OTT');
  });

  it('ignores anything that is not a letter', () => {
    // The backend uppercases the key and the field strips non-letters, so a
    // suggestion containing either would never survive submission.
    expect(suggestKey('design-systems')).toBe('DS');
    expect(suggestKey('  ')).toBe('');
    expect(suggestKey('123')).toBe('');
  });
});
