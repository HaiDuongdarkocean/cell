import { useEffect, useRef, useState } from 'react';
import { COPY_FEEDBACK_DURATION_MS } from '@/shared/config/config';

export function useCopyFlash(
  durationMs: number = COPY_FEEDBACK_DURATION_MS,
): {
  copied: boolean;
  copy: (text: string, target: HTMLElement) => Promise<void>;
} {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = async (text: string, target: HTMLElement): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), durationMs);
    } catch {
      const range = document.createRange();
      range.selectNode(target);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  };

  return { copied, copy };
}
