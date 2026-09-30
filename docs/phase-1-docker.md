# Phase 1: Docker

**Goal:** anyone can clone the repo and run the whole stack with one command,
with no Go, Node or Postgres installed on their machine. The images you build
here are the same ones CI will push and Kubernetes will run later, so build
them as if they're going to production.

**Branch:** `phase-1-docker`

## Setup

Install a container runtime on the Mac: **Docker Desktop** or **OrbStack**
(lighter on an M3). Check with `docker version` and `docker compose version`.

## Tasks

### 1. Backend image (`backend/Dockerfile`)

- Multi-stage: build the Go binary in one stage, run it in a minimal final stage.
- The final image runs as a **non-root** user.
- Base images are pinned to a specific version, not `latest`.
- A `backend/.dockerignore` keeps unneeded files out of the build context.
- **Target:** final image under 30 MB.

<details><summary>Hints (open only if stuck)</summary>

- Look up `CGO_ENABLED=0` and why it matters for the final stage you pick.
- Compare `alpine`, `distroless/static` and `scratch` as final stages. What does
  each give you, and what does each take away (a shell for debugging, CA certs)?
- Order your `COPY` lines so dependency downloads are cached when only
  `main.go` changes.

</details>

### 2. Frontend image (`frontend/Dockerfile`)

- Multi-stage: build the static site with Node, then serve it from a small
  runtime image.
- The served app must still forward `/api/*` to the backend, with the `/api`
  prefix stripped.
- The backend address must be **configurable**. Right now `vite.config.js`
  hard-codes `localhost:8080`, which is wrong inside a container, and will be
  wrong again in Kubernetes.
- Non-root, pinned versions, `.dockerignore`.

**Decide and justify:** how will you serve the built files? The original project
kept Node and `vite preview` in the final image. Compare that with nginx (or
another static server) on image size, attack surface, and whether it's meant
for production.

<details><summary>Hints</summary>

- `npm run build` outputs static files to `dist/`. After that, the final image
  doesn't need Node at all unless you choose to keep it.
- If you choose nginx: look up `proxy_pass` with a trailing slash, and how the
  official nginx image can fill in environment variables in config templates.
- Unprivileged nginx can't listen on port 80. Why not, and what's the usual fix?

</details>

### 3. Compose (`docker-compose.yml`)

- Three services: `postgres`, `backend`, `frontend`.
- Postgres data is kept in a **named volume**, and schema and seed data load
  automatically on first start.
- **Healthchecks** on postgres and backend. The backend waits until Postgres is
  *healthy*, not merely *started*.
- All settings come from `.env`. Commit a `.env.example`; `.env` stays gitignored.
- Only the frontend is published to your host. Postgres and the backend are
  reachable only inside the Compose network.

<details><summary>Hints</summary>

- `depends_on` has a long form with a `condition` key.
- Postgres ships with `pg_isready`. What will you use for the backend's
  healthcheck if your final image has no shell or `curl`?
- The seed scripts only run when the data directory is empty. How do you reset
  the database?

</details>

### 4. Stretch goals (all strong interview material)

- **Multi-arch images.** Your M3 builds `arm64` images. The EKS nodes in Phase 4
  will be `amd64`. Find out what happens when you run an arm64 image on amd64,
  then build both with `docker buildx`.
- **Scan your images** with Trivy or Docker Scout. Record the vulnerability
  counts before and after your base-image choices.
- **A Makefile** with `up`, `down`, `logs` and `reset-db` targets.

## Done when

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps                       # all three healthy
open http://localhost:<your frontend port>   # board loads with seed data
curl localhost:5432                     # fails: Postgres is not published
docker compose down && docker compose up -d   # data survives the restart
docker image ls | grep devboard         # backend < 30 MB
docker run --rm --entrypoint id <backend image>   # not uid 0 (or explain why this fails)
```

## Questions to be ready for

- Why multi-stage builds? What do they change about the final image?
- Your image runs as non-root. What does that protect against?
- What's the difference between `depends_on` and a healthcheck condition?
- `CMD` vs `ENTRYPOINT`? Shell form vs exec form, and how does that affect
  signals and graceful shutdown?
- How does the frontend container find the backend? What would change in
  Kubernetes?
- Named volume vs bind mount? Where does Postgres data actually live?
- How would you make builds faster in CI? (layer caching, `.dockerignore`)

---

## My notes

*Fill this in as you go. Short and honest beats long and polished.*

**Decisions**

| Choice | What I picked | Why | Alternative I rejected |
|---|---|---|---|
| Backend final base | | | |
| Frontend server | | | |
| Backend healthcheck method | | | |

**Numbers**

| Image | Size | Vulnerabilities (critical/high) |
|---|---|---|
| backend | | |
| frontend | | |

**What broke and how I fixed it**

-

**What I'd change in a real production setup**

-
