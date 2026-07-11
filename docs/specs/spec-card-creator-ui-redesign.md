# Spec — Card Creator UI redesign

> Source of truth for redesigning the Card Creator dialog/bottom sheet UI.
> Parent spec: `docs/specs/spec-card-creator.md`
> Intent: `docs/intent/intent-card-creator-ui-redesign.md`
> Mockup (approved, must match): `docs/mockups/anki-card-mockup.html`

## 1. Objective

Redesign the Card Creator UI so it is cleaner, more minimalist, and supports a Yomitan-scanable preview block plus improved drag-and-drop media management.

### User stories

- As a language learner, I want a large read-only preview of my target word and sentence so Yomitan can scan them while I edit the card.
- As a user, I want image media shown as a horizontal carousel with real previews and easy remove/reorder/add.
- As a user, I want audio media shown as a vertical list with waveform icons, filenames, and easy remove/reorder/add.
- As a user, I want to drag and drop files into the media area to add them, and drag existing items to reorder them.
- As a mobile user, I want the same UI in the bottom sheet with touch-friendly long-press drag reorder.

### Acceptance criteria

- The UI matches `docs/mockups/anki-card-mockup.html` pixel-wise in spacing, colors, typography, icons, and layout.
- The preview block displays target word and sentence, centered, with the target word bold and all occurrences in the sentence bolded.
- Images render as a horizontal scrollable gallery with ~120px fixed height, actual image previews, and a top-right remove button.
- Audios render as a vertical list with waveform icon, filename, and remove button.
- Field mapping selectors are label-style (no `→`, no background/border, only a small chevron).
- Media areas support drag-and-drop file addition and drag-to-reorder (desktop click-drag, mobile long-press-drag).
- Existing state logic (`useCardCreatorState`, `cardDraft`, `fieldMapping`) is reused without behavioral changes.

## 2. Tech Stack

- React 18 function components + hooks
- TypeScript 5.x strict
- CSS Modules with design-system tokens (`--space-*`, `--color-*`, `--radius-*`, `--font-size-*`)
- Shared UI components: `Dialog`, `BottomSheet`, `Button`, `Select`, `Input`, `Textarea`
- Native HTML5 Drag and Drop API for desktop reorder and file drop
- Touch events (`touchstart`, `touchmove`, `touchend`) for mobile long-press-drag
- No new dependencies (bundle-size guard).

## 3. Commands

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Unit tests
npm run test:unit

# Build extension
npm run build

# Dev build
npm run dev
```

## 4. Project Structure

```
src/features/cardCreator/ui/
  CardCreatorDialog.tsx                 # desktop modal wrapper (already exists)
  CardCreatorDialog.module.css          # shared content styles (UPDATE)
  CardCreatorDialogContent.tsx          # main body (UPDATE)
  CardCreatorBottomSheet.tsx            # mobile wrapper (already exists)
  CardCreatorBottomSheet.module.css     # if needed
  FieldRow.tsx                          # field label + mapping + input (UPDATE)
  FieldRow.module.css                   # (UPDATE)
  MediaList.tsx                         # image/audio list (UPDATE)
  MediaList.module.css                  # (UPDATE)
  PreviewBlock.tsx                      # NEW: read-only preview (Yomitan scan zone)
  PreviewBlock.module.css               # NEW
  SortableMediaList.tsx                 # NEW: drag-drop + reorder logic
  SortableMediaList.module.css          # NEW
  useCardCreatorState.ts                # state hook (already exists, no changes)

src/shared/ui/
  Select.tsx / Select.module.css        # mapping selector (reuse, style override)

src/features/cardCreator/media/mediaFile.ts  # MediaFile type (no changes)
src/features/cardCreator/state/cardDraft.ts  # draft type (no changes)

