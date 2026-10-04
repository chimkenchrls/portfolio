#!/usr/bin/env bash
# Browser checks (Playwright in Docker). Not part of CI or the site — run locally:
#   python3 -m http.server 8000 &      # from the repo root
#   tests/e2e/run.sh                   # all suites, or: tests/e2e/run.sh terminal layer
set -euo pipefail
cd "$(dirname "$0")"
suites="${*:-terminal layer mobile deck chimken projects chat github}"
# The repo is mounted read-only at /site so suites can serve patched copies of files.
docker run --rm --network host -v "$PWD":/e2e:ro -v "$PWD/../..":/site:ro ${SHOTS:+-v "$SHOTS":/shots -e SHOTS=/shots} -w /e2e mcr.microsoft.com/playwright/python:v1.55.0-noble \
  sh -c "pip install -q --break-system-packages playwright==1.55.0 >/dev/null 2>&1; status=0; for s in $suites; do echo \"== \$s\"; python \$s.py || status=1; done; exit \$status"
