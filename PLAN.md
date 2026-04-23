# Final MVP Plan: The Douchebags Open

## Summary
- Build a Docker-first monorepo for local Unraid deployment with `frontend/` (React + Vite + TypeScript), `backend/` (FastAPI), `db/` (PostgreSQL + Alembic), and `deploy/` (Docker/Unraid docs).
- Keep all golf logic in the backend: handicap conversion, net strokes, official Stableford, hidden bonus rules, public achievement rules, leaderboard ranking, and re-evaluation after score edits.
- Make the app mobile-first and visually inspired by [theopen.com/leaderboard](https://www.theopen.com/leaderboard), but not a brand clone; use your own theme tokens, assets, and typography so the UI stays tweakable.
- Deliver the repo ready to push to `YoloSwagLord2/The-Douchebags-Open`.
- During implementation, do not invent missing behavior. If a needed rule or UX detail is unclear, stop that slice and ask for specification before coding it.

## Architecture and Repo Shape
- Use three runtime containers only: `frontend`, `backend`, and `postgres`.
- Serve the built frontend from Nginx; keep backend and Postgres on the internal Docker network; expose the frontend on the LAN.
- Persist database data and uploaded media on mounted volumes suitable for Unraid appdata storage.
- Include `compose.yaml`, `.env.example`, backend/frontend Dockerfiles, and `deploy/unraid/README.md`.
- Document Unraid manual container mapping because current Unraid docs say Docker Compose is not natively supported: [Overview](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/overview/), [Managing containers](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/).
- Initialize Git locally with a clean `.gitignore`, `README.md`, and remote setup instructions for `git@github.com:YoloSwagLord2/The-Douchebags-Open.git` and `https://github.com/YoloSwagLord2/The-Douchebags-Open.git`.

## Data Model and Core Rules
- Core tables: `users`, `courses`, `holes`, `tournaments`, `rounds`, `tournament_players`, `scores`, `score_revisions`, `bonus_rules`, `bonus_awards`, `achievement_rules`, `achievement_events`, `notifications`, `notification_recipients`.
- `users` stores player/admin identity, password hash, handicap, role, active state, and player photo paths for original, avatar, and feature variants.
- `scores` stores the current authoritative round score per player/hole; `score_revisions` is the append-only event log used for bonus/achievement recomputation.
- `bonus_rules` define hidden side-game rules with scope (`round` or `tournament`), positive integer points, winner message, condition JSON, animation preset, and optional Lottie URL.
- `bonus_awards` stores the active or revoked winning award for each hidden bonus rule; only one active award may exist per rule.
- `achievement_rules` define public exceptional-event rules using the same condition engine but with visible title/message/icon outcomes.
- `achievement_events` stores triggered public events and allows repeated occurrences for the same player/rule when the rule qualifies multiple times.
- `notifications` stores inbox messages; `notification_recipients` tracks per-user read state, popup state, and dismissal state.
- Handicap formula is `round(hcp * (slope_rating / 113) + (course_rating - course_par))`, then 100% allowance and clamp to `>= 0`.
- Allocate handicap strokes by stroke index across the course hole count; plus handicaps are out of scope for MVP.
- Official Stableford is standard net Stableford and remains the official ranking basis.
- Official leaderboard sorts by `official_stableford desc`, then `net_strokes asc`, then `gross_strokes asc`; bonus leaderboard sorts by `bonus_adjusted_stableford desc`, then `official_stableford desc`, then `net_strokes asc`, then `gross_strokes asc`.
- Tournament roster controls eligibility; rounds inherit the roster.
- Players may edit their own scores until an admin locks the round; admins may still correct scores after lock.
- Hidden bonus rules stay secret until won; all players can see bonus totals and bonus-adjusted standings, but only admins and the winner can see the winning rule’s details/message.
- Hidden bonus rules may be edited at any time; on score changes or rule changes, the backend replays `score_revisions` chronologically and reassigns the active winner to the earliest qualifying saved event under the current rule.
- Public achievement rules reuse the same safe JSON condition engine, but create visible achievements plus notifications instead of points; they may trigger on every qualifying occurrence.

## Rule Engine and Media Rules
- Use a structured no-code JSON rule engine only; no raw formulas, no eval, no user scripting.
- Support nested `and`/`or` groups with leaf operators `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, and `in`.
- Supported rule fields are current-hole values and running aggregates only: `strokes`, `par`, `stroke_index`, `hole_number`, `distance`, `gross_to_par`, `net_to_par`, `round_holes_played`, `round_total_strokes`, `round_net_strokes`, `round_stableford`, and tournament aggregate counterparts.
- Bonus rules use animation preset plus optional `animation_lottie_url`; the frontend prefers the custom Lottie animation when present.
- Admins may upload one player photo; backend generates at least original, square avatar, and larger featured portrait variants.
- Leaderboards show avatars in every row and a larger feature image for the current number 1 player; if no photo exists, use a branded initials fallback.

## API and Public Interfaces
- Auth endpoints: `POST /auth/login`, `GET /auth/me`.
- Player scoring endpoints: `GET /rounds/{round_id}/scorecard/me`, `PUT /rounds/{round_id}/scorecard/me`.
- Leaderboard endpoints: `GET /leaderboards/rounds/{round_id}`, `GET /leaderboards/tournaments/{tournament_id}`.
- Player history endpoints: `GET /players/me/bonus-awards`, `GET /players/me/achievements`.
- Notification endpoints: `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.
- Admin player endpoints: `GET /admin/players`, `POST /admin/players`, `PATCH /admin/players/{id}`, `POST /admin/players/{id}/photo`, `DELETE /admin/players/{id}/photo`.
- Admin course endpoints: `GET|POST|PATCH|DELETE /admin/courses`, `PUT /admin/courses/{id}/holes`.
- Admin tournament/round endpoints: `GET|POST|PATCH|DELETE /admin/tournaments`, `PUT /admin/tournaments/{id}/players`, `GET|POST|PATCH|DELETE /admin/rounds`, `POST /admin/rounds/{id}/lock`, `PUT /admin/rounds/{id}/players/{player_id}/scorecard`.
- Admin rule endpoints: `GET|POST|PATCH|DELETE /admin/bonus-rules`, `GET|POST|PATCH|DELETE /admin/achievement-rules`.
- Admin notification endpoints: `GET /admin/notifications`, `POST /admin/notifications`.
- Score-save responses must include authoritative recalculated totals plus `newly_unlocked_bonuses[]`, `new_achievements[]`, and `new_notifications[]` for immediate UI popups.

## Frontend UX and Screen Structure
- Player routes: `/login`, `/leaderboard/tournament/:id`, `/leaderboard/round/:id`, `/round/:id/entry`, `/me/bonuses`, `/me/achievements`, `/notifications`.
- Admin routes: `/admin/players`, `/admin/courses`, `/admin/tournaments`, `/admin/rounds`, `/admin/bonus-rules`, `/admin/achievement-rules`, `/admin/notifications`.
- Build the whole app around phone-first use: large tap targets, sticky primary actions, dense but readable leaderboard rows, keyboard-safe number entry, and no hover-only interactions.
- Mimic the reference site’s feel with a dark editorial masthead, strong hierarchy, premium imagery, dense data rows, segmented leaderboard tabs, and restrained gold accents.
- Keep player-facing screens visually richer; keep admin surfaces simpler but within the same theme family.
- Score entry is one-hole-at-a-time by default with large stroke controls and a sticky save/next bar.
- Hidden bonus unlocks show a fullscreen celebration modal with the configured message and animation.
- Achievement triggers show a smaller in-app popup and are also stored in the user’s inbox/history.
- Notification center is an in-app inbox with unread state and active-session popups.
- Frontend uses polling for unread count and new notifications; no WebSockets in MVP.

## Implementation Sequence
- Phase 1: create repo skeleton, Dockerfiles, `compose.yaml`, root docs, environment template, backend and frontend scaffolds, and Unraid deployment docs.
- Phase 2: implement backend foundations first: models, migrations, auth, role guards, admin seed command, media storage plumbing, and base admin CRUD for courses/tournaments/rounds/players.
- Phase 3: implement scoring pipeline: roster enforcement, score upsert, `score_revisions`, handicap math, Stableford calculation, round/tournament leaderboards, and round lock behavior.
- Phase 4: implement player-facing UI: login, score entry, official leaderboard, bonus leaderboard, avatars, featured leader, and player history views.
- Phase 5: implement hidden bonus rules, celebration modal, animation handling, achievement rules, notification center, admin message composer, and player photo upload flow.
- Phase 6: polish mobile UX, finish docs, wire Docker startup, verify GitHub-ready state, and tighten error handling.

## Test Plan
- Unit-test handicap formula, stroke allocation, Stableford mapping, official/bonus sorting, rule-engine validation, bonus reassignment, achievement occurrence handling, and image variant generation.
- API-test auth, role guards, roster enforcement, player edits before/after lock, admin score override, live leaderboard totals, bonus unlock payloads, achievement trigger payloads, notification fanout, and photo upload/retrieval.
- UI smoke-test phone-sized login, score entry, official/bonus leaderboard switching, featured leader photo, bonus celebration modal, achievement popup, inbox flow, player photo upload, bonus-rule builder, achievement-rule builder, and admin notification composer.
- Deployment-test Docker builds, compose startup, migrations, seed-admin command, media persistence, and clean startup from an empty database.

## Assumptions and Defaults
- LAN-only MVP.
- Admin-created accounts only; admins manage password set/reset.
- Responsive web app only; no PWA/offline sync.
- In-app notifications only; no email, SMS, or browser push.
- Polling is the notification/update mechanism for MVP.
- Photos are optional and fall back to initials.
- Public achievements do not award points.
- Any requirement not explicitly fixed in this plan must be clarified before implementation if that slice depends on it.
