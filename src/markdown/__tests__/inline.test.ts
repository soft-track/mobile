import { segments } from '@/markdown/inline';
import { matchMentions, mentionQueryAt, applyMention } from '@/markdown/mentions';

const PEOPLE = [
  { id: 1, full_name: 'Ada Lovelace', username: 'ada' },
  { id: 2, full_name: 'Grace Hopper', username: 'grace' },
];

describe('segments', () => {
  it('finds a mention of someone on the team', () => {
    expect(segments('hey @ada look', PEOPLE)).toEqual([
      { kind: 'text', text: 'hey ' },
      { kind: 'mention', text: '@ada', person: PEOPLE[0] },
      { kind: 'text', text: ' look' },
    ]);
  });

  it('leaves an unknown handle as plain text', () => {
    // Far more likely an email fragment or a shell variable than a person.
    expect(segments('hi @nobody', PEOPLE)).toEqual([{ kind: 'text', text: 'hi @nobody' }]);
  });

  it('does not read an email address as a mention', () => {
    expect(segments('write to ada@example.com', PEOPLE)).toEqual([
      { kind: 'text', text: 'write to ada@example.com' },
    ]);
  });

  it('links issue identifiers', () => {
    expect(segments('see ENG-142 for detail', PEOPLE)).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'issue', text: 'ENG-142', identifier: 'ENG-142' },
      { kind: 'text', text: ' for detail' },
    ]);
  });

  it('ignores identifier-like text inside a longer token', () => {
    // A hyphenated word or a trailer should not become a link.
    expect(segments('build-ENG-1 and lowercase eng-1', PEOPLE)).toEqual([
      { kind: 'text', text: 'build-ENG-1 and lowercase eng-1' },
    ]);
  });

  it('handles both kinds in one run', () => {
    const parts = segments('@grace please see ENG-7', PEOPLE);
    expect(parts.map((p) => p.kind)).toEqual(['mention', 'text', 'issue']);
  });
});

describe('mentionQueryAt', () => {
  it('opens on a handle being typed', () => {
    expect(mentionQueryAt('hi @ad', 6)).toEqual({ query: 'ad', start: 3 });
  });

  it('stays closed inside an email address', () => {
    expect(mentionQueryAt('mail ada@example', 16)).toBeNull();
  });

  it('is driven by the caret, not the end of the text', () => {
    expect(mentionQueryAt('hi @ad and more', 6)).toEqual({ query: 'ad', start: 3 });
  });
});

describe('matchMentions', () => {
  it('matches on handle or full name', () => {
    expect(matchMentions(PEOPLE, 'lov').map((p) => p.username)).toEqual(['ada']);
    expect(matchMentions(PEOPLE, 'gra').map((p) => p.username)).toEqual(['grace']);
  });
});

describe('applyMention', () => {
  it('replaces the typed query and leaves the caret after a space', () => {
    const result = applyMention('hi @ad', 3, 2, 'ada');
    expect(result.text).toBe('hi @ada ');
    expect(result.caret).toBe(8);
  });
});
