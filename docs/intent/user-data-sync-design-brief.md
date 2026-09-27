# Design Brief: User data sync

> Spec: `docs/specs/user-data-sync.md` · Stage: DESIGN · Status: decided — spec-derived Settings surface

## Decision

Owner reviewed all three concept directions (Beacon, Watershed, Passport) after the real-Chrome stress audit and rejected them as implementation bases: the metaphor surfaces are not reasonable carriers for this spec. Approved direction: **build the Sync surface directly from the spec's Function ↔ Feature Map as a conventional Settings section composed of existing `src/shared/ui` components** — `DESIGN_VARIANCE` effectively low for implementation; the Function Audit, Journey Map, Shared Interaction Rules and Required Mock Scenarios below remain binding requirements (states, actions, privacy, responsive contract), detached from any concept metaphor.

## Design Read

A calm safety console inside Settings: the learner should understand in one glance whether learning data is protected, which account holds each profile, and the one action needed when attention is required.

## Primary Job

**Keep my learning data safe and know where each profile is stored.**

Connecting, routing, recovering and disconnecting are supporting moments in that job. The interface must not feel like a file manager or expose journals, scopes, HLCs, cursors or provider internals.

## Context Anchor

- **Project principle:** “Quiet confidence — calm, focused, learnable, restrained.”
- **Feeling:** a protected place whose state is obvious without demanding attention.
- **Non-digital family:** harbor moorings, irrigation channels and a ship’s logbook.
- **Material:** solid neutral surfaces, small status punctuation, no glass/blur.
- **Out of place:** a developer dashboard, cloud-storage file tree, constant animated sync indicators, a wall of technical metrics, or destructive actions beside the primary action.

## Function Audit

| Function | Class | Frequency / risk | Why |
|---|---|---|---|
| Show overall protection state and last successful sync | must-have | frequent glance / low | Primary reassurance |
| Connect a Google Drive account | must-have | first use, occasional / medium | Entry to sync |
| List connected provider accounts | must-have | occasional / low | Multi-account topology must be understandable |
| Choose the system connection | must-have | rare / high | Global settings need one visible home |
| Bind each language profile to an account or local-only | must-have | occasional / high | Core product decision |
| Sync now | must-have | occasional / low | Gives control without implying manual sync is required |
| Show account/profile health and one recovery action | must-have | occasional / high | Re-auth, offline, quota and waiting states must be actionable |
| Show restore/rebind progress | must-have | rare / high | Prevents uncertainty during long transfers |
| Rebind a profile and decide whether to keep old cloud data | must-have | rare / high | Data-safe migration flow |
| Disconnect an account with affected-profile preview | must-have | rare / very high | Prevent accidental interruption |
| Explain privacy boundary | must-have | first use, reference / medium | Plain-language trust statement |
| Expose conflict log | remove from learner UI | diagnostic / low | Debug seam only per REQ-18 |
| Expose provider quota details | nice-to-have only when relevant | rare / medium | Show only for quota warnings, not healthy state |
| Show journal/file counts | remove | never useful / low | Internal implementation detail |

## Journey Map

| # | Step | Learner action | System response | UI location | Uncertainty handled |
|---|---|---|---|---|---|
| 1 | Arrive before setup | Opens Settings → Sync | Explains what is protected and offers one branded connect action | Empty/first-use state | “What will be uploaded?” answered before consent |
| 2 | Connect | Chooses Google Drive and completes consent | Adds account, marks it as system storage, assigns existing profiles by default, begins reconciliation | Account area + live status | Consent cancel/error returns to a stable state |
| 3 | Confirm protection | Glances at page | Shows “Protected”, last sync time, account and profile destinations | Summary + profile routing | No technical status codes |
| 4 | Control timing | Presses Sync now | Joins/starts a cycle, shows bounded progress, returns to last-sync state | Summary action | Repeated press never creates duplicate work |
| 5 | Add/split accounts | Connects another account, changes a profile destination | Explains that data is copied before the route changes, then shows progress | Profile row/detail | Original account remains safe until verified |
| 6 | Recover | Opens a row marked Needs attention | Shows exactly one action: reconnect, retry, free space, or connect required account | Inline status/action | Other healthy profiles stay visibly unaffected |
| 7 | Disconnect | Opens account menu, chooses Disconnect, confirms affected profiles | Final flush or persistent pending state; local data remains | Confirmation dialog + account state | Cloud copy and local-data consequences stated explicitly |
| 8 | Edge states | Returns during restore, offline, quota full or migration | State persists across restart and continues when possible | Same row/card, never a separate error page | Progress and next action remain visible |

