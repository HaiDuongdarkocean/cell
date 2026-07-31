# Spec: Design System Library — Foundations + Atoms

## Objective

Đổi design-system showcase thành **Design System Library**, lấy ngôn ngữ documentation library kiểu Astryx làm chuẩn trình bày. Wave này chỉ triển khai và phân loại rõ hai tầng:

- **Foundations (Level 0):** Color, Spacing, Typography, Radius, Icons, Motion, Elevation.
- **Atoms (Level 1):** các primitive component đã xác minh là không phụ thuộc molecule/organism.

Molecules, Organisms, Templates và Pages chưa có nội dung trong wave này nhưng được hiển thị trong navigation ở trạng thái disabled với nhãn `Coming later`, để công bố roadmap taxonomy mà không giả vờ chúng đã được hỗ trợ.

## User outcomes

- Người dùng phân biệt ngay token/foundation với component atom.
- Người dùng tìm component theo level và UI intent, không theo technical source folder.
- Foundation preview dùng presentation phù hợp với dữ liệu (swatch, scale, specimen), không dùng chung card component preview.
- Atom preview dùng compact catalog cards, có category và variant/state context.
- Light/dark mode giữ nguyên hierarchy và readability.

## Taxonomy

```ts
type LibraryLevel = 'foundations' | 'atoms';
```

Navigation roadmap có thể biểu diễn các level chưa triển khai bằng dữ liệu tĩnh, nhưng `ShowcaseMeta.level` chỉ nhận level đã được hỗ trợ trong wave này.

```ts
interface ShowcaseMeta {
  title: string;
  description: string;
  level: 'foundations' | 'atoms';
  category: string;
  order?: number;
  status?: 'stable' | 'experimental' | 'deprecated';
}
```

`sourceGroup` nếu cần giữ để trace implementation là metadata phụ, không dùng làm primary navigation.

## Information architecture

```text
Design System Library
├── Foundations
│   ├── Color
│   ├── Spacing
│   ├── Typography
│   ├── Radius
│   ├── Icons
│   ├── Motion
│   └── Elevation
├── Atoms
│   ├── Action
│   ├── Content
│   ├── Input
│   ├── Feedback
│   ├── Navigation
│   └── Display
├── Molecules (disabled — Coming later)
├── Organisms (disabled — Coming later)
├── Templates (disabled — Coming later)
└── Pages (disabled — Coming later)
```

## Presentation rules

### Foundations

- `Color Scale`: swatches/token rows grouped by Core, Semantic, Tint, Data Visualization, Syntax.
- `Spacing Scale`: visual bars grouped by half-step, core, large scale.
- Typography/Radius/Icons/Motion/Elevation: foundation-specific specimens; no generic component card requirement.
- Foundation section is first and visually distinct from atom section.

### Atoms

- Compact responsive card grid.
- Card shows title, category/level metadata, preview, and concise variant/state information.
- No long implementation descriptions in the overview grid.
- An atom must not be labeled solely because it currently lives under `src/shared/ui`.

### Higher levels

- No molecule/organism/template/page showcase content is created in this wave.
- Disabled roadmap items are non-interactive, keyboard-safe, and visually distinct from active navigation.

## Search and navigation

- Page title: `Design System Library`.
- Subtitle: `Foundations → Atoms`.
- Search placeholder: `Search library...`.
- Result count: `N items`.
- Search matches title, description, level, and category.
- Sidebar counts active Foundation and Atom items.
- Sidebar scroll links use level/category anchors.
- Active navigation state is visible in light and dark themes.

## Commands

```text
npm run typecheck
npm run test:unit
npm run build
npx vite build --mode development
```

Browser verification uses Chrome DevTools MCP and the generated design-system library page.

## Project structure

```text
src/entrypoints/design-system-showcase/
  autoDiscovery.ts              # metadata contract and discovery/grouping
  ShowcaseGallery.tsx           # library shell, navigation, search, sections
  ShowcaseGallery.module.css    # responsive library layout
  App.tsx                       # page shell and theme control
src/shared/ui/*.showcase.tsx    # showcase metadata and previews
tests/                          # discovery/grouping/filter tests where applicable
docs/specs/                     # this specification
tasks/                          # implementation plan and task checklist
```

## Code style

Use named exports, React function components, existing tokens, and existing UI patterns. Metadata must be explicit rather than inferred from technical paths:

```tsx
export const showcaseMeta = {
  title: 'Avatar',
  description: 'User representation with size, shape, fallback, and status variants.',
  level: 'atoms',
  category: 'Content',
  order: 3,
  status: 'stable',
} as const;
```

## Testing strategy

- Unit test metadata normalization, level/category grouping, search matching, and disabled roadmap behavior.
- Build must pass after source changes and regenerate token artifacts when applicable.
- Browser verification must confirm:
  - title/copy says Library, not Showcase;
  - Foundations appears before Atoms;
  - disabled higher levels show `Coming later` and cannot activate content;
  - Color and Spacing render in Foundation presentation;
  - Atom cards render in Atom presentation;
  - search works by title/category/level;
  - light/dark mode remains readable;
  - responsive layout works at 320px, 768px, 1024px, and 1280px.

## Boundaries

- Always: use semantic tokens, preserve accessibility, keep discovery deterministic, run typecheck/tests/build/browser verification.
- Ask first: adding dependencies, changing manifest, creating Molecules/Organisms/Templates/Pages content, changing token SSOT.
- Never: fabricate higher-level examples, use technical source groups as the user-facing hierarchy, use raw colors in new UI, or delete existing showcases without migration mapping.

## Success criteria

- No active item is displayed without an explicit supported level and category.
- Foundations and Atoms are visually and semantically distinct.
- Higher levels are visible only as disabled roadmap entries.
- Existing valid showcases remain discoverable after migration.
- The library can be extended to higher levels later without changing the Foundation/Atom contract.
