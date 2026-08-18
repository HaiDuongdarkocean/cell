/**
 * Unit tests for the child-frame side of the iframe subtitle-manager bridge.
 *
 * Co-located with iframeManagerBridgeChild.ts (repo convention).
 * Covers:
 *  - requestManagerOpenOnHost (no-op when !isChildFrame, sends MGR_OPEN,
 *    resolves true on MGR_OPENED {ok:true}, resolves false on timeout)
 *  - sendManagerStateUpdate (sends MGR_STATE only after manager opened)
 *  - onManagerAction (dispatches action + args on MGR_ACTION)
 *  - onManagerCloseFromHost (calls handler on MGR_CLOSE)
 */
import {
  requestManagerOpenOnHost,
  sendManagerStateUpdate,
  onManagerAction,
  onManagerCloseFromHost,
} from './iframeManagerBridgeChild';
import type { SerializedManagerState } from './iframeManagerBridgeTypes';

// Mock isChildFrame so we control child-frame detection without touching
// window.self/window.top. Hoisted before imports by jest.
jest.mock('./iframePlayerModeBridge', () => ({
  isChildFrame: jest.fn(() => true),
}));

import { isChildFrame } from './iframePlayerModeBridge';

const mockIsChildFrame = isChildFrame as jest.MockedFunction<typeof isChildFrame>;

function createMockState(): SerializedManagerState {
  return {
    targetItems: [],
    nativeItems: [],
    targetActiveIndex: 0,
    nativeActiveIndex: 0,
    targetOffsetMs: 0,
    nativeOffsetMs: 0,
    hasSearchKeys: false,
    apiKeys: [],
    generateNativeDisabled: false,
  };
}

describe('iframeManagerBridgeChild', () => {
  beforeEach(() => {
    mockIsChildFrame.mockReturnValue(true);
    jest.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('requestManagerOpenOnHost', () => {
    it('returns false when !isChildFrame', async () => {
      mockIsChildFrame.mockReturnValue(false);
      const result = await requestManagerOpenOnHost(createMockState());
      expect(result).toBe(false);
    });

    it('sends MGR_OPEN message to window.parent', async () => {
      const postMessage = window.parent.postMessage as jest.Mock;
      // Resolve immediately so no dangling listener lingers into later tests.
      const promise = requestManagerOpenOnHost(createMockState());
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: '__CELL_MANAGER_OPENED', ok: true },
      }));
      await promise;
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '__CELL_MANAGER_OPEN' }),
        '*',
      );
    });

    it('resolves true when MGR_OPENED {ok:true} received', async () => {
      const promise = requestManagerOpenOnHost(createMockState());
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: '__CELL_MANAGER_OPENED', ok: true },
      }));
      const result = await promise;
      expect(result).toBe(true);
    });

    it('resolves false on timeout', async () => {
      jest.useFakeTimers();
      const promise = requestManagerOpenOnHost(createMockState(), 100);
      jest.advanceTimersByTime(200);
      const result = await promise;
      expect(result).toBe(false);
      jest.useRealTimers();
    });
  });

  describe('sendManagerStateUpdate', () => {
    it('sends MGR_STATE message after manager opened on host', async () => {
      // managerOpenedOnHost is module-level state — open first to set it true.
      const openPromise = requestManagerOpenOnHost(createMockState());
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: '__CELL_MANAGER_OPENED', ok: true },
      }));
      await openPromise;

      const postMessage = window.parent.postMessage as jest.Mock;
      postMessage.mockClear();
      sendManagerStateUpdate({ targetActiveIndex: 1 });
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '__CELL_MANAGER_STATE' }),
        '*',
      );
    });
  });

  describe('onManagerAction', () => {
    it('calls handler with action + args on MGR_ACTION message', () => {
      const handler = jest.fn();
      const off = onManagerAction(handler);
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: '__CELL_MANAGER_ACTION', action: 'select', role: 'target', index: 0 },
      }));
      expect(handler).toHaveBeenCalledWith('select', {
        type: '__CELL_MANAGER_ACTION',
        role: 'target',
        index: 0,
      });
      off();
    });
  });

  describe('onManagerCloseFromHost', () => {
    it('calls handler on MGR_CLOSE message', () => {
      const handler = jest.fn();
      const off = onManagerCloseFromHost(handler);
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: '__CELL_MANAGER_CLOSE' },
      }));
      expect(handler).toHaveBeenCalled();
      off();
    });
  });
});
