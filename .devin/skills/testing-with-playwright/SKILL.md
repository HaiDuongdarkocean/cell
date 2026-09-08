# testing-with-playwright

Run Cell's two-stage Playwright E2E tests on StreamFlix.

## Stage 1 — environment

`e2e/fixtures/cellEnvironment.fixture.ts` loads Cell + uBOLite, opens `http://127.0.0.1:4321/index.html`, and waits for `<video>`, `#cell-subtitle-root`, and the orbital badge.

## Stage 2 — feature tests

```ts
import { test } from '../fixtures/cellEnvironment.fixture';

test('my feature', async ({ streamFlixPage }) => { /* ... */ });
```

Save new tests in `e2e/stage2/<name>.spec.ts`.

## Commands

```bash
bash scripts/e2e.sh                       # build + run all stage-2
bash scripts/e2e.sh stream-universal      # build + run one file
bash scripts/e2e.sh "e2e/stage2/**/*.ts"  # build + Playwright pattern
bash scripts/e2e.sh --stage2              # run all, skip build
bash scripts/e2e.sh --stage2 stream-uni   # run one, skip build
bash scripts/e2e.sh --build               # build only
```

Build order: `npm run build` (extension) trước, sau đó `npm run build:mock` (mock pages). Dùng `--headed` trong `npx playwright` nếu muốn xem màn hình.
