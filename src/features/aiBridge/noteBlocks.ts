// noteBlocks — AI answer → card note block formatting (spec ai-bridge-dictionary REQ-5).
//
// One labeled block per feature; latest answer per feature wins (mergeAiNoteBlock
// replaces a stale block); labels are fixed English so dedup is locale-stable.

import type { AiFeature, AiProviderId } from '@/entities/settings';

export interface AiNoteAnswer {
  readonly feature: AiFeature;
  readonly provider: AiProviderId;
  readonly text: string;
}

const FEATURE_LABELS: Record<AiFeature, string> = {
  wordExplain: 'AI Explain',
  sentenceBreakdown: 'AI Breakdown',
  sentenceTranslate: 'AI Translation',
};

const PROVIDER_LABELS: Record<AiProviderId, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  claude: 'Claude',
};

export function aiFeatureLabel(feature: AiFeature): string {
  return FEATURE_LABELS[feature];
}

export function aiProviderLabel(provider: AiProviderId): string {
  return PROVIDER_LABELS[provider];
}

export function formatAiNoteBlock(answer: AiNoteAnswer): string {
  return `${FEATURE_LABELS[answer.feature]} (${PROVIDER_LABELS[answer.provider]}):\n${answer.text.trim()}`;
}

export function formatAiNoteBlocks(answers: readonly AiNoteAnswer[]): string {
  return answers.map(formatAiNoteBlock).join('\n\n');
}

function isBlockHeader(line: string): boolean {
  return Object.values(FEATURE_LABELS).some((label) => line.startsWith(`${label} (`));
}

/** Replace the block for `answer.feature` if present, else append. */
export function mergeAiNoteBlock(note: string, answer: AiNoteAnswer): string {
  const block = formatAiNoteBlock(answer);
  const lines = note.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`${FEATURE_LABELS[answer.feature]} (`));
  if (start === -1) return note.trim() ? `${note.trimEnd()}\n\n${block}` : block;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (isBlockHeader(lines[i]!)) {
      end = i;
      break;
    }
  }
  const after = lines.slice(end);
  return [...lines.slice(0, start), ...block.split('\n'), ...(after.length ? ['', ...after] : [])]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Merge a whole answer set into an existing note, preserving user text. */
export function mergeAiNoteBlocks(note: string, answers: readonly AiNoteAnswer[]): string {
  return answers.reduce((acc, answer) => mergeAiNoteBlock(acc, answer), note);
}
