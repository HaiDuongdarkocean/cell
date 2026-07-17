# Spec: Multi-Candidate Popup Dictionary

## Objective

When user hovers/clicks a word, the popup dictionary shows ALL phrase match candidates + single-word lookup — each as a full entry (header + definitions + buttons). Currently only the single best match (winner) is shown; other matches are discarded.

**User story**: Hover "get" in "I couldn't open the door to get out," → popup shows:
1. "get (sb/sth) out" — phrase match, surface: "get out"
2. "open the door to sth" — phrase match, surface: "open the door to get out"
3. "get" — single-word fallback (if no phrase match covers the word)

Each candidate has its own definitions, audio, Quick Add, status cycle — like the current single popup, stacked linearly.

**Why now**: Users miss alternative interpretations. "get" could be part of "get out", "get over", "get off" — showing only the winner hides valid alternatives.

## Tech Stack

- TypeScript strict, vanilla DOM (no React) in content script
- Shadow DOM popup (popupShell.ts)
- Web Worker for phrase matching + dictionary lookup
- IndexedDB for dictionary storage
- Jest for unit tests

## Commands

```
Build:     npm run build
Test:      npm run test:unit          # ~3s, no network
Typecheck: npm run typecheck
Lint:      npm run lint
```

## Architecture Changes

### Current flow (single winner)

```
User hover "get"
  → Worker: matchPhrase → candidates[] → pick winner → query dict for winner
  → Worker returns: LookupResult (single)
  → Content script: showPopup(result) → renderPopupContent(result)
  → Popup: 1 header + 1 definitions panel
```

### New flow (all candidates, progressive)

```
User hover "get"
  → Worker: matchPhrase → candidates[] (ALL kept)
  → Worker: query dict for winner → send LOOKUP_RESULT (winner + pendingCount)
  → Worker: query dict for each remaining candidate → send LOOKUP_RESULT_APPEND per candidate
  → Content script: showPopup(winner) → renderPopupContent(winner)
  → Content script: appendCandidate(result) → appendCandidateElement(result)
  → Popup: N headers + N definitions panels, stacked linearly
```

### Data structure changes

**types.ts** — new/modified types:

```typescript
// Existing LookupResult stays UNCHANGED — each candidate is a full LookupResult.

// Worker message: LOOKUP_RESULT now carries pending candidate count
interface WorkerLookupResultMessage {
  readonly type: 'LOOKUP_RESULT';
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: LookupResult;        // winner (first candidate)
  readonly pendingCandidates?: number;   // how many more candidates are loading
  readonly error?: string;
}

// NEW: append additional candidate to existing popup
interface WorkerLookupAppendMessage {
  readonly type: 'LOOKUP_RESULT_APPEND';
  readonly requestId: string;
  readonly result: LookupResult;         // next candidate
}

// WorkerMessageType gets 'LOOKUP_RESULT_APPEND' added
```

**lookupOrchestrator.ts** — new function:

```typescript
// Existing lookupOrchestrator stays for backward compat (winner only).
// New function returns ALL phrase matches (not just winner):
async function tryEnglishPhraseMatchAll(
  langCode: string,
  sentence: string,
  cursorOffset: number,
  deps: ...,
  signal?: AbortSignal,
): Promise<PhraseMatch[]>  // ALL matches, sorted by priority

// New orchestrator that yields candidates progressively:
export async function lookupOrchestratorMulti(
  request: LookupRequest,
  deps: ...,
  signal?: AbortSignal,
  onCandidate: (result: LookupResult) => void,  // callback per candidate
): Promise<void>
```

**popupContent.ts** — new function:

```typescript
// Existing renderPopupContent stays for single-candidate (backward compat).
// New function renders one candidate element:
export function renderCandidate(
  container: HTMLElement,
  result: LookupResult,
  currentStatus: WordStatus,
  selection: DefinitionSelection,
  callbacks: { ... },
): HTMLElement  // returns the candidate element with data-dp-popup-candidate

// New function appends a candidate to existing popup:
export function appendCandidate(
  container: HTMLElement,
  result: LookupResult,
  currentStatus: WordStatus,
  selection: DefinitionSelection,
  callbacks: { ... },
): void
```

**popupDictionaryController.ts** — state changes:

