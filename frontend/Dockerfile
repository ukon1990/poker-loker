# Serves the static build. Run `pnpm build` first: only dist/ goes into the image.
FROM ghcr.io/nginx/nginx-unprivileged:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 8080
