import fs, { existsSync } from 'node:fs';
import path from 'node:path';
import {
  compilePhraseIndex,
  compilePhraseIndexAsync,
  serializePhraseIndex,
  serializePhraseIndexAsync,
  deserializePhraseIndex,
  openLazyPhraseIndex,
  type PhraseIndexInput,
  STOPWORDS,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';

function tmpl(term: string, frequencyRank = 0): PhraseIndexInput {
  const parsed = parsePhraseTemplate(term);
  if (parsed.status !== 'supported') {
    throw new Error(`test template "${term}" must be supported, got ${parsed.status}`);
  }
  return {
    templateId: 0, // assigned by compiler
    sourceTerm: parsed.sourceTerm,
    normalizedTerm: parsed.normalizedTerm,
    nodes: parsed.nodes,
    fixedTokenCount: parsed.fixedTokenCount,
    minSurfaceTokens: parsed.minSurfaceTokens,
    maxSurfaceTokens: parsed.maxSurfaceTokens,
    frequencyRank,
  };
}

describe('phraseIndexCompiler', () => {
  describe('anchor selection', () => {
    it('prefers a rare content word over a stopword', () => {
      const index = compilePhraseIndex([
        tmpl('kick the bucket'),
        tmpl('spill the beans'),
      ]);

      const kickAnchors = index.templates[0]!.anchors;
      const spillAnchors = index.templates[1]!.anchors;

      // Primary anchor must be a non-stopword content word.
      expect(STOPWORDS.has(kickAnchors[0]!)).toBe(false);
      expect(STOPWORDS.has(spillAnchors[0]!)).toBe(false);
      expect(kickAnchors).toContain('kick');
      expect(spillAnchors).toContain('spill');
    });

    it('prefers the rarest content word as primary anchor', () => {
      // "bucket" appears once, "kick" appears twice → "bucket" is primary.
      const index = compilePhraseIndex([
        tmpl('kick the bucket'),
        tmpl('kick the habit'),
      ]);

      const anchors = index.templates[0]!.anchors;
      expect(anchors[0]).toBe('bucket');
    });

    it('uses length as tie-breaker when posting counts are equal', () => {
      const index = compilePhraseIndex([tmpl('hit the nail on the head')]);
      const anchors = index.templates[0]!.anchors;

      // All non-stopwords have posting=1; "nail" and "head" (4 chars) beat "hit" (3).
      expect(anchors.length).toBeGreaterThanOrEqual(2);
      expect(['nail', 'head']).toContain(anchors[0]);
      expect(['nail', 'head']).toContain(anchors[1]);
    });

    it('picks secondary anchors from remaining required literals', () => {
      const index = compilePhraseIndex([tmpl('put up with sth/sb')]);
      const anchors = index.templates[0]!.anchors;

      expect(anchors.length).toBeGreaterThanOrEqual(2);
      expect(anchors.includes('put')).toBe(true);
      expect(anchors.includes('with')).toBe(true);
    });

    it('uses alternative-branch literals as anchor candidates', () => {
      const index = compilePhraseIndex([tmpl('a close/near thing')]);
      const anchors = index.templates[0]!.anchors;

      expect(anchors).toContain('close');
      expect(anchors).toContain('near');
    });

    it('falls back to the longest available literal when all are stopwords', () => {
      const index = compilePhraseIndex([tmpl('a the of')]);
      const anchors = index.templates[0]!.anchors;

      expect(anchors.length).toBeGreaterThanOrEqual(1);
      expect(STOPWORDS.has(anchors[0]!)).toBe(true);
    });
  });

  describe('posting lists', () => {
    it('returns template IDs for a known anchor', () => {
      const index = compilePhraseIndex([
        tmpl('kick the bucket'),
        tmpl('spill the beans'),
        tmpl('kick the habit'),
      ]);

      const ids = index.lookupByAnchor('kick');
      expect([...ids].sort((a, b) => a - b)).toEqual([
        index.templates.find((t) => t.normalizedTerm === 'kick the bucket')!.templateId,
        index.templates.find((t) => t.normalizedTerm === 'kick the habit')!.templateId,
      ]);
    });

    it('returns empty for an unknown anchor', () => {
      const index = compilePhraseIndex([tmpl('kick the bucket')]);
      expect(index.lookupByAnchor('nonexistent')).toEqual([]);
    });

    it('keeps templateId aligned with the array index when a template is dropped', () => {
      // "sth to" is dropped (only a stopword literal). Its removal must not
      // shift ids — postings must still resolve to the correct template.
      const index = compilePhraseIndex([
        tmpl('catch sb'),
        tmpl('sth to'),
        tmpl('kick the bucket'),
      ]);

      for (const id of index.lookupByAnchor('kick')) {
        expect(index.templates[id]!.sourceTerm).toBe('kick the bucket');
      }
      for (const id of index.lookupByAnchor('catch')) {
        expect(index.templates[id]!.sourceTerm).toBe('catch sb');
      }
      index.templates.forEach((t, i) => expect(t.templateId).toBe(i));
    });
  });

  describe('serialize / deserialize round-trip', () => {
    it('preserves templates, anchors, and posting lookups', () => {
      const original = compilePhraseIndex([
        tmpl('kick the bucket', 1),
        tmpl('spill the beans', 2),
        tmpl('be (right) under your nose', 3),
        tmpl('carry sb/sth through something', 4),
      ]);
      const buffer = serializePhraseIndex(original);
      const restored = deserializePhraseIndex(buffer);

      expect(restored.termCount).toBe(original.termCount);
      expect(restored.templates.length).toBe(original.templates.length);

      for (const t of original.templates) {
        const r = restored.templates[t.templateId]!;
        expect(r.normalizedTerm).toBe(t.normalizedTerm);
        expect(r.anchors).toEqual(t.anchors);
        expect(r.fixedTokenCount).toBe(t.fixedTokenCount);
        expect(r.frequencyRank).toBe(t.frequencyRank);
      }

      for (const anchor of ['kick', 'spill', 'under', 'carry']) {
        expect([...restored.lookupByAnchor(anchor)].sort((a, b) => a - b))
          .toEqual([...original.lookupByAnchor(anchor)].sort((a, b) => a - b));
      }
    });

    it('round-trips a large index across writer growth', () => {
      const inputs: PhraseIndexInput[] = [];
      for (let i = 0; i < 20000; i++) {
        inputs.push(tmpl(`phrase number ${i}`));
      }
      const index = compilePhraseIndex(inputs);
      const buffer = serializePhraseIndex(index);
      expect(buffer.byteLength).toBeGreaterThan(1024 * 1024);
      const restored = deserializePhraseIndex(buffer);
      expect(restored.termCount).toBe(index.termCount);
      expect(restored.anchorCount).toBe(index.anchorCount);
      for (const t of index.templates.slice(0, 50)) {
        const r = restored.templates[t.templateId]!;
        expect(r.normalizedTerm).toBe(t.normalizedTerm);
        expect(r.anchors).toEqual(t.anchors);
      }
      for (const anchor of index.anchorKeys.slice(0, 20)) {
        expect([...restored.lookupByAnchor(anchor)])
          .toEqual([...index.lookupByAnchor(anchor)]);
      }
      expect(index.byteSize).toBe(buffer.byteLength);
    });

    it('lazy-open produces identical templates, anchors, and postings', () => {
      const original = compilePhraseIndex([
        tmpl('kick the bucket', 1),
        tmpl('spill the beans', 2),
        tmpl('be (right) under your nose', 3),
        tmpl('carry sb/sth through something', 4),
        tmpl('put down sth', 5),
      ]);
      const buffer = serializePhraseIndex(original);
      const full = deserializePhraseIndex(buffer);
      const lazy = openLazyPhraseIndex(buffer);

      expect(lazy.compilerVersion).toBe(full.compilerVersion);
      expect(lazy.termCount).toBe(full.termCount);
      expect(lazy.anchorCount).toBe(full.anchorCount);
      expect(lazy.anchorKeys).toEqual(full.anchorKeys);
      expect(lazy.byteSize).toBe(full.byteSize);
      expect(lazy.templates.length).toBe(full.templates.length);

      for (const t of full.templates) {
        expect(lazy.templates[t.templateId]).toEqual(t);
      }
      for (const key of full.anchorKeys) {
        expect([...lazy.lookupByAnchor(key)]).toEqual([...full.lookupByAnchor(key)]);
      }
      expect(lazy.lookupByAnchor('definitely-not-an-anchor')).toEqual([]);
    });

    it('lazy-open memoizes decoded templates', () => {
      const original = compilePhraseIndex([tmpl('kick the bucket', 1)]);
      const lazy = openLazyPhraseIndex(serializePhraseIndex(original));
      expect(lazy.templates[0]).toBe(lazy.templates[0]);
    });

    it('lazy-open rejects bad magic and old versions', () => {
      const original = compilePhraseIndex([tmpl('be under your nose', 1)]);
      const buffer = serializePhraseIndex(original);
      expect(() => openLazyPhraseIndex(buffer.slice(4))).toThrow(/bad magic/);
      const view = new Uint8Array(buffer);
      view[4] = 1; view[5] = 0; view[6] = 0; view[7] = 0;
      expect(() => openLazyPhraseIndex(buffer)).toThrow(/version mismatch/);
    });

    it('async compile+serialize produce identical output to the sync path', async () => {
      const inputs = [
        tmpl('kick the bucket', 1),
        tmpl('spill the beans', 2),
        tmpl('be (right) under your nose', 3),
        tmpl('put down sth', 4),
        tmpl('carry sb/sth through something', 5),
      ];
      const yieldStub = async () => {};
      const asyncIndex = await compilePhraseIndexAsync(inputs, yieldStub);
      const syncIndex = compilePhraseIndex(inputs);
      expect(asyncIndex.templates).toEqual(syncIndex.templates);
      expect(asyncIndex.anchorKeys).toEqual(syncIndex.anchorKeys);
      expect(asyncIndex.termCount).toBe(syncIndex.termCount);

      const asyncBlob = await serializePhraseIndexAsync(asyncIndex, yieldStub);
      const syncBlob = serializePhraseIndex(syncIndex);
      expect(new Uint8Array(asyncBlob)).toEqual(new Uint8Array(syncBlob));
    });

    it('async compile yields control between iterations', async () => {
      const inputs = Array.from({ length: 50 }, (_, i) => tmpl(`phrase number ${i}`));
      let yields = 0;
      const index = await compilePhraseIndexAsync(inputs, async () => { yields++; });
      expect(yields).toBeGreaterThan(0);
      expect(index.termCount).toBeGreaterThanOrEqual(50);
    });

    it('throws clear version-mismatch error on old-format blob', () => {
      // Simulate an old-format blob (version 1) by patching the version
      // field in a serialized buffer. The deserializer must throw a clear
      // error mentioning "version mismatch", not a cryptic "unknown node
      // type" from a desynced offset.
      const original = compilePhraseIndex([tmpl('be under your nose', 1)]);
      const buffer = serializePhraseIndex(original);
      const view = new Uint8Array(buffer);
      // Overwrite version (bytes 4-7) to 1 (old version).
      view[4] = 1; view[5] = 0; view[6] = 0; view[7] = 0;
      expect(() => deserializePhraseIndex(buffer)).toThrow(/version mismatch/);
    });
  });

  describe('Cambridge fixture budget', () => {
    const fullFixture = process.env.Tihoka_FIXTURE_FULL === '1';
    const fixturePath = path.resolve(
      __dirname,
      fullFixture
        ? '../../../../data/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json'
        : '../../../../tests/data-test/resource/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json',
    );
    const FIXTURE_MISSING = fullFixture && !existsSync(fixturePath);
    if (FIXTURE_MISSING) {
      console.warn('[fixture] full Cambridge fixture missing — run without Tihoka_FIXTURE_FULL or restore data/resource/');
    }

    (FIXTURE_MISSING ? it.skip : it)('compiles all supported multiword terms under 8MB with bounded anchor stats', () => {
      const entries = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as { term?: string }[];
      const seen = new Set<string>();
      const inputs: PhraseIndexInput[] = [];
      let nextId = 0;
      for (const e of entries) {
        const term = String(e.term ?? '').trim().normalize('NFC').toLowerCase();
        if (!term || term.split(/\s+/).length < 2 || seen.has(term)) continue;
        seen.add(term);
        const parsed = parsePhraseTemplate(term);
        if (parsed.status !== 'supported') continue;
        inputs.push({
          templateId: nextId++,
          sourceTerm: parsed.sourceTerm,
          normalizedTerm: parsed.normalizedTerm,
          nodes: parsed.nodes,
          fixedTokenCount: parsed.fixedTokenCount,
          minSurfaceTokens: parsed.minSurfaceTokens,
          maxSurfaceTokens: parsed.maxSurfaceTokens,
          frequencyRank: 0,
        });
      }

      const index = compilePhraseIndex(inputs);
      const buffer = serializePhraseIndex(index);

      expect(buffer.byteLength).toBeLessThanOrEqual(8 * 1024 * 1024);
      // compilePhraseIndex may generate separable phrasal-verb variants, so
      // the compiled template count can be greater than the input count.
      expect(index.templates.length).toBeGreaterThanOrEqual(inputs.length);
      expect(index.anchorCount).toBeGreaterThan(Math.floor(inputs.length / 3));

      const postingSizes = Array.from({ length: index.anchorCount }, (_, i) =>
        index.lookupByAnchor(index.anchorKeys[i]!).length,
      );
      postingSizes.sort((a, b) => a - b);
      const max = postingSizes[postingSizes.length - 1]!;
      const median = postingSizes[Math.floor(postingSizes.length / 2)]!;
      const p95 = postingSizes[Math.floor(postingSizes.length * 0.95)]!;
      // Max may exceed MAX_CANDIDATES for very common verbs like "take";
      // the matcher intersects secondary anchors for those. Median and p95
      // must stay low so the common case is fast.
      expect(median).toBeLessThanOrEqual(2);
      expect(p95).toBeLessThanOrEqual(25);
      expect(max).toBeLessThanOrEqual(1500);
    }, 30000);
  });
});