## Baseline Dials

- `DESIGN_VARIANCE: 8` — concept exploration is intentionally unconstrained by the existing component inventory.
- `MOTION_INTENSITY: 2` — only progress, state replacement and a restrained entry stagger.
- `VISUAL_DENSITY: 5` — readable at 320px; account/profile topology still visible at desktop width.

## Design Reset

The first concept pass was rejected before approval. Although the React files were separate, all three reused one mock-level presentation vocabulary (`button`, `badge`, `card`, `menu`, `dialog`) and the same `summary → accounts → profiles` hierarchy. That made the concepts skins of one component-led solution.

The replacement pass follows these constraints:

- Only data, state transitions and the outer comparison shell may be shared.
- Each concept owns its complete markup, presentation vocabulary, responsive behavior and motion.
- No shared concept CSS classes or shared layout/presentation component.
- Existing production components remain visible only in the Real baseline.
- Component mapping happens only after selection; `reuse` may not override the chosen design intent.
- A concept passes divergence only if its silhouette, navigation model and edit interaction remain distinguishable without labels or color.

## Concept A — Beacon

- **IA mental model:** a safety signal, not a settings inventory. The interface answers “is my learning protected?” before revealing storage machinery.
- **Visual archetype:** a large calm beacon field with one semantic signal; healthy details recede into a compact protection constellation and problems rise into a single focused action.
- **Non-digital reference:** a lighthouse whose steady light means the coast is safe.
- **Material / surface:** an open field with a strong circular signal, sparse typography and recessed detail bands; no stack of account/profile cards.
- **Typography treatment:** one declarative sentence (“Your learning is protected”), oversized status word, quiet timestamps; destinations use small annotations.
- **Motion signature:** the beacon makes one slow confirmation pulse after successful sync; no looping motion while healthy. An affected profile moves into the action focus when attention is needed.
- **UX flow:** first use presents an unlit beacon and one connect action; healthy state hides account mechanics behind “Manage protection”; an issue replaces the secondary line with exactly one recovery action; management view exposes destinations only on demand.
- **UI structure:** `Beacon signal → profile constellation → collapsed management band → privacy`. On desktop the constellation surrounds/aligns beside the beacon; mobile becomes a vertical signal with profile markers, not rows.
- **States:** status language and beacon shape change; affected profile marker becomes the focused action target.
- **3 dials:** `DESIGN_VARIANCE: 8`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 2`.
- **Why it fits:** optimizes the primary reassurance job and keeps complexity away from learners who never split accounts.
- **Risk:** account topology requires one disclosure step and is slower for frequent administrators.

## Concept B — Watershed

- **IA mental model:** a topology. Profiles are sources; storage accounts are reservoirs; visible channels answer where each stream goes.
- **Visual archetype:** a true node map rather than rows decorated with lines. Profile nodes occupy one bank, destinations the other, and routes are the primary interactive objects.
- **Non-digital reference:** irrigation channels distributing water between fields and reservoirs.
- **Material / surface:** open canvas, labeled nodes and thin directional channels; no card list. System storage is a spring marker attached to one account node.
- **Typography treatment:** node labels dominate; supporting copy sits outside the map; status is attached to routes rather than repeated in containers.
- **Motion signature:** selecting a profile quiets unrelated routes; choosing a destination draws one channel once; migration progress travels along only that channel.
- **UX flow:** select a profile node → eligible destination nodes become targets → select destination → confirm safe copy → channel transitions only after verification. Account actions open from destination nodes.
- **UI structure:** `Overall health edge → topology canvas → contextual action tray → privacy`. Desktop is left-to-right; mobile is top-to-bottom with real continuous channels, not converted into cards.
- **States:** offline/quota/re-auth interrupts the affected channel; local-only ends at a device node; migration freezes source and destination ends.
- **3 dials:** `DESIGN_VARIANCE: 10`, `MOTION_INTENSITY: 5`, `VISUAL_DENSITY: 4`.
- **Why it fits:** makes the one-account-for-all and account-per-profile models self-evident without reading controls.
- **Risk:** requires careful keyboard navigation and route labeling so the map is not visual-only.

## Concept C — Passport

- **IA mental model:** a focused identity document for each language profile. The learner manages one profile’s protection at a time instead of scanning infrastructure.
- **Visual archetype:** a passport wallet: profile index on one side, selected profile’s protection page on the other, with a destination stamp and data-content marks.
- **Non-digital reference:** a passport containing trusted stamps and a wallet holding several passports.
- **Material / surface:** one continuous two-page spread on desktop; one page plus a profile ribbon on mobile. System settings appear as a separate shared-document tab, not an account table.
- **Typography treatment:** profile language is the cover title; destination appears as a stamp/seal; dictionaries, SRS and Reader are a concise contents record.
- **Motion signature:** page change uses a restrained directional reveal; a successful migration replaces the destination stamp only after verification.
- **UX flow:** choose profile from the index → inspect its protected contents and destination → “Change destination” enters a focused safe-transfer flow. Switch to “Shared settings” to change the system account.
- **UI structure:** `Profile ribbon/index → selected passport page → destination seal/action → contents record → privacy`. No all-profile ledger.
- **States:** each profile page owns its recovery action; unaffected profiles remain quiet in the index; first use opens the active profile with an unstamped destination.
- **3 dials:** `DESIGN_VARIANCE: 9`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 5`.
- **Why it fits:** matches the product’s profile-centric model and gives dictionaries, study history and Reader data a tangible sense of belonging.
- **Risk:** comparison across many profiles takes more navigation than the map.

