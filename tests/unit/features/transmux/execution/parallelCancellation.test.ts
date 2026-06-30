import {
  CancellationToken,
  CancellationTokenRegistry,
  ParallelConversionCancelledError,
  cleanupParallelTempFiles,
} from '@/features/transmux/execution/parallelCancellation';

// --- OPFS mock (minimal) ---

class MockFileHandle {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

class MockDirHandle {
  name: string;
  files = new Map<string, MockFileHandle>();
  dirs = new Map<string, MockDirHandle>();

  constructor(name: string) {
    this.name = name;
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MockFileHandle> {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (opts?.create) {
      const h = new MockFileHandle(name);
      this.files.set(name, h);
      return h;
    }
    throw new DOMException(`File not found: ${name}`, 'NotFoundError');
  }

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MockDirHandle> {
    const existing = this.dirs.get(name);
    if (existing) return existing;
    if (opts?.create) {
      const d = new MockDirHandle(name);
      this.dirs.set(name, d);
      return d;
    }
    throw new DOMException(`Dir not found: ${name}`, 'NotFoundError');
  }

  async removeEntry(name: string): Promise<void> {
    if (this.files.delete(name)) return;
    if (this.dirs.delete(name)) return;
    throw new DOMException(`Not found: ${name}`, 'NotFoundError');
  }

  async *values(): AsyncIterableIterator<{ kind: 'file'; name: string } | { kind: 'directory'; name: string }> {
    for (const name of this.files.keys()) yield { kind: 'file', name };
    for (const name of this.dirs.keys()) yield { kind: 'directory', name };
  }
}

const rootDir = new MockDirHandle('root');
const storageMock = { getDirectory: async () => rootDir };

beforeAll(() => {
  Object.defineProperty(globalThis.navigator, 'storage', {
    value: storageMock,
    configurable: true,
  });
});

beforeEach(() => {
  rootDir.dirs.clear();
});

describe('CancellationToken', () => {
  it('starts as not cancelled', () => {
    const token = new CancellationToken();
    expect(token.isCancelled()).toBe(false);
  });

  it('cancel() sets cancelled state', () => {
    const token = new CancellationToken();
    token.cancel();
    expect(token.isCancelled()).toBe(true);
  });

  it('cancel() is idempotent', () => {
    const token = new CancellationToken();
    token.cancel();
    token.cancel();
    expect(token.isCancelled()).toBe(true);
  });

  it('throwIfCancelled() throws when cancelled', () => {
    const token = new CancellationToken();
    token.cancel();
    expect(() => token.throwIfCancelled()).toThrow(ParallelConversionCancelledError);
  });

  it('throwIfCancelled() does not throw when not cancelled', () => {
    const token = new CancellationToken();
    expect(() => token.throwIfCancelled()).not.toThrow();
  });

  it('onCancel() fires when cancelled', () => {
    const token = new CancellationToken();
    let called = false;
    token.onCancel(() => { called = true; });
    expect(called).toBe(false);
    token.cancel();
    expect(called).toBe(true);
  });

  it('onCancel() fires immediately if already cancelled', () => {
    const token = new CancellationToken();
    token.cancel();
    let called = false;
    token.onCancel(() => { called = true; });
    expect(called).toBe(true);
  });
});

describe('CancellationTokenRegistry', () => {
  it('creates and retrieves tokens', () => {
    const registry = new CancellationTokenRegistry();
    const token = registry.create('dl-1');
    expect(registry.get('dl-1')).toBe(token);
  });

  it('cancel() cancels the token for a downloadId', () => {
    const registry = new CancellationTokenRegistry();
    registry.create('dl-1');
    registry.cancel('dl-1');
    expect(registry.isCancelled('dl-1')).toBe(true);
  });

  it('cancel() is no-op for unknown downloadId', () => {
    const registry = new CancellationTokenRegistry();
    expect(() => registry.cancel('unknown')).not.toThrow();
  });

  it('dispose() removes the token', () => {
    const registry = new CancellationTokenRegistry();
    registry.create('dl-1');
    registry.dispose('dl-1');
    expect(registry.get('dl-1')).toBeUndefined();
  });

  it('isCancelled() returns false for unknown downloadId', () => {
    const registry = new CancellationTokenRegistry();
    expect(registry.isCancelled('unknown')).toBe(false);
  });

  it('clear() removes all tokens', () => {
    const registry = new CancellationTokenRegistry();
    registry.create('dl-1');
    registry.create('dl-2');
    registry.clear();
    expect(registry.get('dl-1')).toBeUndefined();
    expect(registry.get('dl-2')).toBeUndefined();
  });
});

describe('cleanupParallelTempFiles', () => {
  it('returns zero cleaned when no part files exist', async () => {
    // Create downloads/dl-test/ dir
    const downloadsDir = new MockDirHandle('downloads');
    rootDir.dirs.set('downloads', downloadsDir);
    const sub = new MockDirHandle('dl-test');
    downloadsDir.dirs.set('dl-test', sub);

    const result = await cleanupParallelTempFiles('dl-test');
    expect(result.cleaned).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('removes part-*.fmp4 files', async () => {
    const downloadsDir = new MockDirHandle('downloads');
    rootDir.dirs.set('downloads', downloadsDir);
    const sub = new MockDirHandle('dl-test');
    downloadsDir.dirs.set('dl-test', sub);
    sub.files.set('part-0.fmp4', new MockFileHandle('part-0.fmp4'));
    sub.files.set('part-1.fmp4', new MockFileHandle('part-1.fmp4'));
    sub.files.set('input.ts', new MockFileHandle('input.ts'));
    sub.files.set('output.mp4', new MockFileHandle('output.mp4'));

    const result = await cleanupParallelTempFiles('dl-test');
    expect(result.cleaned).toBe(2);
    expect(sub.files.has('part-0.fmp4')).toBe(false);
    expect(sub.files.has('part-1.fmp4')).toBe(false);
    expect(sub.files.has('input.ts')).toBe(true);
    expect(sub.files.has('output.mp4')).toBe(true);
  });

  it('handles missing download directory gracefully', async () => {
    const result = await cleanupParallelTempFiles('nonexistent');
    expect(result.cleaned).toBe(0);
    expect(result.errors).toBe(0);
  });
});
