# testing-with-playwright

## Core concepts

- **Fixture**: Playwright mechanism tự setup/teardown và inject object vào test.
  - `cellEnvironment.fixture.ts` (worker-scoped): launch Chromium, load Cell + uBOLite, mở StreamFlix, tạo `streamFlixPage`.
  - `universalPanel.fixture.ts` (test-scoped): tạo `universalPanel` actor từ `streamFlixPage`.
- **Actor**: typed object chứa hành động của một feature. Test gọi actor thay vì viết `page.evaluate` + selector.
  - Ví dụ: `universalPanel.open()`, `universalPanel.search('exclamation')`.
  - Actor là nơi duy nhất biết cách xuyên shadow DOM và dispatch composed events.

## Principles

- **Flat first, split later.** Khi chỉ có 1–2 actor thì để flat; tách thư mục khi có ≥3 actor hoặc ≥10 file stage-2.
- **One fixture = one responsibility.** Không gộp nhiều feature vào một fixture.
- **No dead folders.** Không tạo thư mục rỗng chỉ để “chuẩn bị”. Tạo khi có file thực sự để đặt vào.
- **Pipeline = test file kết hợp nhiều actor/test.step**, hoặc chạy nhiều test file bằng `scripts/e2e.sh`.
- **Source of truth cho quy tắc chính là skill này**, không cần `e2e/README.md` riêng.

## Folder structure

```text
e2e/
├── fixtures/
│   ├── cellEnvironment.fixture.ts       # worker context + streamFlixPage
│   └── actors/
│       └── universalPanel.fixture.ts    # actor + SELECTORS map
├── stage2/
│   ├── universal-panel-dictionary.spec.ts
│   ├── card-creator-mobile.spec.ts
│   └── pipelines/
│       └── dictionary-to-card-creator.spec.ts
└── __snapshots__/                       # Playwright screenshots
```

## Naming rules

| Item | Rule | Example |
|---|---|---|
| Feature test | `e2e/stage2/<feature>-<flow>.spec.ts` | `universal-panel-dictionary.spec.ts` |
| Pipeline | `e2e/stage2/pipelines/<flow>.spec.ts` | `dictionary-to-card-creator.spec.ts` |
| Actor fixture | `e2e/fixtures/actors/<feature>.fixture.ts` | `universalPanel.fixture.ts` |
| `test.describe` | `Stage 2: <Feature> on <Context>` | `Stage 2: Universal Panel > Dictionary on StreamFlix` |
| `test('...')` | `<action> <expected>` | `opens Dictionary via the orbital badge` |
| Actor class | `<Feature>Actor` | `UniversalPanelActor` |
| Selector map | `const SELECTORS = { ... } as const` trong actor | `SELECTORS.orbitalBadge` |

## How fixtures chain

```ts
// cellEnvironment.fixture.ts
cellContext    → worker-scoped Chromium context with extensions
streamFlixPage → page navigated to StreamFlix, video + overlay ready

// actors/universalPanel.fixture.ts
universalPanel → new UniversalPanelActor(streamFlixPage)
```

Test import:

```ts
import { test } from '../fixtures/actors/universalPanel.fixture';

test.describe('Stage 2: Universal Panel > Dictionary on StreamFlix', () => {
  test('opens Dictionary via the orbital badge', async ({ universalPanel, streamFlixPage }) => {
    await universalPanel.open();
    await universalPanel.openTab('dictionary');
    await universalPanel.search('exclamation');
    await streamFlixPage.screenshot({ path: 'test-results/...' });
  });
});
```

## Pipeline patterns

**Pattern A — one test, multiple steps:**

```ts
test('pipeline: dictionary to card creator', async ({ universalPanel }) => {
  await test.step('open dictionary', async () => {
    await universalPanel.open();
    await universalPanel.openTab('dictionary');
    await universalPanel.search('exclamation');
  });
  await test.step('open card creator', async () => {
    // await cardCreator.open(...)
  });
});
```

**Pattern B — multiple test files in sequence:**

```bash
bash scripts/e2e.sh --stage2 universal-panel-dictionary subtitle-manager
```

## Commands

```bash
bash scripts/e2e.sh                           # build + all stage-2
bash scripts/e2e.sh --headed                  # build + all (browser visible)
bash scripts/e2e.sh universal-panel-dictionary # build + 1 file
bash scripts/e2e.sh brick1 brick2 brick3       # build + nhiều file
bash scripts/e2e.sh --stage2 brick1 brick2     # run only, skip build
bash scripts/e2e.sh --build                    # build only
```

Trên Windows dùng npm:

```bash
npm run test:e2e:full
npm run test:e2e:stage2 -- brick1 brick2
npm run test:e2e:build
```

## How to add a new stage-2 test

1. Nếu cần actor mới, tạo `e2e/fixtures/actors/<feature>.fixture.ts`.
2. Tạo `e2e/stage2/<feature>-<flow>.spec.ts`.
3. Import `test` từ actor fixture tương ứng.
4. Chạy: `bash scripts/e2e.sh --stage2 <tên file>`.

## Notes

- Default **headed** vì Playwright 1.61 không load Chrome extensions ở headless.
- Worker teardown: `cellEnvironment.fixture.ts` tự `close()` context sau khi worker chạy xong.
- `scripts/e2e.sh` thu thập nhiều positional args vào array, chạy 1 lần Playwright.
