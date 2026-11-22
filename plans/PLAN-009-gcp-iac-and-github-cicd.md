# PLAN-009: Portable Google Cloud IaC (Terraform) & GitHub CI/CD Setup

- **Branch / Fix Reference:** `fix/PLAN-009-gcp-iac-and-github-cicd`
- **Document Reference:** `plans/PLAN-009-gcp-iac-and-github-cicd.md`
- **Lead Agent:** `@devops-engineer`
- **Collaborating Agents:** `@product-owner`, `@developer`, `@tester`
- **Status:** **Planned (Ready for Implementation)**

---

## 1. Feature Overview & User Story

*As a developer or project adopter who clones DailyCheckIn, I want a declarative Infrastructure-as-Code (Terraform) setup with GCS remote state, a portable bootstrap script, and a GitHub Actions CI/CD pipeline targeting a `production` environment, so that anyone can provision Google Cloud Run, Firestore, Firebase Auth, and keyless GitHub deployments from scratch with minimal manual steps.*

### 1.1 Key Design Decisions
1. **Terraform (`infra/terraform/`) for GCP IaC:** Declarative HCL managing GCP APIs, Artifact Registry, Firestore Native database, Firebase Web App & Email/Password Auth, Cloud Run v2, IAM service accounts, and GitHub Workload Identity Federation (OIDC).
2. **Single `production` GCP Project:** Keeps the clone-to-deploy setup simple with one GCP project, one GCS remote state prefix, and one `production` GitHub Environment.
3. **Keyless GitHub $\leftrightarrow$ GCP Auth (Workload Identity Federation):** Replaces long-lived `GCP_SA_KEY` JSON secrets with short-lived OIDC tokens scoped to the adopter's GitHub `owner/repo`.
4. **Portable Clone-and-Deploy Experience:** No hardcoded project IDs, bucket names, or GitHub repo names in committed Terraform or workflow files. Everything is driven by `terraform.tfvars` (gitignored), `-backend-config`, and GitHub Environment Variables/Secrets.
5. **GCP Always-Free Tier Defaults:** All provisioned services default to free-tier-eligible regions (`us-central1`), scale-to-zero compute, minimal resource limits, and automatic Artifact Registry / GCS cleanup policies to prevent unexpected charges.

### 1.2 Free-Tier Service Defaults
| Service | Free-Tier Configuration | Why |
| :--- | :--- | :--- |
| **Region** | `us-central1` | Eligible for GCP Always Free tier across Cloud Run, Firestore, and Cloud Storage. |
| **Cloud Run** | `min_instance_count = 0`, `max_instance_count = 2`, `cpu = "1"`, `memory = "256Mi"`, `cpu_idle = true` | Scales to zero when idle and throttles CPU between requests to stay within 180k vCPU-sec / 360k GiB-sec per month. |
| **Artifact Registry** | Cleanup policy keeping only the latest **5** tagged images and deleting untagged manifests > 7 days | Keeps ~28MB images well below the 0.5 GiB/month free storage cap. |
| **Firestore** | `(default)` Native database in `us-central1` | Eligible for 1 GiB storage, 50k reads/day, 20k writes/day free tier. |
| **Firebase Auth** | Email/Password sign-in only (no SMS/Phone MFA or SAML/OIDC) | Covered by the 50,000 MAU free tier. |
| **GCS State Bucket** | Regional (`us-central1`) Standard class with lifecycle rule pruning > 5 noncurrent versions | Stays well within the 5 GB-month Always Free Cloud Storage quota. |

---

## 2. Current Gaps Identified in Codebase

1. **`.github/workflows/ci-cd.yml`:**
   - Line 138 checks `if: env.GCP_SA_KEY != ''`, which always evaluates to empty because `GCP_SA_KEY` is a secret, silently skipping deployments.
   - Uses legacy JSON key auth instead of Workload Identity Federation.
   - Only targets a single environment; no `staging` vs `production` separation or approval gates.
   - Does not pass `VITE_FIREBASE_*` build arguments to `docker build` and does not deploy Firestore rules/indexes.
2. **`Dockerfile`:**
   - Stage 1 (`frontend-builder`) runs `npm run build` without `ARG VITE_FIREBASE_API_KEY`, `ARG VITE_FIREBASE_AUTH_DOMAIN`, or `ARG VITE_FIREBASE_PROJECT_ID`, causing production containers to fall back to `localhost` / `'fake-api-key'` in `frontend/src/firebase.ts`.
