# Popup Dictionary — UX Improvement Spec

> Scope: learner-facing UI/UX improvements for the content-script popup dictionary.
> Date: 2026-07-18
> Source: learner-perspective Socratic audit + existing specs §4.6.3 / §9.

## Socratic learner-perspective audit

A learner using the popup while watching a video asks:

1. **Can I read the meaning without the popup blocking the subtitle?** → The popup is anchored to the word and cannot be moved.
2. **Can I close it easily if I clicked the wrong word?** → Only Esc / click outside; no visible close control.
3. **Can I hear the word immediately?** → Audio is hidden behind the Audio tab; must click tab, then click play.
4. **Do I know what will be saved when I Quick Add?** → Default-everything is selected, but there is no visible summary of what is included.
5. **Did Quick Add work?** → No inline feedback; only a `console.warn` stub.
6. **Can I use only the keyboard?** → Tab exits the popup and goes back to the page; no focus trap.
7. **Can I see the image clearly before selecting?** → Thumbnails are tiny; no preview.
8. **Will the status badge cycle somewhere I don't expect?** → One click cycles `unknown → tracking → known → ignore`; no preview.
9. **Are external links obviously external?** → Plain text list; no icon.
10. **Can I drag the popup on a tablet?** → Only mouse resize handle; no drag support.

## Proposed improvements (≥10)

| # | Improvement | Pros | Cons / Risk |
|---|---|---|---|
| 1 | **Draggable popup** — header / grip is a drag handle; pointer/touch moves popup; offset optionally persisted. | Doesn't block subtitle/video; learner controls position; tablet friendly. | Pointer logic complexity; must not conflict with header buttons; store/restore offset. |
| 2 | **Explicit close button** in header next to settings. | Obvious dismissal; works for touch; complements Esc/click-outside. | Takes header space; minor. |
| 3 | **Focus trap + keyboard navigation** — `role="dialog"`, `aria-modal="true"`, Tab cycles, Esc closes, restore focus. | WCAG AA; screen reader + keyboard users can use popup. | Must track focusable elements; content-script event handling. |
| 4 | **Header audio button** — play term pronunciation inline (TTS/first audio) without opening Audio tab. | Fastest access to sound; reduces clicks; supports listening-first learners. | May duplicate Audio tab; needs fallback when no audio. |
| 5 | **Audio play/pause state** — audio row icon swaps to `pause` while playing; active row highlighted. | Clear playback state; prevents multiple clicks. | Requires tracking `HTMLAudioElement` lifecycle. |
| 6 | **Quick Add feedback toast** — success/error/saving toast inside popup Shadow DOM. | User trusts the action; reduces duplicate clicks; matches design system toasts. | Need toast component in content-script surface. |
| 7 | **Image grid layout** — replace horizontal strip with `grid auto-fill` (Variant B from design spec). | More images visible; better width usage. | Taller panel; may push content. |
| 8 | **Image lightbox preview** — click thumbnail opens larger preview overlay. | User can inspect detail before selecting. | Overlay complexity; more code. |
| 9 | **Selection summary bar** — show counts of selected definitions / audio / images / translation above footer. | User knows exactly what will be saved; fewer mistakes. | More chrome; needs live update. |
| 10 | **Status cycle preview** — status button `title` shows current → next; hover/focus previews. | Prevents accidental status changes; educates cycle order. | Easy; title-only. |
| 11 | **External link chips** — convert Links list to chips with external link icon; open in new tab. | Scannable; clear external affordance; space efficient. | Long names may truncate. |
| 12 | **Collapsible examples** — hide examples behind an expand toggle per definition. | Reduces wall of text; faster scanning. | Extra click per definition. |
| 13 | **Translate source sentence preview** — show the source sentence in empty translate state. | Context before translating; reduces ambiguity. | Minor text change. |
| 14 | **Persist popup drag offset** — remember last dragged position per domain or globally. | Personalized placement; less repositioning. | Storage quota; per-domain key complexity. |

## Evaluation & selection

Selection criteria (ponytail: highest learner value, smallest implementation surface, no new dependencies):

- **Must have** (high learner value, low risk): #2 close button, #3 focus trap, #4 header audio, #6 Quick Add toast, #10 status preview, #11 link chips.
- **Should have** (noticeable value, medium risk): #1 draggable popup, #5 audio play/pause, #7 image grid.
- **Could have** (nice-to-have, deferred): #8 lightbox, #9 selection summary, #12 collapsible examples, #13 translate preview, #14 persist offset.

**Selected for this iteration:**

1. Close button
2. Focus trap + keyboard navigation
3. Draggable popup
4. Header audio button
5. Audio play/pause state
6. Quick Add toast feedback
7. Image grid layout
8. External link chips
9. Status cycle preview (title only)

## Implementation notes

- `popupShell.ts`: add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to term; focus first focusable element on show; Tab trap; restore focus on hide/destroy; pointer drag on header.
- `popupContent.ts`: add close button and audio button to `renderHeader`; status badge `title` with cycle preview; add `onClose` and `onPlayTerm` callbacks.
- `popupDictionaryController.ts`: wire close/hide; wire header audio to `playTts`; manage `currentlyPlayingAudioId`; render toast via DOM instead of `console.warn`; call focus trap helpers.
- `popupToolbar.ts`: audio row `pause` icon when `item.id === currentlyPlayingId`; links as chips; image strip changed to grid via CSS.
- `popupDictionary.css`: chip styles, grid styles, toast styles, drag cursor, focus-trap focus ring, audio playing highlight.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npx jest --selectProjects unit` (popupDictionary/* tests)
- `npm run build`
- Manual keyboard / pointer review in subagent QA pass.