```typescript
interface PopupDictionaryState {
  // ... existing fields ...
  currentResult: LookupResult | null;       // winner (first candidate)
  additionalResults: LookupResult[];        // appended candidates
  pendingCandidates: number;                // how many still loading
}
```

### UI layout

```
┌─────────────────────────────────┐
│ [data-dp-popup-candidate]       │
│   Header: term + reading + btns │
│   Definitions: checkboxes       │
│   (no separator)                │
│ [data-dp-popup-candidate]       │
│   Header: term + reading + btns │
│   Definitions: checkboxes       │
│   (no separator)                │
│ [data-dp-popup-candidate]       │
│   ...                           │
│ Footer (shared, 1 only)         │
└─────────────────────────────────┘
```

- Each candidate: `data-dp-popup-candidate` attribute on wrapper div
- Linear stack, no visual separation (no border, no card, no gap)
- Footer: shared (1 footer for whole popup, not per-candidate)
- Scroll: entire popup scrolls, not per-candidate

### Progressive rendering

1. Worker sends `LOOKUP_RESULT` with winner + `pendingCandidates: N`
2. Popup renders winner immediately (current behavior)
3. Popup shows subtle "loading N more..." indicator at bottom
4. Worker sends `LOOKUP_RESULT_APPEND` for each remaining candidate
5. Popup appends candidate, decrements pending count
6. When pending=0, remove loading indicator

### What stays unchanged

- `phraseMatcher.ts` — matching logic unchanged
- `phraseIndexBuilder.ts` — index building unchanged
- `popupShell.ts` — Shadow DOM container unchanged
- `popupToolbar.ts` — toolbar tabs unchanged (attached to winner only)
- Single-word lookup — still works as fallback when no phrase matches

## Project Structure

```
src/features/dictionaryPopup/
  types.ts                          # +LOOKUP_RESULT_APPEND, WorkerLookupAppendMessage
  logic/
    lookupOrchestrator.ts           # +tryEnglishPhraseMatchAll, +lookupOrchestratorMulti
    lookupOrchestrator.test.ts      # +multi-candidate tests
  worker/
    lookupWorkerHandler.ts          # return all candidates, send APPEND messages
    lookupWorkerHandler.test.ts     # +multi-candidate tests
  ui/
    popupContent.ts                 # +renderCandidate, +appendCandidate
    popupContent.test.ts            # +multi-candidate render tests
    popupDictionaryController.ts    # +additionalResults, +appendCandidate flow
    popupDictionaryController.test.ts # +multi-candidate tests
```

## Code Style

```typescript
// Each candidate is a self-contained element with data-dp-popup-candidate
const candidate = document.createElement('div');
candidate.setAttribute('data-dp-popup-candidate', '');
// ... render header + definitions inside candidate ...
container.appendChild(candidate);
```

## Testing Strategy

- **Unit tests**: lookupOrchestrator returns all candidates, popupContent renders multiple candidates, controller manages progressive append
- **Test locations**: colocate `.test.ts` next to source
- **Coverage**: each new function has ≥1 test for happy path + edge case (0 candidates, 1 candidate, 5 candidates)

## Boundaries

- **Always**: Run `npm run test:unit` before commit. Follow existing vanilla DOM + Shadow DOM pattern. Use `data-dp-popup-candidate` attribute.
- **Ask first**: Changing popupShell positioning logic, adding new dependencies, changing worker message protocol beyond adding LOOKUP_RESULT_APPEND
- **Never**: Break existing single-candidate flow (backward compat). Add React or other frameworks. Change phraseMatcher logic.

## Success Criteria

1. Hover "get" in "I couldn't open the door to get out," → popup shows ≥2 candidates (get out + open the door to sth)
2. Each candidate has full header (term, reading, status, frequency, buttons) + definitions
3. Winner renders immediately; other candidates append progressively
4. "Loading N more..." indicator shows while candidates pending
5. All existing tests pass (0 regressions)
6. `npm run build` succeeds
7. `npm run typecheck` passes
8. No new lint errors from changed files

## Open Questions — RESOLVED

1. Toolbar tabs (Audio, Image, Translate, Links) → **Per-candidate** (each has own toolbar)
2. Quick Add → **Per-candidate** (each has own Quick Add in header)
3. Status cycle → **Per-candidate** (each has own header)
