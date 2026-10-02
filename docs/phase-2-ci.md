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

### Result

Every pull request runs four checks in parallel stages (about 75 seconds in
total): backend tests, frontend tests, and a lint + build + vulnerability scan
for each image. Merging to `main` publishes both images to Docker Hub
(`riyan0/devboard-backend`, `riyan0/devboard-frontend`), tagged with the commit
SHA. `main` is protected, so nothing can be merged unless every check passes.

```
pull request ─▶ backend  (go vet, go test)     ─┐
             └▶ frontend (npm ci, lint, test)   ─┴▶ images [backend, frontend]
                                                    hadolint → build → Trivy scan
                                                    └▶ main only: push :sha-xxxxxxx + :latest
```

### Decisions

| Choice | What I picked | Why | Alternative I rejected |
|---|---|---|---|
| Pipeline shape | Test jobs first, then image jobs with `needs:` | No point building images if the tests fail; test jobs run in parallel | One long job: slower, and one failure hides the others |
| One job for both images | A `matrix` over `[backend, frontend]` with `fail-fast: false` | One definition instead of two copies; one image failing still lets the other finish, so I see every problem in one run | Two copy-pasted jobs |
| Go version in CI | `go-version-file: backend/go.mod` | One source of truth; CI can't drift from the code | Hard-coding a version (I first wrote 1.21, which couldn't build the 1.26 module) |
| Dependency caching | `setup-go` / `setup-node` cache keyed on `go.sum` / `package-lock.json`; Docker layers in the GitHub Actions cache | Faster runs; the cache refreshes automatically when the lockfile changes | No caching: every run downloads everything again |
| Dockerfile linting | hadolint, failing on any finding | Catches Dockerfile mistakes before they ship; it found two real issues | Lowering the threshold to make it pass |
| Vulnerability scanner | Trivy: fail on fixable CRITICAL/HIGH (`ignore-unfixed: true`) | Blocks what I can fix; doesn't block every merge on CVEs nobody can fix yet | Failing on everything (blocks all work) or reporting only (nothing enforced) |
| When to push images | Only on push to `main` (`if:` on the login and push steps) | PRs are untested code and shouldn't get registry credentials or publish anything | Pushing from every branch |
| Image tags | `sha-<commit>` plus `latest` | The SHA tag says exactly which code is running and makes rollbacks precise; ArgoCD will deploy by SHA in Phase 7 | `latest` only: you can't tell what's deployed |
| Registry credentials | Docker Hub **access token** in GitHub encrypted secrets | Limited to push/pull, revocable on its own, masked in logs | My account password |
| Branch protection | Ruleset on `main`: PR required, all four checks required, no force pushes, no deletion, 0 approvals | Turns CI from a warning into a gate. 0 approvals because I work alone and can't approve my own PRs | No protection: red PRs could still be merged |
| Dependency updates | Dependabot weekly for Go modules, npm (minor/patch grouped), Docker base images and GitHub Actions | Updates arrive as PRs and go through the same CI; would have caught the 9 Go CVEs and the old nginx automatically | Manual upgrades when I remember |

### Numbers

| Metric | Value |
|---|---|
| Full pipeline on a pull request | ~75 s |
| backend tests / frontend tests | 19 s / 13 s |
| images: backend / frontend (lint, build, scan) | 24 s / 48 s |
| Real problems CI caught on its first day | 3 (below) |

### What broke and how I fixed it

- **hadolint DL3021.** `COPY go.mod go.sum .` has several sources, so the
  destination must end in `/`. Docker accepted it, hadolint didn't. Fixed to `./`.
- **hadolint DL3066: user names instead of numbers.** `USER app` and
  `USER root` became `USER 10001:10001` and `USER 0`. This matters for
  Kubernetes: `runAsNonRoot` can only verify a numeric user, so the named
  version would have been rejected in Phase 3.
- **A new HIGH CVE after my Phase 1 scan.** Trivy failed the frontend on
  CVE-2026-103111 in `pcre2` (10.48, the regex library nginx uses). Alpine had
  released 10.49, but the `nginx-unprivileged:1.31-alpine` image hadn't been
  rebuilt yet. I upgraded that one package in the final stage
  (`USER 0` → `apk upgrade --no-cache pcre2` → `USER 101`) with a comment to
  remove it once the base image includes the fix. New CVEs appear every day,
  which is why scanning belongs in CI and not only on a laptop.
- **Workflow structure.** My first workflow had `jobs:` inside the trigger
  section, so GitHub saw no jobs. I now run `actionlint` before every commit,
  like `docker compose config` in Phase 1.
- **Merge conflict after a squash merge.** Squash-merging created a new commit
  on `main` with the same content as my branch's original commit, so Git saw
  two different commits that both created `ci.yml`. Fixed with
  `git rebase --onto origin/main <old commit>` and `git push --force-with-lease`.
  Since then I start every new piece of work from a fresh `main`.
- **GitHub CLI couldn't open a PR.** Its token lacked the pull-request
  permission: least privilege working as intended. Opened the PR in the browser.

### What I'd change in a real production setup

- **Pin actions to commit SHAs** instead of version tags, so a compromised
  action tag can't change what runs in my pipeline (supply-chain risk).
- **Sign images and generate an SBOM** (cosign, `provenance`/`sbom` in
  build-push-action), and verify signatures before deploying.
- **Multi-arch images** (amd64 + arm64): needed for EKS in Phase 4.
- **A Compose smoke test in CI**: start the stack and call `/api/projects`, to
  prove the images work together, not just build.
- **Short-lived credentials** (OIDC) instead of a long-lived Docker Hub token,
  once pushing to a registry that supports it (e.g. Amazon ECR).
- **Require at least one reviewer** on a real team.
