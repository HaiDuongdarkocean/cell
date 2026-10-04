import { useEffect, useRef, useState, type ReactElement } from 'react';
import { PopupDictionary } from '@/features/dictionaryPopup/ui/PopupDictionary';
import { installMockChrome } from '../design-system-showcase/mockChrome';
import { getMockLookupResult, installMockDictionarySendMessage } from '../design-system-showcase/mockDictionary';
import { Button } from '@/shared/ui/Button';
import type { PopupAnchor } from '@/features/dictionaryPopup/ui/usePopupPosition';
import type { LookupResult, PosVariant } from '@/entities/dictionary';
import { ENTRIES, type MockEntry, type MockFreq } from './mockData';

installMockChrome();
installMockDictionarySendMessage();

const GENRE_KEYS: Record<string, 'spoken' | 'fiction' | 'magazine' | 'newspaper' | 'academic'> = {
  SPOK: 'spoken',
  FIC: 'fiction',
  MAG: 'magazine',
  NEWS: 'newspaper',
  ACAD: 'academic',
};

function mockFreqToVariant(freq: MockFreq) {
  const genres: Record<string, number> = {};
  for (const g of freq.genres) {
    const key = GENRE_KEYS[g.label];
    if (key) genres[key] = g.value;
  }
  return [{ rank: freq.rank, source: freq.source, total: freq.total, genres }];
}

function toLookupResult(entry: MockEntry): LookupResult {
  const variants: PosVariant[] = entry.variants.map((v) => ({
    pos: v.pos,
    prons: v.accents.map((a) => ({
      accent: a.label === 'ame' ? 'AmE' : 'BrE',
      ipa: a.ipa.replaceAll('/', ''),
    })),
    frequencies: v.freq ? mockFreqToVariant(v.freq) : [],
    status: v.status,
    definitions: v.senses.map((s, i) => ({
      id: `${entry.term}-${v.pos || 'other'}-${i}`,
      pos: v.pos || undefined,
      labels: s.labels,
      text: s.gloss,
      examples: (s.examples ?? []).map((ex) => ({ role: 'example' as const, text: ex })),
      source: 'mock',
      defaultSelected: i === 0,
    })),
    ...(v.stars ? { frequencyStars: { count: v.stars, source: 'MacmillanEnEn' } } : {}),
    ...(v.inflections.length ? { inflections: v.inflections } : {}),
  }));
  const first = variants[0];
  return {
    term: entry.term,
    langCode: 'en',
    reading: first?.prons[0]?.ipa ?? '',
    readingKind: 'ipa',
    frequencies: first?.frequencies ?? [],
    status: first?.status ?? 'unknown',
    partsOfSpeech: entry.variants.map((v) => v.pos).filter(Boolean),
    definitions: variants.flatMap((v) => v.definitions),
    rawDefinitions: [],
    detectedPhrase: null,
    matchSource: 'dictionary',
    variants,
  };
}

function resultFor(term: string): LookupResult {
  const entry = ENTRIES[term];
  return entry ? toLookupResult(entry) : getMockLookupResult(undefined, term);
}

export function Real({ term }: { term: string }): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<PopupAnchor | null>(null);

  useEffect(() => {
    setIsOpen(false);
    const frame = requestAnimationFrame(() => setIsOpen(true));
    return () => cancelAnimationFrame(frame);
  }, [term]);

  useEffect(() => {
    if (!markerRef.current) return;
    const rect = markerRef.current.getBoundingClientRect();
    setAnchor({ top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
  }, []);

  return (
    <div className="mkRealHost">
      <div ref={markerRef} className="mkRealMarker" />
      {!isOpen && <Button onClick={() => setIsOpen(true)}>Reopen popup</Button>}
      {isOpen && anchor && (
        <PopupDictionary
          langCode="en"
          sourceLang="en"
          targetLang="vi"
          anchor={anchor}
          initialTerm={term}
          initialSize={{ width: 420, maxHeight: 380 }}
          initialResult={resultFor(term)}
          onClose={() => setIsOpen(false)}
          onSendToCard={() => { /* design-time */ }}
          onQuickAdd={() => { /* design-time */ }}
        />
      )}
    </div>
  );
}
