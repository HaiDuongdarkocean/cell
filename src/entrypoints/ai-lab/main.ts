import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';

interface LabResponse {
  success?: boolean;
  data?: { text?: string; composer?: boolean; streaming?: boolean; url?: string };
  error?: string;
}

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const status = () => el<HTMLDivElement>('status');
const out = () => el<HTMLPreElement>('out');

const onPing = async (): Promise<void> => {
  status().textContent = 'pinging…';
  const res = await sendMessage<LabResponse>({ type: MESSAGE_TYPES.AI_PING });
  if (res?.success) {
    status().textContent = `bridge ok — composer:${res.data?.composer} streaming:${res.data?.streaming}`;
    out().textContent = res.data?.url ?? '';
  } else {
    status().textContent = `ping failed: ${res?.error ?? 'no response'}`;
  }
};

const onAsk = async (): Promise<void> => {
  const prompt = el<HTMLTextAreaElement>('prompt').value.trim();
  if (!prompt) return;
  status().textContent = 'asking… (ChatGPT may take 10–60s)';
  out().textContent = '';
  const t0 = performance.now();
  try {
    const res = await sendMessage<LabResponse>({
      type: MESSAGE_TYPES.AI_ASK,
      payload: { prompt },
    });
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    if (res?.success) {
      status().textContent = `done in ${secs}s`;
      out().textContent = res.data?.text ?? '';
    } else {
      status().textContent = `error after ${secs}s`;
      out().textContent = res?.error ?? 'no response';
    }
  } catch (err) {
    status().textContent = 'send failed';
    out().textContent = err instanceof Error ? err.message : String(err);
  }
};

el<HTMLButtonElement>('ping').addEventListener('click', () => void onPing());
el<HTMLButtonElement>('ask').addEventListener('click', () => void onAsk());
