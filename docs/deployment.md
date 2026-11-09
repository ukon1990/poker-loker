# Deployment

The app runs as a single nginx container on the Kubernetes cluster, at https://poker-loker.jonaskf.net. Commands, secrets, and cluster requirements are in [infra/README.md](../infra/README.md).

## What the server has to do

Routes are normal paths such as `/lesson/holdem-1-1`, so `frontend/nginx.conf` serves `index.html` for any path with no file. Paths with a file extension stay real 404s, so a missing script is never answered with HTML.

HTTPS is required for installing the app and playing offline, because service workers only run over HTTPS or on localhost. Traefik and cert-manager provide it.

All saved progress is tied to the site's address. Moving to a new address starts with empty progress unless the player exports and imports a backup.

## Caching

- Files in `assets/` have a content hash in their name and are cached for a year.
- Everything else is rechecked on each load, so updates are picked up.

## Hosting under a sub-path

The build assumes the site root. For a sub-path, build with `VITE_BASE`, including both slashes, such as `VITE_BASE=/poker/`, and adjust the paths in `frontend/nginx.conf` and the ingress to match.

## Installed app

The manifest asks for `fullscreen`. Android hides the system bars. iOS has no full-screen mode for web apps, so the status bar stays and takes the page colour through `theme-color`. Screens stay clear of notches and the home indicator with the `--safe-top` and `--safe-bottom` CSS variables.

iOS copies the icon and launch images when the app is added to the home screen, so a changed logo only reaches people who add it again. Launch images are left out of the offline precache, so nobody downloads all 13.

## Updates

When a new version is deployed, a snackbar offers **Reload** or **Later**. The app never reloads by itself.

- It only appears on the main tab screens. Lessons, reviews, tables, and their finish and result screens never show it. An update found there waits until the player is back on a tab.
- **Later** hides it for now. The new version activates once every window of the app has been closed, or the snackbar comes back on the next start.
- The app looks for updates every hour and each time it returns to the foreground, because an installed app can stay open for days.
