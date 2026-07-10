# Spec: Options page redesign

> Pipeline: SPEC → DESIGN → IMPLEMENT → CHECK → SHIP. File này là Gate SPEC.
> Source: `cell` project, ADR-022 (theme) + ADR-023 (dictionary import) + design system `docs/design-system/`.

## Objective

Redesign trang `chrome-extension://<id>/options.html` để:
- Tuân thủ design system `docs/design-system/design-dark-github.md` (dark, GitHub-style, terminal-green CTA).
- Hỗ trợ 3 tab: Tài nguyên (dictionary + frequency import), Giao diện (theme), Cài đặt (settings — placeholder M11 ponytail).
- Logic import + theme đã có (ADR-022, ADR-023). Redesign chỉ đổi UI shell + placement, không đổi logic.
- Cho phép logic agent và UI agent làm song song (khác worktree) qua data contract.

**User**: Anh yêu (developer tự dùng, không phải end-user). Mục tiêu: trang options đẹp, đúng design system, dễ thêm tính năng sau.

**Success looks like**:
- `npm run test:unit` exit 0 (logic + UI unit test xanh).
- `ui-checker` Layer 1 (MCP ATs) pass 8/8.
- `ui-checker` Layer 2 (subagent cognitive) PASS.
- Trang mở trong Chrome thật, dark, terminal-green CTA, 3 tab, không console error.

## Tech Stack

- React 19 + TypeScript 6 (strict, no `any`).
- Vite 8 + @crxjs/vite-plugin (MV3 build).
- Jest 30 (unit + integration projects).
- CSS Modules (no Tailwind, no styled-components).
- Zustand 5 (state — đã có).
- Design system: `docs/design-system/` (tokens trong `tokens/*`, components trong `components/*`).

## Commands

```
Build:        npm run build
Test unit:    npm run test:unit
Test fast:    npm run test:fast
Typecheck:    npm run typecheck
Lint:         npm run lint
Dev:          npm run dev
```

## Project Structure (scope redesign)

```
src/entrypoints/options/
├── OptionsApp.tsx                  # Shell: header + tablist + tabpanel
├── OptionsApp.module.css           # Shell styles (reference design system tokens)
├── options.html                    # Vite entry HTML
├── options.main.tsx                # React mount
└── types.ts                        # NEW — TypeScript types (data contract)
src/features/dictionary/ui/
├── ResourcesPanel.tsx              # Existing — restyle to design system
├── ResourcesPanel.module.css       # Existing — restyle
├── Dropzone.tsx, ResourceCard.tsx, ImportProgress.tsx, DeleteConfirmModal.tsx  # Existing — restyle
src/features/theme/ui/
├── ThemePanel.tsx                  # Existing — restyle
├── *.module.css                    # Existing — restyle
src/features/settings/ui/
├── SettingsPanel.tsx               # NEW — placeholder for M11 ponytail (replace SettingsPlaceholder)
├── SettingsPanel.module.css        # NEW
tests/unit/entrypoints/options/
├── OptionsApp.test.tsx             # NEW — shell unit tests (TDD)
├── SettingsPanel.test.tsx          # NEW
evidence/options/                   # NEW — ui-checker output
UI-UX-Contract.md                   # NEW — design-driven-development output (Gate 2)
```

## Code Style

Function component + hooks, named export, colocate test (`X.tsx` → `X.test.tsx`), TypeScript strict, CSS Modules với `var(--token)` từ design system (no freeform hex).

```typescript
// Example — OptionsApp.tsx style
import { useState, type ReactElement } from 'react';
import styles from './OptionsApp.module.css';

type Tab = 'resources' | 'theme' | 'settings';

export function OptionsApp(): ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('resources');
  return (
    <div className={styles.container} data-testid="options-app">
      {/* ... */}
    </div>
  );
}
```

## Testing Strategy

- **Unit (Jest, ~80%)**: shell render, tab switch, schema binding, ARIA, anti-slop grep. Colocate: `X.tsx` → `X.test.tsx` trong `tests/unit/`.
- **Integration (MCP edge-devtools, ~15%)**: AT1-AT7 qua `ui-checker` Layer 1 — install extension, navigate, snapshot, evaluate, lighthouse, console.
- **Cognitive (subagent, ~5%)**: AT1.needs_guide qua `ui-checker` Layer 2.
- Coverage: không track %, track "mọi behavior mới có test".

## Boundaries

