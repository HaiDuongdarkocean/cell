import { emitDictionaryChanged, onDictionaryChangedVisible } from './dictionaryEvents';

const setVisibility = (v: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
};

describe('onDictionaryChangedVisible', () => {
  afterEach(() => setVisibility('visible'));

  it('fires immediately when the document is visible', () => {
    const seen: string[] = [];
    const unsub = onDictionaryChangedVisible((d) => seen.push(d.langCode));
    emitDictionaryChanged({ langCode: 'en', reason: 'import' });
    expect(seen).toEqual(['en']);
    unsub();
  });

  it('defers while hidden and flushes the latest event on visibilitychange', () => {
    const seen: string[] = [];
    setVisibility('hidden');
    const unsub = onDictionaryChangedVisible((d) => seen.push(d.langCode));
    emitDictionaryChanged({ langCode: 'en', reason: 'import' });
    emitDictionaryChanged({ langCode: 'vi', reason: 'import' });
    expect(seen).toEqual([]);
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(seen).toEqual(['vi']);
    unsub();
  });

  it('does not flush pending events after unsubscribe', () => {
    const seen: string[] = [];
    setVisibility('hidden');
    const unsub = onDictionaryChangedVisible((d) => seen.push(d.langCode));
    emitDictionaryChanged({ langCode: 'en', reason: 'import' });
    unsub();
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(seen).toEqual([]);
  });
});
