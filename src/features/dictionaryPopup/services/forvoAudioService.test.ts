import {
  buildForvoUrl,
  parseForvoHtml,
  scoreAudioByAccent,
} from './forvoAudioService';
import type { AudioItem } from '../types';

/** Minimal Forvo HTML with one UK + one US play button. */
const SAMPLE_HTML = `
<div id="pronunciations-list-en_uk">
  <li>
    <span class="play" onclick="Play(12345,'aHR0cHM6Ly9leGFtcGxlLmNvbS9hdWRpby5tcDM=')"></span>
    <span class="ofLink"><a href="/profiles/ukSpeaker">Jane Doe</a></span>
    <span class="from">from United Kingdom</span>
  </li>
</div>
<div id="pronunciations-list-en_usa">
  <li>
    <span class="play" onclick="Play(67890,'YmFyLm1wMw==')"></span>
    <span class="ofLink"><a href="/profiles/usSpeaker">John Smith</a></span>
    <span class="from">from United States</span>
  </li>
</div>`;

describe('forvoAudioService', () => {
  describe('buildForvoUrl', () => {
    it('encodes the term into the Forvo word URL with the given langCode anchor', () => {
      expect(buildForvoUrl('hello world', 'en')).toBe(
        'https://forvo.com/word/hello%20world/#en',
      );
    });

    it('encodes special characters', () => {
      expect(buildForvoUrl("it's", 'en')).toBe("https://forvo.com/word/it's/#en");
    });

    it('uses the provided langCode as the anchor (non-English)', () => {
      expect(buildForvoUrl('bonjour', 'fr')).toBe('https://forvo.com/word/bonjour/#fr');
    });
  });

  describe('parseForvoHtml', () => {
    it('parses UK + US play buttons into AudioItem[]', () => {
      const items = parseForvoHtml(SAMPLE_HTML, 'en');
      expect(items).toHaveLength(2);

      const uk = items[0];
      expect(uk.accentId).toBe('UK');
      expect(uk.id).toBe('forvo-UK-0');
      expect(uk.kind).toBe('word');
      expect(uk.source).toBe('community');
      expect(uk.state).toBe('idle');
      expect(uk.defaultSelected).toBe(false);
      expect(uk.label).toBe('Jane Doe · United Kingdom');
      expect(uk.url).toBe('https://audio00.forvo.com/mp3/https://example.com/audio.mp3');

      const us = items[1];
      expect(us.accentId).toBe('US');
      expect(us.id).toBe('forvo-US-1');
      expect(us.label).toBe('John Smith · United States');
      expect(us.url).toBe('https://audio00.forvo.com/mp3/bar.mp3');
    });

    it('returns [] for empty string', () => {
      expect(parseForvoHtml('', 'en')).toEqual([]);
    });

    it('returns [] for malformed HTML with no play buttons', () => {
      expect(parseForvoHtml('<html><body>nope</body></html>', 'en')).toEqual([]);
    });

    it('returns [] for HTML with play buttons but no onclick match', () => {
      const html = '<div id="pronunciations-list-en_uk"><li><span class="play"></span></li></div>';
      expect(parseForvoHtml(html, 'en')).toEqual([]);
    });

    it('uses fallback region when .from missing', () => {
      const html = `
<div id="pronunciations-list-en_uk">
  <li>
    <span class="play" onclick="Play(1,'YmFyLm1wMw==')"></span>
    <span class="ofLink"><a href="/profiles/x">Speaker</a></span>
  </li>
</div>`;
      const items = parseForvoHtml(html, 'en');
      expect(items).toHaveLength(1);
      expect(items[0].label).toBe('Speaker · United Kingdom');
    });

    it('uses Unknown speaker when profile anchor missing', () => {
      const html = `
<div id="pronunciations-list-en_usa">
  <li>
    <span class="play" onclick="Play(1,'YmFyLm1wMw==')"></span>
    <span class="from">from United States</span>
  </li>
</div>`;
      const items = parseForvoHtml(html, 'en');
      expect(items).toHaveLength(1);
      expect(items[0].label).toBe('Unknown speaker · United States');
    });
  });

  describe('scoreAudioByAccent', () => {
    const ukItem: AudioItem = {
      id: 'forvo-UK-0',
      kind: 'word',
      source: 'community',
      label: 'UK speaker',
      accentId: 'UK',
      state: 'idle',
      url: 'https://example.com/uk.mp3',
      defaultSelected: false,
    };
    const usItem: AudioItem = {
      id: 'forvo-US-0',
      kind: 'word',
      source: 'community',
      label: 'US speaker',
      accentId: 'US',
      state: 'idle',
      url: 'https://example.com/us.mp3',
      defaultSelected: false,
    };

    it('puts US first when preferredAccent=US', () => {
      const scored = scoreAudioByAccent([ukItem, usItem], 'US');
      expect(scored[0].accentId).toBe('US');
      expect(scored[1].accentId).toBe('UK');
    });

    it('puts UK first when preferredAccent=UK', () => {
      const scored = scoreAudioByAccent([usItem, ukItem], 'UK');
      expect(scored[0].accentId).toBe('UK');
      expect(scored[1].accentId).toBe('US');
    });

    it('defaults to US when no preference given', () => {
      const scored = scoreAudioByAccent([ukItem, usItem]);
      expect(scored[0].accentId).toBe('US');
    });

    it('does not mutate the input array', () => {
      const input = [ukItem, usItem];
      scoreAudioByAccent(input, 'US');
      expect(input[0].accentId).toBe('UK');
    });

    it('handles empty input', () => {
      expect(scoreAudioByAccent([], 'US')).toEqual([]);
    });
  });
});
