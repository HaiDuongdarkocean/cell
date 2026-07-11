/**
 * Unit tests for cardCreatorService.
 *
 * Mocks `sendMessage` so we can assert the AnkiConnect action + params sent
 * and inject canned responses. Covers the Android silent no-op detection
 * for `addTags` and `createModel` (default switch case returns
 * "AnkiConnect v.6" instead of an error).
 */
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import {
  testConnection,
  listDecks,
  listModels,
  listModelFields,
  findRecentNote,
  getNoteInfo,
  storeMedia,
  addNote,
  updateNote,
  addNoteTags,
  ensureDefaultModel,
} from './cardCreatorService';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));
const mockedSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>;

const URL = 'http://localhost:8765';

/** Queue canned responses (in order). Each is either an AnkiConnect result
 *  value (success) or an Error (sendMessage throws). */
function queueResponses(responses: Array<{ result: unknown; error?: string } | Error>): void {
  let calls = 0;
  mockedSendMessage.mockImplementation(async () => {
    const r = responses[calls++];
    if (r instanceof Error) throw r;
    return { success: !r.error, data: { result: r.result }, error: r.error };
  });
}

/** Captured payload type. */
type CapturedPayload = { action: string; params?: Record<string, unknown> };

/** Queue a single response but also capture the payload sent. */
function queueInspecting(
  response: { result: unknown; error?: string },
  inspect: (payload: CapturedPayload) => void,
): void {
  mockedSendMessage.mockImplementation(async (req: unknown) => {
    const payload = (req as { payload: CapturedPayload }).payload;
    inspect(payload);
    return { success: !response.error, data: { result: response.result }, error: response.error };
  });
}

