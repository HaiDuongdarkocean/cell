#!/usr/bin/env bash
set -e

# Usage:
#   bash scripts/e2e.sh                         # build + run all (browser visible)
#   bash scripts/e2e.sh --headed                # build + run all (browser visible)
#   bash scripts/e2e.sh stream-universal        # build + run one file
#   bash scripts/e2e.sh brick1 brick2 brick3    # build + run multiple files/patterns
#   bash scripts/e2e.sh "e2e/stage2/**/*.ts"    # build + Playwright pattern
#   bash scripts/e2e.sh --stage2 [name|pattern] # run only, skip build
#   bash scripts/e2e.sh --stage2 --headed       # run only, browser visible
#   bash scripts/e2e.sh --build                 # build only
#
# Note: headless Chrome cannot load extensions with this Playwright version,
# so all test runs default to headed. Use a virtual display for CI headless.

# On Windows without Git Bash, use the equivalent npm scripts in package.json:
#   npm run test:e2e:full                       # build + all stage-2
#   npm run test:e2e:stage2 -- brick1 brick2    # run only
#   npm run test:e2e:build                      # build only

do_build=true
run_tests=true
headed=false
specs=()

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
        specs+=("$1")
      else
        specs+=("e2e/stage2/${1}.spec.ts")
      fi
      shift
      ;;
  esac
done

if [ ${#specs[@]} -eq 0 ] && [ "$run_tests" = true ]; then
  specs=("e2e/stage2/")
fi

if [ "$do_build" = true ]; then
  npm run build
  npm run build:mock
fi

if [ "$run_tests" = true ]; then
  # Default to headed so Chrome can load the Cell + uBlock extensions.
  # For headless CI, wrap this script in a virtual display (e.g. xvfb-run).
  export EXTENSION_HEADLESS=false
  if [ "$headed" = true ]; then
    npx playwright test --config=playwright.stream.config.ts "${specs[@]}" --project=chromium --headed
  else
    npx playwright test --config=playwright.stream.config.ts "${specs[@]}" --project=chromium
  fi
fi
