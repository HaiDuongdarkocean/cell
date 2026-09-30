import { readViaAnkiConnect, type AnkiConnectInvoker } from './connectAdapter';

function fakeInvoker(handlers: Record<string, (params?: Record<string, unknown>) => unknown>): AnkiConnectInvoker {
  return async (action, params) => {
    const h = handlers[action];
    if (!h) throw new Error(`unsupported action ${action}`);
    return h(params);
  };
}

const BASE_HANDLERS: Record<string, (params?: Record<string, unknown>) => unknown> = {
  deckNamesAndIds: () => ({ 'Default': 1, 'Languages::JP::Core2k': 1600000000002, 'Filtered': 9 }),
  getDeckConfig: (p) => (p?.deck === 'Filtered' ? { dyn: 1 } : { dyn: 0 }),
  modelNamesAndIds: () => ({ 'Basic': 1500000000001, 'ClozeX': 1500000000002 }),
  modelFieldNames: (p) => (p?.modelName === 'ClozeX' ? ['Text', 'Extra'] : ['Front', 'Back']),
  findNotes: () => [101, 102],
  notesInfo: () => [
    {
      noteId: 101, modelName: 'Basic', tags: ['jlpt'],
      fields: { Front: { value: '猫', order: 0 }, Back: { value: 'cat', order: 1 } },
      cards: [1001, 1002],
    },
    {
      noteId: 102, modelName: 'ClozeX', tags: [],
      fields: { Text: { value: '{{c1::犬}} is dog', order: 0 }, Extra: { value: '', order: 1 } },
      cards: [1003],
    },
  ],
  cardsInfo: (p) => {
    const ids = p?.cards as number[];
    const all: Record<number, object> = {
      1001: { cardId: 1001, note: 101, deckName: 'Languages::JP::Core2k', ord: 0, type: 2, queue: 2, due: 42, interval: 30, factor: 2500, reps: 12, lapses: 1, left: 0, odid: 0, modelName: 'Basic' },
      1002: { cardId: 1002, note: 101, deckName: 'Languages::JP::Core2k', ord: 1, type: 0, queue: 0, due: 7, interval: 0, factor: 0, reps: 0, lapses: 0, left: 0, odid: 0, modelName: 'Basic' },
      1003: { cardId: 1003, note: 102, deckName: 'Filtered', ord: 0, type: 2, queue: 2, due: 10, interval: 5, factor: 2000, reps: 3, lapses: 0, left: 0, odid: 1600000000002, modelName: 'ClozeX' },
    };
    return ids.map((id) => all[id]);
  },
  getReviewsOfCards: (p) => {
    const ids = p?.cards as number[];
    const out: Record<string, object[]> = {};
    for (const id of ids) {
      out[String(id)] = id === 1001 ? [{ id: 1700000000001, ease: 3, ivl: 30, time: 4000 }] : [];
    }
    return out;
  },
  getMediaFilesNames: () => ['cat.mp3'],
  retrieveMediaFile: (p) => (p?.filename === 'cat.mp3' ? 'QUJD' : false),
};

describe('readViaAnkiConnect', () => {
  it('maps decks, notetypes, notes, cards and revlog', async () => {
    const data = await readViaAnkiConnect(fakeInvoker(BASE_HANDLERS));
    expect(data.source).toBe('ankiconnect');
    expect(data.fidelity).toBe('estimated');
    expect(data.crtMs).toBeNull();

    expect(data.decks.map((d) => ({ id: d.id, name: d.name, filtered: d.filtered }))).toEqual([
      { id: '1', name: 'Default', filtered: false },
      { id: '1600000000002', name: 'Languages::JP::Core2k', filtered: false },
      { id: '9', name: 'Filtered', filtered: true },
    ]);

    const basic = data.notetypes.find((n) => n.name === 'Basic');
    const cloze = data.notetypes.find((n) => n.name === 'ClozeX');
    expect(basic?.isCloze).toBe(false);
    expect(cloze?.isCloze).toBe(true); // detected from {{c1:: markup in note fields
    expect(basic?.fields.map((f) => f.name)).toEqual(['Front', 'Back']);

    expect(data.notes).toHaveLength(2);
    expect(data.notes[0].fields).toEqual(['猫', 'cat']);
    expect(data.notes[0].tags).toEqual(['jlpt']);

    expect(data.cards).toHaveLength(3);
    const c1001 = data.cards.find((c) => c.id === 1001);
    expect(c1001?.deckId).toBe('1600000000002');
    expect(c1001?.ivl).toBe(30);
    expect(c1001?.queue).toBe(2);
    const c1003 = data.cards.find((c) => c.id === 1003);
    expect(c1003?.odid).toBe(1600000000002);

    expect(data.revlog).toEqual([{ id: 1700000000001, cardId: 1001, ease: 3, ivl: 30, time: 4000 }]);
    expect(data.hasScheduling).toBe(true);
  });

  it('flags a deck as filtered by odid heuristic when getDeckConfig fails', async () => {
    const invoker = fakeInvoker({
      ...BASE_HANDLERS,
      getDeckConfig: () => { throw new Error('unsupported'); },
      deckNamesAndIds: () => ({ Home: 1, Filtered: 9 }),
      findNotes: () => [101],
      notesInfo: () => [{
        noteId: 101, modelName: 'Basic', tags: [],
        fields: { Front: { value: 'a', order: 0 }, Back: { value: 'b', order: 1 } },
        cards: [1001, 1004],
      }],
      cardsInfo: () => [
        { cardId: 1001, note: 101, deckName: 'Filtered', ord: 0, type: 2, queue: 2, due: 5, interval: 3, factor: 2300, reps: 2, lapses: 0, left: 0, odid: 1, modelName: 'Basic' },
        { cardId: 1004, note: 101, deckName: 'Home', ord: 1, type: 0, queue: 0, due: 0, interval: 0, factor: 0, reps: 0, lapses: 0, left: 0, odid: 0, modelName: 'Basic' },
      ],
    });
    const data = await readViaAnkiConnect(invoker);
    expect(data.decks.find((d) => d.name === 'Filtered')?.filtered).toBe(true);
    expect(data.decks.find((d) => d.name === 'Home')?.filtered).toBe(false);
  });

  it('continues without review history when getReviewsOfCards is unsupported', async () => {
    const invoker = fakeInvoker({
      ...BASE_HANDLERS,
      getReviewsOfCards: () => { throw new Error('action not supported'); },
    });
    const data = await readViaAnkiConnect(invoker);
    expect(data.revlog).toEqual([]);
    expect(data.cards).toHaveLength(3);
  });

  it('resolves media via retrieveMediaFile base64', async () => {
    const data = await readViaAnkiConnect(fakeInvoker(BASE_HANDLERS));
    const media = await data.media.resolve('cat.mp3');
    expect(media?.mimeType).toBe('audio/mpeg');
    expect(new Uint8Array(media!.bytes)).toEqual(new Uint8Array([65, 66, 67])); // 'ABC'
    expect(await data.media.resolve('missing.png')).toBeNull();
  });

  it('aborts cleanly when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(readViaAnkiConnect(fakeInvoker(BASE_HANDLERS), { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
  });
});
