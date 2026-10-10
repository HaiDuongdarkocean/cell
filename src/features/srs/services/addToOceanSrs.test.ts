import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { buildSrsFieldsFromPrefill, getSrsTermCardCount, openSrsStudyPage } from './addToOceanSrs';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { PopupCardCreatorPrefill } from '@/entities/dictionary';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

const mockSendMessage = jest.mocked(sendMessage);

function makePrefill(definitions: PopupCardCreatorPrefill['definitions']): PopupCardCreatorPrefill {
  return {
    term: 'hello',
    langCode: 'en',
    reading: '',
    definitions,
    rawDefinitions: [],
    contextSentence: '',
  };
}

describe('buildSrsFieldsFromPrefill', () => {
  it('keeps all definition texts and ticked examples inside the def entry', () => {
    const fields = buildSrsFieldsFromPrefill(makePrefill([
      { pos: 'n', text: 'def one', selectedExamples: ['ex a', 'ex b'] },
      { pos: 'v', text: 'def two', selectedExamples: ['ex c'] },
    ]));
    expect(fields['def']).toEqual({
      kind: 'text',
      value: 'Hello\n\n[n] def one\n- ex a\n- ex b\n\n[v] def two\n- ex c',
    });
    expect(fields['examples']).toBeUndefined();
  });

  it('def-only selection ships no example sentences', () => {
    const fields = buildSrsFieldsFromPrefill(makePrefill([
      { text: 'def one', selectedExamples: [] },
    ]));
    expect(fields['def']).toEqual({ kind: 'text', value: 'Hello\n\ndef one' });
    expect(fields['examples']).toBeUndefined();
  });
});

describe('srs message helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getSrsTermCardCount posts SRS_TERM_CARDS and returns the result', async () => {
    mockSendMessage.mockResolvedValue({ success: true, data: { count: 2, deckIds: ['d1'] } });

    const result = await getSrsTermCardCount('en', 'hello');

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.SRS_TERM_CARDS,
      payload: { langCode: 'en', term: 'hello' },
    });
    expect(result).toEqual({ count: 2, deckIds: ['d1'] });
  });

  it('getSrsTermCardCount throws on a failed response so callers can degrade', async () => {
    mockSendMessage.mockResolvedValue({ success: false, error: 'nope' });

    await expect(getSrsTermCardCount('en', 'hello')).rejects.toThrow('nope');
  });

  it('openSrsStudyPage forwards the term filter', async () => {
    mockSendMessage.mockResolvedValue({ success: true });

    await openSrsStudyPage({ term: 'hello' });

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.SRS_OPEN_STUDY_PAGE,
      payload: { term: 'hello' },
    });
  });

  it('openSrsStudyPage defaults to an empty payload', async () => {
    mockSendMessage.mockResolvedValue({ success: true });

    await openSrsStudyPage();

    expect(mockSendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.SRS_OPEN_STUDY_PAGE,
      payload: {},
    });
  });
});
