import { normalizeSpelling } from '@/features/srs/lib/helpers';

export interface DictationAlignment {
  readonly expected: string;
  readonly typed: string;
  readonly correct: boolean;
  /** Per-character match marks over the normalized strings (LCS alignment). */
  readonly expectedMarks: readonly boolean[];
  readonly typedMarks: readonly boolean[];
}

/** Align typed dictation input against the expected text — verdict and per-char matches, normalized the same way grading does. */
export function alignDictation(expected: string, typed: string): DictationAlignment {
  const e = [...normalizeSpelling(expected)];
  const ty = [...normalizeSpelling(typed)];
  const correct = e.length > 0 && e.join('') === ty.join('');

  const n = e.length;
  const m = ty.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = e[i] === ty[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const expectedMarks = new Array<boolean>(n).fill(false);
  const typedMarks = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (e[i] === ty[j]) {
      expectedMarks[i] = true;
      typedMarks[j] = true;
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return { expected: e.join(''), typed: ty.join(''), correct, expectedMarks, typedMarks };
}
