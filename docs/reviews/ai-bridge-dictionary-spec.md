# Spec Review — ai-bridge-dictionary

Reviewer: spec-reviewer subagent (fresh context, single pass).
Date: post-spec draft, mode `all`.

## Verified seams

- `chatgptBridge.ts` + `chatgptDom.ts` PoC ✅
- `AI_ASK`/`AI_PING` in `registry.ts`/`types.ts`/`dictionarySchemas.ts` ✅
- bg handler `handlers/aiBridge.ts` ✅
- `updateTextField('note',…)` in `mountCardCreatorDialog.ts` ✅
- `PopupTab` union (5 tabs) + `DictionaryToolbar` TABS ✅
- sync `settingsRegistry` + `google-drive/` adapter ✅
- `generateAll` ("Create all") card path ✅
- `providers.ts` is a forward reference — acceptable.

## Traceability

N1–N11 → REQ-1–11 → SC-1–11: clean 1:1 bijection, no orphans either direction. Function↔feature map has no orphans.

## Findings (all applied)

**Major**
1. REQ-5 multi-answer semantics — now pinned: one labeled block per feature, latest-per-feature wins, create-all includes all present blocks, dialog-open pushes via `updateTextField`.
2. REQ-10 language-scope contradiction — dropped; prompts are global per feature, learners use `[INTERFACE_LANG]`/`[TARGET_LANG]` variables for language.
3. Busy semantics — two levels now distinct: popup ignores a second ask in flight (REQ-1); provider `busy` = failover-eligible skip, never queued (REQ-8). Outer timeout scales per-attempt × order length.
4. `autoOpenOnMiss` ownership — assigned to REQ-2 (defaults on) + REQ-7 settings section; added to SC-10.

**Minor**
- Pill positions named: `ai` = position 4 after `translate`, `breakdown` = position 5; 7-pill overflow uses existing toolbar scrolling.
- `error --retry→ resolvingProvider` edge added to state machine.
- Miss predicate cites the real `displayDefinitions.length === 0` (CandidateView).
- REQ-7 exception names the popup answer view as the login-state surface.
- NFR-7 referenced from REQ-11; NFR-8 from REQ-1.
- TO-BE 3 journey row now maps REQ-1/8/9.
- REQ-2 hit path relabeled Alt flow.
- Placeholder rule: omittable but not renamable.
- SC-1 reworded — no auto-ask on every hit.
- "Alternatives rejected" block added (offscreen doc, storage.sync, undocumented APIs).
- REQ-4 precedence pinned: per-popup pick wins for the session and writes back as the persisted default.

## Risks accepted (unchanged)

- Provider ToS gray zone — ship decision remains the owner's call before release.
- Gemini/DeepSeek stability-window done-signal — revisit if verification clips answers.
- SC-11 needs manually logged-in provider profiles — accepted external dependency.
- Popup-close discards late answer — accepted; port-cache is a later upgrade.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

- REQ-1: pill positions (ai=4, breakdown=5), 7-pill overflow note, popup-level single-flight rule, NFR-8 ref.
- REQ-2: real miss predicate cited, hit path relabeled Alt flow, `autoOpenOnMiss` toggle owned (default on).
- REQ-4: precedence pinned — per-popup pick wins, writes back as persisted default.
- REQ-5: multi-answer append semantics defined (per-feature labeled blocks, latest wins, create-all includes all).
- REQ-6: placeholder rule clarified (omittable, not renamable).
- REQ-7: login-state surface named; owns `autoOpenOnMiss` + `sentenceTranslateEngine`.
- REQ-8: failure classes, per-attempt ≤90s timeout, busy=skip semantics.
- REQ-10: whole `AiSettings` slice syncs; language-specific phrase dropped.
- REQ-11: NFR-7 ref added.
- Flows: `error→resolvingProvider` edge added.
- Traceability: TO-BE 3 maps REQ-1/8/9.
- SC-1, SC-10 reworded per findings.
- Open Questions: busy contradiction resolved into two distinct levels.
