import { scheduleOnExternalChange } from './externalChanges';
import type { StorageChangeListener } from './externalChanges';

describe('scheduleOnExternalChange', () => {
  it('invokes the callback only when a synced key changes on the local area', () => {
    let listener: StorageChangeListener | undefined;
    const attached: StorageChangeListener[] = [];
    const removed: StorageChangeListener[] = [];
    const cb = jest.fn();
    const off = scheduleOnExternalChange(cb, {
      addListener: (l) => {
        attached.push(l);
        listener = l;
      },
      removeListener: (l) => {
        removed.push(l);
        if (l === listener) listener = undefined;
      },
    });
    expect(listener).toBeDefined();
    const fire = (changes: Record<string, unknown>, area = 'local') => listener?.(changes, area);

    fire({ syncMetaKV: { oldValue: {}, newValue: {} } });
    fire({ unrelatedKey: { newValue: 1 } });
    fire({ settings: { newValue: {} } }, 'session');
    expect(cb).not.toHaveBeenCalled();

    fire({ settings: { newValue: {} } });
    fire({ themeMode: { newValue: 'light' } });
    fire({ syncState: { newValue: {} } });
    expect(cb).toHaveBeenCalledTimes(2);

    off();
    expect(removed).toEqual(attached);
    fire({ settings: { newValue: {} } });
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
