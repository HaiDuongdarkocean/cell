# Intent: Redesign the Sync settings section for clarity and guidance

> Slug: `sync-settings-redesign` · Mode: interactive · Source: user statement
> ui_surface: yes
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Users cannot tell what the Sync section does for them or what step to take next; the screen overwhelms with text before any action exists | Screenshot `brave_yYAyGwd6Z1.png`; user statement "nhiều chữ… bị choáng ngợp"; `SyncPanel.tsx:188-208` empty state paragraph | high |
| Change | From a text-heavy, all-states-equal layout → a guided screen: what it is, what step you're on, one obvious next action; connect progress becomes inspectable | `SyncPanel.tsx`, `AnkiStatusSyncPanel.tsx`; captured states empty/connected/full/reauth/offline/syncing/storage-full/error/mobile | high |
| Solution | Redesign the Sync section (copy + hierarchy + progressive disclosure), not the sync engine or protocols | scope below | high |
| Value | A 5–80 y/o user can connect Drive and reach "my data is safe" without reading paragraphs; fewer abandoned connects = the feature actually ships value | persona in AGENTS.md; user statement | high |
| Stakeholder | Learner on any device (5–80 y/o); sync owner = this worktree's agent | AGENTS.md persona | high |
| Context | Section lives inside universal-panel Settings → Sync tab; shadow-DOM surface; i18n EN/VI; design tokens SSOT | `SettingsDialogContent.tsx:759-768` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Devin agent + Anh (reviewer) | Small diff inside existing components; reuse shared/ui | `src/shared/ui/*` exists |
| Customer | Learner, 5–80, any device | Know what Sync gives them + what to do next | RAM ≥1GB, touch ≥40px |
| Supplier/Dependency | Google OAuth (`launchWebAuthFlow`), AnkiConnect + Tihoka Bridge add-on | Auth happens in Google's window — panel can only show progress + explain scope | `.env.local` client ID |
| Organization | Future contributors | Sync section stays one `SettingsGroup`/`SettingsRow`-style surface | conventions |
| Regulator | none — OAuth scope text unchanged in meaning | — | — |

## Needs

| ID | Need | FURPS+ | Evidence | Confidence |
|---|---|---|---|---|
| N1 | Understand at a glance what Sync is for and the benefit ("protect my learning data") | U | user statement; `settings.sync.empty.desc` paragraph | high |
| N2 | Know current step in the journey: not-connected → connecting → connected/protected (+ degraded states) | U | all state screenshots; `summaryMeta()` `SyncPanel.tsx:55-71` | high |
| N3 | One obvious primary action per state (Connect / Sign in / Sync now), secondary actions de-emphasized | U | current UI shows Connect + Disconnect + per-profile selects at equal weight | high |
| N4 | While connecting, spinner-only feedback is opaque; user can expand to see what's being requested — without being forced to read it | U | user statement: "nhấn để expand… xem chi tiết"; `busy==='connect'` spinner `SyncPanel.tsx:195-204` | high |
| N5 | Anki status sync reads as part of one Sync story, not a second unexplained system | U | `AnkiStatusSyncPanel` group header + 5 rows of jargon (port, polling, unsuspended) | high |
| N6 | Reduced copy density overall — details available on demand, not always visible | U | user statement | high |
| N7 | Works identically EN/VI, light/dark, 320→desktop, touch ≥40px | U / +a11y | persona; mobile shot `tmp-sc-mobile.png` shows selects wrap fine | high |

## Scope

- **In:** Sync section UI in universal-panel Settings (`SyncPanel`, `AnkiStatusSyncPanel`, their CSS module, i18n strings EN+VI); states: empty, connecting, connected, reauth, offline, storage-full, backoff, error, disconnect dialog; showcase mock states for verification
- **Out:** sync engine, OAuth flow internals, message protocols, Drive folder logic, Anki sync algorithm
- **Non-goals:** new providers; changing what data syncs; the (i) tooltip on the section header; other settings sections

## Workflow

Narrative: a learner opens Settings → Sync because they heard data is protected. (person↔device) They read one line of "what this does", see the current step, and take the one action offered. If they tap Connect, Google asks for permission in its own window; the panel meanwhile shows "waiting for Google" with an expandable line explaining the permission. On success the panel shows "Protected" and which account. (system↔system) Sync then runs silently; the surface only reports health. For Anki users, a second block explains statuses mirror between Anki and this device — same visual language, same "next step" pattern.

## Journey

### AS-IS
1. User opens Settings → Sync: sees a long paragraph + Connect button, and below it an unrelated-looking "Anki status sync" block with 5 rows of technical text.
2. User taps Connect: button spins with no explanation; a separate Google window appears asking sign-in — the user can't tell what was asked or if anything is happening in the panel.
3. Connected: screen shows status row, account row with System/Disconnect/Remove-locally, plus one full-width dropdown per language profile — many same-weight choices, unclear which matter.
4. Edge: reauth/offline/storage-full appear as alert + status row + all the same account/profile UI — the one thing to do isn't visually first.

### TO-BE
1. User opens Settings → Sync: sees a short benefit statement ("Keep your learning safe on every device") and a clear "Step 1: connect Google Drive" style affordance.
2. User taps Connect: the button area becomes a compact progress row ("Waiting for Google sign-in…") that can be tapped to expand and read exactly what permission is requested; Google window does the auth; panel confirms on return.
3. Connected: one calm summary ("Protected — backed up to me@gmail.com, 2 min ago") + Sync now; account management and per-profile routing live behind progressive disclosure (expand "Accounts" / "Per-language routing").
4. Edge: degraded states (reauth/offline/storage-full) promote the single recovery action to the top summary; details stay in the same expandable structure.

## Stories

- S1: As a first-time user, I want to know what Sync gives me and what to do first — done when the empty state answers both in one glance without a paragraph.
- S2: As a user who tapped Connect, I want to see that something is happening and (optionally) what is being requested — done when the connecting state is a tappable progress row, spinner alone never being the only signal.
- S3: As a connected user, I want to confirm protection at a glance — done when the top of the section shows state + account + last sync time without scrolling.
- S4: As a user with a sync problem, I want the one action that fixes it — done when needs-reauth/offline/storage-full surface their recovery button in the summary row.
- S5: As an Anki user, I want word-status sync explained as part of Sync — done when the Anki block uses the same step/summary pattern and jargon is behind expansion.
- S6: As a power user, I want per-language routing and multi-account management — done when they exist one tap deeper, not on the default view.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Hiding advanced controls (bindings, disconnect) harms power users if disclosure is too deep | human | medium | keep one-tap expand; preserve all existing actions |
| Over-shortening copy loses the "only you can see" privacy promise that justifies OAuth consent | human | medium | keep privacy clause in expandable connect details |
| i18n overflow (VI longer) breaks compact rows | operational | low | verify both locales in showcase |
| Mock/real divergence: redesign verified on mock states, real engine states unchanged | internal | low | states enumerated from `syncService.ts:118-132` not invented |

## Decision

**go** — the section fails its primary job (tell me what this is, what to do next) while every mechanism underneath is sound. Pure-UI fix with full state coverage already reproducible in the showcase.

Draft ACs: (1) empty/connecting/connected/reauth/offline/storage-full/error all render with a single obvious next action; (2) connecting state expandable to reveal requested permission; (3) zero paragraphs >2 lines on default view; (4) EN+VI, light+dark, 320px+ verified in showcase; (5) all existing actions (disconnect, per-profile routing, port, toggles) still reachable.
