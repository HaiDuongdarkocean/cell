# Spec: AI bridge — contextual meaning inside the dictionary popup

> Intent: `docs/intent/ai-bridge-dictionary.md` · ui_surface: yes · Mode: all

## Objective

Give the learner AI-generated language answers (word nuance, sentence breakdown, sentence translation) inside the dictionary popup, driven through the learner's own logged-in web session at a configurable AI provider — no API key, no bulk-translation change. Answers auto-append to the card's note field on both create paths, prompts are user-editable, providers fail over in a configured order, and AI settings sync to Google Drive.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | word press, tab select, retry, engine switch, create/create-all, prompt edit, provider reorder, Drive connect | word, sentence, prompt text, provider choice, order | AI answer text, provider attribution, errors, persisted settings |
| AI provider site (chatgpt/gemini/deepseek/claude) | content-script send on its tab | composed prompt text | (its own UI) — returns DOM that the bridge reads |
| Google Drive (existing sync provider) | settings sync tick | AI settings blob | stored/restored config |

System-internal: bridge orchestration (tab find/create, message relay, DOM observe), failover walk, prompt templating, note-field append, settings persistence. Actors never appear inside system steps.

## Requirements

### Functional

REQ-1: Contextual word explanation in the AI tab
- Actor: learner
- Goal: read the word's nuance in the looked-up sentence without leaving the popup
- Preconditions: popup open on a lookup result (or miss); at least one provider session logged in
- Basic flow:
  1. learner opens the AI tab (pill position 4, immediately after `translate`; `breakdown` pill is position 5, immediately after `ai`)
  2. system composes prompt = systemPrompt + userPrompt with [WORD], [SENTENCE], [TARGET_LANG], [INTERFACE_LANG] filled
  3. system sends AI_ASK via the configured provider's bridge tab and observes the response
  4. system renders the answer text + provider attribution + retry control
- Alt flow: learner picks a different provider pill before asking — that provider serves this request only
- Exception: provider error/timeout → automatic failover (REQ-8); all providers fail → error state + manual retry
- Rules: never blocks the popup open path; one in-flight ask per popup — a second ask while one is in flight is ignored at UI level (controls show busy state); toolbar overflow with 7 pills uses the existing toolbar scrolling behavior
- Postcondition: answer stored in popup session state, available to REQ-5
- NFR refs: NFR-1, NFR-2, NFR-4, NFR-8

