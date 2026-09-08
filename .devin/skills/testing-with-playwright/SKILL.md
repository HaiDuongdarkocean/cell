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
bash scripts/e2e.sh                           # build + all stage-2 (headless)
bash scripts/e2e.sh --headed                  # build + all (hiện browser)
bash scripts/e2e.sh stream-universal          # build + 1 file
bash scripts/e2e.sh --stage2 stream-universal # chạy 1 file, không build
bash scripts/e2e.sh --stage2 --headed         # chạy tất cả, hiện browser
bash scripts/e2e.sh --build                   # chỉ build
```

Tên ngắn → `e2e/stage2/<tên>.spec.ts`. Pattern có `e2e/`, `.spec.ts`, `/`, hoặc `*` thì dùng nguyên văn.
