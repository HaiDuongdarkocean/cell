# Sign-off Review — anki-known-seed

VERDICT: SIGN_OFF

## Scope verified

- Intent: `docs/intent/anki-known-seed.md` — continuous three-way status sync (Anki ↔ wordStatus ↔ Tihoka SRS) so immersion state stays truthful everywhere; owner expanded the original one-time seed into ongoing bidirectional sync
- Spec: `docs/specs/anki-known-seed.md` — spec review APPROVE_WITH_CHANGES; all required findings applied (REQ-3/4/5/7 arbitration, provenance through the wire shape, write-back gating)
- Design: `docs/intent/anki-known-seed-design-brief.md` + `docs/intent/anki-known-seed-component-mapping.md` — component-mapping lint pass; mockup visually verified (vision-reader PASS, P2 notes only)
- Verify: `docs/reviews/anki-known-seed-verify.md` — gates green + real-Chromium e2e 3/3 (live AnkiConnect sync run with `source='anki'` writes, SRS review → `learning` via message boundary, settings panel section)

## Deterministic gates

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test:unit` — 657 suites / 7749 tests (statusRules, feedParser, writeBack, statusSyncStorage, arbitration suites + stale pins updated)
- `npm run build` — pass
- `check-feature-cycles` / `check-deep-imports` — clean (0 cycles, 0 new deep imports after barrel routing + message-boundary fix)
- Browser — `e2e/extension-anki-status-sync.spec.ts` 3/3 on built `dist` in real Chromium

## Business acceptance

- Anki card state continuously mirrors into Tihoka word status (`ivl>=21 → known`, otherwise `learning`), via the bridge add-on push feed when installed and AnkiConnect polling otherwise — offline never breaks primary flows.
- Tihoka SRS reviews and Anki imports stamp `learning`/`known` with provenance; Drive sync carries provenance so a second device inherits the same truth without echo loops.
- Users get a new persisted `learning` status (blue) across tokens, vocabulary filters/counts, popup, keymap `5`, and comprehension weighting — in English and Vietnamese.
- Write-back (`known` → Anki mature fields) exists but is opt-in and user-originated only; suspended cards are never touched in either direction.

## Accepted residual risks

- Bridge add-on distribution (`.zip` release) is deferred to a release decision documented in the spec; extension works fully on the polling fallback.
- `learning` keyboard order keeps 1–4 muscle memory and assigns `5` (design decision, recorded in the design review).
- Future-clock-skew clamping logs and clamps conservatively; extreme device clock drift remains an accepted edge.
