import { parseTtml } from '@/shared/lib/parsers/ttmlParser';
import { convertTtmlToSrt } from '@/shared/lib/parsers/ttmlToSrt';

// Real Netflix IMSC1.1 TTML sample (movie 81947712, zh-Hans track).
// tickRate=10000000, 3 cues extracted from the full 735-cue file.
const NETFLIX_TTML = `<?xml version="1.0" encoding="utf-8"?>
<tt ttp:contentProfiles="http://www.w3.org/ns/ttml/profile/imsc1.1/text" xmlns="http://www.w3.org/ns/ttml" xmlns:tt="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:xml="http://www.w3.org/XML/1998/namespace" ttp:tickRate="10000000" ttp:timeBase="media" xml:lang="zh-Hans">
<head>
<metadata xmlns:nttm="http://www.netflix.com/ns/ttml#metadata" nttm:schemaVersion="0" nttm:textType="SUBTITLES"/>
<layout>
<region xml:id="region0" tts:extent="80.000% 80.000%" tts:origin="10.000% 10.000%"/>
</layout>
</head>
<body>
<div>
<p xml:id="subtitle1" begin="162245417t" end="203119584t" region="region0"><span style="style1">（闹钟 六点）</span></p>
<p xml:id="subtitle2" begin="303636667t" end="325325000t" region="region0"><span style="style1">睡前我总是祈祷</span></p>
<p xml:id="subtitle3" begin="336586250t" end="363696667t" region="region0"><span style="style1">希望早上能病得起不来</span></p>
</div>
</body>
</tt>`;

describe('parseTtml', () => {
  it('parses Netflix IMSC1.1 TTML with tick-based timing', () => {
    const { cues } = parseTtml(NETFLIX_TTML);
    expect(cues).toHaveLength(3);

    // First cue: begin=162245417t, end=203119584t, tickRate=10000000
    // → start = 162245417 / 10000000 * 1000 = 16224.5417 ms
    // → end   = 203119584 / 10000000 * 1000 = 20311.9584 ms
    expect(cues[0].index).toBe(1);
    expect(cues[0].start).toBeCloseTo(16224.542, 1);
    expect(cues[0].end).toBeCloseTo(20311.958, 1);
    expect(cues[0].text).toBe('（闹钟 六点）');
  });

  it('extracts text from nested span tags', () => {
    const { cues } = parseTtml(NETFLIX_TTML);
    expect(cues[1].text).toBe('睡前我总是祈祷');
    expect(cues[2].text).toBe('希望早上能病得起不来');
  });

  it('strips BOM from content', () => {
    const bomContent = '\uFEFF' + NETFLIX_TTML;
    const { cues } = parseTtml(bomContent);
    expect(cues).toHaveLength(3);
  });

  it('throws on empty content', () => {
    expect(() => parseTtml('')).toThrow('Cannot parse empty TTML content');
    expect(() => parseTtml('   \n  ')).toThrow('Cannot parse empty TTML content');
  });

  it('throws on malformed XML', () => {
    const malformed = '<?xml version="1.0"?><tt><body><p>unclosed';
    expect(() => parseTtml(malformed)).toThrow();
  });

  it('throws on non-TTML root element', () => {
    const notTtml = '<?xml version="1.0"?><html><body><p>text</p></body></html>';
    expect(() => parseTtml(notTtml)).toThrow('expected <tt>');
  });

  it('handles clock format HH:MM:SS.mmm', () => {
    const clockTtml = `<?xml version="1.0"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:timeBase="media">
<body><div>
<p begin="00:00:05.000" end="00:00:08.500">Hello</p>
<p begin="00:01:30.000" end="00:01:33.000">World</p>
</div></body>
</tt>`;
    const { cues } = parseTtml(clockTtml);
    expect(cues).toHaveLength(2);
    expect(cues[0].start).toBe(5000);
    expect(cues[0].end).toBe(8500);
    expect(cues[0].text).toBe('Hello');
    expect(cues[1].start).toBe(90000);
    expect(cues[1].end).toBe(93000);
  });

  it('handles seconds format Ns', () => {
    const secondsTtml = `<?xml version="1.0"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:timeBase="media">
<body><div>
<p begin="2.5s" end="5.0s">Test</p>
</div></body>
</tt>`;
    const { cues } = parseTtml(secondsTtml);
    expect(cues).toHaveLength(1);
    expect(cues[0].start).toBe(2500);
    expect(cues[0].end).toBe(5000);
  });

  it('converts <br> to newline in cue text', () => {
    const brTtml = `<?xml version="1.0"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10" ttp:timeBase="media">
<body><div>
<p begin="0t" end="100t">Line 1<br/>Line 2</p>
</div></body>
</tt>`;
    const { cues } = parseTtml(brTtml);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Line 1\nLine 2');
  });

  it('skips cues with missing begin/end', () => {
    const missingTiming = `<?xml version="1.0"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10" ttp:timeBase="media">
<body><div>
<p begin="0t" end="100t">Has timing</p>
<p>No timing</p>
<p begin="50t">Missing end</p>
</div></body>
</tt>`;
    const { cues } = parseTtml(missingTiming);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Has timing');
  });

  it('skips cues with empty text', () => {
    const emptyText = `<?xml version="1.0"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10" ttp:timeBase="media">
<body><div>
<p begin="0t" end="100t">   </p>
<p begin="200t" end="300t">Real text</p>
</div></body>
</tt>`;
    const { cues } = parseTtml(emptyText);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Real text');
  });
});

describe('convertTtmlToSrt', () => {
  it('converts TTML to valid SRT format', () => {
    const srt = convertTtmlToSrt(NETFLIX_TTML);
    const lines = srt.split('\n');

    // First block: index, timing, text
    expect(lines[0]).toBe('1');
    expect(lines[1]).toMatch(/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/);
    expect(lines[2]).toBe('（闹钟 六点）');

    // Blocks separated by blank line
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('2');
  });

  it('produces 3 blocks for 3 cues', () => {
    const srt = convertTtmlToSrt(NETFLIX_TTML);
    const blocks = srt.trim().split(/\n\s*\n/);
    expect(blocks).toHaveLength(3);
  });

  it('handles empty input gracefully', () => {
    expect(() => convertTtmlToSrt('')).toThrow('Cannot convert empty TTML content');
  });

  it('throws when no cues found', () => {
    const noCues = `<?xml version="1.0"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10" ttp:timeBase="media">
<body><div></div></body>
</tt>`;
    expect(() => convertTtmlToSrt(noCues)).toThrow('No cues found in TTML content');
  });

  it('decodes XML entities in cue text', () => {
    const entityTtml = `<?xml version="1.0"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10" ttp:timeBase="media">
<body><div>
<p begin="0t" end="100t">A &amp; B &lt;tag&gt; &#39;quote&#39;</p>
</div></body>
</tt>`;
    const srt = convertTtmlToSrt(entityTtml);
    expect(srt).toContain("A & B <tag> 'quote'");
  });

  it('works without DOMParser (service worker environment)', () => {
    // Simulate SW environment by temporarily removing DOMParser.
    const original = (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
    delete (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
    try {
      const srt = convertTtmlToSrt(NETFLIX_TTML);
      expect(srt.split(/\n\s*\n/).filter(Boolean)).toHaveLength(3);
      expect(srt).toContain('（闹钟 六点）');
    } finally {
      if (original) (globalThis as { DOMParser?: typeof DOMParser }).DOMParser = original;
    }
  });
});
