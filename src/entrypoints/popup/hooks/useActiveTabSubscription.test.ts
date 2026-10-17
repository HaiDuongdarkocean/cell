import { renderHook, act } from '@testing-library/react';

jest.mock('@/entities/message/payload', () => ({
  messagePayload: (req: { payload?: unknown }) => req.payload,
}));
jest.mock('@/entrypoints/popup/utils/getActiveContentTab', () => ({
  getActiveContentTabId: jest.fn(),
}));
jest.mock('@/shared/lib/chrome-apis', () => ({
  sendMessage: jest.fn(),
  onMessage: jest.fn(),
  removeOnMessageListener: jest.fn(),
}));

import { getActiveContentTabId } from '@/entrypoints/popup/utils/getActiveContentTab';
import { sendMessage, onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis';
import { useActiveTabSubscription } from './useActiveTabSubscription';
import type { MessageType } from '@/entities/message';

const getTabMock = getActiveContentTabId as jest.MockedFunction<typeof getActiveContentTabId>;
const sendMock = sendMessage as jest.MockedFunction<typeof sendMessage>;
const onMessageMock = onMessage as jest.MockedFunction<typeof onMessage>;
const removeMock = removeOnMessageListener as jest.MockedFunction<typeof removeOnMessageListener>;

type Listener = (req: { type: string; payload?: unknown }, sender: unknown, respond: unknown) => boolean;

const capturedListener = (): Listener =>
  onMessageMock.mock.calls[0][0] as unknown as Listener;

beforeEach(() => {
  jest.clearAllMocks();
  getTabMock.mockResolvedValue(7);
  sendMock.mockResolvedValue({ success: true, data: { items: [1] } });
});

const opts = () => ({
  updateType: 'THING_UPDATE' as MessageType,
  onUpdate: jest.fn(),
  fetchType: 'GET_THING' as MessageType,
  onFetch: jest.fn(),
});

test('fetches initial data for the active tab and calls onFetch', async () => {
  const o = opts();
  await act(async () => {
    renderHook(() => useActiveTabSubscription(o));
  });
  expect(sendMock).toHaveBeenCalledWith({ type: 'GET_THING', payload: { tabId: 7 } });
  expect(o.onFetch).toHaveBeenCalledWith({ items: [1] });
});

test('onUpdate fires only for the active tab', async () => {
  const o = opts();
  await act(async () => {
    renderHook(() => useActiveTabSubscription(o));
  });
  const listener = capturedListener();
  act(() => {
    listener({ type: 'THING_UPDATE', payload: { tabId: 7, v: 'yes' } }, {}, () => {});
    listener({ type: 'THING_UPDATE', payload: { tabId: 9, v: 'no' } }, {}, () => {});
    listener({ type: 'OTHER', payload: { tabId: 7 } }, {}, () => {});
  });
  expect(o.onUpdate).toHaveBeenCalledTimes(1);
  expect(o.onUpdate).toHaveBeenCalledWith({ tabId: 7, v: 'yes' });
});

test('unmount removes the message listener', async () => {
  const o = opts();
  let unmount!: () => void;
  await act(async () => {
    ({ unmount } = renderHook(() => useActiveTabSubscription(o)));
  });
  unmount();
  expect(removeMock).toHaveBeenCalledWith(onMessageMock.mock.calls[0][0]);
});

test('no fetch when there is no active content tab', async () => {
  getTabMock.mockResolvedValue(undefined);
  const o = opts();
  await act(async () => {
    renderHook(() => useActiveTabSubscription(o));
  });
  expect(sendMock).not.toHaveBeenCalled();
  expect(o.onFetch).not.toHaveBeenCalled();
});
