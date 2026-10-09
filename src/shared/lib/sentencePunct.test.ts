import { describe, expect, it } from '@jest/globals';
import { hasSentenceEnd } from './sentencePunct';

describe('hasSentenceEnd', () => {
  it.each([
    ['English', 'end. Next', true],
    ['English question', 'really? yes', true],
    ['CJK ideographic full stop', '你好。世界', true],
    ['CJK fullwidth question', '你好？世界', true],
    ['CJK ellipsis', 'そう…ですね', true],
    ['Arabic question mark', 'كيف حالك؟ بخير', true],
    ['Urdu full stop', 'ٹھیک ہے۔ پھر', true],
    ['Devanagari danda', 'यह ठीक है। फिर', true],
    ['Tibetan shad', 'བཀྲ་ཤིས། བདེ་ལེགས', true],
    ['Ethiopic full stop', 'ሰላም። እንደምን', true],
    ['Myanmar little section', 'မင်္ဂလာပါ။ ဟုတ်ကဲ့', true],
    ['Khmer khan', 'សួស្តី។ បាទ', true],
    ['Armenian full stop', 'Բարև։ Ողջույն', true],
    ['no terminator', 'just words here', false],
    ['clause only', 'words, more words', false],
  ])('%s', (_name, text, expected) => {
    expect(hasSentenceEnd(text)).toBe(expected);
  });
});
