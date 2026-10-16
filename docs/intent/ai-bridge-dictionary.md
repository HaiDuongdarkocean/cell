# Intent: AI bridge — contextual meaning inside the dictionary popup

> Slug: `ai-bridge-dictionary` · Mode: all · Source: user statement (PoC verified in worktree)
> ui_surface: yes          ← popup tabs, settings section, provider picker, retry UI
> confidence: high          ← PoC verified end-to-end on live ChatGPT; remaining unknowns are per-provider selectors

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Learner hits a word the dictionary misses or whose *contextual* nuance isn't covered by static definitions — today they must leave the popup and ask an AI manually, or create cards with an empty note. | user statement: "không tìm thấy term nào → tự động mở tab này để giải nghĩa"; `fieldMapping.ts:94` maps a notes field | high |
| Change | AS-IS: static dictionary + Google bulk translate only. TO-BE: AI answers (word nuance, sentence breakdown, sentence translation) generated inside the popup via the user's logged-in AI provider session, auto-filling the card note. | `TranslatePanel.tsx` is Google-only; `popupTypes.ts:26` PopupTab has 5 tabs, no AI | high |
| Solution | A bridge layer: extension drives the user's logged-in chat tab (ChatGPT/Gemini/DeepSeek/Claude) via content-script DOM automation; answers render in new popup tabs; prompts are user-editable; provider order configurable with automatic failover. | PoC `src/features/aiBridge/` + `src/entrypoints/content/chatgptBridge.ts` verified: answer returned in 4–6s | high |
| Value | One-click contextual meaning and sentence understanding without copy-pasting to an external AI; richer Anki notes at zero marginal cost (free ride on subscriptions users already pay). | user statement; PoC latency 4–6s vs ~30s manual roundtrip | high |
| Stakeholder | Primary: the language-learner persona (5–80, low-spec machines — popup must stay light). Anh is product owner and solo maintainer. | `AGENTS.md` persona rule | high |
| Context | MV3 extension; ChatGPT DOM bridge already working (event-driven MutationObserver, verified on talvt frontend); other providers probed but not yet verified end-to-end. | `src/features/aiBridge/` PoC + commit history | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Anh + agent sessions | Feasible build on existing bridge PoC; provider adapters are per-site selector config, not new architecture | DOM-probe workflow proven; per-provider variants untested |
| Customer | Language learner | Instant contextual explanation; answers that land in cards without retyping | Must be logged into at least one provider in the browser |
| Supplier/Dependency | OpenAI, Google, Anthropic, DeepSeek web frontends | Their DOM contracts are internal and rotate per deploy | `[data-talvt-turn-state]` verified live on chatgpt.com (`chatgptDom.ts` + PoC run); other providers probed, unverified end-to-end | medium |
| Organization | Future maintainers | Provider adapters isolated in one config module so a DOM change is a one-line fix | `src/features/aiBridge/chatgptDom.ts` is the probe-module exemplar |
| Regulator | Provider ToS (OpenAI usage policies etc.), Chrome Web Store policy | Automating a consumer web session is a gray zone; store review may flag web-request automation | Risk accepted by user for PoC; documented, not production-cleared |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Get an AI explanation of a word's nuance in its sentence context, without leaving the dictionary popup | F | user statement + retry screenshot (context-explain view) | high |
| N2 | When the dictionary finds no term, get the AI explanation automatically — no dead-end lookup | F | user statement: "không tìm thấy term nào → tự động mở tab này" | high |
| N3 | Break the currently-looked-up sentence into meaningful chunks with reworded meaning + grammar notes (no free-form input) | F | user statement + breakdown prompt; Q&A: input = câu đang lookup | high |
| N4 | Translate a sentence via AI as an option alongside the existing Google engine | F | user statement: "cùng tồn tại option với tab translation" | high |
| N5 | AI answers append to the card's note field — for both single create and create-all — preserving existing note content | F | user statement + Q&A: append; `fieldMapping.ts:94` notes field exists | high |
| N6 | Edit system + user prompts per feature, with fixed `[WORD]` `[SENTENCE]` `[TARGET_LANG]` `[INTERFACE_LANG]` placeholders, save and reset-to-default | F, S | user statement + Migaku-style prompt settings screenshots | high |
| N7 | Pick which provider answers — per-request in the popup, default in settings | U | user statement: "chọn provider ngay trong tab AI hoặc ở setting"; non-chatgpt providers unverified end-to-end `[assumption]` | medium |
| N8 | On provider failure (timeout/rate-limit/no answer), fail over automatically to the next provider in a user-ordered list; when ALL providers fail, show an explicit error + manual retry | R | user statement + Q&A: all-fail → error + retry; non-chatgpt adapters unverified `[assumption]` | medium |
| N9 | Regenerate an answer when it misses the intended meaning (retry button in the answer view) | U, F | user statement + Retry screenshot | high |
| N10 | Sync all AI settings to Google Drive: per-feature prompts, provider order, default provider, translate-engine choice, toggles | S, +infra | user statement + Q&A: prompts + provider order + toàn bộ AI settings; `src/features/sync/adapters/google-drive/` exists | high |
| N11 | No API key required — ride the user's logged-in provider session | F | user statement from original ask: "đăng nhập chatgpt.com… gọi trực tiếp" | high |

