// state — shared mock-state logic for the Resources redesign mockup.
//
// State + handlers only, never UI layout. Each concept consumes
// `useMockResources()` and renders its own structure on top.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DuplicateDecision, ResourceInfo, ResourceType } from '@/entities/dictionary';
import type { FrequencyBandThresholds } from '@/shared/lib/frequencyBand';
import {
  DEFAULT_MOCK_BANDS,
  IDLE_IMPORT,
  IMPORT_POOL,
  INITIAL_IMPORT_STATES,
  MOCK_RESOURCES,
  SECTION_COPY,
  type MockSectionImport,
} from './mockData';

const RESOURCE_TYPES: readonly ResourceType[] = ['DICTIONARY', 'FREQUENCY'];
const IMPORT_TICK_MS = 220;
const IMPORT_STEP = 160;
const SIMULATED_TOTAL = 1200;

export interface MockResourcesState {
  readonly resources: ResourceInfo[];
  readonly importStates: Record<ResourceType, MockSectionImport>;
  readonly bands: FrequencyBandThresholds;
  readonly deleteTarget: ResourceInfo | null;
  readonly deleteAllTarget: ResourceType | null;
}

export interface UseMockResourcesReturn {
  readonly state: MockResourcesState;
  /** Section lists, sorted by priority (mirrors ResourcesPanel). */
  readonly dictionaries: ResourceInfo[];
  readonly frequencies: ResourceInfo[];
  /** Simulate a file pick/drop: progress → new resource + success alert. */
  readonly simulateImport: (type: ResourceType) => void;
  readonly dismissError: (type: ResourceType) => void;
  readonly dismissSuccess: (type: ResourceType) => void;
  readonly resolveDuplicate: (type: ResourceType, choice: DuplicateDecision) => void;
  readonly toggleResource: (id: number, next: boolean) => void;
  readonly moveResource: (type: ResourceType, index: number, direction: -1 | 1) => void;
  readonly requestDelete: (resource: ResourceInfo) => void;
  readonly confirmDelete: () => void;
  readonly requestDeleteAll: (type: ResourceType) => void;
  readonly confirmDeleteAll: () => void;
  readonly cancelDelete: () => void;
  readonly setBands: (bands: FrequencyBandThresholds) => void;
}

const INITIAL_STATE: MockResourcesState = {
  resources: [...MOCK_RESOURCES],
  importStates: INITIAL_IMPORT_STATES,
  bands: DEFAULT_MOCK_BANDS,
  deleteTarget: null,
  deleteAllTarget: null,
};

