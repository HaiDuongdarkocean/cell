#!/usr/bin/env bash
set -e

# Usage:
#   bash scripts/e2e.sh                         # build + run all stage-2 (headless)
#   bash scripts/e2e.sh --headed                # build + run all (headed)
#   bash scripts/e2e.sh stream-universal        # build + run one stage-2 file
#   bash scripts/e2e.sh "e2e/stage2/**/*.ts"    # build + run Playwright pattern
#   bash scripts/e2e.sh --stage2 [name|pattern] # run only, skip build
#   bash scripts/e2e.sh --stage2 --headed       # run all, headed, skip build
#   bash scripts/e2e.sh --build                 # build only

do_build=true
run_tests=true
headed=false
spec=""

while [ $# -gt 0 ]; do
  case "$1" in
    --build)
      do_build=true
      run_tests=false
      shift
      ;;
    --stage2)
      do_build=false
      run_tests=true
      shift
      ;;
    --headed)
      headed=true
      shift
      ;;
    *)
      if [[ "$1" == e2e/* ]] || [[ "$1" == *.spec.ts ]] || [[ "$1" == *"/"* ]] || [[ "$1" == *"*"* ]]; then
        spec="$1"
      else
        spec="e2e/stage2/${1}.spec.ts"
      fi
      shift
      ;;
  esac
done

if [ -z "$spec" ] && [ "$run_tests" = true ]; then
  spec="e2e/stage2/"
fi

if [ "$do_build" = true ]; then
  npm run build
  npm run build:mock
fi

if [ "$run_tests" = true ]; then
  if [ "$headed" = true ]; then
    export EXTENSION_HEADLESS=false
    npx playwright test --config=playwright.stream.config.ts "$spec" --project=chromium --headed
  else
    export EXTENSION_HEADLESS=true
    npx playwright test --config=playwright.stream.config.ts "$spec" --project=chromium
  fi
fi
