import { connectionId, profileIdForTarget, scopeForTarget, targetOf } from './scope';

describe('targetOf', () => {
  it('maps language values to their ISO-639-1 base', () => {
    expect(targetOf('en')).toBe('en');
    expect(targetOf('en-US')).toBe('en');
    expect(targetOf('zh-hant')).toBe('zh');
    expect(targetOf('zh-Hant-TW')).toBe('zh');
    expect(targetOf('eng')).toBe('en');
    expect(targetOf('jpn')).toBe('ja');
  });
});

describe('deterministic ids', () => {
  it('profile id derives from target only', () => {
    expect(profileIdForTarget('ko')).toBe('profile-ko');
  });

  it('scope derives from target', () => {
    expect(scopeForTarget('ko')).toBe('profile:ko');
  });

  it('connectionId is provider:accountKey', () => {
    expect(connectionId('google-drive', 'sub123')).toBe('google-drive:sub123');
  });
});
