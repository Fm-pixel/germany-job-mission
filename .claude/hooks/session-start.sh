#!/bin/bash
# Prepares a Claude Code on the web session: installs the dependencies so that
# lint, typecheck, tests and the build can run straight away.
set -euo pipefail

# Only needed in the remote environment; a local machine already has its setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "Installing npm dependencies for Germany Job Mission…"
npm install --no-audit --no-fund

# The click-through test uses the Chromium that the environment already ships,
# so it never downloads a browser.
if [ -x /opt/pw-browsers/chromium ]; then
  echo 'export PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium' >> "${CLAUDE_ENV_FILE:-/dev/null}"
fi

echo "Ready: npm run check runs lint, typecheck, tests and the build."
