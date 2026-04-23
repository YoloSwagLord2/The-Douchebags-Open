# The Douchebags Open

Docker-first MVP for golf tournament tracking with a FastAPI backend, React frontend, and PostgreSQL database.

## Structure

- `backend/` FastAPI app, scoring logic, migrations, tests, and seed utilities
- `frontend/` React + Vite SPA optimized for mobile-first play and leaderboard viewing
- `db/` SQL schema snapshot
- `deploy/` Docker and Unraid deployment notes

## Local development

1. Copy `.env.example` to `.env` and update values.
2. Start the stack:

```bash
docker compose up --build
```

3. Seed the first admin:

```bash
docker compose exec backend python -m app.seeds.seed_admin
```

4. Open:

- Frontend: `http://localhost:8080`
- Backend docs via the frontend proxy: `http://localhost:8080/api/docs`

## Verification

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run build
```

Backend:

```bash
python3 -m venv .venv
.venv/bin/pip install -e './backend[dev]'
.venv/bin/python -m pytest backend/tests
```

Schema snapshot:

- `db/schema.sql` is generated from the SQLAlchemy metadata and represents the current PostgreSQL schema shape.

## GitHub

Initialize and push the repo:

```bash
git init
git branch -M main
git remote add origin git@github.com:YoloSwagLord2/The-Douchebags-Open.git
git add .
git commit -m "Launch Docker-first MVP scaffold

Constraint: Local Unraid deployment is the primary target
Confidence: medium
Scope-risk: broad
Directive: Keep golf scoring logic in the backend only
Tested: docker compose config
Not-tested: Full end-to-end runtime until dependencies are installed"
git push -u origin main
```

HTTPS remote alternative:

```bash
git remote add origin https://github.com/YoloSwagLord2/The-Douchebags-Open.git
```
