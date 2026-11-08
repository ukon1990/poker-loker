#!/usr/bin/env bash
# Builds the app and uploads it to an S3 bucket. See docs/deployment.md.
# Usage: S3_BUCKET=my-bucket pnpm deploy:s3
set -euo pipefail

: "${S3_BUCKET:?Set S3_BUCKET to the name of the target bucket}"
target="s3://${S3_BUCKET}"

pnpm build

# Upload new files before removing old ones, so a client that loaded the
# previous index.html can still fetch the assets it references.
aws s3 sync dist/assets "${target}/assets" \
  --cache-control "public,max-age=31536000,immutable"

aws s3 sync dist "${target}" --exclude "assets/*" --exclude "*.webmanifest" \
  --cache-control "no-cache"

# The AWS CLI does not know this extension and would store it as binary.
aws s3 cp dist/manifest.webmanifest "${target}/manifest.webmanifest" \
  --content-type "application/manifest+json" --cache-control "no-cache"

aws s3 sync dist "${target}" --delete --size-only
