// Options data contract — TypeScript types (compile-time check).
// Logic import (ADR-023) + theme (ADR-022) đã có. UI agent import types này.
// Logic agent không đổi — chỉ re-export cho UI.

import type { ResourceInfo } from '@/entities/dictionary';
import type { ThemeConfig, ThemeMode, ResolvedMode } from '@/entities/theme';

// === Logic output → UI input ===

// Re-export entity types cho UI agent (single import point)
export type { ResourceInfo, ImportResult } from '@/entities/dictionary';
export type { ThemeConfig, ThemeMode, ResolvedMode } from '@/entities/theme';

// ResourcesPanel state — logic provides via listResources() + importFile()
export interface ResourcesPanelState {
  readonly resources: ResourceInfo[];
  readonly loading: boolean;
  readonly importing: boolean;
  readonly progress: number;        // 0-100
  readonly progressTotal: number;
  readonly error: string | null;
  readonly success: string | null;
}

// ThemePanel state — logic provides via themeManager
export interface ThemePanelState {
  readonly mode: ThemeMode;
  readonly config: ThemeConfig;
  readonly systemResolved: ResolvedMode;
}

// === UI-only state (no logic) ===

// Tab — UI-only state (sidebar active item)
export type Tab = 'resources' | 'theme' | 'settings';

// Sidebar item — UI config (room grow cho items sau)
export interface SidebarItem {
  readonly id: Tab;
  readonly label: string;
  readonly icon: string;   // SVG icon key
}