## Scope

- **In:** AI tab (word nuance) + sentence-breakdown tab in the dictionary popup; AI option inside the existing translate tab; auto-open on dictionary miss; note-field fill on create/create-all; provider picker + ordered failover; retry; per-feature prompt editing with save/reset; Drive sync of prompt config; provider adapters for chatgpt/gemini/deepseek/claude.
- **Out:** Bulk/subtitle-cue AI translation (Google stays for cue lists — rate limits and latency make AI wrong for bulk); API-key mode; token-streaming display inside the popup; offline/on-device AI (Gemini Nano).
- **Non-goals:** replacing the dictionary, replacing the Google translate pipeline, a chat UI, mobile app support.

## Workflow

A learner presses a word while watching a video. The dictionary popup opens and runs the usual lookup. If the dictionary hits, the learner reads definitions as today — and can still tap the AI pill for context nuance. If the dictionary misses entirely, the popup auto-opens the AI tab instead of dead-ending. In the background, the bridge reuses (or opens) a tab of the selected provider where the learner is logged in, types a templated prompt (system + user prompt with word/sentence/language filled in), and watches the page for the response. The answer renders in the popup the moment the provider finishes. If the provider does not respond or errors, the bridge walks down the learner's ordered provider list until one answers. The learner taps Retry if the meaning is off. When the learner creates a card — one or create-all — the AI text lands in the note field. In settings, a dedicated section edits each feature's system/user prompts and drags providers into fallback order; that configuration syncs to Google Drive.

```
word press → dictionary lookup
   ├─ hit  → normal tabs … AI tab on demand
   └─ miss → auto-open AI tab
                  │
                  ▼   provider tab (logged-in session)
   popup asks ──► bg ──► content script: fill → send → observe
                  │        │ fail/timeout → next provider in order
                  ▼        ▼
             answer view (Retry ↻ · "Sourced from X")
                  │
                  ▼ create / create-all
             card note field ← AI text
```

## Journey

### AS-IS
1. Learner presses a word mid-video; popup opens; dictionary lookup runs.
2. Hit → static definition list; learner guesses which sense fits the sentence. Miss → popup shows nothing useful; learner either skips or opens an AI site in another tab, pastes the sentence, waits, copies back.
3. Sentence translation comes from Google only — literal, no nuance. There is no sentence breakdown tool.
4. Card creation (create/create-all) fills notes only from dictionary fields — AI insight, if the learner obtained one manually, must be pasted by hand.
5. Edge case: learner on a word not in the dictionary gets zero help inside the popup today.

