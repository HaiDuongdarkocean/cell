#!/usr/bin/env bash
set -e

# Usage:
#   bash scripts/e2e.sh              # build extension + mock pages + run stage 2
#   bash scripts/e2e.sh --stage2     # run stage 2 only (assumes build already done)

if [ "$1" == "--stage2" ]; then
  npx playwright test --config=playwright.stream.config.ts e2e/stage2/ --project=chromium
else
  npm run build
  npm run build:mock
  npx playwright test --config=playwright.stream.config.ts e2e/stage2/ --project=chromium
fi
