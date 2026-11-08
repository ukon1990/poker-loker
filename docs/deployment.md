# Deployment

The build in `dist/` is static files only. It uses hash routing and relative asset paths, so no rewrite rules are needed and it works at a bucket root or under a sub-path.

## HTTPS is required for the PWA

Service workers only run over HTTPS (or on localhost). **The S3 "static website" endpoint is HTTP only**, so on that URL the app runs but cannot be installed or work offline.

| Option                    | URL                                                     | PWA    | Notes                                                                                              |
| ------------------------- | ------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| S3 HTTPS endpoint         | `https://<bucket>.s3.<region>.amazonaws.com/index.html` | Yes    | Simplest. Must be opened with `/index.html`, because this endpoint does not serve an index for `/` |
| CloudFront in front of S3 | Your domain or `*.cloudfront.net`                       | Yes    | Use this for a custom domain. Set the default root object to `index.html`                          |
| S3 website endpoint       | `http://<bucket>.s3-website-<region>.amazonaws.com`     | **No** | Not recommended                                                                                    |

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

When a new version is deployed, the app shows an "update available" prompt rather than reloading by itself, so it never interrupts a hand.
