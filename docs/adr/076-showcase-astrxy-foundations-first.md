# ADR-076: Astryx foundations-first design-system showcase

## Status
Accepted

## Context

The showcase was difficult to review because it rendered large surface previews before the atoms, wrapped every foundation in cards, and a PoC injected hostile red/yellow CSS into the document. The token values also drifted from `docs/design-system/daft.md`: the type scale was flattened, semantic radius roles were missing from the static scale, and the showcase used undefined token names.

## Decision

Refactor the showcase into an Astryx/Meta-inspired review surface:

1. **Review order:** foundations → atom primitives → domain atoms → surface previews.
2. **AppShell layout:** sticky header, filter toolbar, bounded content column, sticky group navigation, responsive atom grid.
3. **Container policy:** cards are reserved for individual atom specimens; foundation sections are flat with dividers; radius is shown as independent specimen rows.
4. **Token SSOT:** `tokens.json` remains canonical. The generated CSS receives the daft geometric type scale, 4px spacing aliases (`--spacing-*`), semantic radius roles, and body/heading/code family aliases.
5. **Isolation PoC:** the shadow-root preview may inject tokens and component CSS into its own shadow boundary, but must not inject global hostile styles into the page.
6. **Theme:** the showcase defaults to the dark neutral surface and exposes a light/dark toggle; component primary blue remains a Cell action token because production tests and behavior depend on it.

## Consequences

- Reviewers see all atom categories and counts before heavyweight panels.
- Foundation drift is visible without nested-card noise.
- Existing production action-color contracts remain stable while surfaces follow the neutral Astryx direction.
- Full test suite still contains unrelated/pre-existing failures plus several atom test failures from the parallel implementation; build and typecheck are the release gates for this showcase slice until those tests are repaired separately.

## Sources

- `docs/design-system/daft.md`
- https://astryx.atmeta.com/docs/layout
- https://astryx.atmeta.com/docs/tokens
- https://astryx.atmeta.com/docs/typography
- https://astryx.atmeta.com/docs/spacing
- https://astryx.atmeta.com/docs/shape
