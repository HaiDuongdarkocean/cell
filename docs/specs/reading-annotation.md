# Spec: Reading Annotation — batched pronunciation hints on tokenized text

> Intent: `docs/intent/reading-annotation.md` · ui_surface: yes · Mode: all

## Objective

Render each tokenized term's stored pronunciation (IPA) or reading (pinyin/furigana-class) as a small annotation attached to the token span, batched through the existing metadata-hydration seam — so a learner can read a subtitle line aloud without opening the dictionary popup. v1 covers surfaces with a controlled layout zone (subtitle overlay, CueList, card-creator preview) and languages whose tokenizer produces term-level tokens whose dictionaries carry `reading`/`pronunciation` (zh + IPA-covered languages). Japanese furigana is explicitly out — `tokenizeTextBlock` special-cases `'zh'` only; ja yields clause-level tokens (`textTokenizer.ts:46`); unblocking it requires a ja segmenter (named follow-up).

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | enables "show readings" on a language profile | profile toggle | token annotations appear/disappear without re-tokenizing |
| System | token list hydration | terms per token list | one extra batched message leg → `Token.reading` |
| System | dictionary row lacks reading/IPA | `reading === term` or both empty | no annotation, no visual artifact |
| System | dictionary set changes mid-session | existing reload broadcast | cached readings re-resolve |

## Requirements

### Functional

REQ-1: Batch reading resolution message
- Actor: system
- Goal: terms → display-ready reading strings in one roundtrip per chunk
- Basic flow:
  1. new message type `READINGS_GET`; payload mirrors `FrequencyGetPayloadSchema` (`dictionarySchemas.ts:321-325`): `{ tabId, langCode, terms }` with `terms.max(1000)`; response `{ readings: Record<string, string> }` — display text only, no kind label (the string carries its own script; mislabeling impossible when there is no label)
  2. background handler `handlers/readings.ts`: eligible dictionary resources = enabled + `installationFinished` (`frequencyAllowedIds` precedent, `handlers/frequency.ts:22-29` — an unordered `Set`); ordering comes from `ResourceInfo.priority` with resourceId-desc fallback — `buildResourcePriority` is module-private (`lookupOrchestrator.ts:200-210`) and must be extracted or reimplemented for handler use
  3. new repository read `findDictionaryByTerms(langCode, terms): Promise<Map<string, DictionaryEntry[]>>` on `resourceEntryRepository` — bounded cursor over the `by_term` index, same cost shape as `findFrequencyByTerms` (`resourceEntryRepository.ts:166-220`); full rows deserialize (senses/definitions come along — accepted; no projection possible short of a new index)
  4. per-term rule — **exact orchestrator find-semantics** (`lookupOrchestrator.ts:809-816`): scan entries in resource-priority order; first entry where `!disabledComponents(resourceId).has('pronunciation')` AND (`pronunciation` non-empty OR (`reading` non-empty AND `reading ≠ term` case-insensitive)) wins; result = `pronunciation || reading`; if the winning `pronunciation` equals the term case-insensitively → omit the term. Critical detail: an entry whose only reading equals the term does NOT win the scan — it is skipped so a lower-priority resource's real reading still surfaces (importer fallback emits `reading = term`, `baseImportStrategy.ts:202` — equality, not `''`, is the "no distinct reading" marker)
- Alt flow: no eligible dictionary resources → `{ readings: {} }`
- Exception: store read fails → `success:false` response; callers treat as empty map
- Rules: never runs `lookupOrchestrator`/`LOOKUP_REQUEST` (single-term, fires `requestRemoteCheck` side-effect, `handlers/lookup.ts:33-38`); `disabledComponents['pronunciation']` suppresses the entry as reading source entirely — identical to popup semantics, so a disabled-pronunciation resource never annotates; `prons[]` accent variants are ignored in v1 (popup picks one accent there — annotation uses the flat `pronunciation` string only)
- NFR refs: NFR-1, NFR-4

