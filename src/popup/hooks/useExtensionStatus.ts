import { useCallback } from 'react';
import { usePopupStore } from '@/popup/store/popupStore';
import type { MessageRequest } from '@/types/message';

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
    void chrome.runtime.sendMessage(request);
    setExtensionActive(!isActive);
  }, [isActive, setExtensionActive]);

  return { isActive, toggle };
}
