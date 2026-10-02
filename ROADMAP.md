# Roadmap

One branch and one pull request per phase. Each phase is finished when its
"done when" checklist passes **and** its notes are written in `docs/`.

| # | Phase | Runs on | Branch | Status |
|---|---|---|---|---|
| 0 | Starter: app code only | laptop | `main` | ✅ |
| 1 | Docker: images + Compose | laptop | `phase-1-docker` | ✅ |
| 2 | GitHub Actions: CI, security scans, push to Docker Hub | GitHub | `phase-2-ci` | ✅ |
| 3 | Kubernetes: raw manifests | kind (local) | `phase-3-k8s` | ⬜ |
| 3b | AI service: Python + small Ollama model | kind (local) | `phase-3b-ai` | ⬜ |
| 4 | Terraform: VPC + EKS + remote state | AWS `eu-west-2` | `phase-4-terraform` | ⬜ |
| 5 | Ansible: ops box (bastion + CI runner), roles, vault, dynamic inventory | AWS EC2 | `phase-5-ansible` | ⬜ |
| 6 | Observability: OpenTelemetry, Prometheus, Grafana, Loki, Tempo | kind (local) | `phase-6-observability` | ⬜ |
| 7 | GitOps: Helm chart, ArgoCD, Gateway API, External Secrets; everything on EKS | AWS `eu-west-2` | `phase-7-gitops` | ⬜ |

## Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Local Kubernetes | kind | Cheap, fast to recreate; AWS only when the phase needs it |
| AWS region | `eu-west-2` (London) | Closest to me |
| Image registry | Docker Hub (`riyan0/…`) | Free, widely known |
| AI assistant | Kept, with a small model (≈0.5B) | Adds a 3rd language and a real observability story, fits in kind |
| Ansible scope | Ops box configured after Terraform creates it | A realistic Terraform-then-Ansible handoff, instead of just a tool installer |

## Cost rule for AWS phases

Run `terraform destroy` at the end of every AWS session. EKS plus NAT plus a
load balancer costs roughly $8–12 a day if left running.

## How each phase works

1. Read the brief in `docs/phase-N-*.md`.
2. Build it yourself. Ask for hints, not answers.
3. Get a review, fix what comes up.
4. Fill in **My notes** at the bottom of the brief: decisions, numbers, what
   broke, and what you'd change. This becomes your interview material.
5. Open a PR, merge, tick the row above.
