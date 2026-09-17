import {
  fetchRecentNote,
  isMissingSchemaError,
  resolveSchemaChoice,
  runWithSchemaRetry,
} from './ankiSchemaService';
import { findRecentNote, getNoteInfo } from './cardCreatorService';
import { refreshAnkiSchemaCache } from './ankiSchemaCache';

jest.mock('./cardCreatorService', () => ({
  findRecentNote: jest.fn(),
  getNoteInfo: jest.fn(),
}));

jest.mock('./ankiSchemaCache', () => ({
  refreshAnkiSchemaCache: jest.fn(),
}));

const findRecentNoteMock = jest.mocked(findRecentNote);
const getNoteInfoMock = jest.mocked(getNoteInfo);
const refreshMock = jest.mocked(refreshAnkiSchemaCache);

const url = 'http://localhost:8765';

describe('isMissingSchemaError', () => {
  it('detects deck/model/note-type style errors', () => {
    expect(isMissingSchemaError('deck not found')).toBe(true);
    expect(isMissingSchemaError('model does not exist')).toBe(true);
    expect(isMissingSchemaError('Note Type missing')).toBe(true);
    expect(isMissingSchemaError('collection not found')).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isMissingSchemaError('network unreachable')).toBe(false);
    expect(isMissingSchemaError('')).toBe(false);
  });
});

describe('resolveSchemaChoice', () => {
  it('prefers the restored value when available', () => {
    expect(resolveSchemaChoice(['A', 'B'], 'B', 'A')).toBe('B');
  });

  it('falls back to the configured value when restored is unavailable', () => {
    expect(resolveSchemaChoice(['A', 'B'], 'X', 'A')).toBe('A');
  });

  it('falls back to the first option when neither is available', () => {
    expect(resolveSchemaChoice(['A', 'B'], 'X', 'Y')).toBe('A');
    expect(resolveSchemaChoice([], 'X', 'Y')).toBe('');
  });
});

describe('fetchRecentNote', () => {
  beforeEach(() => {
    findRecentNoteMock.mockReset();
    getNoteInfoMock.mockReset();
  });

  it('returns null id when no recent note exists', async () => {
    findRecentNoteMock.mockResolvedValue({ ok: true, value: null });
    const result = await fetchRecentNote(url, 'Default', 'Basic');
    expect(result).toEqual({ id: null, info: null });
    expect(getNoteInfoMock).not.toHaveBeenCalled();
  });

  it('returns null id when findRecentNote fails', async () => {
    findRecentNoteMock.mockResolvedValue({ ok: false, error: 'boom' });
    const result = await fetchRecentNote(url, 'Default', 'Basic');
    expect(result).toEqual({ id: null, info: null });
  });

  it('returns id + info when a recent note exists', async () => {
    findRecentNoteMock.mockResolvedValue({ ok: true, value: 42 });
    getNoteInfoMock.mockResolvedValue({
      ok: true,
      value: { noteId: 42, modelName: 'Basic', fields: { Front: 'x' }, tags: ['t1'] },
    });
    const result = await fetchRecentNote(url, 'Default', 'Basic');
    expect(result).toEqual({ id: 42, info: { fields: { Front: 'x' }, tags: ['t1'] } });
  });

  it('returns id with null info when notesInfo fails', async () => {
    findRecentNoteMock.mockResolvedValue({ ok: true, value: 7 });
    getNoteInfoMock.mockResolvedValue({ ok: false, error: 'nope' });
    const result = await fetchRecentNote(url, 'Default', 'Basic');
    expect(result).toEqual({ id: 7, info: null });
  });
});

describe('runWithSchemaRetry', () => {
  beforeEach(() => {
    refreshMock.mockReset();
  });

  it('returns the result without retry on success', async () => {
    const fn = jest.fn(async () => 'ok');
    const onSchema = jest.fn();
    await expect(runWithSchemaRetry(url, onSchema, fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('rethrows non-schema errors without refreshing', async () => {
    const fn = jest.fn(async () => {
      throw new Error('network unreachable');
    });
    const onSchema = jest.fn();
    await expect(runWithSchemaRetry(url, onSchema, fn)).rejects.toThrow('network unreachable');
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('refreshes the schema, notifies, and retries once on missing-schema errors', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('model does not exist'))
      .mockResolvedValue('retried');
    refreshMock.mockResolvedValue({
      ok: true,
      value: { url, fetchedAt: 1, decks: ['D1'], models: ['M1'], fieldsByModel: {} },
    });
    const onSchema = jest.fn();
    await expect(runWithSchemaRetry(url, onSchema, fn)).resolves.toBe('retried');
    expect(onSchema).toHaveBeenCalledWith({ decks: ['D1'], models: ['M1'] });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries without notifying when the refresh fails', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error('deck not found'))
      .mockResolvedValue('retried');
    refreshMock.mockResolvedValue({ ok: false, error: 'offline' });
    const onSchema = jest.fn();
    await expect(runWithSchemaRetry(url, onSchema, fn)).resolves.toBe('retried');
    expect(onSchema).not.toHaveBeenCalled();
  });
});
