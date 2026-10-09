# Todo — word-status-flags

| # | Task | Slice | Status | AC |
|---|---|---|---|---|
| 1 | Semantics helpers (baseStatus/statusFlag/isNotKnown/nextBaseStatus/toggleTrackingFlag) + STATUS_CYCLE→3 + tests | T1 | pending | AC-1, AC-11 |
| 2 | Store guard (public writers reject 'learning'), `clearLearningFlag`, arbitration protects ignore | T2 | pending | AC-4b, AC-7, AC-12 |
| 3 | Keys 1-4 remap + tracking toggle path in both controllers + popup target | T3 | pending | AC-4 |
| 4 | Token capsule gradients flag→unknown in both CSS builders + test | T4 | pending | AC-2 |
| 5 | Popup segmented control `[base\|flag]` + SRS state-aware button + i18n | T5 | pending | AC-3, AC-5 |
| 6 | SRS lifecycle: create→learning, delete→conditional unknown, reconcile, Anki disappearance | T6 | pending | AC-5, AC-6, AC-7, AC-7b, AC-12 |
| 7 | Consumers: vocab cycle skip learning, auto-mark no-demote, sessionRecap/lookup audit, i18n legend | T7 | pending | AC-8, AC-9, AC-10 |
| 8 | Gates + Chrome verify + docs + verify review + ship | T8 | pending | DoD |
| 9 | Delete `src/entrypoints/mockup-word-status-flags/` at ship | T8 | pending | — |
