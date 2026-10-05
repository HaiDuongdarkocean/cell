import type { SrtCue } from '@/entities/media/types';
import type { CleanupRulesSetting, ResolvedCleanupRule } from '@/entities/studyMode';
import {
  applyCleanupRules,
  cleanupRulesFingerprint,
  DEFAULT_CLEANUP_RULES_SETTING,
  resolveCleanupRules,
} from '@/entities/studyMode';
import { useCuesStore } from '@/features/subtitle/cuesStore';
import { useStudyModeStore } from '@/features/studyModes';

let activeRules: readonly ResolvedCleanupRule[] = resolveCleanupRules(DEFAULT_CLEANUP_RULES_SETTING);
let activeFingerprint = cleanupRulesFingerprint(DEFAULT_CLEANUP_RULES_SETTING);
let storeSyncStarted = false;

function syncFromStudyModeStore(): void {
  if (storeSyncStarted) return;
  storeSyncStarted = true;
  setCleanupRules(useStudyModeStore.getState().advanced.cleanupRules);
  useStudyModeStore.subscribe((s) => setCleanupRules(s.advanced.cleanupRules));
}

const cleanedByRaw = new WeakMap<readonly SrtCue[], SrtCue[]>();
const liveCleaned = new Set<WeakRef<SrtCue[]>>();

export function getCleanupFingerprint(): string {
  return activeFingerprint;
}

export function getActiveCleanupRules(): readonly ResolvedCleanupRule[] {
  return activeRules;
}

export function cleanTargetCues(cues: readonly SrtCue[]): SrtCue[] {
  syncFromStudyModeStore();
  const existing = cleanedByRaw.get(cues);
  if (existing) return existing;
  const cleaned = cues.map((cue) => {
    const rawText = cue.rawText ?? cue.text;
    return { ...cue, rawText, text: applyCleanupRules(rawText, activeRules) };
  });
  cleanedByRaw.set(cues, cleaned);
  for (const ref of liveCleaned) {
    if (ref.deref() === undefined) liveCleaned.delete(ref);
  }
  liveCleaned.add(new WeakRef(cleaned));
  return cleaned;
}

export function recleanRegistered(): void {
  for (const ref of liveCleaned) {
    const cleaned = ref.deref();
    if (!cleaned) {
      liveCleaned.delete(ref);
      continue;
    }
    for (const cue of cleaned) {
      (cue as { text: string }).text = applyCleanupRules(cue.rawText ?? cue.text, activeRules);
    }
  }
  useCuesStore.getState().recleanTargetText((raw) => applyCleanupRules(raw, activeRules));
}

export function setCleanupRules(setting: CleanupRulesSetting | undefined): boolean {
  const fingerprint = cleanupRulesFingerprint(setting);
  if (fingerprint === activeFingerprint) return false;
  activeFingerprint = fingerprint;
  activeRules = resolveCleanupRules(setting);
  recleanRegistered();
  return true;
}
