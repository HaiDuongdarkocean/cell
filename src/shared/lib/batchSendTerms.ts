import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import type { MessageResponse } from '@/entities/message';

export async function batchSendTerms<TData, TAcc>(opts: {
  type: string;
  terms: readonly string[];
  chunkSize: number;
  makePayload: (chunk: readonly string[]) => Record<string, unknown>;
  empty: () => TAcc;
  merge: (acc: TAcc, data: TData) => void;
  abortOnFail?: boolean;
}): Promise<TAcc | null> {
  const acc = opts.empty();
  if (opts.terms.length === 0) return acc;
  for (let i = 0; i < opts.terms.length; i += opts.chunkSize) {
    const chunk = opts.terms.slice(i, i + opts.chunkSize);
    const res = await sendMessage<MessageResponse<TData>>({
      type: opts.type,
      payload: opts.makePayload(chunk),
    });
    if (res?.success !== true) {
      if (opts.abortOnFail === true) return null;
      continue;
    }
    if (res.data) opts.merge(acc, res.data);
  }
  return acc;
}
