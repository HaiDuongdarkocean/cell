import { detectPackage } from './detectPackage';

describe('detectPackage', () => {
  it('detects a conventional dsl + dsl.files.zip pair', () => {
    const r = detectPackage(['ForvoEnglish.dsl', 'ForvoEnglish.dsl.files.zip', 'readme.txt']);
    expect(r).toEqual({
      ok: true,
      pkg: { dslName: 'ForvoEnglish.dsl', kind: 'single', zipName: 'ForvoEnglish.dsl.files.zip' },
    });
  });

  it('prefers the dsl whose basename matches the archive', () => {
    const r = detectPackage(['other.dsl', 'ForvoEnglish.dsl.files.zip', 'ForvoEnglish.dsl']);
    expect(r).toEqual({
      ok: true,
      pkg: { dslName: 'ForvoEnglish.dsl', kind: 'single', zipName: 'ForvoEnglish.dsl.files.zip' },
    });
  });

  it('falls back to the first dsl when no name matches the archive', () => {
    const r = detectPackage(['sound.dsl', 'bundle.dsl.files.zip']);
    expect(r.ok && r.pkg.dslName).toBe('sound.dsl');
  });

  it('treats a lone zip of any name as a single package', () => {
    const r = detectPackage(['idx.dsl', 'audio.zip']);
    expect(r).toEqual({ ok: true, pkg: { dslName: 'idx.dsl', kind: 'single', zipName: 'audio.zip' } });
  });

  it('derives a first-letter pattern from per-letter zips', () => {
    const r = detectPackage([
      'ForvoEnglish.dsl',
      'ForvoEnglish_a.zip',
      'ForvoEnglish_b.zip',
      'ForvoEnglish_c.zip',
    ]);
    expect(r).toEqual({
      ok: true,
      pkg: { dslName: 'ForvoEnglish.dsl', kind: 'split', pattern: 'ForvoEnglish_{firstLetter}.zip' },
    });
  });

  it('derives a pattern for bare letter zips', () => {
    const r = detectPackage(['idx.dsl', 'a.zip', 'b.zip']);
    expect(r).toEqual({
      ok: true,
      pkg: { dslName: 'idx.dsl', kind: 'split', pattern: '{firstLetter}.zip' },
    });
  });

  it('rejects mixed non-letter zips', () => {
    const r = detectPackage(['idx.dsl', 'backup_final.zip', 'backup_draft.zip']);
    expect(r).toEqual({ ok: false, reason: 'no-archive' });
  });

  it('rejects digit-suffixed zips', () => {
    const r = detectPackage(['idx.dsl', 'part1.zip', 'part2.zip']);
    expect(r).toEqual({ ok: false, reason: 'no-archive' });
  });

  it('fails when no dsl exists', () => {
    expect(detectPackage(['a.zip'])).toEqual({ ok: false, reason: 'no-dsl' });
  });

  it('fails when no archive exists', () => {
    expect(detectPackage(['idx.dsl', 'notes.txt'])).toEqual({ ok: false, reason: 'no-archive' });
  });
});
