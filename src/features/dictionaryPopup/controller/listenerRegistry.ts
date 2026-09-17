interface ListenerEntry {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: EventListenerOrEventListenerObject;
  readonly options?: boolean | AddEventListenerOptions;
}

export interface ListenerRegistry {
  readonly add: (
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  readonly removeAll: () => void;
}

export function createListenerRegistry(): ListenerRegistry {
  const entries: ListenerEntry[] = [];
  return {
    add(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      entries.push({ target, type, listener, options });
    },
    removeAll() {
      for (const entry of entries) {
        entry.target.removeEventListener(entry.type, entry.listener, entry.options);
      }
      entries.length = 0;
    },
  };
}
