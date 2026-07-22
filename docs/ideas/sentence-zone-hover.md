# Sentence Zone Hover — Keep Popup Alive Within Sentence

## Problem Statement
How might we keep the dictionary popup alive when the user moves their cursor within the sentence they're currently looking up — even over spaces between words — so hover word-to-word is seamless without dismiss flicker? The sentence module must be SSOT — shared by hover zone, translation context, and SRS card creation.

## Recommended Direction
**SSOT sentence module + sentence zone + delayed dismiss + adaptive highlight.**

### SSOT: `src/features/dictionaryPopup/sentence/`

One module, three consumers:

```
                    ┌─────────────────────────┐
                    │   sentenceModule.ts     │  ← SSOT
                    │  (extract + split +     │
                    │   range + zone rect)    │
                    └──────┬──────────┬───────┘
                           │          │
           ┌───────────────┼──────────┼───────────────┐
           ▼               ▼          ▼               ▼
     Hover Zone      Translation   SRS Card       Subtitle
   (webTrigger)    (popup state)  (cardCreator)   (cue text)
```

**Current state (scattered):**
- `extractSentenceContext` (webTriggerController) — DOM block-level, returns entire block as "sentence"
- `getSentenceText` (textTokenizer) — token-based, sentenceIndex grouping
- Subtitle cue text — passed directly as sentence
- `contextSentence` (LookupRequest) vs `sentence` (QuickAddPayload) — same concept, different names
- 2 separate `translateSentence` implementations (popup vs cardCreator)

**SSOT module provides:**
1. `extractSentence(textNode, offset)` → `{ text, start, end, blockEl, range }` — punctuation-aware split, merge if < 3 words
2. `sentenceZoneRect(range)` → `DOMRect` — bounding rect for hover zone
3. `isPointInSentenceZone(x, y, range)` → `boolean` — hit test for hover guard
4. Replaces `extractSentenceContext` + `getSentenceText` + subtitle sentence logic

**Migration path (incremental):**
1. Create `sentence/` module with `extractSentence` (punctuation split + merge + TreeWalker map)
2. `webTriggerController` imports from module → deprecate `extractSentenceContext`
3. `LookupRequest.contextSentence` stays (public API) but computed via module
4. `QuickAddPayload.sentence` maps from `contextSentence` (already does this)
5. `textTokenizer.getSentenceText` delegates to module (or stays for tokenize-specific logic)

### Zone + dismiss + highlight (built on SSOT)

When a lookup fires, `extractSentence` computes the sentence range (split by punctuation, merge if < 3 words). While the cursor stays within `sentenceZoneRect`, the popup stays open — no `resetHover()` on spaces. When the cursor leaves the zone, dismiss after 500ms. A subtle background tint highlights the active sentence, adaptive to the website's background luminance.

## Key Assumptions to Validate
- [ ] `caretRangeFromPoint` returns a valid text node when hovering over spaces (not just word chars) — test on real pages
- [ ] Sentence split regex handles decimals (`3.5`), CJK punctuation (`。！？`), and no-punctuation blocks (headings)
- [ ] `getComputedStyle(el).backgroundColor` gives usable luminance for adaptive tint — some sites use `transparent` or inherit
- [ ] 500ms dismiss delay feels natural — not too sluggish, not too twitchy
- [ ] Sentence zone bounding rect (`Range.getBoundingClientRect()`) covers multi-line sentences correctly
- [ ] SSOT module doesn't break existing `LookupRequest.contextSentence` consumers (translation, SRS, audio)

## MVP Scope

### In
1. **SSOT sentence module** (`src/features/dictionaryPopup/sentence/sentenceModule.ts`):
   - `extractSentence(textNode, offset)` → `{ text, start, end, blockEl, range }`
   - Split by `/(?<!\d)[.!?。！？]+(?!\d)(?:\s+|$)/` → find sentence containing cursor → merge if < 3 words → map to DOM Range via TreeWalker
   - Pure functions, no side effects, fully testable
2. **Zone-aware hover guard** in `onMouseMove`: If popup is open AND `isPointInSentenceZone(x, y, range)` → skip `resetHover()`, cancel pending dismiss timer
3. **Delayed dismiss**: When cursor leaves zone → `setTimeout(500ms)` → `resetHover()`. Re-entering zone cancels the timer.
4. **Adaptive sentence highlight**: Overlay div on zone rect with tint based on background luminance (`getComputedStyle` → relative luminance → dark tint on light bg, light tint on dark bg)
5. **Highlight lifecycle**: Show on lookup, clear on dismiss/lookup-change. Reuse `wordHighlight.ts` overlay mechanism.
6. **Migration**: `webTriggerController.extractSentenceContext` → delegate to module. `buildHoverLookupRequestFromContext` uses module output for `contextSentence`.

### Not Doing (and Why)
- **NLP sentence parsing** (abbreviations, quotes, URLs) — zone off by a few chars doesn't break the goal; over-engineering
- **Cross-block sentence zones** — sentences don't span `<p>` boundaries in practice; keep it simple
- **Configurable zone size** — YAGNI; 3-word minimum + punctuation split is enough
- **Sentence zone for click mode** — click mode already has text-aware dismiss (`isPointOnText`); only hover mode needs this
- **Animation on highlight** — fade-in is enough, no slide/expand
- **Unifying `translateSentence`** (popup vs cardCreator) — separate concern, out of scope for this feature
- **Renaming `contextSentence` → `sentence`** in LookupRequest — public API break, not worth it now
- **Migrating `textTokenizer.getSentenceText`** — tokenize has its own sentenceIndex grouping; can delegate later

## Open Questions
- Should the sentence highlight show in subtitle mode too, or only web text hover?
- If the sentence zone is very large (long sentence with no punctuation), should we clamp to N visual lines?
- Should the 500ms dismiss timer reset on each mousemove outside zone, or only on zone exit?
- Should `extractSentence` return multiple sentence ranges (for the < 3 words merge case) or just one merged range?
