// formatDefinitions test — smallest check that fails if definition formatting breaks.
// Verifies: <br> → \n, numbered senses → bullets, \n\n between defs, no trailing \n.

import { describe, it, expect } from '@jest/globals';
import { formatDefinitions } from './webTextDictionaryController';

describe('formatDefinitions', () => {
  it('joins multiple definitions with exactly \\n\\n (no trailing)', () => {
    const result = formatDefinitions([
      '1.(noun) the way in which two things are connected',
      '2.(noun) the way in which two or more people feel and behave towards each other',
    ]);
    expect(result).toBe(
      '• (noun) the way in which two things are connected\n\n' +
      '• (noun) the way in which two or more people feel and behave towards each other',
    );
  });

  it('strips trailing <br><br> from raw definitions (no trailing \\n\\n)', () => {
    const result = formatDefinitions([
      '1.(phrasal verb) to remove something<br><br>',
      '2.(phrasal verb) to leave the ground<br><br>',
    ]);
    // Must NOT end with \n or \n\n
    expect(result.endsWith('\n')).toBe(false);
    expect(result).toBe(
      '• (phrasal verb) to remove something\n\n' +
      '• (phrasal verb) to leave the ground',
    );
  });

  it('preserves internal <br><br> as \\n\\n within a single definition', () => {
    const result = formatDefinitions([
      '1.(noun) sense one<br><br>2.(noun) sense two',
    ]);
    expect(result).toBe('• (noun) sense one\n\n• (noun) sense two');
  });

  it('handles empty array', () => {
    expect(formatDefinitions([])).toBe('');
  });

  it('handles single definition without trailing whitespace', () => {
    const result = formatDefinitions(['(adj) lasting a very short time<br>']);
    expect(result).toBe('(adj) lasting a very short time');
  });
});
