# Deployment

Poker Loker runs on the shared jonaskf VPS k3s cluster.

| Environment | Branch | URL | Namespace |
| --- | --- | --- | --- |
| Production | `main` | https://poker-loker.jonaskf.net | `pokerloker` |

## Layout

- `infra/kubernetes/vps/`: Kubernetes manifests
- `frontend/Dockerfile`, `frontend/nginx.conf`: the runtime image, nginx serving the static build
- `scripts/deploy/deploy-vps-local.sh`: builds, pushes to GHCR, applies manifests, rolls out, and verifies
- `scripts/deploy.mjs`: wraps that script, and runs all checks first
- `.github/workflows/deploy.yml`: the same steps, on every push to `main`

## Architecture

```text
Internet
  -> Traefik Ingress (poker-loker.jonaskf.net, TLS from cert-manager)
  -> pokerloker-frontend (nginx, port 8080)
```

All game data stays in the player's browser, so there is no backend or database.

The cluster must provide Traefik (`ingressClassName: traefik`) and cert-manager with the ClusterIssuer `letsencrypt-http01`. DNS for `poker-loker.jonaskf.net` must point at the VPS.

## Local deploy

Needs Podman or Docker running, and these variables:

```bash
export KUBECONFIG=~/.kube/jonaskf-vps.yaml
export GHCR_PULL_TOKEN=...  # GitHub token with write:packages and read:packages
```

```bash
pnpm deploy:check
```

```bash
pnpm run deploy
```

| Command | What it does |
| --- | --- |
| `pnpm deploy:check` | Checks tools, variables, and cluster access. Changes nothing. |
| `pnpm run deploy` | Runs all checks, then builds, pushes, rolls out, and verifies. Only from `main`. |
| `pnpm run deploy -- --skip-verify` | The same, without running the checks. |
| `pnpm deploy:secrets` | Re-applies manifests and the pull secret, then restarts. Builds nothing. |

Use `pnpm run deploy`, because plain `pnpm deploy` is a built-in pnpm command.

The deploy builds your working tree as it is, including uncommitted changes. Images are tagged `local-<commit>-<time>`, and `:latest` follows the newest deploy.

## GitHub Actions

Every push to `main` runs the checks. It deploys as well once these repository or `production` environment secrets exist. Until then the deploy step is skipped.

| Secret | Purpose |
| --- | --- |
| `KUBECONFIG_B64` | Base64-encoded kubeconfig for the cluster |
| `PROD_GHCR_PULL_TOKEN` or `GHCR_PULL_TOKEN` | Pushes images, and becomes the cluster's `ghcr` pull secret |

## Operating it

```bash
kubectl -n pokerloker get pods,ingress,certificate
```

```bash
kubectl -n pokerloker logs deployment/pokerloker-frontend
```

```bash
kubectl -n pokerloker rollout undo deployment/pokerloker-frontend
```