3. **Environment Variable Naming Mismatch:**
   - `cmd/server/main.go` and `internal/repository/firestore.go` read `FIREBASE_PROJECT_ID` (and `PROJECT_ID`), whereas `docs/DEPLOYMENT.md` referenced `GCP_PROJECT_ID`.

---

## 3. Architecture & Deliverables

### 3.1 Terraform Infrastructure (`infra/terraform/`)
| File | Responsibility |
| :--- | :--- |
| `versions.tf` | Terraform `>= 1.6`, `google` & `google-beta` `~> 6.0`, and empty `backend "gcs" {}` block (configured at `terraform init` via `-backend-config`). |
| `variables.tf` | `project_id`, `region` (default `us-central1`), `environment` (`staging` \| `production`), `github_repository` (`owner/repo`), `service_name` (default `dailycheckin`), `initial_image` (bootstrap placeholder image for first `apply`). |
| `apis.tf` | Enables `run.googleapis.com`, `artifactregistry.googleapis.com`, `firestore.googleapis.com`, `iam.googleapis.com`, `iamcredentials.googleapis.com`, `cloudresourcemanager.googleapis.com`, `firebase.googleapis.com`, `identitytoolkit.googleapis.com`. |
| `artifact_registry.tf` | Docker repository `dailycheckin` in `var.region`. |
| `firestore.tf` | `google_firestore_database` (`(default)`, `FIRESTORE_NATIVE`) and composite indexes matching `firestore.indexes.json`. |
| `firebase.tf` | `google_firebase_project`, `google_firebase_web_app`, `data.google_firebase_web_app_config`, and `google_identity_platform_config` (enables Email/Password sign-in and authorizes the Cloud Run domain). |
| `cloud_run.tf` | Dedicated runtime Service Account (`dailycheckin-runtime`) with `roles/datastore.user` & `roles/firebaseauth.viewer`, plus `google_cloud_run_v2_service` configured for port `8080`, `APP_ENV=production`, `FIREBASE_PROJECT_ID=var.project_id`, and `/api/health` startup/liveness probes. |
| `wif_github.tf` | `google_iam_workload_identity_pool`, OIDC provider (`https://token.actions.githubusercontent.com`) restricted to `attribute.repository == var.github_repository`, and `dailycheckin-deployer` SA with `roles/run.admin`, `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser`, and `roles/firebase.admin`. |
| `outputs.tf` | Exports `cloud_run_url`, `artifact_registry_repository`, `wif_provider`, `wif_service_account`, `firebase_api_key`, `firebase_auth_domain`, and `firebase_project_id`. |
| `terraform.tfvars.example` | Template variable file for adopters. |

### 3.2 Bootstrap & GitHub Setup Scripts (`scripts/`)
- **`scripts/bootstrap-gcp.sh`:** Idempotent script for adopters to:
  1. Create (or select) the GCP project and link billing.
  2. Enable `storage.googleapis.com` and `cloudresourcemanager.googleapis.com`.
  3. Create a versioned GCS bucket for Terraform remote state (with uniform bucket-level access).
  4. Print the exact `terraform init -backend-config=...` and `terraform apply` commands for `staging` and `production`.
- **`scripts/configure-github-env.sh` (Optional helper using `gh` CLI):** Reads `terraform output -json` and populates the GitHub Environment (`staging` or `production`) variables/secrets automatically.

### 3.3 Dockerfile Updates (`Dockerfile`)
- Add `ARG VITE_FIREBASE_API_KEY`, `ARG VITE_FIREBASE_AUTH_DOMAIN`, `ARG VITE_FIREBASE_PROJECT_ID` (with `ENV` pass-through) in Stage 1 (`frontend-builder`) before `RUN npm run build` so Vite bakes the target environment's Firebase config into `frontend/dist`.

### 3.4 GitHub Actions CI/CD (`.github/workflows/ci-cd.yml`)
1. **`test` (PRs & `main` & tags):**
   - Go `gofmt`, `go vet`, `go test -v -race ./...` against Firestore Emulator.
   - Frontend `npm ci`, `npx tsc --noEmit`, `npm test -- --run`, `npm run build`.
   - Go single-binary `go build` verification.
