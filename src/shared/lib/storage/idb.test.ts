import { idbRequest, txDone } from './idb';

function fakeRequest<T>(result: T): IDBRequest<T> {
  return {
    result,
    error: null,
    onsuccess: null,
    onerror: null,
  } as unknown as IDBRequest<T>;
}

function fakeTx(error: DOMException | null = null): IDBTransaction {
  return {
    error,
    oncomplete: null,
    onerror: null,
    onabort: null,
  } as unknown as IDBTransaction;
}

describe('idbRequest', () => {
  it('resolves with request.result on success', async () => {
    const req = fakeRequest(42);
    const p = idbRequest(req);
    req.onsuccess?.(new Event('success'));
    await expect(p).resolves.toBe(42);
  });

  it('rejects with request.error on error', async () => {
    const req = fakeRequest<number>(0);
    const err = new DOMException('boom');
    (req as { error: DOMException | null }).error = err;
    const p = idbRequest(req);
    req.onerror?.(new Event('error'));
    await expect(p).rejects.toBe(err);
  });
});

describe('txDone', () => {
  it('resolves on complete', async () => {
    const tx = fakeTx();
    const p = txDone(tx);
    tx.oncomplete?.(new Event('complete'));
    await expect(p).resolves.toBeUndefined();
  });

  it('rejects with tx.error on error', async () => {
    const err = new DOMException('constraint');
    const tx = fakeTx(err);
    const p = txDone(tx);
    tx.onerror?.(new Event('error'));
    await expect(p).rejects.toBe(err);
  });

  it('rejects on abort with generic error when tx.error is null', async () => {
    const tx = fakeTx();
    const p = txDone(tx);
    tx.onabort?.(new Event('abort'));
    await expect(p).rejects.toThrow('idb tx failed');
  });
});
