import { createEspeakPhonemeEngine } from './espeakPhonemeEngine';

describe('createEspeakPhonemeEngine', () => {
  it('initializes once and converts text to IPA', async () => {
    const init = jest.fn().mockResolvedValue({
      textToIPA: jest.fn().mockReturnValue('həlˈəʊ'),
    });

    const engine = createEspeakPhonemeEngine(init);
    const ipa1 = await engine.toIpa('hello');
    const ipa2 = await engine.toIpa('world');

    expect(init).toHaveBeenCalledTimes(1);
    expect(ipa1).toBe('həlˈəʊ');
    expect(ipa2).toBe('həlˈəʊ');
  });

  it('passes options to the underlying engine', async () => {
    const textToIPA = jest.fn().mockReturnValue('həlˈoʊ');
    const init = jest.fn().mockResolvedValue({ textToIPA });

    const engine = createEspeakPhonemeEngine(init);
    await engine.toIpa('hello', { voice: 'en-us' });

    expect(textToIPA).toHaveBeenCalledWith('hello', { voice: 'en-us' });
  });
});