2. **`docker-package` (PRs & `main` & tags):**
   - Multi-stage Docker build, `<45MB` image size gate, container `/api/health` smoke test.
3. **`deploy-staging` (Push to `main`):**
   - Uses GitHub Environment `staging` + `id-token: write`.
   - Authenticates via `google-github-actions/auth@v2` (WIF).
   - Builds & pushes image to Artifact Registry with `VITE_FIREBASE_*` build args.
   - Deploys to Cloud Run (`staging`) with `APP_ENV=production` and `FIREBASE_PROJECT_ID`.
   - Deploys `firestore.rules` & `firestore.indexes.json` via Firebase CLI.
   - Runs live `curl -f "${SERVICE_URL}/api/health"` smoke check.
4. **`deploy-production` (Push of `v*.*.*` tag OR manual `workflow_dispatch`):**
   - Uses GitHub Environment `production` (configured with **Required Reviewers** in GitHub UI for manual approval).
   - Same WIF auth, build/push, Cloud Run deploy, Firestore rules/indexes deploy, and `/api/health` smoke check targeting the production GCP project.

### 3.5 Documentation (`docs/DEPLOYMENT.md` & `README.md`)
- Update `docs/DEPLOYMENT.md` to be a complete, clone-to-deploy runbook covering:
  - Prerequisites (`gcloud`, `terraform`, `firebase-tools`, `gh`)
  - Step 1: Bootstrap GCP projects & GCS Terraform state bucket
  - Step 2: Provision `staging` and `production` via Terraform
  - Step 3: Configure GitHub Environments (`staging`, `production` with required reviewers), Variables/Secrets, and `main` branch protection
  - Step 4: Triggering & verifying Staging and Production deployments
  - Local development vs Production environment variable reference (`FIREBASE_PROJECT_ID`, `VITE_FIREBASE_*`).

---

## 4. Acceptance Criteria (Gherkin Scenarios)

- **Scenario 1: Portable Terraform Validation & Formatting**
  - **Given:** A developer clones the repository and inspects `infra/terraform/`.
  - **When:** `terraform fmt -check -recursive infra/terraform` and `terraform init -backend=false && terraform validate` are executed.
  - **Then:** All `.tf` files pass formatting and validation with zero hardcoded personal project IDs, bucket names, or repository names.

- **Scenario 2: Docker Build with Production Firebase Config**
  - **Given:** `Dockerfile` accepts `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, and `VITE_FIREBASE_PROJECT_ID` build arguments.
  - **When:** The container is built with `docker build --build-arg VITE_FIREBASE_PROJECT_ID=demo-proj ...` and started.
  - **Then:** The embedded frontend bundle contains the supplied Firebase config, the image remains under 45MB, and `GET /api/health` returns HTTP 200.

- **Scenario 3: Keyless Staging & Production CI/CD Workflows**
  - **Given:** `.github/workflows/ci-cd.yml` defines `test`, `docker-package`, `deploy-staging`, and `deploy-production`.
  - **When:** Code is pushed to `main`, `deploy-staging` triggers using WIF (`id-token: write`) and GitHub Environment `staging`; when a `v*.*.*` tag is pushed (or `workflow_dispatch` is triggered), `deploy-production` targets GitHub Environment `production`.
  - **Then:** Neither deploy job relies on `GCP_SA_KEY` or broken `env.GCP_SA_KEY` conditionals, and both verify `/api/health` post-deploy.

---

## 5. Definition of Done Checklist

- [ ] `infra/terraform/` modules created, formatted (`terraform fmt`), and validated (`terraform validate`).
- [ ] `scripts/bootstrap-gcp.sh` and `scripts/configure-github-env.sh` created and shell-checked (`bash -n`).
- [ ] `Dockerfile` updated with `VITE_FIREBASE_*` build args and verified via local Docker build + `/api/health` check (if Docker daemon available) or `go test`/`npm run build`.
- [ ] `.github/workflows/ci-cd.yml` updated for WIF + `staging` + `production` + Firestore deploy + `/api/health` smoke check.
- [ ] `docs/DEPLOYMENT.md` updated with complete clone-to-deploy instructions for GitHub & GCP.
- [ ] Existing Go tests (`go test ./...`) and Frontend tests (`cd frontend && npm test && npm run build`) pass.
