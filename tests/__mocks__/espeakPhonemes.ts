/**
 * Jest mock for @jocelyn-stericker/espeak-phonemes.
 *
 * The real package loads a WASM binary that cannot run in jsdom/Jest.
 * Tests for the pronunciation engine inject a stub engine directly,
 * so this mock just needs to satisfy the module shape.
 */

export const textToIPA = jest.fn().mockReturnValue('həlˈəʊ');
export const createESpeak = jest.fn().mockResolvedValue({ textToIPA });

export interface IPAPhonemeOptions {
  readonly voice?: 'en' | 'en-us';
  readonly separator?: string;
  readonly keepStress?: boolean;
  readonly tie?: string;
}