docs/mockups/anki-card-mockup.html      # approved mockup
docs/specs/spec-card-creator-ui-redesign.md  # this file
```

## 5. Code Style

- Named exports, no default exports.
- CSS modules with kebab-case class names.
- Use design-system tokens only; no hardcoded colors/spacing.
- One component per file; logic functions co-located in `*.utils.ts` if needed.
- React hooks with explicit dependency arrays.
- Accessible: `aria-label`, `role`, `tabIndex`, focus-visible rings.

### Example snippet

```tsx
// PreviewBlock.tsx
import type { ReactElement } from 'react';
import styles from './PreviewBlock.module.css';

interface PreviewBlockProps {
  targetWord: string;
  sentence: string;
}

export function PreviewBlock({ targetWord, sentence }: PreviewBlockProps): ReactElement {
  const highlightedSentence = highlightOccurrences(sentence, targetWord);
  return (
    <div className={styles.previewBlock} aria-label="Preview">
      <div className={styles.previewTarget}>{targetWord}</div>
      <div className={styles.previewSentence}>{highlightedSentence}</div>
    </div>
  );
}

function highlightOccurrences(sentence: string, target: string): ReactElement {
  if (!target.trim()) return <>{sentence}</>;
  // naive case-sensitive split; i18n-safe per AC
  const parts = sentence.split(target);
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 && <strong>{target}</strong>}
        </span>
      ))}
    </>
  );
}
```

## 6. Testing Strategy

- Unit tests with Jest + React Testing Library (`npm run test:unit`).
- Colocate tests: `PreviewBlock.test.tsx` next to `PreviewBlock.tsx`.
- Test coverage:
  - `PreviewBlock` renders target word and sentence, highlights all occurrences.
  - `FieldRow` renders label + mapping select + input; select change calls `onMapChange`.
  - `MediaList` renders image gallery vs audio list; remove/add triggers callbacks.
  - `SortableMediaList` reorder callback fires after drag reorder.
  - `CardCreatorDialogContent` renders preview block and all fields.
- Visual QA: open `docs/mockups/anki-card-mockup.html` and compare implemented UI.
- Browser MCP verification for desktop + mobile bottom sheet.

## 7. Boundaries

- **Always:**
  - Use design-system tokens.
  - Run `npm run test:unit` and `npm run lint` before commit.
  - Keep existing Card Creator state logic untouched.
  - Add `aria-label` to all icon buttons.
  - Preserve `data-testid` for testability.

- **Ask first:**
  - Adding a new dependency.
  - Changing `MediaFile` or `CardDraft` types.
  - Modifying `useCardCreatorState` behavior.
  - Changing `manifest.json`.

- **Never:**
  - Commit secrets or debug `console.log`.
  - Remove existing `spec-card-creator.md` or `intent-card-creator.md`.
  - Break existing quick-update / edit-card flows.
  - Use `any` without explicit reason.

## 8. Data Contract

### Types (compile-time)

```typescript
// src/features/cardCreator/ui/PreviewBlock.tsx
export interface PreviewBlockProps {
  readonly targetWord: string;
  readonly sentence: string;
}

