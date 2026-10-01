## My notes

### Result

`docker compose up -d --build` starts the full stack (React + nginx, Go API,
Postgres 16) with one command. Only the frontend is published (port 3000), all
three start in the right order using healthchecks, and data survives
`docker compose down` / `up`.

### Decisions

| Choice | What I picked | Why | Alternative I rejected |
|---|---|---|---|
| Build style | Multi-stage builds for both images | Build tools (Go, Node) stay in the build stage; the final image only has what runs | Single-stage: hundreds of MB of compilers shipped to production |
| Backend final base | `alpine:3.24` | Small, but keeps a shell and `wget` for debugging and healthchecks | distroless: smaller and safer, but no shell or `wget`, so the healthcheck would need another approach |
| Backend binary | `CGO_ENABLED=0`, `-ldflags="-s -w"` | Static binary that needs no system libraries; stripping debug symbols cut the image 23% | Default build: bigger, and may depend on C libraries |
| Frontend server | `nginx-unprivileged:1.31-alpine` | After `npm run build` the app is just static files; nginx serves them and proxies `/api`. Runs as non-root by default | Node + `vite preview` (what the course used): ~120 MB bigger and not meant for production |
| Backend address | `${BACKEND_URL}` in an nginx template, filled in at start-up | The same image works in Compose and later in Kubernetes, where the address is different | Hard-coding `backend:8080` into the image |
| Non-root | Backend runs as `uid 10001`; nginx-unprivileged as `nginx` | If the app is compromised, the attacker isn't root in the container | Running as root (the default) |
| Dependency install | `npm ci` and `go mod download`, with dependency files copied before the source | Exact versions from the lockfile; Docker caches the slow download step when only code changes | `npm install`, which can silently upgrade packages |
| Startup order | `depends_on` + `condition: service_healthy` | "Started" isn't "ready": Postgres needs a few seconds before it accepts connections | Plain `depends_on`, which only waits for the container to start |
| Healthchecks | Postgres: `pg_isready`. Backend: `wget` to `/health` | Checks the service really answers, not just that the process exists | `curl`: not installed in Alpine |
| Database data | Named volume `pgdata` | Data survives container restarts; `down -v` resets it | No volume: data lost every restart |
| Seed data | `init/postgres` mounted to `/docker-entrypoint-initdb.d` | Postgres runs the SQL once, on first start with an empty volume | Loading data by hand |
| Exposed ports | Only the frontend (3000) | Database and API aren't reachable from outside; fewer port clashes | Publishing all three |
| Config | `.env` (gitignored) + committed `.env.example` | Settings in one place, no secrets in Git | Values written into `docker-compose.yml` |

### Numbers

| Image | Size | Critical / High CVEs (Docker Scout) |
|---|---|---|
| backend | 34.4 MB → **26.4 MB** with `-ldflags="-s -w"` | 9C / 9H → **0C / 0H** |
| frontend | ~73 MB (`node:20-alpine` alone is 194 MB) | 3C / 16H → **0C / 1H** (the remaining High has no fix released yet) |

### What broke and how I fixed it

- **Build ran before the code was copied in.** `go build` came before `COPY . .`,
  so the build failed with "no Go files in /app". Dockerfile steps run top to
  bottom; order matters.
- **I pushed a Dockerfile that didn't build.** A typo (`Idflags` instead of
  `-ldflags`) got committed because I didn't check the build succeeded first.
  The image ID hadn't changed, so my checks were testing the old image. Now I
  chain `build && test && commit`, so a failure stops everything. CI will
  enforce this in Phase 2.
- **The vulnerabilities weren't where I expected.** The backend's base image
  was clean, but Scout found 9 critical CVEs in the Go binary itself: old
  versions of Gin and its dependencies, from `go.mod`. Fixed with
  `go get -u ./...`, `go mod tidy`, and re-running the tests.
- **"Pinned" isn't the same as "up to date".** nginx 1.24 was pinned but years
  old, with 3 critical and 16 high CVEs. Pinning stops surprise changes, but it
  means upgrades have to be done on purpose. Upgrading to 1.31 removed all the
  fixable ones.
- **Found a dependency conflict in the original app.** Vite 8 was paired with a
  React plugin that only supported up to Vite 7, so `npm ci` failed. The
  original repo hid this with `--legacy-peer-deps`; I upgraded the plugin
  instead (see `phase-0-starter.md`).
- **Compose YAML indentation.** `build:` and `ports:` were at the same level as
  the service name, so Compose read them as services ("services.ports must be
  a mapping"). Other mistakes were hidden: `depends_on` and `healthcheck`
  inside `environment`, a `curl` healthcheck on the wrong port, and no
  `sslmode=disable` in the database URL. Now I run `docker compose config`
  before every commit.
- **Ports 8080 and 8081 were already taken** by old kind clusters on my
  machine. The app is published on 3000 instead.
- **Ran commands from the wrong folder** ("path ./backend not found"). The
  path given to `docker build` is the build context, relative to where you are.

### What I'd change in a real production setup

- **Secrets:** use a secret manager instead of a `.env` file (Phase 7: AWS
  Secrets Manager).
- **Database:** use a managed service such as Amazon RDS, with backups, rather
  than Postgres in a container.
- **Multi-arch images:** my Mac builds arm64 images; the EKS nodes will be
  amd64. Build both with `docker buildx`.
- **Automated scanning:** scan every image in CI and fail the build on critical
  CVEs, plus Dependabot to keep base images and dependencies updated (Phase 2).
- **Fully pinned images:** pin base images by digest (`@sha256:...`), not just
  by tag, so builds are fully reproducible.
- **TLS:** HTTPS in front of the frontend (Phase 7: cert-manager).
