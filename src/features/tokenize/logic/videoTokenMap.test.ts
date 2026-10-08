import type { WordStatus } from '@/entities/dictionary';
import type { TokenFrequencyBand } from '@/features/tokenize/types';
import { createVideoTokenMap } from './videoTokenMap';

describe('createVideoTokenMap', () => {
  it('prepares a cue and emits update', () => {
    const map = createVideoTokenMap('en');
    const listener = jest.fn();
    map.onUpdate(listener);

    map.prepare(0, 'Hello world');
    const cue = map.get(0);

    expect(cue).toBeDefined();
    expect(cue!.text).toBe('Hello world');
    expect(cue!.tokens.length).toBeGreaterThan(0);
    expect(cue!.metadataResolved).toBe(false);
    expect(listener).toHaveBeenCalledWith(0);
  });

  it('resolves metadata for a cue and emits update', () => {
    const map = createVideoTokenMap('en');
    const listener = jest.fn();
    map.onUpdate(listener);

    map.prepare(0, 'Hello world');
    listener.mockClear();

    const statuses = new Map<string, WordStatus>([['hello', 'known']]);
    const frequencies = new Map<string, TokenFrequencyBand>([['hello', 'core']]);
    map.resolveMetadata(0, statuses, frequencies);

    const cue = map.get(0);
    expect(cue!.metadataResolved).toBe(true);
    expect(cue!.tokens.find((t) => t.term === 'hello')?.status).toBe('known');
    expect(cue!.tokens.find((t) => t.term === 'hello')?.frequencyBand).toBe('core');
    expect(listener).toHaveBeenCalledWith(0);
  });

  it('applies status to all cues containing the term', () => {
    const map = createVideoTokenMap('en');
    const listener = jest.fn();
    map.onUpdate(listener);

    map.prepare(0, 'Hello world');
    map.prepare(1, 'Hello again');
    map.resolveMetadata(0, new Map(), new Map());
    map.resolveMetadata(1, new Map(), new Map());
    listener.mockClear();

    const changed = map.applyStatus('hello', 'known');

    expect(changed).toBe(true);
    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.status).toBe('known');
    expect(map.get(1)!.tokens.find((t) => t.term === 'hello')?.status).toBe('known');
    expect(listener).toHaveBeenCalledWith(0);
    expect(listener).toHaveBeenCalledWith(1);
  });

  it('returns false when applying status to a term no cue contains', () => {
    const map = createVideoTokenMap('en');
    map.prepare(0, 'Hello world');
    expect(map.applyStatus('xyz', 'known')).toBe(false);
  });

  it('keeps readings for terms a chunked resolve pass does not cover', () => {
    const map = createVideoTokenMap('en');
    map.prepare(0, 'Hello world');
    map.prepare(1, 'Goodbye world');

    map.resolveMetadata(0, new Map(), new Map(), new Map([['hello', 'həˈloʊ']]));
    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.reading).toBe('həˈloʊ');

    map.resolveMetadata(0, new Map(), new Map(), new Map([['goodbye', 'ˌɡʊdˈbaɪ']]));
    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.reading).toBe('həˈloʊ');
  });

  it('clears a reading when the covering resolve pass reports none', () => {
    const map = createVideoTokenMap('en');
    map.prepare(0, 'Hello');

    map.resolveMetadata(0, new Map(), new Map(), new Map([['hello', 'həˈloʊ']]));
    map.resolveMetadata(0, new Map(), new Map(), new Map([['hello', '']]));

    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.reading).toBeUndefined();
  });

  it('resolveTerms only touches cues containing the given terms', () => {
    const map = createVideoTokenMap('en');
    const listener = jest.fn();
    map.prepare(0, 'Hello world');
    map.prepare(1, 'Completely unrelated');
    map.onUpdate(listener);
    listener.mockClear();

    map.resolveTerms(
      new Set(['hello']),
      new Map<string, WordStatus>([['hello', 'known']]),
      new Map<string, TokenFrequencyBand>(),
      new Map([['hello', 'həˈloʊ']]),
    );

    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.status).toBe('known');
    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.reading).toBe('həˈloʊ');
    expect(listener).toHaveBeenCalledWith(0);
    expect(listener).not.toHaveBeenCalledWith(1);
    expect(map.get(1)!.tokens.every((t) => t.status === 'unknown')).toBe(true);
  });

  it('resolves glosses and caches them into newly prepared cues', () => {
    const map = createVideoTokenMap('en');
    map.prepare(0, 'Hello world');

    map.resolveMetadata(0, new Map(), new Map(), undefined, new Map([['hello', 'xin chào']]));
    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.gloss).toBe('xin chào');

    map.prepare(1, 'Hello again');
    expect(map.get(1)!.tokens.find((t) => t.term === 'hello')?.gloss).toBe('xin chào');
  });

  it('keeps glosses when the gloss leg is skipped (undefined map)', () => {
    const map = createVideoTokenMap('en');
    map.prepare(0, 'Hello');

    map.resolveMetadata(0, new Map(), new Map(), undefined, new Map([['hello', 'xin chào']]));
    map.resolveMetadata(0, new Map(), new Map());

    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.gloss).toBe('xin chào');
  });

  it('clearGlosses drops cached glosses for future prepares', () => {
    const map = createVideoTokenMap('en');
    map.prepare(0, 'Hello world');
    map.resolveMetadata(0, new Map(), new Map(), undefined, new Map([['hello', 'xin chào']]));

    map.clearGlosses();
    map.prepare(1, 'Hello again');

    expect(map.get(1)!.tokens.find((t) => t.term === 'hello')?.gloss).toBeUndefined();
    // Existing tokens keep the stale hint until a re-resolve overwrites it.
    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.gloss).toBe('xin chào');
  });

  it('clears all cues and listeners still work after clear', () => {
    const map = createVideoTokenMap('en');
    map.prepare(0, 'Hello world');
    map.clear();
    expect(map.get(0)).toBeUndefined();
  });

  it('unsubscribes listener', () => {
    const map = createVideoTokenMap('en');
    const listener = jest.fn();
    const cleanup = map.onUpdate(listener);
    cleanup();
    map.prepare(0, 'Hello world');
    expect(listener).not.toHaveBeenCalled();
  });

  it('resolveTerms still resolves every cue when an update listener throws', () => {
    const map = createVideoTokenMap('en');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    map.onUpdate(() => {
      throw new Error('UI listener blew up');
    });
    map.prepare(0, 'Hello world');
    map.prepare(1, 'Hello again');

    expect(() =>
      map.resolveTerms(
        new Set(['hello']),
        new Map<string, WordStatus>([['hello', 'known']]),
        new Map<string, TokenFrequencyBand>(),
      ),
    ).not.toThrow();

    expect(map.get(0)!.tokens.find((t) => t.term === 'hello')?.status).toBe('known');
    expect(map.get(1)!.tokens.find((t) => t.term === 'hello')?.status).toBe('known');
    expect(map.get(0)!.metadataResolved).toBe(true);
    expect(map.get(1)!.metadataResolved).toBe(true);
    errorSpy.mockRestore();
  });
});
