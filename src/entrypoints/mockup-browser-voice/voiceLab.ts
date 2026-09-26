import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface VoiceItem {
  readonly name: string;
  readonly lang: string;
  readonly short: string;
  readonly region: string;
  readonly natural: boolean;
}

export const SAMPLE_TEXT: Record<string, string> = {
  en: 'Hello! This is how I sound.',
  vi: 'Xin chào! Đây là giọng đọc của tôi.',
  ja: 'こんにちは！この声で読みます。',
  ko: '안녕하세요! 이 목소리로 읽어 드립니다.',
};

const FALLBACK_VOICES: VoiceItem[] = [
  { name: 'Microsoft Aria - English (United States)', lang: 'en-US', short: 'Aria', region: 'US', natural: true },
  { name: 'Microsoft Guy - English (United States)', lang: 'en-US', short: 'Guy', region: 'US', natural: true },
  { name: 'Microsoft Sonia - English (United Kingdom)', lang: 'en-GB', short: 'Sonia', region: 'GB', natural: true },
  { name: 'Google US English', lang: 'en-US', short: 'Google US English', region: 'US', natural: false },
  { name: 'Microsoft David - English (United States)', lang: 'en-US', short: 'David', region: 'US', natural: false },
];

function shortName(raw: string): string {
  const cleaned = raw
    .replace(/^Microsoft\s+/i, '')
    .replace(/\s+Online\s*\(Natural\)\s*/i, ' ')
    .replace(/\s+Online\s*/i, ' ')
    .replace(/\s+-\s+.+$/, '')
    .trim();
  return cleaned || raw;
}

function regionOf(lang: string): string {
  const part = lang.split('-')[1];
  return part ? part.toUpperCase() : '';
}

function toItem(v: { name: string; lang: string }): VoiceItem {
  return {
    name: v.name,
    lang: v.lang,
    short: shortName(v.name),
    region: regionOf(v.lang),
    natural: /natural|online|neural/i.test(v.name),
  };
}

export interface VoiceLab {
  readonly voices: readonly VoiceItem[];
  readonly loading: boolean;
  readonly supported: boolean;
  readonly slots: readonly (string | null)[];
  readonly filledCount: number;
  readonly playing: string | null;
  readonly savedTick: number;
  readonly targetLang: string;
  slotOf(name: string): number;
  shortOf(name: string): string;
  preview(name: string, text?: string): void;
  assignTo(name: string, slot: number): void;
  toggle(name: string): void;
  remove(name: string): void;
  reset(): void;
}

export function useVoiceLab(targetLang: string): VoiceLab {
  const supported = typeof speechSynthesis !== 'undefined';
  const [allVoices, setAllVoices] = useState<VoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null]);
  const [playing, setPlaying] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  useEffect(() => {
    if (!supported) {
      setAllVoices(FALLBACK_VOICES);
      setLoading(false);
      return;
    }
    let alive = true;
    const pull = () => {
      const raw = speechSynthesis.getVoices();
      if (raw.length > 0 && alive) {
        setAllVoices(raw.map(toItem));
        setLoading(false);
      }
    };
    pull();
    speechSynthesis.addEventListener('voiceschanged', pull);
    const timer = setTimeout(() => {
      if (alive) setLoading(false);
    }, 1500);
    return () => {
      alive = false;
      speechSynthesis.removeEventListener('voiceschanged', pull);
      clearTimeout(timer);
      speechSynthesis.cancel();
    };
  }, [supported]);

  const voices = useMemo(() => {
    const prefix = targetLang.toLowerCase();
    const list = allVoices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
    return list.length > 0 ? list : allVoices;
  }, [allVoices, targetLang]);

  useEffect(() => {
    setSlots((prev) => prev.map((n) => (n && voices.some((v) => v.name === n) ? n : null)));
  }, [voices]);

  const commit = useCallback((next: (string | null)[]) => {
    setSlots(next);
    setSavedTick((n) => n + 1);
  }, []);

  const slotOf = useCallback(
    (name: string) => slotsRef.current.findIndex((n) => n === name),
    [],
  );

  const shortOf = useCallback(
    (name: string) => voices.find((v) => v.name === name)?.short ?? shortName(name),
    [voices],
  );

  const preview = useCallback(
    (name: string, text?: string) => {
      if (!supported) return;
      const voice = speechSynthesis.getVoices().find((v) => v.name === name);
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(
        text?.trim() || SAMPLE_TEXT[targetLang] || SAMPLE_TEXT.en!,
      );
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      }
      u.onend = () => setPlaying((p) => (p === name ? null : p));
      u.onerror = () => setPlaying((p) => (p === name ? null : p));
      setPlaying(name);
      speechSynthesis.speak(u);
    },
    [supported, targetLang],
  );

  const assignTo = useCallback(
    (name: string, slot: number) => {
      const next = [...slotsRef.current] as (string | null)[];
      for (let i = 0; i < next.length; i++) {
        if (next[i] === name) next[i] = null;
      }
      next[slot] = name;
      commit(next);
    },
    [commit],
  );

  const toggle = useCallback(
    (name: string) => {
      const cur = slotsRef.current;
      if (cur.includes(name)) {
        commit(cur.map((n) => (n === name ? null : n)));
        return;
      }
      const empty = cur.findIndex((n) => n === null);
      if (empty === -1) return;
      const next = [...cur] as (string | null)[];
      next[empty] = name;
      commit(next);
    },
    [commit],
  );

  const remove = useCallback(
    (name: string) => {
      commit(slotsRef.current.map((n) => (n === name ? null : n)));
    },
    [commit],
  );

  const reset = useCallback(() => commit([null, null, null]), [commit]);

  return {
    voices,
    loading,
    supported,
    slots,
    filledCount: slots.filter(Boolean).length,
    playing,
    savedTick,
    targetLang,
    slotOf,
    shortOf,
    preview,
    assignTo,
    toggle,
    remove,
    reset,
  };
}
