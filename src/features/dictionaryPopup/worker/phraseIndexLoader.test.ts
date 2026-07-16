// phraseIndexLoader tests — ADR-037 §7: validate + hydrate compact blobs.

import { describe, expect, it } from '@jest/globals';
import {
  compilePhraseIndex,
  serializePhraseIndex,
  type PhraseIndexInput,
} from '@/features/dictionary/logic/phraseIndexCompiler';
import { parsePhraseTemplate } from '@/features/dictionary/logic/phraseTemplateParser';
import {
  buildAnchorMap,
  EXPECTED_COMPILER_VERSION,
  loadPhraseIndexBlob,
  resolveCandidatesByAnchors,
  totalResidentBytes,
} from './phraseIndexLoader';

const TEST_VERBS = new Set(['take', 'kick', 'give', 'put', 'look', 'carry']);

function tmpl(term: string): PhraseIndexInput {
  const parsed = parsePhraseTemplate(term, { inflectableLiterals: TEST_VERBS });
  if (parsed.status !== 'supported') {
    throw new Error(`test template "${term}" must be supported, got ${parsed.status}`);
  }
  return {
    templateId: 0,
    sourceTerm: parsed.sourceTerm,
    normalizedTerm: parsed.normalizedTerm,
    nodes: parsed.nodes,
    fixedTokenCount: parsed.fixedTokenCount,
    minSurfaceTokens: parsed.minSurfaceTokens,
    maxSurfaceTokens: parsed.maxSurfaceTokens,
    frequencyRank: 0,
  };
}

function buildBlob(terms: string[]): ArrayBuffer {
  const inputs = terms.map((t, i) => ({ ...tmpl(t), templateId: i }));
  return serializePhraseIndex(compilePhraseIndex(inputs));
}

describe('phraseIndexLoader — loadPhraseIndexBlob', () => {
  it('loads a valid blob and builds the anchor map', () => {
    const blob = buildBlob(['take off', 'kick the bucket']);
    const result = loadPhraseIndexBlob(3, blob);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resident.resourceId).toBe(3);
    expect(result.resident.index.termCount).toBe(2);
    expect(result.resident.byteSize).toBe(blob.byteLength);
    expect(result.resident.anchorMap.size).toBeGreaterThan(0);
  });

  it('rejects a too-small blob', () => {
    const result = loadPhraseIndexBlob(1, new ArrayBuffer(8));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('blob-too-small');
  });

  it('rejects a blob with bad magic', () => {
    const bad = new ArrayBuffer(64);
    const result = loadPhraseIndexBlob(1, bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/deserialize-failed|bad-magic/);
  });

  it('rejects a version mismatch', () => {
    // Build a valid blob then patch the version field (offset 4, u32 LE).
    const blob = buildBlob(['take off']);
    const view = new DataView(blob);
    view.setUint32(4, EXPECTED_COMPILER_VERSION + 999, true);
    const result = loadPhraseIndexBlob(1, blob);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/version mismatch/);
  });

  it('loads an empty index (0 terms) without error', () => {
    const blob = serializePhraseIndex(compilePhraseIndex([]));
    const result = loadPhraseIndexBlob(1, blob);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.resident.index.termCount).toBe(0);
    expect(result.resident.anchorMap.size).toBe(0);
  });
});

describe('phraseIndexLoader — buildAnchorMap', () => {
  it('maps every anchor key to its template IDs', () => {
    const blob = buildBlob(['take off', 'kick the bucket']);
    const loaded = loadPhraseIndexBlob(1, blob);
    if (!loaded.ok) throw new Error('load failed');
    const map = buildAnchorMap(loaded.resident.index);
    // 'take' and 'kick' should be anchors (non-stopwords).
    expect(map.has('take')).toBe(true);
    expect(map.has('kick')).toBe(true);
    expect(map.get('take')?.length).toBeGreaterThanOrEqual(1);
  });
});

describe('phraseIndexLoader — resolveCandidatesByAnchors', () => {
  it('returns template IDs whose anchor appears in the token set', () => {
    const blob = buildBlob(['take off', 'kick the bucket', 'give up']);
    const loaded = loadPhraseIndexBlob(1, blob);
    if (!loaded.ok) throw new Error('load failed');

    const candidates = resolveCandidatesByAnchors(
      ['please', 'take', 'off', 'your', 'shoes'],
      loaded.resident.anchorMap,
    );
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    // The 'take off' template should be among candidates.
    const takeOffTemplate = loaded.resident.index.templates.find(
      (t) => t.sourceTerm === 'take off',
    );
    expect(takeOffTemplate).toBeDefined();
    expect(candidates).toContain(takeOffTemplate!.templateId);
  });

  it('returns empty when no anchor matches any token', () => {
    const blob = buildBlob(['take off']);
    const loaded = loadPhraseIndexBlob(1, blob);
    if (!loaded.ok) throw new Error('load failed');

    const candidates = resolveCandidatesByAnchors(['hello', 'world'], loaded.resident.anchorMap);
    expect(candidates).toEqual([]);
  });

  it('deduplicates template IDs when multiple anchors hit the same template', () => {
    const blob = buildBlob(['kick the bucket']);
    const loaded = loadPhraseIndexBlob(1, blob);
    if (!loaded.ok) throw new Error('load failed');

    // 'kick' and 'bucket' are both anchors for the same template.
    const candidates = resolveCandidatesByAnchors(
      ['kick', 'the', 'bucket'],
      loaded.resident.anchorMap,
    );
    const unique = new Set(candidates);
    expect(candidates.length).toBe(unique.size);
  });
});

describe('phraseIndexLoader — totalResidentBytes', () => {
  it('sums byte sizes across resident indexes', () => {
    const blob1 = buildBlob(['take off']);
    const blob2 = buildBlob(['kick the bucket', 'give up']);
    const r1 = loadPhraseIndexBlob(1, blob1);
    const r2 = loadPhraseIndexBlob(2, blob2);
    if (!r1.ok || !r2.ok) throw new Error('load failed');
    expect(totalResidentBytes([r1.resident, r2.resident])).toBe(blob1.byteLength + blob2.byteLength);
  });

  it('returns 0 for empty iterable', () => {
    expect(totalResidentBytes([])).toBe(0);
  });
});
