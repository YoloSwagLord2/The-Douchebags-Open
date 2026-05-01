# Unraid Deployment Notes

Unraid's current documentation says Docker Compose is not natively supported, so the canonical setup mirrors the `compose.yaml` services as individual Unraid containers. There are two: a Postgres database and a single combined `app` container that serves both the API and the built SPA.

- Overview: https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/overview/
- Managing containers: https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/

## Containers

### postgres

- Image: `postgres:16-alpine`
- Container name: **must be `postgres`** — the `app` container's `DATABASE_URL` resolves it by name on the shared Docker network.
- Environment:
  - `POSTGRES_DB`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
- Volume:
  - `/mnt/user/appdata/douchebags-open/postgres` -> `/var/lib/postgresql/data`

### app

- Image: `ghcr.io/yoloswaglord2/the-douchebags-open:latest` (published from `main` by `.github/workflows/docker-publish.yml`)
- External port: `8000` (or whatever you want to expose)
- Internal port: `8000`
- Environment:
  - `DATABASE_URL=postgresql+psycopg://<user>:<pass>@postgres:5432/<db>`
  - `JWT_SECRET`
  - `JWT_EXPIRES_MINUTES`
  - `SEED_ADMIN_NAME`
  - `SEED_ADMIN_EMAIL`
  - `SEED_ADMIN_PASSWORD`
  - `MEDIA_ROOT=/app/uploads`
- Volume:
  - `/mnt/user/appdata/douchebags-open/uploads` -> `/app/uploads`

The container serves the React SPA at `/` and the JSON API at `/api/*`. Uploaded media is served at `/media/*`.

`DATABASE_URL` must use the exact same values as the Postgres container's `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. For example, if Postgres has `POSTGRES_USER=douchebags`, `POSTGRES_PASSWORD=change-me`, and `POSTGRES_DB=douchebags_open`, set the app to `DATABASE_URL=postgresql+psycopg://douchebags:change-me@postgres:5432/douchebags_open`.

If the app logs show a migration failure against `localhost:5432`, the app container is missing `DATABASE_URL` or it points at itself. Set it to the Postgres container name, for example `postgresql+psycopg://douchebags:change-me@postgres:5432/douchebags_open`.

If the app logs show `password authentication failed for user "postgres"`, it is still using the image fallback credentials. Add or fix the app container's `DATABASE_URL` so it matches your Postgres container.

## Networking

Both containers must share a user-defined Docker network so the `app` container can resolve `postgres` by name. On Unraid, create a custom network (e.g. `douchebags`) and attach both containers to it.

## Pulling private packages

By default GHCR packages are private on first push. Either flip the package to public on github.com (Packages → `the-douchebags-open` → Settings → Change visibility), or run `docker login ghcr.io` on Unraid with a PAT that has `read:packages` before pulling.

## First boot

1. Start `postgres`.
2. Start `app` (the entrypoint runs `alembic upgrade head` automatically).
3. Run the admin seed command inside the app container:

```bash
python -m app.seeds.seed_admin
```

4. Visit `http://<unraid-ip>:8000/` in a browser.
