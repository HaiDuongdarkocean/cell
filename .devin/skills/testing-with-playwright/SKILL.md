# testing-with-playwright

Run Cell's two-stage Playwright E2E tests on StreamFlix.

## Stage 1 — environment

`e2e/fixtures/cellEnvironment.fixture.ts` loads Cell + uBOLite, opens `http://127.0.0.1:4321/index.html`, and waits for `<video>`, `#cell-subtitle-root`, and the orbital badge.

## Stage 2 — feature tests

```ts
import { test } from '../fixtures/cellEnvironment.fixture';

test('my feature', async ({ streamFlixPage }) => {
  // interact + assert
});
```

Save new tests in `e2e/stage2/<feature>.spec.ts`.

## Commands

```bash
npm run build
npm run build:mock
npx playwright test --config=playwright.stream.config.ts e2e/stage2/ --project=chromium
npx playwright test --config=playwright.stream.config.ts e2e/stage2/stream-universal-dictionary.spec.ts --project=chromium --headed
```

Build extension first, then mock pages. Use `--headed` to watch the browser.
