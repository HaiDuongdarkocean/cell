export interface CueSeekIntent {
  cueSeq: number;
  markedAt: number;
}

let pending: CueSeekIntent | null = null;

export function markCueSeekIntent(cueSeq: number): void {
  pending = { cueSeq, markedAt: Date.now() };
}

export function takeCueSeekIntent(): CueSeekIntent | null {
  const intent = pending;
  pending = null;
  return intent;
}

export function clearCueSeekIntent(): void {
  pending = null;
}
