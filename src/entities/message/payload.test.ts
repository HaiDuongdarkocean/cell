import { describe, expect, it } from '@jest/globals';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { messagePayload } from './payload';

describe('messagePayload', () => {
  it('returns parsed payload when type matches and schema passes', () => {
    const payload = messagePayload<{ jobId: string }>(
      { type: MESSAGE_TYPES.JOB_DISMISS, payload: { jobId: 'j1' } },
      MESSAGE_TYPES.JOB_DISMISS,
    );
    expect(payload).toEqual({ jobId: 'j1' });
  });

  it('returns undefined on type mismatch without touching the schema', () => {
    expect(
      messagePayload(
        { type: MESSAGE_TYPES.JOB_LIST, payload: 'not-an-object' },
        MESSAGE_TYPES.JOB_DISMISS,
      ),
    ).toBeUndefined();
  });

  it('returns undefined when the payload fails the contract schema', () => {
    expect(
      messagePayload(
        { type: MESSAGE_TYPES.JOB_DISMISS, payload: { jobId: 42 } },
        MESSAGE_TYPES.JOB_DISMISS,
      ),
    ).toBeUndefined();
  });

  it('returns undefined when a required payload is missing entirely', () => {
    expect(
      messagePayload({ type: MESSAGE_TYPES.JOB_DISMISS }, MESSAGE_TYPES.JOB_DISMISS),
    ).toBeUndefined();
  });

  it('strips unknown keys like the background bus does', () => {
    const payload = messagePayload<{ jobId: string }>(
      { type: MESSAGE_TYPES.JOB_DISMISS, payload: { jobId: 'j1', extra: 'x' } },
      MESSAGE_TYPES.JOB_DISMISS,
    );
    expect(payload).toEqual({ jobId: 'j1' });
  });

  it('validates newly-contracted broadcasts (AUTO_LOAD_SUBTITLES)', () => {
    const target = { url: 'https://a/b.vtt', language: 'en', format: 'vtt' };
    expect(
      messagePayload(
        {
          type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
          payload: { tabId: 1, target, native: null },
        },
        MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
      ),
    ).toEqual({ tabId: 1, target, native: null });
    expect(
      messagePayload(
        {
          type: MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
          payload: { target, native: null },
        },
        MESSAGE_TYPES.AUTO_LOAD_SUBTITLES,
      ),
    ).toBeUndefined();
  });

  it('tolerates non-object messages', () => {
    expect(messagePayload(null, MESSAGE_TYPES.JOB_DISMISS)).toBeUndefined();
    expect(messagePayload('JOB_DISMISS', MESSAGE_TYPES.JOB_DISMISS)).toBeUndefined();
  });
});