- **Always**: `npm run test:unit` trước commit. Dùng `var(--token)` từ design system, không freeform hex. Colocate test. Update `docs/2-architechture-system.md` khi đổi `src/`.
- **Ask first**: thêm dependency, đổi `manifest.json`, đổi `package.json` scripts.
- **Never**: commit secret, edit `dist/` (build artifact), bỏ qua test fail, dùng Inter font, dùng em-dash `—`, dùng AI-purple gradient.

## Data Contract

Logic import (ADR-023) và theme (ADR-022) đã có. UI agent chỉ cần biết **shape data** để render. Logic agent không đổi — chỉ export types/schema cho UI import.

### Logic output → UI input

```typescript
// src/entrypoints/options/types.ts
// Logic output → UI input (ResourcesPanel consumes)

import type { ResourceInfo, ImportResult } from '@/entities/dictionary';
import type { ThemeConfig, ThemeMode } from '@/entities/theme';

// ResourcesPanel state — logic provides via listResources() + importFile()
export type ResourcesPanelState = {
  resources: ResourceInfo[];
  loading: boolean;
  importing: boolean;
  progress: number;        // 0-100
  progressTotal: number;
  error: string | null;
  success: string | null;
};

// ImportResult — logic output after importFile()
// (re-export from entities/dictionary — ADR-023 đã define)
export type { ImportResult } from '@/entities/dictionary';

// ThemePanel state — logic provides via themeManager
export type ThemePanelState = {
  mode: ThemeMode;
  config: ThemeConfig;
  systemResolved: 'light' | 'dark';
};

// Tab — UI-only state (no logic)
export type Tab = 'resources' | 'theme' | 'settings';
```

### Zod schema (runtime validation tại boundary)

```typescript
// src/entrypoints/options/schema.ts
import { z } from 'zod';
// Note: zod chưa có trong package.json — sẽ add ở IMPLEMENT step nếu Anh yêu approve
// Alternative: dùng TypeScript type guard thủ công nếu không muốn thêm dependency

export const ResourcesPanelStateSchema = z.object({
  resources: z.array(z.object({
    id: z.string().nullable(),
    name: z.string(),
    type: z.enum(['DICTIONARY', 'FREQUENCY']),
    wordCount: z.number().int().min(0),
  })),
  loading: z.boolean(),
  importing: z.boolean(),
  progress: z.number().min(0).max(100),
  progressTotal: z.number().int().min(0),
  error: z.string().nullable(),
  success: z.string().nullable(),
});

export const TabSchema = z.enum(['resources', 'theme', 'settings']);
```

### Where files live

- `src/entrypoints/options/types.ts` — TypeScript types (logic + UI import).
- `src/entrypoints/options/schema.ts` — Zod schema (UI + test import, runtime validation khi data từ IndexedDB/message passing vào UI).
- `tests/unit/entrypoints/options/` — test import schema từ `src/`, không redefine.

### Why this matters

Logic agent (nếu cần đổi logic import/theme) và UI agent (redesign shell) có thể làm song song khác worktree, cả 2 import cùng `types.ts`. Test (TDD) là verifier — `ResourcesPanelStateSchema.parse(state)` chấm pass/fail. Không cần verifier agent riêng.

## Success Criteria

- [ ] `npm run test:unit` exit 0.
- [ ] `npm run typecheck` exit 0.
- [ ] `npm run build` exit 0, `dist/` fresh.
- [ ] `ui-checker` Layer 1: 8/8 ATs pass (AT1a, AT1b, AT2, AT3, AT4, AT5, AT6, AT7).
- [ ] `ui-checker` Layer 2: subagent cognitive PASS.
- [ ] Trang mở trong Chrome thật: dark, terminal-green CTA, 3 tab, 0 console error.
- [ ] `docs/2-architechture-system.md` updated (thêm SettingsPanel, types.ts, schema.ts).

## Decisions (Anh yêu approved)

1. **Zod dependency**: thêm `zod` vào `package.json`. Runtime validation mạnh, `ui-checker` dùng `Schema.parse()` chấm pass/fail.
2. **Settings tab**: giữ placeholder (M11 ponytail). Redesign scope chỉ shell + resources + theme. Settings implement sau.
3. **Design system tokens**: migrate sang tokens mới (`--color-deep-void`, `--color-terminal-green`, `--color-slate-edge`, ...). Bỏ fallback hex. Tuân design system 100%.
