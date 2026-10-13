# ADR-102 — E2E agent/worker artifact hierarchy and cleanup

## Context

Playwright E2E tests were writing runtime artifacts to scattered root-level directories:

- `test-results/`
- `playwright-report/`
- `.mock-servers/`
- `.test-pages/`
- `.Tihoka-profile-*`
- `.extension-build-*`

When multiple agents ran on the same machine, reports, screenshots, traces, ports, and browser profiles collided. Additionally, `globalSetup` deleted the entire `e2e-results/<agent>/staging` directory after the `webServer` had already started, which removed mock-page files while `http-server` was still serving them and caused `net::ERR_HTTP_RESPONSE_CODE_FAILURE` in stage2 tests.

## Decision

Use a single, agent-scoped root under `e2e-results/<agent-name>/` with the following layout:

```
e2e-results/<agent-name>/
  test-results/
  playwright-report/
  staging/
    mock-servers/
    test-pages/
    .extension-build-...
    .Tihoka-profile-...
```

- `agent-name` comes from `AGENT_ID` first, then `PW_OUTPUT_DIR`, falling back to `default`.
- `PW_PORT_OFFSET` shifts all mock and test-page ports so multiple agents do not share sockets.
- `PW_WORKERS` controls Playwright worker count; worker indices are embedded in profile/build directory names.
- `globalSetup` only cleans the current agent's `test-results` and `playwright-report`. It does not delete `staging` while `webServer` may be running.
- `globalTeardown` removes the current agent's `staging` unless `PW_KEEP_STAGING=1`, and removes `test-results`/`playwright-report` unless `PW_KEEP_RESULTS=1`.
- `serve-mock-pages.mjs` and `serve-test-pages.mjs` create a unique per-run directory under `staging/mock-servers` and `staging/test-pages`, then start an in-process `http-server` so Playwright stopping the parent process also closes the server and releases the staging directory.

## Consequences

- Concurrent agents are isolated by name, output directories, and ports.
- Mock pages, standalone test pages, extension builds, and persistent browser profiles all live under one predictable, gitignored root.
- Test artifacts are removed by default after a run; opt-in flags preserve them for debugging.
- `http-server` is added to `devDependencies` and used as a library, eliminating `npx` child-process leaks on Windows.

## Verification

- `npx playwright test e2e/extension.spec.ts` — 3 passed
- `npx playwright test e2e/launcher-dashboard.spec.ts` — 3 passed
- `npx playwright test e2e/profile-panel.spec.ts` — 8 passed
- `npx playwright test e2e/showcase.spec.ts` — 5 passed
- `npx playwright test e2e/stage2/stream-universal-dictionary.spec.ts --config=playwright.stream.config.ts` — 2 passed
- `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` all pass.
