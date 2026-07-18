/**
 * Unit tests for quickAddNote — Quick Add direct (bypass dialog).
 *
 * Mocks `sendMessage` so we can assert the AnkiConnect actions sent and
 * inject canned responses. Covers: happy path (text + media mapped),
 * empty fieldMapping (no fields set), media upload failure (onWarning called,
 * note still added).
 */
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { quickAddNote } from './quickAddNote';
import type { MediaFile } from '../media/mediaFile';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));
const mockedSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>;

const URL = 'http://localhost:8765';

/** Queue canned responses (in order). */
function queueResponses(responses: Array<{ result: unknown; error?: string } | Error>): void {
  let calls = 0;
  mockedSendMessage.mockImplementation(async () => {
    const r = responses[calls++];
    if (r instanceof Error) throw r;
    return { success: !r.error, data: { result: r.result }, error: r.error };
  });
}

/** Capture the last sendMessage payload (action + params from the envelope). */
function captureLastAction(): { action: string; params: Record<string, unknown> } | null {
  const lastCall = mockedSendMessage.mock.calls[mockedSendMessage.mock.calls.length - 1];
  if (!lastCall) return null;
  const envelope = lastCall[0] as { type: string; payload: { action: string; params: Record<string, unknown> } };
  return { action: envelope.payload.action, params: envelope.payload.params };
}

function makeMediaFile(kind: 'image' | 'audio', filename: string): MediaFile {
  return {
    kind,
    filename,
    mimeType: kind === 'image' ? 'image/png' : 'audio/mpeg',
    data: new ArrayBuffer(4),
  };
}

describe('quickAddNote', () => {
  const text = {
    targetWord: 'ephemeral',
    sentence: 'The ephemeral nature of fame.',
    sentenceTranslation: 'Bản chất ngắn ngủi của danh tiếng.',
    definitions: '(adj) lasting a very short time',
    note: '',
    moreExample: '',
  };

  const fieldMapping = {
    targetWord: 'Front',
    sentence: 'Sentence',
    sentenceTranslation: 'Translation',
    definitions: 'Back',
    images: 'Image',
    wordAudios: 'WordAudio',
    sentenceAudios: 'SentenceAudio',
  };

  it('happy path: maps text + media, uploads, adds note', async () => {
    // storeMedia (image) → storeMedia (sentenceAudio) → storeMedia (wordAudio) → addNote
    queueResponses([
      { result: 'cell-img-1.png' },
      { result: 'cell-audio-2.mp3' },
      { result: 'cell-audio-1.mp3' },
      { result: 12345 },
    ]);

    const r = await quickAddNote(
      URL,
      'Default',
      'Basic',
      fieldMapping,
      'cell learning',
      text,
      {
        images: [makeMediaFile('image', 'cell-img-1.png')],
        wordAudios: [makeMediaFile('audio', 'cell-audio-1.mp3')],
        sentenceAudios: [makeMediaFile('audio', 'cell-audio-2.mp3')],
      },
    );

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.noteId).toBe(12345);

    // Last action should be addNote with mapped fields.
    const last = captureLastAction();
    expect(last?.action).toBe('addNote');
    const note = (last?.params as { note: Record<string, unknown> }).note;
    expect(note.deckName).toBe('Default');
    expect(note.modelName).toBe('Basic');
    const fields = note.fields as Record<string, string>;
    expect(fields.Front).toBe('ephemeral');
    expect(fields.Sentence).toBe('The ephemeral nature of fame.');
    expect(fields.Translation).toBe('Bản chất ngắn ngủi của danh tiếng.');
    expect(fields.Back).toBe('(adj) lasting a very short time');
    expect(fields.Image).toContain('<img src="cell-img-1.png">');
    expect(fields.WordAudio).toContain('[sound:cell-audio-1.mp3]');
    expect(fields.SentenceAudio).toContain('[sound:cell-audio-2.mp3]');
    expect(note.tags).toEqual(['cell', 'learning']);
  });

  it('empty fieldMapping: no fields set, addNote still called', async () => {
    queueResponses([{ result: 99 }]);

    const r = await quickAddNote(URL, 'Default', 'Basic', {}, '', text, {
      images: [],
      wordAudios: [],
      sentenceAudios: [],
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.noteId).toBe(99);

    const last = captureLastAction();
    expect(last?.action).toBe('addNote');
    const note = (last?.params as { note: Record<string, unknown> }).note;
    const fields = note.fields as Record<string, string>;
    expect(Object.keys(fields)).toHaveLength(0);
  });

  it('media upload failure: onWarning called, note still added with successful media', async () => {
    // storeMedia image fails → storeMedia wordAudio succeeds → addNote
    queueResponses([
      new Error('upload failed'),
      { result: 'cell-audio-1.mp3' },
      { result: 42 },
    ]);

    const warnings: string[] = [];
    const r = await quickAddNote(
      URL,
      'Default',
      'Basic',
      { images: 'Image', wordAudios: 'WordAudio' },
      '',
      text,
      {
        images: [makeMediaFile('image', 'cell-img-1.png')],
        wordAudios: [makeMediaFile('audio', 'cell-audio-1.mp3')],
        sentenceAudios: [],
      },
      (msg) => warnings.push(msg),
    );

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.noteId).toBe(42);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain('Media upload failed');

    // Image field should NOT be set (upload failed), WordAudio should be set.
    const last = captureLastAction();
    const note = (last?.params as { note: Record<string, unknown> }).note;
    const fields = note.fields as Record<string, string>;
    expect(fields.Image).toBeUndefined();
    expect(fields.WordAudio).toContain('[sound:cell-audio-1.mp3]');
  });

  it('addNote failure: returns error result', async () => {
    queueResponses([{ result: null, error: 'collection is corrupt' }]);

    const r = await quickAddNote(URL, 'Default', 'Basic', fieldMapping, '', text, {
      images: [],
      wordAudios: [],
      sentenceAudios: [],
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('corrupt');
  });

  it('duplicate skipped: returns noteId null', async () => {
    queueResponses([{ result: null }]);

    const r = await quickAddNote(URL, 'Default', 'Basic', fieldMapping, '', text, {
      images: [],
      wordAudios: [],
      sentenceAudios: [],
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.noteId).toBeNull();
  });
});
