# DevBoard

A small project and task board (React + Go + Postgres) that I'm taking from
"runs on my laptop" to a production-shaped platform on AWS, one DevOps layer at
a time.

> Based on the DevBoard teaching app by Shubham Londhe (TrainWithShubham).
> The application code comes from there; the platform work in this repo
> (containers, CI/CD, Kubernetes, infrastructure, observability and GitOps) is
> my own, with the decisions and trade-offs written up in [`docs/`](docs/).

## Architecture (today)

```
browser ─▶ frontend (React, Vite)  ─/api─▶  backend (Go, Gin)  ─▶  Postgres 16
            :5173                           :8080                  :5432
```

- **frontend/** — React 18 + Vite + Tailwind. Proxies `/api/*` to the backend.
- **backend/** — Go REST API: `/health`, `/projects`, `/tasks`, `/search`.
- **init/postgres/** — schema and seed data, loaded into a fresh database.

This diagram will grow with each phase. See [`ROADMAP.md`](ROADMAP.md).

## Run it locally (no containers yet)

This is the "before" state: every piece runs directly on the host. Setting it up
by hand is deliberate. It's the pain Phase 1 removes.

**Requirements (macOS):** `brew install go node postgresql@16`

```bash
# 1. Database
brew services start postgresql@16
createuser -s devboard 2>/dev/null; psql postgres -c "ALTER USER devboard PASSWORD 'devboard';"
createdb -O devboard devboard
psql -U devboard -d devboard -f init/postgres/01_schema.sql
psql -U devboard -d devboard -f init/postgres/02_seed.sql

# 2. Backend (terminal 1)
cd backend && go run .

# 3. Frontend (terminal 2)
cd frontend && npm ci && npm run dev
```

Open http://localhost:5173.

### Configuration

| Variable | Used by | Default |
|---|---|---|
| `POSTGRES_URL` | backend | `postgres://devboard:devboard@localhost:5432/devboard?sslmode=disable` |
| `PORT` | backend | `8080` |

### Tests

```bash
cd backend  && go test ./...
cd frontend && npm run lint && npm test
```
