# testing-with-playwright

Run Cell's two-stage Playwright E2E tests on StreamFlix.

## Stage 1 — environment

`e2e/fixtures/cellEnvironment.fixture.ts` loads Cell + uBOLite, opens StreamFlix, and exposes `streamFlixPage`.

## Stage 2 — actor fixture

`e2e/fixtures/universalPanel.fixture.ts` cung cấp `universalPanel` actor:

```ts
import { test } from '../fixtures/universalPanel.fixture';

test('my flow', async ({ universalPanel, streamFlixPage }) => {
  await universalPanel.open();
  await universalPanel.openTab('dictionary');
  await universalPanel.search('exclamation');
});
```

Mỗi stage-2 test là một file `e2e/stage2/<name>.spec.ts`. Actor giúp gộp nhiều bước bằng `test.step`.

## Commands

```bash
bash scripts/e2e.sh                           # build + all (headless)
bash scripts/e2e.sh --headed                  # build + all (hiện browser)
bash scripts/e2e.sh brick1 brick2 brick3      # build + nhiều file
bash scripts/e2e.sh --stage2 brick1 brick2    # chạy nhiều file, không build
bash scripts/e2e.sh --build                   # chỉ build
```

Trên Windows dùng npm:

```bash
npm run test:e2e:full
npm run test:e2e:stage2 -- brick1 brick2
npm run test:e2e:build
```

Actor giữ selector map và `page.evaluate` để xuyên shadow DOM, không cần copy-paste.
