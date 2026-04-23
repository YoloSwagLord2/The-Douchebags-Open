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

- Build from this repo's `backend/` directory or push a built image to your registry.
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

- Build from this repo's `frontend/` directory or push a built image to your registry.
- External port: `8080`
- Internal port: `80`
- Build args:
  - `VITE_API_BASE_URL`
  - `VITE_NOTIFICATION_POLL_INTERVAL_MS`

## First boot

1. Start `postgres`.
2. Start `backend`.
3. Run the admin seed command inside the backend container:

```bash
python -m app.seeds.seed_admin
```

4. Start `frontend`.