REQ-2: Token hydration — `Token.reading`
- Actor: system
- Goal: every rendered token list resolves readings in the same batch wave as status/frequency
- Basic flow:
  1. `Token` gains `readonly reading?: string` (`features/tokenize/types`); `createTokenList` leaves it undefined
  2. `resolveTokenListMetadata` adds a readings leg to the existing `Promise.all` (`tokenListMetadata.ts:45`): `getReadings(langCode, terms)` — new client mirroring `frequencyClient` chunking (500) AND copying `wordStatusClient`'s `normalizeLangCode` (`wordStatusClient.ts:17-20`) which `frequencyClient` lacks
  3. fallback: when the readings map misses a term, the already-fetched `FrequencyEntry[]` for that term is scanned in entry order for the first `reading` distinct from the term (case-insensitive) — frequency responses already carry `reading` for free (`frequencyClient.ts:27-34`); dict rows win over freq rows
  4. hydration call sites: `videoTokenPreloader.flushPendingTerms` (chunkSize 100, `videoTokenPreloader.ts:79-126`) gains the readings leg; `videoTokenMap.resolveMetadata(statuses, frequencies)` signature grows a third `readings` map (`videoTokenMap.ts:99-127`); `resolveCueListTokenMetadata` (`cueListTokens.ts:95-171`, `Promise.allSettled`, per-request chunk `MAX_TERMS_PER_REQUEST = 1000` — list itself unbounded) gains the leg; `webTokenizeController.flushMetadataQueue` does **not** fetch readings in v1 — no render surface consumes them there
  5. `videoTokenMap` ripples — both required: (a) `resolveMetadata`'s `changed` flag (`videoTokenMap.ts:112`) currently compares only status/frequencyBand — a reading-only update must also set `changed` or `restyleTokenBlock` never re-runs; (b) `prepare()` rebuilds tokens from `termStatusCache`/`termFrequencyCache` (:78-82) — add `termReadingCache` or re-prepared cues silently drop readings
  6. all reads gated on the resolved profile flag (REQ-4): when off, zero extra messages are sent; `videoTokenPreloader` marks `resolvedTerms` even when only the readings leg fails — reading-only misses are not retried (acceptable; the next invalidation re-resolves)
- Exception: readings leg rejects → other metadata still applies; tokens render reading-less
- Rules: dedupe before fetch; never one message per token; `reading === undefined` and `reading === term` render identically (nothing)
- NFR refs: NFR-1, NFR-4

REQ-3: Annotation rendering
- Actor: system
- Goal: reading visible on the token without polluting copy, selection, or layout
- Basic flow:
  1. `tokenSpanRenderer` (`tokenSpanRenderer.ts:63-115`) sets `data-reading` on the inner `.js-Tihoka-token-word` span — `attr()` only reads the element's own attribute, so attribute and `::before` must target the same node; `restyleTokenBlock` (`:165-186`) re-applies the attribute alongside classes so post-bind resolution still lands
  2. CSS: `::before { content: attr(data-reading) }` on `.js-Tihoka-token-word` — copy-clean (pseudo-element text never enters clipboard/selection); absolutely positioned in a fixed slot so the host line's `line-height` and cue layout are untouched; hidden when the attribute is absent/empty; `pointer-events: none` so tap-to-lookup is unaffected
  3. React twins — BOTH must carry the attribute: `CueTokenText` (`CueList.tsx:99-170`) and `TokenSpan` inside `PreviewBlock.tsx:192-204` (card-creator preview already calls `resolveTokenListMetadata`, `PreviewBlock.tsx:27-35`)
  4. both CSS builders emit the rule: `buildTokenSpanCss` (`tokenSpanCss.ts:100`) and `buildTokenSpanCssForShadow` (`tokenSpanCss.ts:309+`) — covers shadow surfaces (split view, universal panel, card creator)
  5. exact geometry (above vs below glyph, font size, truncation) is a design-stage decision within these constraints
- Alt flow: token has no `data-reading` → renders exactly as today
- Exception: annotation wider than its token → truncate/scale per design brief, never reflow the line
- Rules: annotation is decorative — no extra DOM text nodes, no `aria` surface, no tooltip; **web-tokenize surfaces (`webTokenizeController` render path) do not render annotations in v1** — in-flow or absolute annotation on arbitrary host pages risks reflow/overlap of the article layout; named follow-up decides a reflow-safe primitive
- NFR refs: NFR-2, NFR-3

REQ-4: Per-language profile toggle
- Actor: learner
- Goal: annotations follow the profile, persist, and flip without re-tokenizing
- Basic flow:
  1. flat-field convention is a required `boolean` (`types.ts:284-286` — not `?`): `LanguageProfile.showReadings: boolean` and mirrored `Settings.showReadings: boolean`. Full sync machinery — ALL four touchpoints: (a) `FLAT_FIELD_KEYS` (`profileResolution.ts:73-80`), (b) `syncFlatFieldsToActiveProfile`'s hardcoded field list (`profileResolution.ts:126-134` — it does NOT iterate `FLAT_FIELD_KEYS`), (c) `ACTIVE_PROFILE_MIRROR_EXCLUSIONS` (`settingsRegistry.ts:7-16`) so the flat field doesn't double-sync against `languageProfiles[]`, (d) a `settingsStore` MIGRATIONS entry filling existing profiles (v5→v6/v6→v7 pattern)
  2. default: `true` when the profile's `target` base language is `'zh'`, `false` otherwise — applied at profile-creation default and in `DEFAULT_SETTINGS`; `resolveProfile` has no per-field default mechanism, so the migration writes concrete values (zh profiles → on; all others → off)
  3. control: a toggle in the settings dialog's **Subtitle card** (`SettingsDialogContent.tsx:377-422`, same home as `subtitleOverlayAutoLoad` — `ProfileForm` is identity-only, its edit mode renders no toggles); i18n keys `en` + `vi`
  4. flip behavior: hydration controllers react on settings change — tokens keep their `reading` data; the render layer flips annotation visibility via a container-level flag/class (no re-tokenize, no re-resolve); **toggling ON must explicitly reset the resolved-terms dedupe/queue** (`videoTokenPreloader.ts:130-135` dedupes already-resolved terms — without a reset, already-rendered tokens never fetch readings)
