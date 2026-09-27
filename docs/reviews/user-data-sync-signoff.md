# Sign-off Review — user-data-sync

VERDICT: SIGN_OFF

## Scope verified

- Intent: `docs/intent/user-data-sync.md` — owner-approved (Testing mode first, production deferred)
- Spec: `docs/specs/user-data-sync.md` — spec review APPROVE_WITH_CHANGES, all items applied
- Design: `docs/reviews/user-data-sync-design.md` — owner rejected all 3 metaphor concepts; approved spec-derived Settings section on shared `src/shared/ui` components
- Verify: `docs/reviews/user-data-sync-verify.md` — three fresh-context adversarial rounds converged to 10/10 PASS, no open majors

## Deterministic gates

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test:unit` — 619/619 suites, 7414/7414 tests
- `npm run build` — pass
- Feature-cycle / deep-import checkers — clean
- Browser (Chrome-for-Testing, packed extension) — status snapshot valid, panel renders, OAuth connect window launches

## Business acceptance

- A signed-in user's learning data — SRS collections/decks/cards, dictionaries, word statuses, reader books and progress, language-profile and system configuration (incl. subtitle API keys) — syncs automatically across devices via Google Drive `appDataFolder`; no manual export needed.
- Multiple Google accounts and language profiles supported; one global system connection plus per-profile bindings; exactly one profile per target language with lossless merge of legacy duplicates.
- Rebinding migrates data before switching and keeps the old remote copy until the user explicitly deletes it; disconnect revokes the token and resumes cleanly if the device was unreachable.
- Settings → Sync shows per-connection health, per-scope waiting/destination, copy progress, and a single labeled recovery action per problem state; the privacy notice names subtitle API keys next to the connect action.
- OAuth remains in Testing mode; production publishing and brand verification deferred per intent.

## Accepted residual risks

Bounded items recorded in `user-data-sync-verify.md` §Residual risks — all converge or degrade to storage cost/warnings; none lose user data.