REQ-2: Auto-open AI tab on dictionary miss
- Actor: learner
- Goal: still get an explanation when the dictionary yields nothing
- Preconditions: lookup finished with zero candidates/definitions
- Basic flow:
  1. learner presses a word
  2. system completes lookup → zero display definitions detected (the popup's existing miss predicate: `displayDefinitions.length === 0`, `CandidateView.tsx`)
  3. system auto-selects the AI tab and issues REQ-1 flow
- Alt flow: lookup hit → normal popup; AI tab dormant until tapped (on a hit the learner opens the tab manually — no automatic ask on every lookup)
- Exception: `autoOpenOnMiss` setting off → miss shows the normal empty state, no auto-ask
- Rules: miss detection = `displayDefinitions.length === 0` after the lookup completes; the toggle lives in the AI settings section (REQ-7) and defaults to on
- Postcondition: learner always sees an answer surface
- NFR refs: NFR-1

REQ-3: Sentence breakdown tab
- Actor: learner
- Goal: parse the looked-up sentence into meaning/grammar chunks
- Preconditions: popup open with a sentence context; provider session
- Basic flow:
  1. learner opens the breakdown pill tab
  2. system composes the breakdown prompt with [SENTENCE]/[TARGET_LANG]/[INTERFACE_LANG]
  3. system asks via provider bridge; renders the numbered chunk list
- Exception: no sentence in the current lookup context → disabled state with hint; provider failure → REQ-8
- Rules: input is always the currently looked-up sentence — no free-form input
- Postcondition: breakdown text in session state
- NFR refs: NFR-1, NFR-2

REQ-4: AI sentence translation as engine option
- Actor: learner
- Goal: get a context-aware sentence translation instead of literal Google output
- Preconditions: translate tab; sentence context
- Basic flow:
  1. learner selects the AI engine inside the translate tab (toggle beside Google)
  2. system composes the translation prompt with [SENTENCE]/[TARGET_LANG]
  3. system asks via provider bridge; replaces the translation text
- Alt flow: learner switches back to Google → cached/instant re-fetch of the Google result
- Exception: provider failure → REQ-8, Google stays available
- Rules: the engine choice persists in settings as the default for future popups; within one popup the learner's pick wins for that lookup session and writes back as the new persisted default
- Postcondition: translation text available for REQ-5 (sentenceTranslation field as today)
- NFR refs: NFR-1, NFR-2

REQ-5: AI text appended to card note field
- Actor: learner
- Goal: cards carry the AI answer without manual copying
- Preconditions: an AI answer exists in the current popup session; learner triggers create or create-all
- Basic flow:
  1. learner triggers create or create-all
  2. system takes the latest answer **per feature** present in the popup session (word-explain and/or breakdown and/or AI translation) and appends each as its own labeled block to the note field
  3. card is created with existing note content preserved, AI blocks appended
- Alt flow: no AI answer yet → card created unchanged (no blocking). Card dialog already open when an answer arrives → pushed via the existing `updateTextField('note', …)` path
- Exception: none beyond REQ-8 for the ask itself
- Rules: append only, never overwrite; one block per feature, latest-per-feature wins (a retry updates the stored answer used at create time — the note snapshot reflects the latest answer at the moment of creation); each block is labeled (e.g. `AI·explain — ChatGPT`); multiple feature blocks may coexist in one note; create-all includes every labeled block present
- Postcondition: note field contains dictionary content + present AI blocks
- NFR refs: NFR-3

REQ-6: Custom AI prompt management
- Actor: learner
- Goal: tailor system/user prompts per AI feature
- Preconditions: settings page open
- Basic flow:
  1. learner opens the Custom AI prompts settings section
  2. learner edits system prompt and/or user prompt per feature (word explain / sentence breakdown / sentence translate)
  3. system validates placeholders, saves on Save, restores stock on Reset
- Alt flow: invalid placeholder edit → inline error, save refused
- Exception: none beyond validation
- Rules: prompts are English-authored; a placeholder may be omitted from a prompt entirely, but its bracketed name ([WORD]/[SENTENCE]/[TARGET_LANG]/[INTERFACE_LANG]) may not be renamed or altered; defaults ship per feature
- Postcondition: custom prompts persist and drive subsequent asks
- NFR refs: NFR-5

REQ-7: Provider selection (popup + settings)
- Actor: learner
- Goal: choose which provider answers, or set the default
- Preconditions: settings saved; ≥1 provider logged in
- Basic flow:
  1. learner picks provider in the AI tab (per-request) or reorders/selects default in settings
  2. system uses the popup pick if set, else the settings default, else first in the order list
- Exception: picked provider not logged in → the popup answer view shows a "not logged in — open the provider site to sign in" state on that provider pill; the failover chain then proceeds to the next provider per REQ-8
- Rules: popup pick is per-lookup-session, not persisted; the AI settings section also owns `autoOpenOnMiss` (REQ-2) and `sentenceTranslateEngine` (REQ-4)
- Postcondition: effective provider resolved per ask
- NFR refs: NFR-2

REQ-8: Ordered failover
- Actor: system-internal (triggered by ask failure)
- Goal: survive a provider outage silently
- Preconditions: provider order configured; an ask just failed (timeout, no-response, DOM error, not-logged-in)
- Basic flow:
  1. ask fails on provider P
  2. system walks the configured order for the next provider, opens/uses its tab, re-sends the same prompt
  3. system renders the first success; attribution shows which provider answered
- Exception: every provider fails → error state + Retry control (learner re-triggers the whole chain)
- Rules: failover is silent (no toast spam); a manual provider pick does not disable failover; failure classes {timeout, rateLimit, noAnswer, busy, loginRequired, domError} are all failover-eligible and a provider is never retried within one chain; each attempt carries its own ≤90s timeout so the background outer bound scales as `attemptTimeout × order length` (the PoC's fixed 120s outer must become per-attempt); `busy` means that provider's tab is serving another ask → skip to next provider, never queue at provider level (popup-level single-flight is REQ-1's rule)
- Postcondition: answer from the surviving provider, or terminal error
- NFR refs: NFR-2, NFR-4

REQ-9: Retry an answer
- Actor: learner
- Goal: regenerate when the answer misses intent
- Preconditions: an answer (or error) is displayed
- Basic flow:
  1. learner taps Retry in the answer view
  2. system re-issues the same prompt (same feature context) through the provider order
  3. answer replaces the previous text
- Exception: same failure semantics as REQ-8
- Rules: retry does not change the selected provider unless failover kicks in
- Postcondition: latest answer replaces session state (note fill uses the latest)
- NFR refs: NFR-2

REQ-10: Sync AI settings to Google Drive
- Actor: learner
- Goal: prompt config + provider order + defaults follow them across machines
- Preconditions: Drive backup connected (existing sync infra)
- Basic flow:
  1. learner edits AI settings
  2. system writes to local settings store immediately
  3. system includes the AI settings blob in the next Drive sync round-trip
- Alt flow: restore on a second profile → AI settings applied on load
- Exception: sync failure → existing sync error handling; local remains source of truth until next sync
- Rules: the entire `AiSettings` slice syncs — feature-scoped prompts (global, no per-language dimension), provider order, default provider, engine choice, and toggles; no secrets in the synced blob
- Postcondition: remote copy equals local AI settings
- NFR refs: NFR-5

REQ-11: Provider bridge adapters (chatgpt/gemini/deepseek/claude)
- Actor: system-internal
- Goal: each provider works through one adapter contract — composer find/fill/send, assistant-unit detection, done-signal, answer text extraction
- Preconditions: content script injected on the provider origin; user logged in
- Basic flow:
  1. system locates/creates a provider tab
  2. content script fills composer, sends once, observes DOM for the new assistant turn
  3. system resolves answer text on the provider's done signal (attribute flip or stability window)
- Alt flow: DeepSeek virtual list keeps last message mounted (auto-scroll); Gemini uses stability window (no clean done attr verified)
- Exception: composer absent → bridge reports not-ready (login wall); timeout → caller failover
- Rules: adapter = config object in one SSOT module; no provider logic leaks into popup code
- Postcondition: answer text or typed error returned to background
- NFR refs: NFR-2, NFR-4, NFR-6, NFR-7

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Popup interaction stays non-blocking; AI asks never stall the lookup path | U | lookup UI responsive <300ms regardless of ask state |
| NFR-2 | Answer resolves event-driven on provider's done signal, not fixed-delay polling | P | resolve on the same mutation tick; safety timeout per provider ≤90s |
| NFR-3 | Note append is non-destructive and idempotent per answer | R | create called twice does not duplicate the AI block |
| NFR-4 | Provider automation is single-flight per tab with a busy guard | R | concurrent asks serialize; second ask on busy provider → 'busy' → failover/next |
| NFR-5 | Prompts/settings persist locally and through Drive sync; placeholder names immutable | S | edit survives reload and remote round-trip |
| NFR-6 | Selector fragility contained to one adapter config module per provider | S | a DOM contract change is a selector patch in `features/aiBridge/providers.ts` |
| NFR-7 | No API keys or credentials stored; prompts carry only word/sentence text | +security/privacy | synced blob contains no auth material |
| NFR-8 | Works on low-spec persona machine | resource | popup adds only text rendering; observer scoped to provider tab |

## Flows / States

Ask lifecycle (system side, per popup ask):

```
idle --ask→ resolvingProvider
resolvingProvider --tab ready→ awaitingReply   (observer armed before send)
resolvingProvider --tab missing/login-wall→ failoverNext
awaitingReply --done signal→ answered          (text captured, rendered)
awaitingReply --timeout/error→ failoverNext    (walk providerOrder)
failoverNext --next exists→ resolvingProvider  (same prompt)
failoverNext --none left→ error                (manual Retry available)
error --learner retry→ resolvingProvider       (chain restarts at configured default)
answered --learner retry→ resolvingProvider    (same prompt, provider order)
```

Dictionary-miss trigger: `lookupComplete(results=0) --auto→ aiTab.selected + ask(wordExplain)`.

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Answer a language question via the learner's AI session | AI tab panel, breakdown tab panel, AI engine option in translate tab, provider picker pills, Retry button, "Sourced from X" attribution |
| Deliver prompts to provider web sessions reliably | AI_ASK/AI_PING message types, background tab-orchestration handler, per-provider DOM adapter config, MutationObserver reply watcher, busy/in-flight guard |
| Keep explanations out of dead ends | Dictionary-miss auto-open trigger |
| Put the answer into cards | Note-field append on create/create-all + late-arriving push via updateTextField |
| Manage prompt/provider preferences | Custom AI prompts settings section (system+user per feature, save/reset), provider order control, default provider, translate-engine toggle |
| Carry preferences across machines | AI settings blob on the existing Google Drive sync provider |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| AiProviderAdapter | name, url, tabMatch, composer selectors, assistantUnit, answerBody, doneAttrs, turnDone | code (`features/aiBridge/providers.ts`) | n/a |
| AiSettings | defaultProvider, providerOrder, prompts{wordExplain,sentenceBreakdown,sentenceTranslate}{system,user}, translateEngine, autoOpenOnMiss | `chrome.storage.local` settings + Drive sync blob | until changed |
| AiAnswer (ephemeral) | text, provider, feature, word, sentence, ts | popup session state | popup lifetime |
| PromptTemplate | system, user, placeholders used | inside AiSettings.prompts | synced |

## Traceability

| Need (intent ID) | REQ | AC (Success Criteria line) |
|---|---|---|
| N1 | REQ-1 | SC-1 |
| N2 | REQ-2 | SC-2 |
| N3 | REQ-3 | SC-3 |
| N4 | REQ-4 | SC-4 |
| N5 | REQ-5 | SC-5 |
| N6 | REQ-6 | SC-6 |
| N7 | REQ-7 | SC-7 |
| N8 | REQ-8 | SC-8 |
| N9 | REQ-9 | SC-9 |
| N10 | REQ-10 | SC-10 |
| N11 | REQ-11 | SC-11 |

| Journey step | REQ |
|---|---|
| AS-IS 1–5 (pain) | REQ-1, REQ-2, REQ-3, REQ-4, REQ-5 |
| TO-BE 2 (AI tab / auto-open) | REQ-1, REQ-2, REQ-7 |
| TO-BE 3 (attribution + retry) | REQ-1, REQ-8, REQ-9 |
| TO-BE 4 (breakdown + engine option) | REQ-3, REQ-4 |
| TO-BE 5 (failover) | REQ-8 |
| TO-BE 6 (note field) | REQ-5 |
| TO-BE 7 (settings + sync) | REQ-6, REQ-7, REQ-10 |

## Boundaries

- Always: gates before commit (`typecheck`, `test:unit`, `build`); provider adapters confined to `features/aiBridge/`; named exports; no `any`; i18n keys for all visible strings; tokens from `tokens.json` for any styling.
- Ask first: new dependencies; manifest permission changes (content-script match additions are additive and covered by existing `host_permissions`, but flag anyway); changing `PopupTab` union order semantics.
- Never: store credentials/API keys; replace the Google translate pipeline; commit secrets; bulk-subtitle AI translation.

### Alternatives rejected

- **Offscreen document / iframe automation** — providers gate content behind login walls and bot detection; only a real visible tab in the user's session reliably renders composer + reply. Rejected.
- **`chrome.storage.sync` for AI settings** — existing Drive sync infra already carries settings blobs with larger quota and is the established restore path; adding a second sync channel doubles failure modes. Rejected.
- **Undocumented provider network APIs** — fragile, session-token harvesting, higher ToS exposure than DOM automation. Rejected (Intent Out-scope).

## Success Criteria

- [ ] SC-1: On a lookup hit, opening the AI tab fires the ask and shows a provider answer for that word+sentence context; provider attribution visible; answer resolves without a fixed wait loop (same-tick on the provider's done signal).
- [ ] SC-2: A lookup with zero results auto-selects the AI tab and issues the explanation ask without learner interaction.
- [ ] SC-3: Breakdown tab renders the provider's numbered chunk output for the looked-up sentence only.
- [ ] SC-4: Translate tab offers Google and AI engines; selecting AI returns the provider's translation of the sentence; switching back shows Google output again.
- [ ] SC-5: With an AI answer present, both create and create-all produce a card whose note field contains the prior content plus the appended AI text; repeating the action does not duplicate the AI block.
- [ ] SC-6: Editing a feature's prompts persists after reload, changes subsequent AI output, rejects broken placeholder names, and Reset-to-default restores stock prompts.
- [ ] SC-7: A per-request provider pick in the popup overrides the settings default for that ask only; the next ask reverts to the default.
- [ ] SC-8: Simulated provider failure (timeout/force-error) triggers the next provider in the configured order automatically; when every provider fails the view shows an error + Retry that re-runs the chain.
- [ ] SC-9: Retry on an answered view issues a fresh ask and replaces the visible answer.
- [ ] SC-10: After Drive sync, a second profile restores prompts, provider order, default provider, engine choice, and feature toggles (auto-open-on-miss).
- [ ] SC-11: All four provider adapters pass a live send→answer round-trip on their logged-in tabs (verified per provider; DeepSeek/Gemini/Claude need login in the verify profile).

## Definition of Done

- [ ] All Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass design-system check (tokens/components, no hardcoded styles)
- [ ] Real-Chromium verify: logged-in provider tab answers in the popup; failover exercised by forcing the first provider to fail
- [ ] Canon docs updated: ADR for provider-session bridge architecture + selector fragility note

## Open Questions / Accepted Risks

- Provider ToS gray zone accepted for PoC/personal build; ship decision remains the owner's call before release.
- Gemini/DeepSeek done-signal is text-stability (~1.5–2s silence) rather than an attribute flip — a mid-generation pause could clip an answer early; tighten if observed in verification.
- Breakdown prompt output quality depends on provider; parsing the numbered list is rendered as text (no structured parsing in this iteration).
- DeepSeek's virtual list can unmount off-screen messages; auto-scroll keeps the last message mounted — accepted for this scope.
- Concurrent asks: two levels are now distinct — the popup ignores a second ask while one is in flight (busy controls, REQ-1); a provider `busy` response (its tab serving another ask) is a failover-eligible failure that skips to the next provider without queueing (REQ-8).
- Popup closed mid-request: the popup is an overlay whose lifetime is the lookup session; a late answer arriving after close is discarded (session state gone) — the learner re-asks on the next lookup. Accepted for this iteration; a port-based answer cache is a later upgrade.