// src/features/cardCreator/ui/SortableMediaList.tsx
export interface SortableMediaListProps {
  readonly files: readonly MediaFile[];
  readonly kind: 'image' | 'audio';
  readonly addLabel: string;
  readonly onAdd: () => void;
  readonly onRemove: (index: number) => void;
  readonly onReorder: (fromIndex: number, toIndex: number) => void;
  readonly onFilesDrop: (files: MediaFile[]) => void;
  readonly addDisabled?: boolean;
  readonly testId?: string;
}
```

### Zod schema (runtime)

Not needed for UI-only feature; `MediaFile` shape is enforced by TypeScript in `mediaFile.ts`.

## 9. UI Specification (must match mockup)

### 9.1 Dialog shell

- Desktop: `Dialog` component, title "Card Creator", showCloseButton.
- Mobile: `BottomSheet` component, title "Card Creator", drag handle.
- Body padding: `var(--space-6)` horizontal, `var(--space-4)` vertical top, `var(--space-6)` vertical bottom.
- Background: `var(--color-background)`.

### 9.2 Alert

- Top of body.
- Style: warning subtle background, left border 3px `var(--color-warning)`, no full border.
- Icon: warning circle exclamation, 16px.
- Text: `No existing card found in this deck. Fill in the fields below to create a new card.`
- Error variant: left border `var(--color-error)`, background `var(--color-error-subtle)`.

### 9.3 Section: Card destination

- Section title: `Card destination`, `var(--font-size-sm)`, `var(--font-weight-semibold)`, uppercase `var(--tracking-wide)`, `var(--color-text)`.
- Pair row: Note type (Select) | Deck (Select), grid 1fr 1fr, gap `var(--space-4)`.
- Mobile: stack vertically.

### 9.4 Preview block (NEW)

- Location: between Card destination and Fields section.
- Container: `var(--color-surface)` background, `var(--radius-md)` border-radius, `var(--space-4)` padding, no border.
- Content:
  - `#1` Target word: first line, centered, `var(--font-size-base)`, `var(--font-weight-semibold)`, `var(--color-text)`.
  - `#2` Sentence: second line, centered, `var(--font-size-base)`, `var(--font-weight-regular)`, `var(--color-text-secondary)`.
  - All occurrences of target word in sentence wrapped in `<strong>` with `var(--color-text)` and `var(--font-weight-semibold)`.
- Realtime sync: update immediately on `targetWord` / `sentence` state change.
- Accessible: `aria-label="Preview"`, `role="region"`.

### 9.5 Section: Fields

- Section title: `Fields`, same style as Card destination.
- Fields in order: Target word, Sentence, Sentence translation, Definitions, Image, Sentence audio, Word audio, Note, More example, Tags.
- Each field:
  - `field-header`: label left, mapping selector right.
  - Label: `var(--font-size-xs)`, `var(--font-weight-medium)`, `var(--color-text-secondary)`.
  - Input/Textarea: design-system Input style, full width, min-height 56px for textarea.

### 9.6 Field mapping selector (redesigned)

- Inline in field header, aligned right.
- Container: `inline-flex`, `align-items: center`, no background, no border.
- Select trigger:
  - Text: `var(--font-size-xs)`, `var(--font-weight-medium)`, `var(--color-text-muted)`.
  - Padding: `2px 14px 2px 4px`.
  - Border: none; background: transparent.
  - `appearance: none`.
  - Focus: `var(--color-primary)` text only.
- Chevron: 10px SVG `polyline points="6 9 12 15 18 9"`, color `var(--color-text-muted)`, absolute right.
- Options: include `None` (value `''`) plus available Anki fields. Native `<select>` fallback for a11y/menu styling in custom Select.
- Width: fit-content.

### 9.7 Media zone (Image)

- Container: `var(--color-surface)` background, `var(--radius-md)`, `var(--space-2)` padding, no border.
- Empty state:
  - Dashed border `var(--color-border)`.
  - Centered icon + text.
  - Text: `Drop image here or click to add`.
  - Cursor pointer.
  - Hover: border `var(--color-border-focus)`, text `var(--color-text-secondary)`.
- Filled state:
  - Horizontal scrollable gallery (`image-gallery`).
  - Thumbnail height 120px fixed; width auto respecting aspect ratio; `object-fit: contain`.
  - Gap `var(--space-2)`.
  - Remove button top-right (4px from edges), 20x20, `var(--color-surface-hover)` bg, `×` icon.
  - Add button at end: dashed border 80x120, `+` icon.
  - Desktop: drag thumbnail to reorder.
  - Mobile: long-press thumbnail to start drag reorder.
  - Click thumbnail to open image preview overlay (existing `ImagePreview` behavior).
  - Drop image files onto zone to append.

### 9.8 Media zone (Audio)

