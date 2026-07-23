# Send to Card Queue — I+N Review Flow

## Problem Statement
How might we let users review and add N unknown/tracking words from a single subtitle line to Anki via the Card Creator dialog — without opening the popup dictionary N times?

## Recommended Direction
**Direction A — Sidebar queue inside Card Creator dialog (right side).**

When the user clicks "Send to Card" (edit-card) from the subtitle cluster and the current subtitle line has N unknown/tracking words, the Card Creator dialog opens with a sidebar on the **right side** listing all N items. Each item shows the target word + status badge (unknown/tracking). Clicking an item switches the dialog's prefill (targetWord, definitions, sentence, translation, media). After the user clicks Add or Update, the dialog auto-advances to the next item in the queue.

Media (screenshot + sentence audio) is captured **once** before the dialog opens and shared across all N cards — no repeated video seeking.

### Sidebar Toggle Behavior
- **N = 1 (I+1):** Sidebar defaults to **closed**. The dialog opens as a normal single-card editor — no sidebar visible. The toggle icon is still present but hidden (no queue to show).
- **N ≥ 2 (I+N):** Sidebar defaults to **open**. The dialog opens with the sidebar visible on the right, showing all N items.
- **Toggle icon:** Located in the dialog header, **next to the close button**. Clicking it toggles the sidebar open/closed. The icon is only rendered when N ≥ 2.
- **State persistence:** The toggle state (open/closed) persists for the duration of the queue session. If the user closes the sidebar, it stays closed as they auto-advance through items. If they reopen it, it stays open.
- **Mobile (bottom sheet):** The sidebar collapses into horizontal pills at the top of the sheet. The toggle icon hides/shows the pills row. Same N=1/N≥2 default behavior applies.

This reuses the existing `CardCreatorOpenContext` + `useCardCreatorState` architecture. The queue is a new `CardCreatorQueue` array passed alongside the prefill, with an `activeIndex` that the dialog switches on item click or auto-next.

## Key Assumptions to Validate
- [ ] N is typically small (1-3) — if N > 10, sidebar overflows. Test with real subtitle lines.
- [ ] Dictionary lookup for N words via background is fast enough (~100-300ms per word, N=3 → ~1s total). Measure.
- [ ] Users want to review each word individually (Send to Card = review path; Quick Add = batch path without review).
- [ ] Media capture once is sufficient — the screenshot frame doesn't change within a single subtitle cue. Verified by existing `buildCardCreatorContext` logic.

## MVP Scope
**In:**
- `edit-card` action from cluster → tokenize subtitle → find unknown/tracking words → lookup each → build queue
- Card Creator dialog: sidebar (desktop) / pills (mobile) showing N items with status badge
- Sidebar toggle icon next to close button — only rendered when N ≥ 2
- N = 1 → sidebar default closed (single-card editor, no toggle icon)
- N ≥ 2 → sidebar default open
- Toggle state persists across auto-advance within the same queue session
- Each item has a **delete button (×)** to remove it from the queue. Deleting the active item auto-advances to the next remaining item. Deleting the last item closes the dialog with a summary toast.
- **Undo on delete:** When an item is deleted, a toast with an **undo button** appears for **3 seconds**. Clicking undo restores the item to its original position in the queue. After 3s the deletion is permanent. This prevents accidental deletes from losing a word the user still wanted to review.
- Click item → switch prefill (targetWord, definitions, sentence, translation, shared media)
- Add/Update → auto-next item
- Queue exhausted → dialog closes with summary toast
- Media captured once before dialog opens (shared across all items)

**Out:**
- Reordering queue items (drag-drop) — YAGNI for MVP
- Skipping items (mark as "don't add") — handled by the per-item delete button (×). User removes items they don't want, keeping only what they want to review.
- Persisting queue across page reloads — queue is per-subtitle-line, ephemeral
- Batch operations within queue (select all, add all) — that's Quick Add's job

## Not Doing (and Why)
- **Queue popover separate from dialog** — adds a UI layer without value. Integrating into the dialog is simpler and keeps the user in one place.
- **Re-capturing media per word** — the frame is the same for one subtitle cue. Re-capture would seek the video N times, degrading UX.
- **Queue persistence** — the queue is tied to the current subtitle line. If the user navigates away, the queue is stale. Ephemeral is correct.
- **N > 10 support** — cap at 10. If more, toast "Use Quick Add for batch." Sidebar with 10+ items is cluttered; users who want batch without review should use Quick Add.
- **Drag-drop reordering** — the queue order follows sentence order. Reordering adds complexity for minimal value.

## Open Questions
- Should the sidebar show the word's frequency band (core/advanced) alongside the status badge? (Existing tokenize system already has this data.)
- When the user edits the targetWord in the dialog (types a different word), should the queue item update? Or is the queue read-only?
- ~~Should there be a "Skip" button to move to the next item without adding?~~ — Resolved: per-item delete button (×) handles this. User removes items they don't want.
