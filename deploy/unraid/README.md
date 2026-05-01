# Unraid Deployment Notes

Unraid's current documentation says Docker Compose is not natively supported, so the canonical setup for the server is to mirror the `compose.yaml` services as individual Unraid containers:

- Overview: https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/overview/
- Managing containers: https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/

## Containers

### postgres

- Image: `postgres:16-alpine`
- Environment:
  - `POSTGRES_DB`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
- Volume:
  - `/mnt/user/appdata/douchebags-open/postgres` -> `/var/lib/postgresql/data`

### backend

- Image: `ghcr.io/yoloswaglord2/the-douchebags-open-backend:latest` (published from `main` by `.github/workflows/docker-publish.yml`)
- Container name: **must be `backend`** — the frontend's nginx proxies `/api/` and `/media/` to `http://backend:8000`.
- Internal port: `8000`
- Environment:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `JWT_EXPIRES_MINUTES`
  - `SEED_ADMIN_NAME`
  - `SEED_ADMIN_EMAIL`
  - `SEED_ADMIN_PASSWORD`
  - `MEDIA_ROOT=/app/uploads`
- Volume:
  - `/mnt/user/appdata/douchebags-open/uploads` -> `/app/uploads`

### frontend

- Image: `ghcr.io/yoloswaglord2/the-douchebags-open-frontend:latest` (published from `main` by `.github/workflows/docker-publish.yml`)
- External port: `8080`
- Internal port: `80`
- No build args required at runtime — the bundled SPA calls `/api` and the container's nginx proxies it to the `backend` container on the shared Docker network. If you want to bake in a different `VITE_API_BASE_URL`, override the build arg locally and push your own tag.

## Networking

All three containers (`postgres`, `backend`, `frontend`) must share a user-defined Docker network so they can resolve each other by container name. On Unraid, create a custom network (e.g. `douchebags`) and attach all three containers to it.

## Pulling private packages

By default GHCR packages are private on first push. Either flip each package to public on github.com (Packages → package → Settings → Change visibility), or run `docker login ghcr.io` on Unraid with a PAT that has `read:packages` before pulling.

## First boot

1. Start `postgres`.
2. Start `backend`.
3. Run the admin seed command inside the backend container:

```bash
python -m app.seeds.seed_admin
```

4. Start `frontend`.