- Container: same surface background, radius, padding.
- Empty state: same dashed icon + text pattern.
- Filled state:
  - Vertical list (`media-list`), gap `var(--space-1)`.
  - Row: waveform icon button (28x28, surface-hover bg) + filename + remove `×`.
  - Row background: `var(--color-background)`.
  - Row border-radius: `var(--radius-sm)`.
  - Click waveform icon to play audio.
  - Add button: `+ Add sentence audio` / `+ Add word audio` text style, no dashed border.
  - Drag row to reorder (desktop drag / mobile long-press).
  - Drop audio files onto zone to append.

### 9.9 Footer

- Desktop: `display: flex`, `justify-content: space-between`, `align-items: center`, border-top `var(--color-border-subtle)`, padding-top `var(--space-3)`.
- Left: "Update mode" label + Select (Overwrite/Append/Skip).
- Right: Cancel (ghost) | Add (secondary) | Update (primary).
- Mobile: stack vertically, Update mode full width, buttons row `flex: 1` each.

### 9.10 Mobile bottom sheet

- Same sections, pair rows stacked, preview block centered, footer stacked.
- 75vh max height, drag handle, overlay tap/drag-down to close.

## 10. Media D&D and Reorder Behavior

### 10.1 Add by file drop

- `onDragOver` on media zone: set `dragover` class (dashed border focus color).
- `onDrop`: read `DataTransfer.files`, filter by `kind` (image accept `image/*`, audio accept `audio/*`), convert to `MediaFile[]`, call `onFilesDrop(files)`.
- Ignore files of wrong type with a non-blocking toast warning.

### 10.2 Reorder

- **Desktop:** each media item is `draggable`. On `dragstart`, store `dataTransfer.setData('text/plain', fromIndex)`. On `dragover` another item, prevent default. On `drop` on another item, call `onReorder(fromIndex, toIndex)`. On `drop` on zone end, append to end.
- **Mobile:** on `touchstart`, start a long-press timer (400ms). On `touchmove` before timer fires, cancel. If timer fires, enter drag mode: create a visual clone under finger, on `touchmove` update clone position, on `touchend` determine drop target index and call `onReorder`. This is a minimal custom implementation; no external library.
- Visual feedback during drag: `opacity: 0.4` on dragged item; placeholder gap where it would land.

### 10.3 State updates

- `onReorder` in `CardCreatorDialogContent` updates `draft.fields[kind]` by moving the item from `fromIndex` to `toIndex`.
- `onFilesDrop` appends new `MediaFile[]` to the corresponding array.

## 11. Success Criteria

- [ ] UI matches `docs/mockups/anki-card-mockup.html` visually (dark + light theme toggle).
- [ ] Preview block renders target word and sentence, centered, with all target-word occurrences bolded.
- [ ] Preview text updates in realtime when `targetWord` or `sentence` inputs change.
- [ ] Field mapping selectors are label-style (no background/border, no `→`).
- [ ] Image media renders as horizontal gallery with 120px height and actual previews.
- [ ] Audio media renders as vertical list with waveform icon and filename.
- [ ] Media empty state shows icon + "Drop ... here or click to add" text.
- [ ] Dropping files onto image/audio zones appends them.
- [ ] Drag-to-reorder works on desktop (mouse drag) and mobile (long-press drag).
- [ ] Removing image/audio triggers `onRemove` and removes the correct item.
- [ ] Add buttons open file picker and append selected files.
- [ ] Mobile bottom sheet uses same redesigned content.
- [ ] `npm run test:unit` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] Browser MCP verifies desktop dialog and mobile bottom sheet.

## 12. Open Questions

- Should the `10 minutes` alert copy be simplified to "No existing card found in this deck" (already used in `CardCreatorDialogContent.tsx`) or keep the spec text? (This is a wording-only decision; no code impact.)
- For the `Add` / `Update` footer order in the final mockup: `Add` is secondary, `Update` is primary rightmost. Confirm this matches quick-update workflow (Update is primary action when recent card exists).