/** Order a section list by priority — mirrors ResourcesPanel's sort. */
function sortByPriority(list: readonly ResourceInfo[]): ResourceInfo[] {
  return [...list].sort((a, b) => {
    const aPriority = a.priority ?? Number.POSITIVE_INFINITY;
    const bPriority = b.priority ?? Number.POSITIVE_INFINITY;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

function patchImport(
  prev: MockResourcesState,
  type: ResourceType,
  patch: Partial<MockSectionImport>,
): MockResourcesState {
  return {
    ...prev,
    importStates: { ...prev.importStates, [type]: { ...prev.importStates[type], ...patch } },
  };
}

/** Import finished — append the pending file as a new resource + success. */
function finalizeImport(prev: MockResourcesState, type: ResourceType): MockResourcesState {
  const pendingName = prev.importStates[type].pendingName;
  const pool = IMPORT_POOL[type];
  const spec = pool.find((p) => p.name === pendingName) ?? pool[0];
  const siblings = prev.resources.filter((r) => r.type === type);
  const nextId = Math.max(0, ...prev.resources.map((r) => r.id ?? 0)) + 1;
  const resource: ResourceInfo = {
    id: nextId,
    name: spec.name,
    langCode: 'en',
    type,
    format: spec.format,
    signature: `sig-mock-${nextId}`,
    wordCount: spec.wordCount,
    installationFinished: true,
    importedAt: Date.now(),
    enabled: true,
    priority: siblings.length,
  };
  return {
    ...prev,
    resources: [...prev.resources, resource],
    importStates: {
      ...prev.importStates,
      [type]: { ...IDLE_IMPORT, success: `Đã thêm "${spec.name}" — ${spec.wordCount.toLocaleString('en-US')} từ.` },
    },
  };
}

export function useMockResources(): UseMockResourcesReturn {
  const [state, setState] = useState<MockResourcesState>(INITIAL_STATE);

  // Drive in-flight imports: tick progress for any importing section and
  // finalize when it completes (also completes the seeded FREQUENCY import).
  useEffect(() => {
    const timer = setInterval(() => {
      setState((prev) => {
        let next = prev;
        let changed = false;
        for (const type of RESOURCE_TYPES) {
          const cur = next.importStates[type];
          if (!cur.importing) continue;
          changed = true;
          const progress = cur.progress + IMPORT_STEP;
          next =
            progress < cur.progressTotal
              ? patchImport(next, type, { progress })
              : finalizeImport(next, type);
        }
        return changed ? next : prev;
      });
    }, IMPORT_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const simulateImport = useCallback((type: ResourceType) => {
    setState((prev) => {
      if (prev.importStates[type].importing) return prev;
      const count = prev.resources.filter((r) => r.type === type).length;
      const spec = IMPORT_POOL[type][count % IMPORT_POOL[type].length];
      return patchImport(prev, type, {
        ...IDLE_IMPORT,
        importing: true,
        progress: 0,
        progressTotal: SIMULATED_TOTAL,
        pendingName: spec.name,
      });
    });
  }, []);

  const dismissError = useCallback(
    (type: ResourceType) => setState((prev) => patchImport(prev, type, { error: null })),
    [],
  );

  const dismissSuccess = useCallback(
    (type: ResourceType) => setState((prev) => patchImport(prev, type, { success: null })),
    [],
  );

  const resolveDuplicate = useCallback((type: ResourceType, choice: DuplicateDecision) => {
    setState((prev) => {
      const dup = prev.importStates[type].duplicate;
      if (!dup) return prev;
      let next = patchImport(prev, type, { duplicate: null });
      if (choice === 'replace') {
        next = {
          ...next,
          resources: next.resources.map((r) =>
            r.id === dup.existingId
              ? { ...r, importedAt: Date.now(), installationFinished: true, enabled: true }
              : r,
          ),
        };
        next = patchImport(next, type, { success: `Đã thay thế bằng "${dup.fileName}".` });
      }
      return next;
    });
  }, []);

  const toggleResource = useCallback((id: number, next: boolean) => {
    setState((prev) => ({
      ...prev,
      resources: prev.resources.map((r) => (r.id === id ? { ...r, enabled: next } : r)),
    }));
  }, []);

  const moveResource = useCallback((type: ResourceType, index: number, direction: -1 | 1) => {
    setState((prev) => {
      const list = sortByPriority(prev.resources.filter((r) => r.type === type));
      const target = index + direction;
      if (target < 0 || target >= list.length) return prev;
      const reordered = [...list];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(target, 0, moved);
      const priorityById = new Map(reordered.map((r, i) => [r.id, i]));
      return {
        ...prev,
        resources: prev.resources.map((r) =>
          priorityById.has(r.id) ? { ...r, priority: priorityById.get(r.id) } : r,
        ),
      };
    });
  }, []);

  const requestDelete = useCallback(
    (resource: ResourceInfo) => setState((prev) => ({ ...prev, deleteTarget: resource, deleteAllTarget: null })),
    [],
  );

  const confirmDelete = useCallback(() => {
    setState((prev) => {
      const target = prev.deleteTarget;
      if (!target) return prev;
      const next: MockResourcesState = {
        ...prev,
        resources: prev.resources.filter((r) => r.id !== target.id),
        deleteTarget: null,
      };
      return patchImport(next, target.type, { success: `Đã xóa "${target.name}".` });
    });
  }, []);

  const requestDeleteAll = useCallback(
    (type: ResourceType) => setState((prev) => ({ ...prev, deleteAllTarget: type, deleteTarget: null })),
    [],
  );

  const confirmDeleteAll = useCallback(() => {
    setState((prev) => {
      const type = prev.deleteAllTarget;
      if (!type) return prev;
      const removed = prev.resources.filter((r) => r.type === type).length;
      const next: MockResourcesState = {
        ...prev,
        resources: prev.resources.filter((r) => r.type !== type),
        deleteAllTarget: null,
      };
      return patchImport(next, type, {
        success: `Đã xóa ${removed} ${SECTION_COPY[type].noun}.`,
      });
    });
  }, []);

  const cancelDelete = useCallback(
    () => setState((prev) => ({ ...prev, deleteTarget: null, deleteAllTarget: null })),
    [],
  );

  const setBands = useCallback(
    (bands: FrequencyBandThresholds) => setState((prev) => ({ ...prev, bands })),
    [],
  );

  const dictionaries = useMemo(
    () => sortByPriority(state.resources.filter((r) => r.type === 'DICTIONARY')),
    [state.resources],
  );
  const frequencies = useMemo(
    () => sortByPriority(state.resources.filter((r) => r.type === 'FREQUENCY')),
    [state.resources],
  );

  return {
    state,
    dictionaries,
    frequencies,
    simulateImport,
    dismissError,
    dismissSuccess,
    resolveDuplicate,
    toggleResource,
    moveResource,
    requestDelete,
    confirmDelete,
    requestDeleteAll,
    confirmDeleteAll,
    cancelDelete,
    setBands,
  };
}