describe('cardCreatorService', () => {
  afterEach(() => {
    mockedSendMessage.mockReset();
  });

  describe('testConnection', () => {
    it('returns version on success', async () => {
      queueResponses([{ result: 6 }]);
      const r = await testConnection(URL);
      expect(r.ok).toBe(true);
      expect(r.ok && r.value).toBe(6);
    });

    it('returns error on AnkiConnect error', async () => {
      queueResponses([{ result: null, error: 'connection refused' }]);
      const r = await testConnection(URL);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toBe('connection refused');
    });

    it('returns error on sendMessage throw', async () => {
      queueResponses([new Error('runtime disconnected')]);
      const r = await testConnection(URL);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toBe('runtime disconnected');
    });
  });

  describe('listDecks / listModels / listModelFields', () => {
    it('listDecks returns string[]', async () => {
      queueResponses([{ result: ['Default', 'Japanese'] }]);
      const r = await listDecks(URL);
      expect(r.ok && r.value).toEqual(['Default', 'Japanese']);
    });

    it('listModels returns string[]', async () => {
      queueResponses([{ result: ['Basic', 'Cell Video Card'] }]);
      const r = await listModels(URL);
      expect(r.ok && r.value).toEqual(['Basic', 'Cell Video Card']);
    });

    it('listModelFields sends modelName param', async () => {
      const captured: { value: CapturedPayload | null } = { value: null };
      queueInspecting({ result: ['Front', 'Back'] }, (p) => {
        captured.value = p;
      });
      const r = await listModelFields(URL, 'Basic');
      expect(captured.value?.action).toBe('modelFieldNames');
      expect(captured.value?.params?.modelName).toBe('Basic');
      expect(r.ok && r.value).toEqual(['Front', 'Back']);
    });
  });

  describe('findRecentNote', () => {
    it('returns null when no notes found', async () => {
      queueResponses([{ result: [] }]);
      const r = await findRecentNote(URL, 'Default', 'Basic');
      expect(r.ok && r.value).toBeNull();
    });

    it('returns newest note id (sorted desc)', async () => {
      queueResponses([{ result: [100, 300, 200] }]);
      const r = await findRecentNote(URL, 'Default', 'Basic');
      expect(r.ok && r.value).toBe(300);
    });

    it('does not quote simple deck/model names (Android compat)', async () => {
      const captured: { value: CapturedPayload | null } = { value: null };
      queueInspecting({ result: [] }, (p) => {
        captured.value = p;
      });
      await findRecentNote(URL, 'Default', 'Basic');
      expect(captured.value?.params?.query).toBe('deck:Default note:Basic');
    });

    it('quotes deck/model names with spaces (Android compat)', async () => {
      const captured: { value: CapturedPayload | null } = { value: null };
      queueInspecting({ result: [] }, (p) => {
        captured.value = p;
      });
      await findRecentNote(URL, 'My Deck', 'Mining Note');
      expect(captured.value?.params?.query).toBe('deck:"My Deck" note:"Mining Note"');
    });
  });

  describe('getNoteInfo', () => {
    it('returns flattened fields + tags', async () => {
      queueResponses([
        {
          result: [
            {
              noteId: 123,
              modelName: 'Basic',
              fields: { Front: { value: 'hi', order: 0 }, Back: { value: 'yo', order: 1 } },
              tags: ['a', 'b'],
            },
          ],
        },
      ]);
      const r = await getNoteInfo(URL, 123);
      expect(r.ok && r.value).toEqual({
        noteId: 123,
        modelName: 'Basic',
        fields: { Front: 'hi', Back: 'yo' },
        tags: ['a', 'b'],
      });
    });

    it('returns null when note not found', async () => {
      queueResponses([{ result: [] }]);
      const r = await getNoteInfo(URL, 999);
      expect(r.ok && r.value).toBeNull();
    });
  });

  describe('storeMedia', () => {
    it('returns stored filename (Android may rename)', async () => {
      queueResponses([{ result: 'cell-screenshot_123456789.png' }]);
      const r = await storeMedia(URL, 'cell-screenshot.png', 'aGVsbG8=');
      expect(r.ok && r.value).toBe('cell-screenshot_123456789.png');
    });

    it('falls back to input filename when desktop returns null', async () => {
      queueResponses([{ result: null }]);
      const r = await storeMedia(URL, 'cell-screenshot.png', 'aGVsbG8=');
      expect(r.ok && r.value).toBe('cell-screenshot.png');
    });
  });

  describe('addNote', () => {
    it('returns note id on success', async () => {
      queueResponses([{ result: 1496198395707 }]);
      const r = await addNote(URL, {
        deckName: 'Default',
        modelName: 'Basic',
        fields: { Front: 'hi', Back: 'yo' },
        tags: ['cell'],
      });
      expect(r.ok && r.value).toBe(1496198395707);
    });

    it('returns null when duplicate skipped', async () => {
      queueResponses([{ result: null }]);
      const r = await addNote(URL, {
        deckName: 'Default',
        modelName: 'Basic',
        fields: { Front: 'hi', Back: 'yo' },
        tags: [],
      });
      expect(r.ok && r.value).toBeNull();
    });
  });

  describe('updateNote', () => {
    it('overwrite: only sends non-empty new fields', async () => {
      const captured: { value: CapturedPayload | null } = { value: null };
      queueInspecting({ result: null }, (p) => {
        captured.value = p;
      });
      const r = await updateNote(
        URL,
        123,
        { Front: 'new', Back: '' },
        'overwrite',
        { Front: 'old', Back: 'old' },
      );
      expect(r.ok).toBe(true);
      const note = captured.value?.params?.note as { id: number; fields: Record<string, string> };
      expect(note.id).toBe(123);
      expect(note.fields).toEqual({ Front: 'new' }); // Back omitted (empty)
    });

    it('append: joins with newline when existing non-empty', async () => {
      const captured: { value: CapturedPayload | null } = { value: null };
      queueInspecting({ result: null }, (p) => {
        captured.value = p;
      });
      await updateNote(URL, 123, { Front: 'new' }, 'append', { Front: 'old' });
      const note = captured.value?.params?.note as { fields: Record<string, string> };
      expect(note.fields.Front).toBe('old\nnew');
    });

    it('append: sets value when existing empty', async () => {
      const captured: { value: CapturedPayload | null } = { value: null };
      queueInspecting({ result: null }, (p) => {
        captured.value = p;
      });
      await updateNote(URL, 123, { Front: 'new' }, 'append', { Front: '' });
      const note = captured.value?.params?.note as { fields: Record<string, string> };
      expect(note.fields.Front).toBe('new');
    });

    it('skip: only sends fields empty in current note', async () => {
      const captured: { value: CapturedPayload | null } = { value: null };
      queueInspecting({ result: null }, (p) => {
        captured.value = p;
      });
      await updateNote(
        URL,
        123,
        { Front: 'new', Back: 'new' },
        'skip',
        { Front: 'filled', Back: '' },
      );
      const note = captured.value?.params?.note as { fields: Record<string, string> };
      expect(note.fields).toEqual({ Back: 'new' }); // Front skipped (non-empty)
    });

    it('skip: no-op when all fields already filled', async () => {
      queueResponses([{ result: null }]);
      const r = await updateNote(
        URL,
        123,
        { Front: 'new' },
        'skip',
        { Front: 'filled' },
      );
      expect(r.ok).toBe(true);
      // No sendMessage call because nothing to update.
      expect(mockedSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('addNoteTags — Android silent no-op detection', () => {
    it('desktop success → result null → ok', async () => {
      queueResponses([{ result: null }]);
      const r = await addNoteTags(URL, 123, ['cell', 'learning']);
      expect(r.ok).toBe(true);
    });

    it('Android default handler → result "AnkiConnect v.6" → error', async () => {
      queueResponses([{ result: 'AnkiConnect v.6' }]);
      const r = await addNoteTags(URL, 123, ['cell']);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toContain('not supported on AnkiconnectAndroid');
    });

    it('empty tags → no-op ok without calling', async () => {
      queueResponses([{ result: null }]);
      const r = await addNoteTags(URL, 123, []);
      expect(r.ok).toBe(true);
      expect(mockedSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('ensureDefaultModel — Android silent no-op detection', () => {
    it('model already exists → ok without createModel call', async () => {
      queueResponses([{ result: ['Basic', 'Cell Video Card'] }]);
      const r = await ensureDefaultModel(URL);
      expect(r.ok).toBe(true);
      // Only one sendMessage call (modelNames); no createModel.
      expect(mockedSendMessage).toHaveBeenCalledTimes(1);
    });

    it('desktop: model missing → createModel → re-check shows model → ok', async () => {
      // Call 1: modelNames (missing). Call 2: createModel. Call 3: modelNames (present).
      queueResponses([
        { result: ['Basic'] },
        { result: null },
        { result: ['Basic', 'Cell Video Card'] },
      ]);
      const r = await ensureDefaultModel(URL);
      expect(r.ok).toBe(true);
    });

    it('Android: model missing → createModel silent no-op → re-check still missing → error', async () => {
      // Call 1: modelNames (missing). Call 2: createModel (returns "AnkiConnect v.6" silently).
      // Call 3: modelNames (still missing).
      queueResponses([
        { result: ['Basic'] },
        { result: 'AnkiConnect v.6' },
        { result: ['Basic'] },
      ]);
      const r = await ensureDefaultModel(URL);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toContain('create the "Cell Video Card" note type manually');
    });
  });
});
