# Phase 3: Kubernetes on kind

**Goal:** run DevBoard on a local Kubernetes cluster, using the images CI
publishes to Docker Hub, the way it would run in production: self-healing,
health-checked, resource-limited and non-root. Phase 7 moves the same
manifests to EKS.

**Branch:** `phase-3-k8s`

## Key ideas (read first)

| Object | Plain meaning | DevBoard uses it for |
|---|---|---|
| **Pod** | One or more containers running together | Never created directly |
| **Deployment** | Keeps N identical pods running; replaces dead ones; rolls out new versions | backend, frontend |
| **StatefulSet** | Like a Deployment, but each pod keeps a stable name and its own disk | Postgres |
| **Service** | A stable name and IP in front of changing pods (the Compose "service name" idea) | `postgres`, `backend`, `frontend` |
| **ConfigMap** | Non-secret settings, mounted as files or env vars | `BACKEND_URL`, the SQL init scripts |
| **Secret** | Sensitive settings (base64, **not** encrypted by default) | Postgres password |
| **PersistentVolumeClaim** | "I need N GB of disk"; the cluster finds or creates it | Postgres data |
| **Probe** | How Kubernetes checks a container: *readiness* (send it traffic?) and *liveness* (restart it?) | all three |
| **Namespace** | A folder for related objects | `devboard` |

Compose → Kubernetes, roughly: `services:` → Deployment + Service ·
`volumes:` → PVC · `healthcheck:` → probes · `depends_on` → nothing (pods must
retry until their dependencies are ready).

## Tasks

### 0. Prepare the machine

- Decide what to do with the three old kind clusters (`tws-cluster`,
  `self-healing-infra`, `k8s-troubleshoot`). Check their memory use with
  `docker stats --no-stream`. Delete only what you no longer need:
  `kind delete cluster --name <name>` cannot be undone.
- Install tools if missing: `brew install kind kubectl k9s`.

### 1. Create the cluster (`k8s/kind-config.yaml`)

- One control-plane node and one worker node is enough.
- Map one host port into the cluster so the browser can reach the frontend
  later (look up kind's `extraPortMappings`). Avoid 8080 and 8081.
- `kind create cluster --name devboard --config k8s/kind-config.yaml`

### 2. Will your images even run here?

Before writing manifests, check what CI actually published:

```bash
docker manifest inspect riyan0/devboard-backend:latest
kubectl get nodes -o wide
```

Compare the image's **architecture** with your nodes' architecture (your Mac
is an M3). If they don't match, you've found a real problem. Fix it at the
source: make CI build both architectures (`docker/setup-qemu-action`,
`platforms:` on build-push-action). This was a Phase 2 stretch goal; now it's
required.

<details><summary>Hints</summary>

- `uname -m` inside a kind node: `docker exec devboard-control-plane uname -m`.
- GitHub's `ubuntu-latest` runners are amd64.
- A multi-arch image is an *index* that lists one image per platform. The
  `docker manifest inspect` output shows whether yours is one.

</details>

### 3. Postgres (`k8s/postgres.yaml`)

- Namespace `devboard`.
- A **Secret** with the user, password and database name.
- A **ConfigMap** holding `01_schema.sql` and `02_seed.sql`, mounted at
  `/docker-entrypoint-initdb.d`.
- A **StatefulSet** (1 replica) with a `volumeClaimTemplates` entry (1Gi),
  a readiness probe using `pg_isready`, and resource requests and limits.
- A **Service** named `postgres` on port 5432.

<details><summary>Hints</summary>

- `kubectl create configmap ... --from-file=init/postgres --dry-run=client -o yaml`
  generates the ConfigMap YAML for you.
- Postgres refuses to start if its data directory contains anything else,
  and some volume types add a `lost+found` folder. Look up `PGDATA`.

</details>

### 4. Backend (`k8s/backend.yaml`)

- **Deployment**, 2 replicas, image pinned to a `sha-…` tag (not `latest`).
- `POSTGRES_URL` built from the Secret, never written in plain text.
- **Readiness and liveness probes** on `/health`.
- **Resource requests and limits** for CPU and memory.
- **securityContext:** `runAsNonRoot: true`, `allowPrivilegeEscalation: false`,
  `readOnlyRootFilesystem: true`, drop all capabilities. Your numeric
  `USER 10001:10001` from Phase 2 is what makes `runAsNonRoot` pass.
- **Service** named `backend` on port 8080.

### 5. Frontend (`k8s/frontend.yaml`)

- **Deployment**, 2 replicas, `BACKEND_URL=backend:8080` from a ConfigMap.
- Probes, resources and the same securityContext. nginx needs somewhere to
  write when the root filesystem is read-only: look at which paths fail in
  the logs and mount `emptyDir` volumes there.
- **Service** reachable from your browser through the port you mapped in Task 1.

### 6. Prove it behaves like production

Run each of these and write down what happened:

- `kubectl delete pod <a backend pod>` → a new one appears.
- `kubectl rollout restart deployment/backend` → no downtime in the browser.
- Change the backend image to a tag that doesn't exist → `ImagePullBackOff`;
  then `kubectl rollout undo deployment/backend`.
- Delete the Postgres pod → it comes back with your data (create a task first).
- Break the readiness probe path → the pod stays *not ready* and gets no traffic.

### 7. Stretch goals

- **Kustomize:** a `k8s/kustomization.yaml` so one `kubectl apply -k k8s/`
  deploys everything.
- **HorizontalPodAutoscaler** for the frontend (needs metrics-server on kind).
- **NetworkPolicy:** only the backend may talk to Postgres.
- **Gateway API** instead of a NodePort, as a preview of Phase 7.
- **CI check:** validate manifests in GitHub Actions with `kubeconform`.

## Done when

- [ ] `kubectl get pods -n devboard` shows every pod `Running` and `READY`
- [ ] The board opens in your browser and shows the seed data
- [ ] Images run on the cluster's architecture (multi-arch from CI)
- [ ] No passwords in any committed file except as a clearly marked local-only demo Secret
- [ ] Every container has probes, resource limits and runs as non-root
- [ ] Every experiment in Task 6 done, with what you saw written down

## Questions to be ready for

- Deployment vs StatefulSet: when and why?
- Readiness vs liveness probe: what happens when each fails?
- How does the backend find Postgres inside the cluster? (Service DNS)
- Requests vs limits: what happens when a container goes over its memory limit?
- Why is a Kubernetes Secret not actually secret by default? What would you use instead?
- What does `ImagePullBackOff` mean, and how do you debug it?
- What happens to Postgres data when its pod is deleted? When its PVC is deleted?
- Why pin images by SHA tag in manifests?

---

## My notes

**Decisions**

| Choice | What I picked | Why | Alternative I rejected |
|---|---|---|---|
| Postgres workload | | | |
| How the browser reaches the app | | | |
| Image tags in manifests | | | |

**What broke and how I fixed it**

-

**What I'd change in a real production setup**

-
