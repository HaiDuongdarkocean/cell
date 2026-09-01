import { describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { usePronunciation } from './usePronunciation';
import type { PronunciationEngine } from '../services/pronunciationEngine';
import type { PronunciationResult } from '../types';

function makeEngine(result: PronunciationResult | Error): PronunciationEngine {
  return {
    toPronunciation: jest.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

function makeResult(term: string, langCode: string): PronunciationResult {
  return {
    text: term,
    language: langCode,
    ipa: 'həˈloʊ',
    phonemes: [
      { ipa: 'h', startMs: 0, endMs: 50, type: 'consonant' },
      { ipa: 'ə', startMs: 50, endMs: 100, type: 'vowel' },
      { ipa: 'ˈ', startMs: 100, endMs: 100, type: 'stress' },
      { ipa: 'l', startMs: 100, endMs: 150, type: 'consonant' },
      { ipa: 'oʊ', startMs: 150, endMs: 250, type: 'diphthong' },
    ],
    audio: null,
    metadata: { engine: 'espeak-phonemes', engineVersion: '0.0.5', source: 'espeak' },
  };
}

describe('usePronunciation', () => {
  it('returns a pronunciation result for the given term and language', async () => {
    const result = makeResult('hello', 'en');
    const engine = makeEngine(result);
    const { result: hook } = renderHook(() => usePronunciation({ term: 'hello', langCode: 'en', engine, enabled: true }));

    expect(hook.current.loading).toBe(true);
    await waitFor(() => expect(hook.current.loading).toBe(false));

    expect(hook.current.pronunciation).toEqual(result);
    expect(hook.current.error).toBeNull();
    expect(engine.toPronunciation).toHaveBeenCalledWith('hello', 'en');
  });

  it('recomputes when term changes', async () => {
    const engine = makeEngine(makeResult('world', 'en'));
    const { result: hook, rerender } = renderHook(
      ({ term }) => usePronunciation({ term, langCode: 'en', engine }),
      { initialProps: { term: 'hello' } },
    );

    await waitFor(() => expect(hook.current.loading).toBe(false));
    expect(engine.toPronunciation).toHaveBeenCalledWith('hello', 'en');

    rerender({ term: 'world' });
    await waitFor(() => expect(hook.current.pronunciation?.text).toBe('world'));
    expect(engine.toPronunciation).toHaveBeenCalledWith('world', 'en');
  });

  it('surfaces engine errors', async () => {
    const engine = makeEngine(new Error('WASM failed'));
    const { result: hook } = renderHook(() => usePronunciation({ term: 'hello', langCode: 'en', engine }));

    await waitFor(() => expect(hook.current.loading).toBe(false));

    expect(hook.current.pronunciation).toBeNull();
    expect(hook.current.error).toBe('WASM failed');
  });

  it('clears the result when term is empty', async () => {
    const result = makeResult('hello', 'en');
    const engine = makeEngine(result);
    const { result: hook, rerender } = renderHook(
      ({ term }) => usePronunciation({ term, langCode: 'en', engine }),
      { initialProps: { term: 'hello' } },
    );

    await waitFor(() => expect(hook.current.pronunciation).not.toBeNull());

    rerender({ term: '' });
    await waitFor(() => expect(hook.current.pronunciation).toBeNull());
    expect(hook.current.error).toBeNull();
  });

  it('does not call the engine when disabled', async () => {
    const result = makeResult('hello', 'en');
    const engine = makeEngine(result);
    renderHook(() => usePronunciation({ term: 'hello', langCode: 'en', engine, enabled: false }));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(engine.toPronunciation).not.toHaveBeenCalled();
  });
});