### TO-BE
1. Learner presses a word; popup opens; dictionary lookup runs.
2. Hit → learner may tap the AI pill for contextual nuance. Miss → AI tab auto-opens and explains the term in context — the dead end is gone.
3. The answer view shows the explanation, a Retry button for regenerating, and which provider answered.
4. Learner switches the sentence to breakdown mode for chunked meaning/grammar, or picks AI as the sentence-translation engine next to Google.
5. If a provider stalls or rate-limits, the bridge silently tries the next provider in the learner's order; only total failure surfaces an error with retry.
6. Learner creates the card (single or create-all); the AI result is already in the note field.
7. Learner tunes prompts and provider order in settings; the config follows them to other machines via Drive sync.

## Stories

- S1: As a learner, I want the word's contextual nuance explained in the popup so that I understand this sentence's usage — done when an AI-generated answer for the pressed word+sentence is visible without me leaving the popup.
- S2: As a learner, I want a dictionary miss to still yield an explanation so that unknown words are not dead ends — done when a zero-result lookup produces an AI answer automatically.
- S3: As a learner, I want a sentence broken into meaning chunks with grammar notes so that I can parse hard sentences — done when the breakdown view lists #1/#2/#3 groups.
- S4: As a learner, I want AI as a sentence-translation option so that I can pick literal-vs-contextual output — done when the translate tab offers both engines and AI output returns.
- S5: As a learner, I want AI answers written into the card's note field so that my cards carry the explanation — done when create and create-all produce notes without manual copying.
- S6: As a power user, I want to edit each feature's prompts with fixed placeholders and reset to default so that output matches my taste — done when edited prompts change the AI output and reset restores stock.
- S7: As a learner, I want to choose and order providers so that one provider's outage doesn't block me — done when a failed provider triggers the next automatically and my order is honored.
- S8: As a learner, I want to regenerate an answer on demand so that a meaning that missed my intent gets another pass — done when the regenerate action issues a fresh request and replaces the visible answer.
- S9: As a learner, I want my prompt config synced to Drive so that settings survive reinstalls and other machines — done when a restore on a second profile reproduces my prompts.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Provider ToS prohibits web-session automation; account rate-limit/ban | legal/external | High for the user's account | Documented + accepted for PoC; failover reduces per-provider load; final decision before ship |
| Internal DOM attrs rotate on deploy → adapter breaks | external | Medium — feature degrades until selector patch | Adapters isolated in one config file; probes scripted for re-verification |
| Free-tier rate limits → repeated failover loop burns through providers | external | Medium | Ordered list + user expectation management; exponential backoff at spec time |
| Sentences/prompts leave the machine to third-party AI | privacy | Medium — learner content (video sentences) sent to providers | Disclosed in settings; learner opts in by using the tab |
| Provider tab lock: user typing in the same chat tab collides with bridge requests | operational | Low-Medium | in-flight guard exists; dedicated conversation per PoC design |
| All providers unauthenticated → every ask fails | human/operational | Medium | Ping gate reports login state; error copy directs user to log in |
| DeepSeek virtual list unmounts the answer when scrolled | internal/external | Low | Auto-scroll keeps last message mounted; noted for spec edge case |

## Decision

go — feasibility proven end-to-end on the hardest provider (ChatGPT talvt DOM); remaining work is replicating the adapter contract on three already-probed sites plus standard popup/settings wiring. Risks are real but bounded and disclosed; failover covers the dominant operational risk (rate limit).

## Draft Acceptance Criteria

- [ ] Pressing a word with a dictionary miss auto-opens the AI tab and returns an explanation.
- [ ] The AI tab, breakdown tab (on the looked-up sentence), and AI-translate option each return provider output in the popup.
- [ ] Provider picker in the popup overrides the settings default for that request only.
- [ ] A provider timeout/error automatically triggers the next provider in the configured order; all-fail shows an explicit error with a manual retry control.
- [ ] Retry regenerates and replaces the answer; the view names the answering provider.
- [ ] Create and create-all both append the AI text into the card note field without removing existing content.
- [ ] Edited prompts persist, change output, and reset-to-default restores stock prompts.
- [ ] All AI settings — prompts, provider order, default provider, engine choice, toggles — survive a Drive sync round-trip to a second profile.
