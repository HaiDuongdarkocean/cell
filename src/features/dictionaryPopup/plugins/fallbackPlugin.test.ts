// fallbackPlugin + pluginRegistry tests — spec §4.6.3.

import { describe, expect, it } from '@jest/globals';
import { createFallbackPlugin, fallbackTokenize } from './fallbackPlugin';
import { PluginRegistry, pluginRegistry } from './pluginRegistry';
import { createEnglishPlugin } from './englishPlugin';
import { compilePhraseIndex } from '@/features/dictionary/logic/phraseIndexCompiler';

describe('fallbackPlugin', () => {
  it('has the given langCode and readingKind none', () => {
    const plugin = createFallbackPlugin('fr');
    expect(plugin.langCode).toBe('fr');
    expect(plugin.readingKind).toBe('none');
  });

  it('has empty accents', () => {
    const plugin = createFallbackPlugin('fr');
    expect(plugin.accents).toEqual([]);
  });

  it('does not implement segment/lemma/normalizePossessive/matchPhrase', () => {
    const plugin = createFallbackPlugin('fr');
    expect(plugin.segment).toBeUndefined();
    expect(plugin.lemma).toBeUndefined();
    expect(plugin.normalizePossessive).toBeUndefined();
    expect(plugin.matchPhrase).toBeUndefined();
  });

  it('tokenizes by whitespace + punctuation', () => {
    const tokens = fallbackTokenize('Hello, world!');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.text).toBe('hello');
    expect(tokens[0]!.start).toBe(0);
    expect(tokens[1]!.text).toBe('world');
    expect(tokens[1]!.start).toBe(7);
  });

  it('handles empty string', () => {
    expect(fallbackTokenize('')).toEqual([]);
  });

  it('handles punctuation-only string', () => {
    expect(fallbackTokenize('!!!...')).toEqual([]);
  });
});

describe('PluginRegistry', () => {
  it('returns the fallback for an unregistered language', () => {
    const registry = new PluginRegistry();
    const plugin = registry.get('xyz');
    expect(plugin.langCode).toBe('xyz');
    expect(plugin.readingKind).toBe('none');
  });

  it('returns the registered plugin for a known language', () => {
    const registry = new PluginRegistry();
    const en = createEnglishPlugin(compilePhraseIndex([]));
    registry.register(en);
    expect(registry.get('en')).toBe(en);
  });

  it('has() returns true for registered, false for unregistered', () => {
    const registry = new PluginRegistry();
    registry.register(createEnglishPlugin(compilePhraseIndex([])));
    expect(registry.has('en')).toBe(true);
    expect(registry.has('fr')).toBe(false);
  });

  it('listLangs() returns all registered language codes', () => {
    const registry = new PluginRegistry();
    registry.register(createEnglishPlugin(compilePhraseIndex([])));
    registry.register(createFallbackPlugin('fr'));
    expect(registry.listLangs()).toContain('en');
    expect(registry.listLangs()).toContain('fr');
  });

  it('global pluginRegistry is a PluginRegistry instance', () => {
    expect(pluginRegistry).toBeInstanceOf(PluginRegistry);
  });
});
