import {
  folderedTarget,
  logicalPathOf,
  mapLogicalPath,
  scopeFolderName,
  scopeOfFolderName,
} from './driveLayout';

describe('scopeFolderName/scopeOfFolderName', () => {
  it('round-trips global', () => {
    expect(scopeOfFolderName(scopeFolderName('global'))).toBe('global');
  });

  it('sanitizes profile colon to dash and back', () => {
    expect(scopeFolderName('profile:en')).toBe('profile-en');
    expect(scopeFolderName('profile:en-US')).toBe('profile-en-US');
    expect(scopeOfFolderName('profile-en-US')).toBe('profile:en-US');
  });

  it('rejects unknown names', () => {
    expect(scopeOfFolderName('blobs')).toBeNull();
    expect(scopeOfFolderName('meta')).toBeNull();
    expect(scopeOfFolderName('profile-')).toBeNull();
    expect(scopeOfFolderName('other')).toBeNull();
  });
});

describe('mapLogicalPath', () => {
  it('maps device chain files', () => {
    expect(mapLogicalPath('cell-sync/v1/scopes/global/devices/dev1/journal-3.json.gz')).toEqual({
      chain: ['global', 'dev1'],
      leaf: 'journal-3.json.gz',
    });
  });

  it('maps profile scopes with sanitized folder name', () => {
    expect(
      mapLogicalPath('cell-sync/v1/scopes/profile:en/devices/d2/snapshot-5.json.gz'),
    ).toEqual({ chain: ['profile-en', 'd2'], leaf: 'snapshot-5.json.gz' });
  });

  it('maps blobs and meta', () => {
    expect(mapLogicalPath('cell-sync/v1/blobs/abc123')).toEqual({
      chain: ['blobs'],
      leaf: 'abc123',
    });
    expect(mapLogicalPath('cell-sync/v1/meta/disconnect.json')).toEqual({
      chain: ['meta'],
      leaf: 'disconnect.json',
    });
    expect(mapLogicalPath('cell-sync/v1/meta/blobs-needed/abc')).toEqual({
      chain: ['meta', 'blobs-needed'],
      leaf: 'abc',
    });
  });

  it('renames route markers colon to dash', () => {
    expect(mapLogicalPath('cell-sync/v1/meta/routes/profile:en.json')).toEqual({
      chain: ['meta', 'routes'],
      leaf: 'profile-en.json',
    });
    expect(mapLogicalPath('cell-sync/v1/meta/routes/global.json')).toEqual({
      chain: ['meta', 'routes'],
      leaf: 'global.json',
    });
  });

  it('rejects out-of-tree and malformed in-tree paths', () => {
    expect(mapLogicalPath('other/file')).toBeNull();
    expect(mapLogicalPath('cell-sync/v1')).toBeNull();
    expect(mapLogicalPath('cell-sync/v1/nothing/x')).toBeNull();
    expect(mapLogicalPath('cell-sync/v1/scopes/global/dev1/journal-1.json.gz')).toBeNull();
    expect(mapLogicalPath('cell-sync/v1/scopes/global/devices//journal-1.json.gz')).toBeNull();
    expect(mapLogicalPath('cell-sync/v1/blobs/a/b')).toBeNull();
    expect(mapLogicalPath('cell-sync/v1/meta/a/b')).toBeNull();
    expect(mapLogicalPath('cell-sync/v1/meta/routes/a/b.json')).toBeNull();
  });
});

describe('logicalPathOf', () => {
  it('reconstructs device chain paths and filters non-chain leaves', () => {
    expect(logicalPathOf(['global', 'd1'], 'journal-1.json.gz')).toBe(
      'cell-sync/v1/scopes/global/devices/d1/journal-1.json.gz',
    );
    expect(logicalPathOf(['profile-en', 'd1'], 'snapshot-2.json.gz')).toBe(
      'cell-sync/v1/scopes/profile:en/devices/d1/snapshot-2.json.gz',
    );
    expect(logicalPathOf(['global', 'd1'], 'stray.txt')).toBeNull();
  });

  it('reconstructs blobs and meta paths', () => {
    expect(logicalPathOf(['blobs'], 'a1b2')).toBe('cell-sync/v1/blobs/a1b2');
    expect(logicalPathOf(['blobs'], 'has-dash')).toBeNull();
    expect(logicalPathOf(['meta'], 'disconnect.json')).toBe('cell-sync/v1/meta/disconnect.json');
    expect(logicalPathOf(['meta', 'blobs-needed'], 'a3f9c2')).toBe(
      'cell-sync/v1/meta/blobs-needed/a3f9c2',
    );
    expect(logicalPathOf(['meta', 'routes'], 'profile-en.json')).toBe(
      'cell-sync/v1/meta/routes/profile:en.json',
    );
  });
});

describe('folderedTarget', () => {
  it('classifies ancestor prefixes as tree', () => {
    for (const p of ['', 'cell-sync', 'cell-sync/v1', 'cell-sync/v1/']) {
      expect(folderedTarget(p)).toEqual({ kind: 'tree' });
    }
  });

  it('classifies scopes prefixes', () => {
    expect(folderedTarget('cell-sync/v1/scopes/')).toEqual({ kind: 'scopes', scopePrefix: '' });
    expect(folderedTarget('cell-sync/v1/scopes/profile:en')).toEqual({
      kind: 'scopes',
      scopePrefix: 'profile:en',
    });
  });

  it('classifies chain prefixes with leaf filters', () => {
    expect(folderedTarget('cell-sync/v1/scopes/profile:en/devices/dev1/journal-')).toEqual({
      kind: 'chain',
      chain: ['profile-en', 'dev1'],
      leafPrefix: 'journal-',
    });
    expect(folderedTarget('cell-sync/v1/scopes/global/devices/dev1/')).toEqual({
      kind: 'chain',
      chain: ['global', 'dev1'],
      leafPrefix: '',
    });
    expect(folderedTarget('cell-sync/v1/blobs/')).toEqual({
      kind: 'chain',
      chain: ['blobs'],
      leafPrefix: '',
    });
    expect(folderedTarget('cell-sync/v1/meta/routes/')).toEqual({
      kind: 'chain',
      chain: ['meta', 'routes'],
      leafPrefix: '',
    });
  });

  it('treats mid-device-id prefixes as scope-folder descent', () => {
    expect(folderedTarget('cell-sync/v1/scopes/global/devices/dev')).toEqual({
      kind: 'chain',
      chain: ['global'],
      leafPrefix: 'dev',
    });
  });

  it('returns null for flat-only or unknown in-tree prefixes', () => {
    expect(folderedTarget('other/')).toBeNull();
    expect(folderedTarget('cell-sync/v1/nothing/')).toBeNull();
    expect(folderedTarget('cell-sync/v1/blobs/a/b')).toBeNull();
  });
});
