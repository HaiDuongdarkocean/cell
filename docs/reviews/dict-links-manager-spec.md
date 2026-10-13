# Spec Review — dict-links-manager

Synthesis of 3 independent lens reviews (BA/PO/TL per `.agents/skills/pipeline-specify/references/review-lenses.md`) + orchestrator verification. All file:line claims below verified against source.

**Verified accurate:** `useDictionaryToolbar.ts:431` hardcodes `DEFAULT_DICTIONARY_POPUP_SETTINGS.externalDictLinks`; `fillExternalDictLinks` filters `langCodes` + `encodeURIComponent` (:101-114); `useCandidate.ts:206` loads settings once on mount; `dict.links.empty` exists en+vi (`messages/*.json:147`, rendered `LinksPanel.tsx:18`, anchors already `noopener noreferrer`); `update()` merge at `DictionaryPopupSettingsPanel.tsx:111-119`; `dictionaryPopup` in `FLAT_FIELD_KEYS` (`profileResolution.ts:87`), `mergeDictionaryPopupWithDefaults` (:105) fills `externalDictLinks` but preserves stored `[]`; schema field exists since v14, no migration needed (CURRENT=32); `useSectionDrag`/`ResourceCard`/`DeleteConfirmModal`/`reorderItems`/`DragHandle`/`--iconbutton-size-md`(tokens.json:830) all real; no dnd dep in package.json; ICON_CATALOG has needed icons. Intent N1–N7 fully traced to REQ/SC; no scope creep.

Blockers:
1. [NFR-2/NFR-6/SC-5] [TL]: The claimed save path silently drops `dictionaryPopup` edits on the browser-action Settings surface. `saveSettings` ends with `resolveSettingsFlatFields(toStore)` (settingsStore.ts:674) which overwrites `toStore.dictionaryPopup` with `mergeDictionaryPopupWithDefaults(active.dictionaryPopup, …)` — the active profile's stale copy — whenever the profile carries the field (post-v23 near-universal). Only `SettingsTab.tsx:62-66` runs `syncFlatFieldsToActiveProfile` before save; the popup path `App.redesigned.tsx:268-272` → `popupStore.updateSettings` (popupStore.ts:137-142) + `UPDATE_SETTINGS` → `handlers/settings.ts:38-42` does not → link add/rename/delete/reorder via that dialog reverts on save; SC-5 fails there. Pre-existing slice-wide bug, but this feature makes it user-visible and spec asserts "existing onChange → settings save path" works. Fix: spec must require `syncFlatFieldsToActiveProfile` on every persisting host (single-point fix inside `saveSettings` also repairs CardCreatorPanel/dead mountSettingsDialog path) + AC covering persistence via the action-popup settings dialog.

Major:
1. [REQ-5/NFR-5/SC-7] [TL]: Cited precedents produce the 44px the spec forbids. `DragHandle` pins `min-width/min-height: var(--touch-target)` (DragHandle.module.css:5-8; `.sm`/`.md` keep the min) → 44px on mobile (tokens.json:588-591). "Reuse ResourceCard/DragHandle pattern" contradicts "never the 44px mobile touch-target" unless overridden. Fix: name the override (local class pinning `--iconbutton-size-md` incl. min-*; precedent: DictionaryToolbar.module.css:28-31).
2. [REQ-4/REQ-5/Boundaries] [TL]: Cited reuse symbols are not importable as written. `useSectionDrag` is `draggedId: number` keyed to `data-tihoka-id^="slot-"` (useSectionDrag.ts:36,54-59) while link ids are `crypto.randomUUID()` strings; `reorderItems` lives in `features/cardCreator/ui/` (no barrel); `DeleteConfirmModal` is feature-local to `features/dictionary/ui/` — new deep imports fail the `check-deep-imports` ratchet. Fix: state the mechanism — promote `useSectionDrag` (generalize to `string` ids) + `reorderItems` to `src/shared`, confirm via shared `Dialog`; or explicitly sanction local adaptation.
3. [REQ-3] [PO]: Blur semantics contradict the cited precedent. Alt flow says "actor cancels (Esc/blur) → name unchanged" but ResourceCard commits on blur (ResourceCard.tsx:254 `onBlur={commitRename}`); only Esc cancels. Fix: blur = commit (matches precedent); correct REQ-3.
4. [REQ-6/NFR-3] [TL]: Render path never re-validates stored URLs. Spec whitelists input but Rules say "`fillExternalDictLinks` unchanged" — `LinksPanel.tsx:25` renders `href={link.url}` verbatim in host-page shadow DOM; any non-http(s) or malformed entry already in storage (field shipped since v14, hand-editable per intent AS-IS-4) becomes a clickable `javascript:`/`undefined` anchor. Fix: add scheme whitelist + malformed-entry drop in `fillExternalDictLinks` (one-line filter) and amend REQ-6 Rules.

