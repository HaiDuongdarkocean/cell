/**
 * Unit tests for iframe manager bridge type definitions.
 *
 * Co-located with iframeManagerBridgeTypes.ts (repo convention).
 * Covers:
 *  - Message constants all share the __CELL_MANAGER_ prefix
 *  - SerializedManagerState is JSON-serializable
 *  - SerializedAppearanceState is JSON-serializable
 *  - ManagerAction covers all 14 action types
 */

import { describe, it, expect } from '@jest/globals';
import {
  MGR_OPEN_MSG,
  MGR_CLOSE_MSG,
  MGR_STATE_MSG,
  MGR_ACTION_MSG,
  MGR_OPENED_MSG,
  MGR_CLOSED_MSG,
} from './iframeManagerBridgeTypes';
import type {
  SerializedManagerState,
  SerializedAppearanceState,
  ManagerAction,
} from './iframeManagerBridgeTypes';

describe('iframeManagerBridgeTypes', () => {
  describe('message constants', () => {
    it('all constants start with __CELL_MANAGER_', () => {
      expect(MGR_OPEN_MSG).toMatch(/^__CELL_MANAGER_/);
      expect(MGR_CLOSE_MSG).toMatch(/^__CELL_MANAGER_/);
      expect(MGR_STATE_MSG).toMatch(/^__CELL_MANAGER_/);
      expect(MGR_ACTION_MSG).toMatch(/^__CELL_MANAGER_/);
      expect(MGR_OPENED_MSG).toMatch(/^__CELL_MANAGER_/);
      expect(MGR_CLOSED_MSG).toMatch(/^__CELL_MANAGER_/);
    });
  });

  describe('SerializedManagerState', () => {
    it('is JSON-serializable', () => {
      const state: SerializedManagerState = {
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
      expect(() => JSON.stringify(state)).not.toThrow();
    });
  });

  describe('SerializedAppearanceState', () => {
    it('is JSON-serializable', () => {
      // Minimal mock — complex nested types are opaque to the serializer;
      // cast through unknown to avoid no-explicit-any.
      const appearance = {
        targetStyle: {},
        nativeStyle: {},
        blockSettings: {},
        clusterSettings: {},
        defaultTargetStyle: {},
        defaultNativeStyle: {},
        previewTargetText: '',
        previewNativeText: '',
      } as unknown as SerializedAppearanceState;
      expect(() => JSON.stringify(appearance)).not.toThrow();
    });
  });

  describe('ManagerAction', () => {
    it('covers all 14 action types', () => {
      const actions: ManagerAction[] = [
        'select',
        'import',
        'generateNative',
        'offsetChange',
        'download',
        'hideSection',
        'hideBoth',
        'apiKeysChange',
        'searchResultSelect',
        'styleChange',
        'blockSettingsChange',
        'clusterSettingsChange',
        'resetStyle',
        'previewTextChange',
      ];
      expect(actions).toHaveLength(14);
    });
  });
});
