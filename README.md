# DevBoard

[![CI](https://github.com/riyan-ahmed/devboard/actions/workflows/ci.yml/badge.svg)](https://github.com/riyan-ahmed/devboard/actions/workflows/ci.yml)

A small project and task board (React + Go + Postgres) that I'm taking from
"runs on my laptop" to a production-shaped platform on AWS, one DevOps layer at
a time.

> Based on the DevBoard teaching app by Shubham Londhe (TrainWithShubham).
> The application code comes from there; the platform work in this repo
> (containers, CI/CD, Kubernetes, infrastructure, observability and GitOps) is
> my own, with the decisions and trade-offs written up in [`docs/`](docs/).

## Architecture

```
                     ┌──────────── Docker Compose network ────────────┐
                     │                                                │
browser ──:3000──▶   │  frontend          backend           postgres  │
                     │  nginx       /api  Go + Gin          16-alpine │
                     │  static  ──────▶   :8080   ──────▶   :5432     │
                     │  files                                  │      │
                     └─────────────────────────────────────────┼──────┘
                                                               ▼
                                                     volume: pgdata
```

| Service | Image | Notes |
|---|---|---|
| **frontend** | `nginx-unprivileged:1.31-alpine` | Serves the built React app; proxies `/api/*` to the backend. Non-root. ~73 MB |
| **backend** | `alpine:3.24` + static Go binary | REST API: `/health`, `/projects`, `/tasks`, `/search`. Non-root. 26 MB |
| **postgres** | `postgres:16-alpine` | Schema and seed data from `init/postgres/` load on first start |

Only the frontend is published to the host. The backend and database are
reachable only inside the Compose network.

## Run it locally

**Requires:** Docker (Docker Desktop or OrbStack). Nothing else; no Go, Node
or Postgres needed on your machine.

```bash
cp .env.example .env
docker compose up -d --build
```

Open **http://localhost:3000**.

```bash
docker compose ps           # status and health of each service
docker compose logs -f      # follow the logs
docker compose down         # stop (database data is kept)
docker compose down -v      # stop and reset the database to the seed data
```

### Configuration (`.env`)

| Variable | Default | Used for |
|---|---|---|
| `POSTGRES_USER` | `devboard` | Database user |
| `POSTGRES_PASSWORD` | `devboard` | Database password (demo value only) |
| `POSTGRES_DB` | `devboard` | Database name |
| `FRONTEND_PORT` | `3000` | Port on your machine where the app opens |

## Tests

```bash
cd backend  && go test ./...
cd frontend && npm ci && npm run lint && npm test
```

## Project progress

| # | Phase | Status | Write-up |
|---|---|---|---|
| 1 | Docker: multi-stage images + Compose | ✅ | [docs/phase-1-docker.md](docs/phase-1-docker.md) |
| 2 | GitHub Actions: CI, security scans, push to Docker Hub | ✅ | |
| 3 | Kubernetes on kind | ⬜ | |
| 4 | Terraform: VPC + EKS on AWS | ⬜ | |
| 5 | Ansible: ops server configuration | ⬜ | |
| 6 | Observability: OpenTelemetry, Prometheus, Grafana, Loki, Tempo | ⬜ | |
| 7 | GitOps: Helm + ArgoCD on EKS | ⬜ | |

Full plan and decisions: [ROADMAP.md](ROADMAP.md).

### Phase 1 highlights

- Backend image **34 → 26 MB**; frontend uses nginx instead of Node (Node alone is 194 MB)
- **0 critical / 0 high** CVEs in the backend after finding and updating
  vulnerable Go dependencies (was 9 critical / 9 high)
- Both containers run as **non-root**
- Healthcheck-based start-up order; only one port exposed
