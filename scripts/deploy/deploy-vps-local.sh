#!/usr/bin/env bash
# Builds the frontend image, pushes it to GHCR, and rolls it out to the VPS cluster.
# See infra/README.md. `pnpm run deploy` wraps this.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
K8S_DIR="${K8S_DIR:-${ROOT_DIR}/infra/kubernetes/vps}"
APP_NAMESPACE="${APP_NAMESPACE:-pokerloker}"
APP_HOST="${APP_HOST:-poker-loker.jonaskf.net}"
FRONTEND_DEPLOYMENT="${FRONTEND_DEPLOYMENT:-pokerloker-frontend}"
GHCR_IMAGE_PREFIX="${GHCR_IMAGE_PREFIX:-ghcr.io/ukon1990/pokerloker}"
GHCR_USERNAME="${GHCR_USERNAME:-$(printf '%s' "${GHCR_IMAGE_PREFIX#ghcr.io/}" | cut -d/ -f1)}"
GHCR_PULL_TOKEN="${GHCR_PULL_TOKEN:-}"
IMAGE_PLATFORM="${IMAGE_PLATFORM:-linux/amd64}"
MANIFEST_IMAGE="${GHCR_IMAGE_PREFIX%/}/frontend:latest"
SECRETS_ONLY=false
PREFLIGHT_ONLY=false

usage() {
  cat <<'EOF'
Usage: deploy-vps-local.sh [--preflight] [--secrets-only]

Environment variables:
  KUBECONFIG       Kubeconfig for the VPS cluster (required)
  GHCR_PULL_TOKEN  GitHub token with write:packages and read:packages (required)
  CONTAINER_CLI    docker or podman. Picks whichever is running when unset.

  --preflight      Validate tools, environment, and cluster access. Changes nothing.
  --secrets-only   Re-apply manifests and the pull secret, then restart. Builds nothing.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --preflight) PREFLIGHT_ONLY=true ;;
    --secrets-only) SECRETS_ONLY=true ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

CONTAINER_CLI="${CONTAINER_CLI:-}"
if [[ "$SECRETS_ONLY" != "true" ]]; then
  if [[ -z "$CONTAINER_CLI" ]]; then
    if docker info >/dev/null 2>&1; then
      CONTAINER_CLI=docker
    elif command -v podman >/dev/null 2>&1 && podman info >/dev/null 2>&1; then
      CONTAINER_CLI=podman
    else
      echo "No container engine is running. For Podman: podman machine start" >&2
      exit 1
    fi
  elif ! "$CONTAINER_CLI" info >/dev/null 2>&1; then
    echo "${CONTAINER_CLI} is not available or not running." >&2
    exit 1
  fi
  echo "Using ${CONTAINER_CLI} for image build and push"
fi

for command_name in kubectl curl git pnpm; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
done

for var_name in KUBECONFIG GHCR_PULL_TOKEN; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

if [[ ! -r "$KUBECONFIG" ]]; then
  echo "KUBECONFIG does not point to a readable file: ${KUBECONFIG}" >&2
  exit 1
fi

echo "Checking Kubernetes access"
kubectl cluster-info >/dev/null

if [[ "$PREFLIGHT_ONLY" == "true" ]]; then
  echo "Preflight OK (${APP_NAMESPACE}, ${APP_HOST})"
  exit 0
fi

apply_pull_secret() {
  echo "Applying GHCR image pull secret"
  kubectl -n "$APP_NAMESPACE" create secret docker-registry ghcr \
    --docker-server=ghcr.io \
    --docker-username="$GHCR_USERNAME" \
    --docker-password="$GHCR_PULL_TOKEN" \
    --docker-email="${GHCR_USERNAME}@users.noreply.github.com" \
    --dry-run=client \
    -o yaml | kubectl apply -f -
}

# Pins the image while applying, so the deployment rolls out once and never to :latest.
apply_manifests() {
  local image="$1"
  kubectl apply -f "${K8S_DIR}/namespace.yaml"
  apply_pull_secret

  local manifest
  for manifest in "$K8S_DIR"/*.yaml; do
    [[ "$manifest" == */namespace.yaml ]] && continue
    if [[ "$manifest" == */frontend-deployment.yaml ]]; then
      [[ -z "$image" ]] && continue
      sed "s#${MANIFEST_IMAGE}#${image}#" "$manifest" | kubectl apply -f -
    else
      kubectl apply -f "$manifest"
    fi
  done
}

verify_url() {
  local url="$1"
  for _ in $(seq 1 30); do
    if curl --fail --silent --show-error --connect-timeout 5 --max-time 10 "$url" >/dev/null; then
      return 0
    fi
    sleep 10
  done
  curl --fail --silent --show-error --connect-timeout 5 --max-time 10 "$url" >/dev/null
}

verify_endpoints() {
  echo "Verifying public endpoints"
  verify_url "https://${APP_HOST}/"
  # A deep link only works if the server falls back to the app.
  verify_url "https://${APP_HOST}/play"
}

rollout_status() {
  kubectl -n "$APP_NAMESPACE" rollout status "deployment/${FRONTEND_DEPLOYMENT}" --timeout=180s
}

if [[ "$SECRETS_ONLY" == "true" ]]; then
  apply_manifests ""
  kubectl -n "$APP_NAMESPACE" rollout restart "deployment/${FRONTEND_DEPLOYMENT}"
  rollout_status
  verify_endpoints
  echo "Secrets-only deploy succeeded"
  exit 0
fi

echo "Logging in to ghcr.io as ${GHCR_USERNAME}"
printf '%s' "$GHCR_PULL_TOKEN" | "$CONTAINER_CLI" login ghcr.io -u "$GHCR_USERNAME" --password-stdin

short_sha="$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD)"
timestamp="$(date -u +%Y%m%d%H%M%S)"
image_tag="${IMAGE_TAG:-local-${short_sha}-${timestamp}}"
image="${GHCR_IMAGE_PREFIX%/}/frontend:${image_tag}"

echo "==> Building the app"
pnpm --dir "${ROOT_DIR}/frontend" install --frozen-lockfile
pnpm --dir "${ROOT_DIR}/frontend" build

echo "==> Building image ${image}"
"$CONTAINER_CLI" build \
  --platform "$IMAGE_PLATFORM" \
  --file "${ROOT_DIR}/frontend/Dockerfile" \
  --tag "$image" \
  --tag "$MANIFEST_IMAGE" \
  "${ROOT_DIR}/frontend"

echo "==> Pushing image"
"$CONTAINER_CLI" push "$image"
"$CONTAINER_CLI" push "$MANIFEST_IMAGE"

echo "==> Applying Kubernetes manifests"
apply_manifests "$image"

echo "==> Waiting for rollout"
rollout_status

verify_endpoints
echo "Deploy succeeded: ${image_tag}"
