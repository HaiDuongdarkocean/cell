/**
 * Unit tests for the manager-state serializer.
 *
 * Co-located with managerStateSerializer.ts (repo convention).
 * Verifies that function callbacks are stripped and the output is
 * JSON-serializable for the iframe postMessage bridge.
 */

import { describe, it, expect } from '@jest/globals';
import { serializeManagerState, serializeAppearanceState } from './managerStateSerializer';
import type { ManagerState, OffsetState } from '../ui/SubtitlePanels';
import type { AppearanceState } from '../ui/SubtitleManagerPanel';

// Helper: create a mock ManagerState with all required + optional fields.
// Optional function callbacks are included so we can assert they are stripped.
function createMockManager(): ManagerState {
  return {
    targetItems: [],
    nativeItems: [],
    targetActiveIndex: 0,
    nativeActiveIndex: 0,
    onSelect: () => {},
    onImport: () => {},
    onGenerateNative: () => {},
    onOffsetChange: () => {},
    hasSearchKeys: false,
    apiKeys: [],
    onApiKeysChange: () => {},
    onSearchResultSelect: () => {},
    onDownload: () => {},
    onHideSection: () => {},
    onHideBoth: () => {},
    targetHidden: false,
    nativeHidden: false,
    bothHidden: false,
  };
}

describe('serializeManagerState', () => {
  it('strips all function fields', () => {
    const manager = createMockManager();
    const serialized = serializeManagerState(manager);
    expect(serialized).not.toHaveProperty('onSelect');
    expect(serialized).not.toHaveProperty('onImport');
    expect(serialized).not.toHaveProperty('onGenerateNative');
    expect(serialized).not.toHaveProperty('onOffsetChange');
    expect(serialized).not.toHaveProperty('onApiKeysChange');
    expect(serialized).not.toHaveProperty('onSearchResultSelect');
    expect(serialized).not.toHaveProperty('onDownload');
    expect(serialized).not.toHaveProperty('onHideSection');
    expect(serialized).not.toHaveProperty('onHideBoth');
  });

  it('maps offset.targetMs to targetOffsetMs', () => {
    const manager = createMockManager();
    const offset: OffsetState = {
      targetMs: 500,
      nativeMs: -200,
      onTargetChange: () => {},
      onNativeChange: () => {},
    };
    const serialized = serializeManagerState(manager, offset);
    expect(serialized.targetOffsetMs).toBe(500);
    expect(serialized.nativeOffsetMs).toBe(-200);
    expect(serialized).not.toHaveProperty('onTargetChange');
    expect(serialized).not.toHaveProperty('onNativeChange');
  });

  it('defaults offset to 0 when no offset provided', () => {
    const manager = createMockManager();
    const serialized = serializeManagerState(manager);
    expect(serialized.targetOffsetMs).toBe(0);
    expect(serialized.nativeOffsetMs).toBe(0);
  });

  it('handles missing appearance (undefined)', () => {
    const manager = createMockManager();
    const serialized = serializeManagerState(manager);
    expect(serialized.appearance).toBeUndefined();
  });

  it('preserves hidden flags and indexes', () => {
    const manager = createMockManager();
    manager.targetHidden = true;
    manager.nativeHidden = false;
    manager.bothHidden = true;
    manager.targetActiveIndex = 3;
    manager.nativeActiveIndex = 1;
    const serialized = serializeManagerState(manager);
    expect(serialized.targetHidden).toBe(true);
    expect(serialized.nativeHidden).toBe(false);
    expect(serialized.bothHidden).toBe(true);
    expect(serialized.targetActiveIndex).toBe(3);
    expect(serialized.nativeActiveIndex).toBe(1);
  });

  it('copies apiKeys into a new array', () => {
    const manager = createMockManager();
    manager.apiKeys = [
      { id: 'a', provider: 'subdl', key: 'k-a', status: 'active', addedAt: 1000 },
    ];
    const serialized = serializeManagerState(manager);
    expect(serialized.apiKeys).toEqual(manager.apiKeys);
    expect(serialized.apiKeys).not.toBe(manager.apiKeys);
  });

  it('output is JSON-serializable', () => {
    const manager = createMockManager();
    const serialized = serializeManagerState(manager);
    expect(() => JSON.stringify(serialized)).not.toThrow();
    const roundTripped = JSON.parse(JSON.stringify(serialized)) as unknown;
    expect(roundTripped).toEqual(serialized);
  });
});

describe('serializeAppearanceState', () => {
  it('strips all function fields', () => {
    const appearance = {
      targetStyle: {},
      nativeStyle: {},
      blockSettings: {},
      clusterSettings: {},
      defaultTargetStyle: {},
      defaultNativeStyle: {},
      previewTargetText: '',
      previewNativeText: '',
      onStyleChange: () => {},
      onBlockSettingsChange: () => {},
      onClusterSettingsChange: () => {},
      onResetStyle: () => {},
      onPreviewTextChange: () => {},
    } as unknown as AppearanceState;
    const serialized = serializeAppearanceState(appearance);
    expect(serialized).not.toHaveProperty('onStyleChange');
    expect(serialized).not.toHaveProperty('onBlockSettingsChange');
    expect(serialized).not.toHaveProperty('onClusterSettingsChange');
    expect(serialized).not.toHaveProperty('onResetStyle');
    expect(serialized).not.toHaveProperty('onPreviewTextChange');
  });

  it('preserves data fields', () => {
    const appearance = {
      targetStyle: { fontSize: 20 },
      nativeStyle: { fontSize: 16 },
      blockSettings: { maxLines: 2 },
      clusterSettings: { gap: 4 },
      defaultTargetStyle: { fontSize: 20 },
      defaultNativeStyle: { fontSize: 16 },
      previewTargetText: 'hello',
      previewNativeText: 'xin chào',
      onStyleChange: () => {},
      onBlockSettingsChange: () => {},
      onClusterSettingsChange: () => {},
      onResetStyle: () => {},
      onPreviewTextChange: () => {},
    } as unknown as AppearanceState;
    const serialized = serializeAppearanceState(appearance);
    expect(serialized.previewTargetText).toBe('hello');
    expect(serialized.previewNativeText).toBe('xin chào');
  });

  it('output is JSON-serializable', () => {
    const appearance = {
      targetStyle: {},
      nativeStyle: {},
      blockSettings: {},
      clusterSettings: {},
      defaultTargetStyle: {},
      defaultNativeStyle: {},
      previewTargetText: '',
      previewNativeText: '',
      onStyleChange: () => {},
      onBlockSettingsChange: () => {},
      onClusterSettingsChange: () => {},
      onResetStyle: () => {},
      onPreviewTextChange: () => {},
    } as unknown as AppearanceState;
    const serialized = serializeAppearanceState(appearance);
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });
});