## Responsive Contract

| Width | Contract |
|---|---|
| 320px | One column; 44px controls; status/action never share a cramped row; destination labels wrap; no horizontal scrolling |
| 768px | Settings horizontal navigation remains usable; account/profile rows may align label, status and control |
| 1280px | Settings sidebar visible; Sync content maxes at a readable measure; concepts may use two columns but preserve reading order |
| 1920px | No stretched ledger; content remains centered inside the Settings main column |

## Shared Interaction Rules

- Healthy state says **Protected** and “Last synced …”; never “All systems operational”.
- “Sync now” is secondary when healthy and becomes the single retry action when appropriate.
- Only the affected account/profile receives an error treatment.
- Rebind copy completes and verifies before the visible destination changes.
- Disconnect and delete-old-copy are separate decisions.
- “Keep old cloud copy” is the default.
- Local-only reads **Only on this device**, not “Disabled”.
- Subtitle API keys are named in the privacy disclosure because they sync by owner decision.
- Progress is determinate when byte counts exist and labeled indeterminate otherwise.
- `prefers-reduced-motion` removes stagger and route drawing while preserving state changes.

## Required Mock Scenarios

1. **Empty:** no account, no language profile and no learning data; the screen explains the prerequisite and offers one path to create a profile without rendering broken empty structures.
2. **First use:** no connection, three profiles, one branded Google Drive connect action.
3. **Protected:** two accounts; system badge on account A; English and Japanese on A, Korean on B; last sync is recent.
4. **Needs attention:** B requires sign-in; only Korean pauses and shows one action.
5. **Migrating:** English moving A→B with verified progress and explicit “old copy untouched”.
6. **Offline disconnect:** account row shows persistent `Disconnect pending`.
7. **Overflow:** six accounts (including long emails), twelve profiles (including long language labels), mixed destinations and recoverable states. All concepts must remain readable and operable without overlap, clipping, horizontal page scroll or hidden actions.

Every scenario is verified on Chrome at `mobile/desktop × light/dark`. Empty and Overflow are mandatory stress gates, not showcase-only fixtures.

## Audit Findings Addressed

| Finding / risk | Treatment |
|---|---|
| Multi-account topology is easy to misunderstand | Every profile names its destination; system storage is visibly badged |
| Status enums can leak technical language | Plain-language labels plus one next action |
| Risky migration can feel destructive | Copy-before-switch explanation, persistent progress, old-copy decision afterward |
| Settings is already long | New dedicated Sync navigation item; progressive disclosure inside the section |
| Mobile can collapse routing context | Destination repeated in each profile card; no reliance on connector lines alone |
| Color-only status | Icon + label + semantic color; screen-reader status text |
| Google consent uncertainty | Pre-consent privacy summary adjacent to the branded button |

## Anti-patterns Avoided

- No cloud file browser.
- No provider-specific architecture language.
- No global red banner when one profile has a recoverable issue.
- No always-visible destructive button.
- No animation that implies continuous real-time synchronization.
- No glass, blur, gradient decoration or off-token color.
- No desktop table squeezed unchanged onto mobile.

## Why The Concepts Are Genuinely Different

- **A** is state-first and progressively discloses storage mechanics.
- **B** is relationship-first and makes the topology itself editable.
- **C** is profile-first and exposes one bounded protection document at a time.

They share no presentation primitives. They differ in what is initially visible, how the learner navigates, how a destination changes, spatial structure and motion—not merely color or card styling.
