# Deployment

The build in `dist/` is static files only. Routes are normal paths such as `/lesson/holdem-1-1`.

## What the host must do

1. **Serve `index.html` for any path that has no file.** A reload or shared link asks the host for `/play`, and no such file exists. The app then reads the path and shows the right screen.
2. **Use HTTPS.** Service workers only run over HTTPS or on localhost, so install and offline need it.

## Your own server: Apache or nginx

Not sure which you have? Run this on the server. Whichever command prints a version is installed:

```bash
nginx -v; apachectl -v
```

**Apache** needs no extra files. `.htaccess` is part of the build and uploads with the app. The folder must allow it (`AllowOverride All`), and `mod_rewrite` and `mod_headers` must be enabled:

```bash
sudo a2enmod rewrite headers && sudo systemctl reload apache2
```

**nginx** ignores `.htaccess`. Copy [deploy/nginx.conf](../deploy/nginx.conf) into your site config, change `server_name` and `root`, then reload nginx.

To build and upload to either one, over SSH:

```bash
DEPLOY_TARGET=user@host:/var/www/poker-loker pnpm deploy:server
```

Add HTTPS with your usual tool, such as Certbot, so the app can be installed and work offline.

### Plesk

Plesk puts nginx in front of the site and writes the `location /` block itself, so `deploy/nginx.conf` can't be pasted in. Upload the contents of `dist/`, including `.htaccess`, to the subdomain's document root. Then:

1. Point the subdomain's DNS `A` record at the Plesk server.
2. Once DNS has updated, issue a Let's Encrypt certificate under **SSL/TLS Certificates**. Issuing fails until DNS points at Plesk.
3. Under **Apache & nginx Settings**, add this to **Additional nginx directives**, so links like `/play` work:

```nginx
if (!-e $request_filename) {
    rewrite ^/[^.]*$ /index.html last;
}
```

## S3 and CloudFront

| Option                    | Deep links | PWA    | Notes                                                                                                              |
| ------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| CloudFront in front of S3 | Yes        | Yes    | **Recommended.** Needs the setup below                                                                             |
| S3 website endpoint       | Yes        | **No** | HTTP only. Set both the index and error documents to `index.html`. Deep links return a 404 status but still render |
| S3 HTTPS endpoint         | **No**     | n/a    | Does not work: it cannot serve `index.html` for `/` or for unknown paths                                           |

### CloudFront setup

- Set the default root object to `index.html`.
- Add custom error responses for **403 and 404**: respond with `/index.html` and status 200. A private bucket reports missing files as 403, so both are needed.
- Keep the bucket private and use Origin Access Control.

### Hosting under a sub-path

The build assumes the site root. For a sub-path, build with `VITE_BASE`, including both slashes, and upload to that folder. Apache’s `.htaccess` works there unchanged. On nginx, change the `location` paths and the `/index.html` fallback to include the sub-path. On S3:

```bash
VITE_BASE=/poker/ S3_BUCKET=my-bucket/poker pnpm deploy:s3
```

Note that the origin stays the same across deploys, and all saved progress is tied to that origin. Moving to a new URL starts with empty progress unless you export and import a backup.

## Upload

```bash
S3_BUCKET=my-bucket pnpm deploy:s3
```

The script (`scripts/deploy-s3.sh`):

1. Builds the app.
2. Uploads hashed assets with a one-year immutable cache.
3. Uploads `index.html`, `sw.js`, and other unhashed files with `no-cache`, so updates are picked up.
4. Uploads the web manifest with the correct content type.
5. Removes files from older builds last, so a client mid-load does not lose its assets.

The bucket must allow public read (or CloudFront access through Origin Access Control).

## Updates

When a new version is deployed, a snackbar offers **Reload** or **Later**. The app never reloads by itself.

- It only appears on the main tab screens. Lessons, reviews, tables, and their finish and result screens never show it. An update found there waits until the player is back on a tab.
- **Later** hides it for now. The new version activates once every window of the app has been closed, or the snackbar comes back on the next start.
- The app looks for updates every hour and each time it returns to the foreground, because an installed app can stay open for days.
