import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { AiProviderId } from '@/entities/message/dictionarySchemas';

interface LabResponse {
  success?: boolean;
  data?: {
    text?: string;
    composer?: boolean;
    streaming?: boolean;
    url?: string;
    provider?: AiProviderId;
    attempts?: { provider: AiProviderId; error: string }[];
  };
  error?: string;
}

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const status = () => el<HTMLDivElement>('status');
const out = () => el<HTMLPreElement>('out');
const providerPick = (): { provider?: AiProviderId } => {
  const value = el<HTMLSelectElement>('provider').value;
  return value ? { provider: value as AiProviderId } : {};
};

const onPing = async (): Promise<void> => {
  status().textContent = 'pinging…';
  const res = await sendMessage<LabResponse>({
    type: MESSAGE_TYPES.AI_PING,
    payload: providerPick(),
  });
  if (res?.success) {
    status().textContent =
      `bridge ok — provider:${res.data?.provider} composer:${res.data?.composer} ` +
      `streaming:${res.data?.streaming}`;
    out().textContent = res.data?.url ?? '';
  } else {
    status().textContent = `ping failed: ${res?.error ?? 'no response'}`;
  }
};

const onAsk = async (): Promise<void> => {
  const prompt = el<HTMLTextAreaElement>('prompt').value.trim();
  if (!prompt) return;
  status().textContent = 'asking… (failover chain may take a while)';
  out().textContent = '';
  const t0 = performance.now();
  try {
    const res = await sendMessage<LabResponse>({
      type: MESSAGE_TYPES.AI_ASK,
      payload: { prompt, ...providerPick() },
    });
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    if (res?.success) {
      status().textContent = `done in ${secs}s — answered by ${res.data?.provider ?? '?'}`;
      out().textContent = res.data?.text ?? '';
    } else {
      status().textContent = `error after ${secs}s: ${res?.error ?? 'no response'}`;
      out().textContent = res.data?.attempts
        ? res.data.attempts.map((a) => `${a.provider}: ${a.error}`).join('\n')
        : '';
    }
  } catch (err) {
    status().textContent = 'send failed';
    out().textContent = err instanceof Error ? err.message : String(err);
  }
};

el<HTMLButtonElement>('ping').addEventListener('click', () => void onPing());
el<HTMLButtonElement>('ask').addEventListener('click', () => void onAsk());