Minor:
1. [SC] [BA/PO]: Two intent draft ACs have no asserting SC — "list follows active language profile" (NFR-6 states mechanism only) and "defaults remain shipped initial value". Add SC-9/extend SC-1.
2. [REQ-2] [PO]: Validation under-specified — name the probe substitution (`{term}`→'x', `{lang}`→a code), trim before validate, cap name/template length, state dedupe + double-submit policy.
3. [REQ-6] [TL]: `links` useMemo deps `[result]` (:429-434) must include the new option; note pills render shipped defaults until `loadSettings` resolves and stale pills while popup stays open — accepted, say so.
4. [REQ-2] [TL]: use repo's guarded id-gen (`typeof crypto.randomUUID === 'function'` fallback — mediaScan.ts:147 pattern), not bare `crypto.randomUUID()` — settings UI can run in content-script context.
5. [Docs] [BA]: NFR-1 should name `src/shared/i18n/messages/{en,vi}.json` (public/_locales is manifest-only); NFR-5 citation should point at `tokens.json` (tokens.css is generated/not in repo).
6. [Spec-wide] [TL]: No Alternatives section — document rejected options (new dnd dep — none in package.json; in-popup editing; per-link langCodes).
7. [REQ-4] [TL]: Note nested-Dialog focus/escape behavior (DeleteConfirmModal inside SettingsDialog; `pushEscapeLayer` precedent exists).
8. [REQ-1] [PO]: NFR-2 (persistence) cited on a read-only view — traceability noise.

Nhận xét theo role:
- BA: Problem-first, intent-traceable, bounded non-goals — chỉ thiếu SC cho profile-follow/defaults và vài citation mờ.
- PO: Flows đủ basic/alt/exception, SC testable — blur-cancel mâu thuẫn precedent và validation detail chưa chốt.
- TL: Code claims unusually accurate (every cite verified) — hai lỗ hổng thật: save-path clobber trên popup host và reuse citations không survive deep-import ratchet / 44px min trap.

Action items:
1. Require `syncFlatFieldsToActiveProfile` on all persisting hosts (fix in `saveSettings` recommended) + AC for popup-dialog persistence — spec author — §NFR-2/REQ-2..5/SC
2. State 40px override mechanism vs shared `--touch-target` mins — spec author — §NFR-5
3. State reuse mechanism (promote to src/shared + string-id generalization, or sanctioned local adaptation) — spec author — §REQ-4/5 + Boundaries
4. Fix REQ-3 blur = commit — spec author — §REQ-3
5. Add render-time scheme whitelist + malformed-entry filter — spec author — §REQ-6 Rules
6. Add SC for profile-follow + fresh-install defaults — spec author — §Success Criteria
7. Minor edits: probe/trim/caps/dedupe/double-submit, useMemo dep + staleness note, guarded randomUUID, i18n/tokens.json citations, Alternatives section, nested-dialog note — spec author

Risks chấp nhận:
- URL edits require delete + re-add (documented) — revisit on typo-churn reports.
- Pills show shipped defaults until settings load resolves; stale while popup open — revisit if perceptible.
- Stored non-http(s) only writable out-of-band — revisit if an import/migration path ever writes `externalDictLinks`.

VERDICT: APPROVE_WITH_CHANGES

## Applied fixes

Applied to `docs/specs/dict-links-manager.md` after review (2026-09-26):

1. Blocker: added REQ-7 — `saveSettings` runs `syncFlatFieldsToActiveProfile` before `resolveSettingsFlatFields` (single-point fix covering SettingsTab + action-popup UPDATE_SETTINGS path); SC-9 asserts persistence via the action-popup dialog + unit-test coverage.
2. Major-1: NFR-5 now names the override — local class pins `width/height/min-width/min-height` to `var(--iconbutton-size-md)` (double-class specificity precedent); citations repointed to `tokens.json`.
3. Major-2: REQ-5 Rules state the reuse mechanism — promote `useSectionDrag` → `src/shared/lib/` generalized (`draggedId` string, slot-prefix option) + promote `reorderItems` → `src/shared/lib/`; REQ-4 composes shared `Dialog` instead of importing feature-local `DeleteConfirmModal`.
4. Major-3: REQ-3 blur = commit (ResourceCard precedent), Esc = cancel.
5. Major-4: REQ-6 Rules — `fillExternalDictLinks` gains render-time http(s) whitelist + malformed-entry drop; `links` useMemo dep noted; defaults-until-load + stale-while-open accepted.
6. Minor-1: SC-1 covers fresh-install defaults; new SC-10 covers profile-follow.
7. Minors 2/4/5/7/8: REQ-2 validation detail (probe substitution, trim, 64/2048 caps, duplicates allowed, double-submit guard), guarded `crypto.randomUUID`, i18n paths named (`messages/{en,vi}.json`), nested-Dialog `pushEscapeLayer` note, REQ-1 NFR refs trimmed (NFR-2 dropped from read-only view).
8. Added `## Alternatives Considered` (dnd dep, in-popup editing, per-link langCodes, modal promotion, per-host sync).
