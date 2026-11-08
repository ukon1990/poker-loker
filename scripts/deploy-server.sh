#!/usr/bin/env bash
# Builds the app and uploads it to an Apache or nginx server. See docs/deployment.md.
# Usage: DEPLOY_TARGET=user@host:/var/www/poker-loker pnpm deploy:server
set -euo pipefail

: "${DEPLOY_TARGET:?Set DEPLOY_TARGET, for example user@host:/var/www/poker-loker}"

pnpm build

# Upload new files before removing old ones, so a client that loaded the
# previous index.html can still fetch the assets it references.
rsync -az dist/assets "${DEPLOY_TARGET}/"
rsync -az --exclude assets dist/ "${DEPLOY_TARGET}/"
rsync -az --delete dist/ "${DEPLOY_TARGET}/"
