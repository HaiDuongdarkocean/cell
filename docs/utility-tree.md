# Utility Tree — Tihoka baseline (eval 20261017)

Pinned at baseline eval. Every arch-eval run diffs scenario coverage
against this tree. QA ranks from Anh (2026-10-17, validated) — driver:
"feature mới phá cũ" (SSOT/DRY so add/edit/delete doesn't break old logic).

```text
UTILITY
├── Maintainability (H — Anh's #1: SSOT/DRY, low blast radius)
│   ├── Modifiability
│   │   ├── S1  add a subtitle provider → ≤3 touchpoints outside the
│   │   │     adapter seam        [measured 10 → FAIL, leak 8]
│   │   ├── S2  add a message type → ≤6 touchpoints
│   │   │     [measured 6 → PASS, near-ideal seam]
│   │   └── S3  rename/delete a feature field → no edit required in
│   │         an unrelated feature's files
│   └── Analyzability
│       └── S4  bug in a boundary → the registry/handler naming tells
│             which file owns it (no hunt)
├── Reliability (H — user data is sacred)
│   ├── S5  SW idle-kill mid-transmux job → resume, 0 data loss
│   │     (ADR-108)                        [scenario written, unmeasured]
│   └── S6  two machines edit dictionary concurrently → 0 lost entries
│         (ADR-109/120)                    [scenario written, unmeasured]
├── Performance (M — unvalidated, from Mandate persona)
│   └── S7  subtitle overlay visible <3s from video canplay on a
│         RAM-1GB machine                    [persona rule, unmeasured]
└── Security/Privacy (M — unvalidated, from Mandate)
    ├── S8  credentials/tokens never leave device except declared
    │     endpoints (Drive, AnkiConnect, OAuth)
    └── S9  host_permissions <all_urls> — attack surface audited
          per new capability                   [standing tradeoff]
```

Legend: [measured N → PASS/FAIL] = L3 probe ran · [written, unmeasured]
= scenario exists, no instrument · [standing] = permanent tradeoff.
