import { render, fireEvent } from '@testing-library/react';
import { HostManagerSheet } from './HostManagerSheet';
import type { SerializedManagerState } from '../logic/iframeManagerBridgeTypes';

// Mock SubtitleManagerPanel to capture props without rendering its full tree.
// The mock stores the last props on globalThis so each test can assert wiring.
jest.mock('./SubtitleManagerPanel', () => ({
  SubtitleManagerPanel: jest.fn(() => null),
}));

// ManagerLayer (rendered by HostManagerSheet) persists sheet height via
// chrome.storage. Stub the adapter so jsdom doesn't throw "chrome is not defined".
jest.mock('@/shared/lib/chrome-apis', () => ({
  getStorage: jest.fn().mockResolvedValue({}),
  setStorage: jest.fn().mockResolvedValue(undefined),
}));

import { SubtitleManagerPanel } from './SubtitleManagerPanel';
const mockPanel = jest.mocked(SubtitleManagerPanel);

type PanelProps = Record<string, unknown>;

function lastPanelProps(): PanelProps {
  const calls = mockPanel.mock.calls;
  const last = calls[calls.length - 1];
  return ((last?.[0] ?? {}) as unknown) as PanelProps;
}

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

describe('HostManagerSheet', () => {
  it('renders backdrop and sheet container', () => {
    const { container } = render(
      <HostManagerSheet state={createMockState()} onAction={jest.fn()} onClose={jest.fn()} />,
    );
    expect(container.querySelector('.backdrop')).toBeTruthy();
    expect(container.querySelector('.sheet')).toBeTruthy();
  });

  it('renders drag handle', () => {
    const { container } = render(
      <HostManagerSheet state={createMockState()} onAction={jest.fn()} onClose={jest.fn()} />,
    );
    expect(container.querySelector('.handle')).toBeTruthy();
  });

  it('click on backdrop calls onClose', () => {
    const onClose = jest.fn();
    const { container } = render(
      <HostManagerSheet state={createMockState()} onAction={jest.fn()} onClose={onClose} />,
    );
    const backdrop = container.querySelector('.backdrop');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes correct props to SubtitleManagerPanel', () => {
    const state = createMockState();
    render(
      <HostManagerSheet state={state} onAction={jest.fn()} onClose={jest.fn()} />,
    );
    expect(mockPanel).toHaveBeenCalled();
    const props = lastPanelProps();
    expect(props.targetItems).toBe(state.targetItems);
    expect(props.nativeItems).toBe(state.nativeItems);
    expect(props.targetActiveIndex).toBe(0);
    expect(props.nativeActiveIndex).toBe(0);
    expect(props.hasSearchKeys).toBe(false);
  });

  it('onSelect calls onAction with select', () => {
    const onAction = jest.fn();
    render(
      <HostManagerSheet state={createMockState()} onAction={onAction} onClose={jest.fn()} />,
    );
    const props = lastPanelProps();
    const onSelect = props.onSelect as (role: string, index: number) => void;
    onSelect('target', 1);
    expect(onAction).toHaveBeenCalledWith('select', { role: 'target', index: 1 });
  });

  it('onImport calls onAction with import', () => {
    const onAction = jest.fn();
    render(
      <HostManagerSheet state={createMockState()} onAction={onAction} onClose={jest.fn()} />,
    );
    const props = lastPanelProps();
    const onImport = props.onImport as (role: string) => void;
    onImport('native');
    expect(onAction).toHaveBeenCalledWith('import', { role: 'native' });
  });

  it('onClose prop is forwarded to SubtitleManagerPanel', () => {
    const onClose = jest.fn();
    render(
      <HostManagerSheet state={createMockState()} onAction={jest.fn()} onClose={onClose} />,
    );
    const props = lastPanelProps();
    const panelOnClose = props.onClose as () => void;
    panelOnClose();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