- Alt flow: profile deleted/switched → new profile's value governs on next tokenize pass
- Rules: per-surface distinction lives in the renderers, not the flag — one profile flag controls data + controlled-zone surfaces; the flag does NOT enable web-surface rendering in v1
- NFR refs: NFR-3

REQ-5: Invalidation
- Actor: system
- Goal: dictionary changes mid-session don't leave stale/absent readings
- Basic flow: controllers re-resolve readings on the same invalidation event as word statuses (`onWordStatusesReload` listener, `subtitleTokenizeController.ts:114-125`). **Verified gap**: dictionary import/disable/reorder does NOT emit `emitWordStatusesReload` today — that emitter fires only from `wordStatusCrossTab.ts:17` on `SYNC_DATA_APPLIED` wordStatus scopes, and it is a per-context emitter (controllers live in content scripts). Delivery must therefore add a runtime broadcast on dictionary-set changes (import completion, resource enable/disable, priority reorder) relayed to content scripts — reuse the `wordStatusCrossTab` relay pattern or add a dedicated `DICTIONARY_CHANGED` message; the reading path piggybacks on whichever channel lands
- Exception: re-resolve fails → existing readings stay rendered (stale hint beats blank flicker)
- NFR refs: NFR-4

### Non-functional

- NFR-1 Performance: readings add ≤1 chunked message leg inside the existing `Promise.all` wave per token list; 500-term client chunks, ≤1000 zod bound; hydration never blocks first token paint (annotation resolves a tick later — same contract as frequency bands); the original latency objective — user-waited data paths < 3 s — is preserved (measure before/after per the audit convention, `docs/audits/20261006-data-flow-latency-audit.md`)
- NFR-2 Copy/selection: sentence copy of an annotated line yields exactly today's text (pseudo-element only — no `<rt>` in v1)
- NFR-3 Layout: zero reflow — annotation slot is absolutely positioned; cue height, wrap, and `yOffset` zones unchanged; verified by screenshot/pixel evidence on the longest-cue fixture
- NFR-4 Degradation: no dictionary, no reading fields, disabled pronunciation component, or fetch failure → pixels identical to today's render
- NFR-5 i18n + a11y: `en`/`vi` keys for the profile toggle; annotation adds no focusable/announced element

## Data Contracts

- `READINGS_GET` payload: `{ tabId: number, langCode: string, terms: string[] }` (zod, `terms.max(1000)`); response `MessageResponse<{ readings: Record<string, string> }>`; `direction: 'any'` (content scripts + extension pages both hydrate token lists)
- `Token.reading?: string` — populated only for `!isSeparator` tokens; absent = no annotation
- `LanguageProfile.showReadings: boolean` / `Settings.showReadings: boolean` — required booleans (flat-field convention), wired through `FLAT_FIELD_KEYS` + `syncFlatFieldsToActiveProfile` + `ACTIVE_PROFILE_MIRROR_EXCLUSIONS` + a `settingsStore` migration

## Success Criteria

- SC-1: zh subtitle line with a term-bank dictionary renders pinyin above/with tokens; copying the cue yields the raw sentence text only
- SC-2: term whose only dictionary row has `reading === term` renders no annotation
- SC-3: disabling a resource's `pronunciation` component removes its readings from annotation while the popup follows the same rule
- SC-4: toggling `showReadings` flips annotation visibility without re-tokenizing; persisted across reload
- SC-5: `READINGS_GET` traffic ≤ ceil(terms/500) messages per hydration wave; no `LOOKUP_REQUEST` per token
- SC-6: cue-list rows + card-creator preview render the same annotation as the overlay
- SC-7: ja content behaves exactly as today (clause-level tokens, no misleading single-token readings)
- SC-8: screenshot evidence before/after on subtitle overlay + cue list; layout metrics unchanged (NFR-3)
- SC-9: readings fetch failure mid-wave renders tokens identical to today's shape (status/frequency still apply; no blank gaps, no error UI)

## Traceability

| Intent need | Requirement |
|---|---|
| N1 batched resolution | REQ-1, REQ-2 |
| N2 render on all twins | REQ-3 |
| N3 toggle scope/defaults | REQ-4 |
| N4 orchestrator-parity source rule | REQ-1 (rule), REQ-2 (freq fallback) |
| N5 perf budget | NFR-1 |
| N6 i18n | REQ-4, NFR-5 |
| N7 honest language coverage | Scope + REQ-3 web exclusion + SC-7 |

## Out of Scope

- ja segmentation / furigana (dependency: a ja segmenter for `tokenizeTextBlock`)
- web-tokenize surface annotations (reflow-safe primitive needed)
- espeak runtime IPA generation (in-context WASM, English-only voices — `pronunciationEngine.ts:60`)
- `prons[]` accent selection beyond flat `pronunciation`
- hover-only reveal, reading-kind labels/typography variants
