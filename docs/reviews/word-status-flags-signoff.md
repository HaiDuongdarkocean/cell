# Sign-off Review — word-status-flags

VERDICT: SIGN_OFF

## Scope verified

- Intent/spec/design: `docs/specs/word-status-flags.md`, `docs/intent/word-status-flags-design-brief.md`, component mapping — owner approved concept B control + A capsule gradient (flag→unknown)
- Verify: `docs/reviews/word-status-flags-verify.md` — fresh-context review VERDICT: PASS; D1 (raw enum comparisons in status consumers) and D2 (user `tracking`/`unknown` demotion onto `learning` rows) both fixed and re-verified in `943ba57e`
- Wiki: `docs/0-wiki.md` changelog entry present (closes verify finding D3)

## Deterministic gates

- `npm run typecheck` — pass
- `npm run lint` — pass
- `npm run test:unit` — pass
- `npm run build` — pass
- Browser — pass (live Brave screenshots + 13/13 gradient pixel-scan evidence, `tmp/word-status-flags-*`)

Re-run at current HEAD for ship transition; commits since original gate recording (`82417db5`/`943ba57e`) are unrelated features — status-model code untouched.

## Business acceptance

- Status model is base cycle `unknown→known→ignore` + engagement flags (`tracking`/`learning`); `learning` is system-owned end-to-end (UI, message handler, store guard).
- Card loss clears flags via reconcile passes; restore/trash semantics documented as accepted behavior.
- Keymap `1/2/3` base cycle, `4` tracking toggle; popup segmented `[base | flag]` control live.

## Accepted residual risks

Recorded in `word-status-flags-verify.md` — stricter `learning` demotion guard (R1), latent arbitration hole for future `tracking` writers, sync-write repaint lag, cue-list i+1 gating intentionally out of scope.
