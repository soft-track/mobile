import { isValidUsername } from '@/settings/username';

describe('isValidUsername', () => {
  it('accepts what the backend accepts', () => {
    expect(isValidUsername('ada')).toBe(true);
    expect(isValidUsername('ada.lovelace')).toBe(true);
    expect(isValidUsername('ada_2')).toBe(true);
    expect(isValidUsername('a1')).toBe(true);
  });

  it('refuses what it would reject', () => {
    // Must start with a letter or digit.
    expect(isValidUsername('.ada')).toBe(false);
    expect(isValidUsername('-ada')).toBe(false);
    // Lowercase only, and no spaces or @.
    expect(isValidUsername('Ada')).toBe(false);
    expect(isValidUsername('ada lovelace')).toBe(false);
    expect(isValidUsername('ada@example.com')).toBe(false);
    // Two to thirty-nine characters.
    expect(isValidUsername('a')).toBe(false);
    expect(isValidUsername('a'.repeat(40))).toBe(false);
    expect(isValidUsername('a'.repeat(39))).toBe(true);
  });
});
