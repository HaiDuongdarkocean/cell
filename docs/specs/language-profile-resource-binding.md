# Spec: Language Profile — menu fix + resource binding

> Source: audit report (session 2026-…). Bugs confirmed by code reading; the
> profile/resource data model exists but was never enforced end-to-end.

## Objective

Language profiles are the unit of learning configuration. Two defects and one
gap currently break that model:

1. **⋮ menu invisible (P0)** — `ProfileMenu` portals its popover to
   `ownerDocument.body`. The only production surface rendering it is the
   Universal Panel Settings tab, which lives inside a **shadow root**
   (`mountReactShadow` + `allModuleCss`). The menu therefore lands in the page's
   light DOM: module CSS doesn't apply (`position:fixed` lost → appended as an
   unstyled block at the end of `<body>`), and the panel host covers the
   viewport with a higher z-index. Users see nothing when clicking ⋮.

2. **Resources not bound to profile** — dictionary/frequency can be installed
   with zero profiles; imported resources get no `profileIds` and the
   management UI never filters by the active profile, so every profile sees
   every resource. Business rule: **dictionary & frequency data follow the
   profile — each profile owns its own set.**

3. **Profile switch doesn't propagate** — `mountUniversalPanel.onProfileChange`
   persists `activeProfileId` but never re-derives
   `dictionarySourceLang/targetLang/langCode`, so the Dictionary tab and Card
   Creator keep using the previous profile's languages until remount.

Success looks like: the ⋮ menu opens and works inside the universal panel;
with no profiles the Resources section asks the user to create one first;
importing a resource scopes it to the active profile; the resources list shows
only what the active profile can use; switching profile in the panel header
re-points dictionary/card-creator languages immediately.

## Tech Stack

React + TypeScript, MV3 extension, Vite/Rolldown, Zustand, CSS Modules,
shadow-DOM mounts (`mountReactShadow`), Jest + RTL, Playwright stage2/showcase.

## Commands

- Unit: `npx jest <path> --silent`
- Typecheck: `npx tsc --noEmit`
- Lint: `npx eslint <files>`
- Build: `npm run build`
- Stage2 e2e: `npx playwright test --config=playwright.stream.config.ts <spec> --project=stage2`

## Decisions (accepted risks)

- **Binding direction SSOT: `ResourceInfo.profileIds`** (resource → profiles).
  `LanguageProfile.resourceIds` is a dead field — removed from the type,
  creation code, fixtures and tests. Stored settings may still carry the key;
  it is simply ignored (no migration needed).
- **Empty `profileIds` = all profiles** (existing schema semantics kept).
- **Import auto-assigns the active profile.** Replacing a duplicate creates a
  fresh resource record → assignment is safe (no merge needed).
- **No-profile fallback stays permissive at lookup time** (`isAllowed` returns
  true when `activeProfileId` is null) so deleting the last profile never
  bricks an already-installed dictionary. The *management* UI is what gates:
  no profiles → Resources card shows a create-profile CTA instead of import.
- **SRS active pointer follows `settings.activeProfileId`** (was
  `srs.activeLanguageProfileId` first). Deleting a profile also clears the SRS
  active pointers when they referenced it.
- **Word status / frequency bands / tokenize / Anki stay global per language** —
  out of scope; two profiles sharing a target language share those pools.

## Implementation outline

### S1 — ProfileMenu shadow-aware portal
- Reuse `Select.getPortalContainer` pattern: when `getRootNode()` is a
  `ShadowRoot`, portal into the topmost element inside that root (keeps CSS +
  z-index context); otherwise `document.body`.
- Outside-click listener attaches to the **root scope** (ShadowRoot or
  Document) so `contains()` sees real targets — `document` listeners get
  retargeted targets and would close the menu before item clicks.
- Scroll-close listener attaches to both `window` and the scope (scroll events
  don't cross the shadow boundary).

### S2 — Resource ↔ profile binding
- `SettingsDialogContent`: derive `activeProfile = getActiveProfileSettings`;
  Resources card shows `EmptyState` + CTA (scroll to Language Profile card)
  when `languageProfiles.length === 0`; otherwise renders
  `ResourcesPanel langCode={activeProfile.resourceLangCode} activeProfileId`.
- `ResourcesPanel`: `resourceIds` prop → `activeProfileId`; list filter uses
  `profileIds` semantics; successful import calls
  `setResourceProfiles(langCode, resourceId, [activeProfileId])`.
- `ResourceDetail`: profile picker shown when ≥1 profile (was ≥2).
- Remove `LanguageProfile.resourceIds` everywhere.
- `firstRunService`: `settings.activeProfileId ?? srs.activeLanguageProfileId`.
- `LanguageProfilePanel.deleteProfile`: clears `srs.activeLanguageProfileId`
  and active collection/deck/notetype when they point at the deleted profile.
- i18n keys for the no-profile empty state (en + vi).

### S3 — Profile-switch language propagation
- `mountUniversalPanel`: keep loaded settings; `onProfileChange` resolves the
  selected profile and updates `dictionarySourceLang`, `dictionaryTargetLang`,
  `dictionaryLangCode` before re-render.

## Boundaries

- Always: tests for behavior changes; tokens-only CSS; atomic commits.
- Ask first: none anticipated (no new deps, no schema version bump — field
  removal is backward compatible).
- Never: touch unrelated dirty WIP (split-view files); commit secrets.

## Testing Strategy

- Jest/RTL: new `ProfileMenu.test.tsx` (shadow-root portal, item click,
  outside-click close); `ResourcesPanel.test.tsx` (profile filter + import
  auto-assign); `LanguageProfilePanel`/`SettingsDialogContent` tests (gate,
  delete cleanup); `firstRunService.test.ts` (precedence).
- Full unit suite + tsc + eslint + build.

## Definition of Done

- [ ] ⋮ menu renders inside the shadow root, items clickable, Escape/outside
      click/scroll close it
- [ ] Resources card gated behind ≥1 profile with CTA
- [ ] Import scopes resource to active profile; list filtered by profile
- [ ] Profile switch re-points dictionary languages without remount
- [ ] `resourceIds` field removed; SRS pointers cleaned on delete
- [ ] All gates pass (jest, tsc, eslint, build, design audit)
