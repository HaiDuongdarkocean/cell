import { useCallback } from 'react';
import { usePopupStore } from '@/entrypoints/popup/store/popupStore';
import { sendMessage } from '@/shared/lib/chrome-apis';
import type { MessageRequest } from '@/entities/message';

/**
 * Tracks and toggles the extension's active status.
 *
 * `toggle()` sends a `TOGGLE_EXTENSION` message to the background script and
 * flips the `extensionActive` flag in the popup store.
 */
export function useExtensionStatus(): {
  isActive: boolean;
  toggle: () => void;
} {
  const isActive = usePopupStore((state) => state.extensionActive);
  const setExtensionActive = usePopupStore((state) => state.setExtensionActive);

  const toggle = useCallback(() => {
    const request: MessageRequest = { type: 'TOGGLE_EXTENSION' };
    void sendMessage(request);
    setExtensionActive(!isActive);
  }, [isActive, setExtensionActive]);

  return { isActive, toggle };
}
