# Phase 2: GitHub Actions (CI)

**Goal:** every push and pull request is checked automatically. Broken code,
a broken Dockerfile or a critical vulnerability can't reach `main`, and every
merge to `main` publishes tested images to Docker Hub.

In Phase 1 you checked builds by hand, and a broken Dockerfile still got
pushed. This phase makes GitHub do those checks for you, every time.

**Branch:** `phase-2-ci`

## Key ideas (read first)

| Term | Plain meaning |
|---|---|
| **Workflow** | A YAML file in `.github/workflows/` that tells GitHub what to run |
| **Trigger** (`on:`) | When it runs: on a push, on a pull request, on a schedule… |
| **Job** | A group of steps that runs on one fresh virtual machine ("runner") |
| **Step** | One command (`run:`) or one ready-made action (`uses:`) |
| **Action** | A reusable step someone published, e.g. `actions/checkout` |
| **Secret** | A password or token stored in GitHub settings, never in the code |

Jobs run **in parallel** unless you say one `needs:` another.

## Tasks

### 1. Test the app code (`.github/workflows/ci.yml`)

Runs on every **pull request** and every **push to `main`**.

- **backend job:** set up Go, then `go vet ./...` and `go test ./...`
- **frontend job:** set up Node 22, then `npm ci`, `npm run lint`, `npm test`

<details><summary>Hints</summary>

- `actions/checkout`, `actions/setup-go` and `actions/setup-node` do the setup.
- `setup-go` can read the Go version from `backend/go.mod`
  (`go-version-file`), so the version is defined in one place.
- Commands run from the repo root. Use `working-directory: backend` on a step,
  or `defaults.run.working-directory` on the job.
- Both setup actions can cache dependencies. Find the option and use it.

</details>

### 2. Build and scan the images

- A job that builds both Docker images, after the tests pass (`needs:`).
- Lint each Dockerfile with **hadolint**.
- Scan each image with **Trivy**. The job must **fail on CRITICAL**
  vulnerabilities that have a fix available.

<details><summary>Hints</summary>

- A **matrix** lets one job definition run once per image
  (`backend`, `frontend`) instead of copy-pasting it.
- `docker/build-push-action` with `load: true` builds without pushing, so
  Trivy can scan the local image.
- Look at Trivy's `exit-code`, `severity` and `ignore-unfixed` options.

</details>

### 3. Push to Docker Hub, only from `main`

- On a push to `main` (not on pull requests), push both images to
  `riyan0/devboard-backend` and `riyan0/devboard-frontend`.
- Tag each image with the **short commit SHA** (e.g. `sha-82dce86`), and also
  `latest`.
- Log in with a Docker Hub **access token** stored as GitHub secrets
  (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`), never your password.

<details><summary>Hints</summary>

- Create the token at Docker Hub → Account settings → Personal access tokens,
  with Read & Write permission only.
- Add secrets at GitHub repo → Settings → Secrets and variables → Actions.
- `docker/metadata-action` generates SHA tags for you.
- An `if:` condition on a step can check `github.event_name` and `github.ref`.

</details>

### 4. Protect `main`

- GitHub → Settings → Branches (or Rules) → require a pull request, and require
  your CI checks to pass before merging.
- Test it: open a PR with a deliberately failing test. The merge button should
  be blocked. Then fix it.

### 5. Keep dependencies updated (`.github/dependabot.yml`)

Weekly Dependabot updates for: Go modules (`/backend`), npm (`/frontend`),
Docker base images (`/backend`, `/frontend`) and GitHub Actions (`/`).

### 6. Stretch goals

- **Compose smoke test:** in CI, run `docker compose up -d --wait`, then
  `curl` the frontend and `/api/projects`. This proves the images work
  *together*, not just build.
- **Multi-arch images:** build `linux/amd64` and `linux/arm64` with
  `docker/setup-buildx-action` and `docker/setup-qemu-action`. You'll need
  amd64 for EKS in Phase 4.
- **Build cache:** `cache-from: type=gha` / `cache-to: type=gha` to make
  Docker builds faster. Record the before and after times.
- **Pin actions by commit SHA** instead of version tags, and explain why.

## Done when

- [ ] A PR shows green checks for: backend tests, frontend tests, image build + scan
- [ ] A PR with a failing test **cannot** be merged
- [ ] Merging to `main` pushes both images to Docker Hub with a `sha-…` tag
- [ ] No passwords or tokens anywhere in the repo
- [ ] Dependabot opens its first PRs
- [ ] A README badge shows the CI status

## Questions to be ready for

- What's the difference between CI and CD? Which parts of this phase are which?
- Why run tests on pull requests, but only push images from `main`?
- Why tag images with the commit SHA instead of only `latest`?
- Where do secrets live, and how do you stop them leaking into logs?
- A scan finds a critical CVE with no fix available. What do you do?
- How would you make a slow pipeline faster?
- Why pin actions to a SHA? What's the supply-chain risk?

---

## My notes

**Decisions**

| Choice | What I picked | Why | Alternative I rejected |
|---|---|---|---|
| Scanner | | | |
| Image tags | | | |
| When to push | | | |

**Numbers**

| Metric | Value |
|---|---|
| Pipeline time (first run) | |
| Pipeline time (with caching) | |

**What broke and how I fixed it**

-

**What I'd change in a real production setup**

-
