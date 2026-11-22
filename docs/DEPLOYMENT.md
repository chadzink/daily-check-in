# DailyCheckIn - Google Cloud Deployment & CI/CD Guide

This guide provides a portable, clone-to-deploy walkthrough for provisioning **DailyCheckIn** on **Google Cloud** (`production` environment) using **Terraform** and **GitHub Actions** with keyless **Workload Identity Federation (OIDC)**.

---

## 1. Architecture & Free-Tier Defaults

DailyCheckIn compiles the React TypeScript frontend directly into the Go Echo binary using `go:embed`. The multi-stage `Dockerfile` produces a minimal Alpine Linux image (**~28MB**) with an integrated `/api/health` check and non-root execution (`nobody:nobody`).

### Free-Tier Defaults
All Terraform resources in `infra/terraform/` default to **GCP Always-Free Tier** settings:
- **Region (`us-central1`):** Eligible for Always Free Cloud Run, Firestore, and Cloud Storage.
- **Cloud Run:** `min_instance_count = 0` (scales to zero when idle), `max_instance_count = 2`, `cpu = "1"`, `memory = "256Mi"`, `cpu_idle = true`.
- **Artifact Registry:** Automatic cleanup policy keeping the latest **5** tagged images and pruning untagged manifests older than 7 days (well under the 0.5 GiB/month free cap).
- **Firestore:** `(default)` Native database in `us-central1` (1 GiB storage, 50k reads/day, 20k writes/day free).
- **Firebase Auth:** Email/Password sign-in only (within the 50,000 MAU free tier).
- **GCS Terraform State Bucket:** Regional (`us-central1`) Standard class with versioning and lifecycle pruning (>5 noncurrent versions).

> **Note:** Cloud Run and Firebase require a billing account linked to your GCP project, even when usage stays within the free tier.

---

## 2. Prerequisites

1. **Google Cloud Account** with an active Billing Account ID (`gcloud billing accounts list`).
2. **Google Cloud SDK (`gcloud`):**
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```
3. **Terraform (`>= 1.6.0`)**
4. **GitHub CLI (`gh`)** & `jq` (for automated GitHub Environment setup, or configure manually in GitHub UI).
5. **Docker** (only needed if building/testing containers locally).

---

## 3. Step 1: Bootstrap GCP Project & GCS Remote State

Run `scripts/bootstrap-gcp.sh` (replace `1234` and `your-username/daily-check-in` with your own unique suffix and GitHub `owner/repo`):

```bash
# Find your billing account ID
gcloud billing accounts list

# Bootstrap Production GCP project & GCS Terraform state bucket
./scripts/bootstrap-gcp.sh \
  --project-id dailycheckin-prod-1234 \
  --state-bucket dailycheckin-tfstate-1234 \
  --github-repo your-username/daily-check-in \
  --billing-account XXXXXX-XXXXXX-XXXXXX
```

This creates the GCP project, links billing, creates the versioned GCS state bucket, and generates the gitignored `infra/terraform/production.tfvars`.

---

## 4. Step 2: Provision Infrastructure with Terraform

```bash
cd infra/terraform

terraform init -reconfigure \
  -backend-config="bucket=dailycheckin-tfstate-1234" \
  -backend-config="prefix=dailycheckin/production"

terraform apply -var-file="production.tfvars"
```

`terraform apply` creates the Cloud Run service (initially with a placeholder image) and prints `cloud_run_url` in its outputs.

---

## 5. Step 3: Configure GitHub Environment & Branch Protection

### Option A: Automated via `gh` CLI
```bash
./scripts/configure-github-env.sh --github-repo your-username/daily-check-in
```

### Option B: Manual GitHub UI Setup
In **GitHub Repository Settings $\rightarrow$ Environments**, create an environment named `production` and add the following **Environment Variables** from `terraform output`:

| Variable | Terraform Output Source |
| :--- | :--- |
| `GCP_PROJECT_ID` | `gcp_project_id` |
| `GCP_REGION` | `gcp_region` |
| `ARTIFACT_REGISTRY_REPO` | `artifact_registry_repository` |
| `CLOUD_RUN_SERVICE` | `cloud_run_service` |
| `WIF_PROVIDER` | `wif_provider` |
| `WIF_SERVICE_ACCOUNT` | `wif_service_account` |
| `VITE_FIREBASE_API_KEY` | `firebase_api_key` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `firebase_auth_domain` |
| `VITE_FIREBASE_PROJECT_ID` | `firebase_project_id` |

### Recommended GitHub Protections
1. **Optional Approval Gate:** In **Settings $\rightarrow$ Environments $\rightarrow$ `production`**, you can enable **Required reviewers** if you want manual approval before deployments proceed.
2. **Branch Protection on `main`:** In **Settings $\rightarrow$ Branches**, protect `main` and require the `Lint & Test Suite` and `Build & Audit Docker Image` status checks to pass before merging PRs.

---

## 6. Step 4: Trigger Your First Deployment & Authorize Domain

### Trigger CI/CD
Any of the following triggers [.github/workflows/ci-cd.yml](file:///Users/chadzink/Projects/DailyCheckIn/.github/workflows/ci-cd.yml) to build, push, and deploy DailyCheckIn to Cloud Run:
- **Merge / Push to `main`** (e.g., merging your setup PR into `main`)
- **Manual trigger:** In GitHub, go to **Actions $\rightarrow$ CI/CD Pipeline $\rightarrow$ Run workflow**
- **Release tag:** Pushing a tag matching `v*.*.*`

*(Pull requests to `main` run `test` and `docker-package` only—they do not deploy.)*

### Authorize Cloud Run Domain in Firebase Auth
Once `terraform apply` has completed (or after your first CI/CD deploy), get your Cloud Run hostname:
```bash
terraform -chdir=infra/terraform output -raw cloud_run_url
```
Copy the hostname **without `https://`** (e.g. `dailycheckin-xxxx-uc.a.run.app`) and add it under **Firebase Console $\rightarrow$ Authentication $\rightarrow$ Settings $\rightarrow$ Authorized domains**.

---

## 7. Runtime Configuration & Environment Variables

| Variable | Description | Production Setting |
| :--- | :--- | :--- |
| `PORT` | Listening port for Echo server | Automatically set by Cloud Run (`8080`) |
| `APP_ENV` | Application environment | `production` (disables local `localhost:8085` Firestore emulator fallback and uses Cloud Run ADC) |
| `FIREBASE_PROJECT_ID` | Project ID for Firestore & Firebase Auth SDKs | Set to `$GCP_PROJECT_ID` by CI/CD & Terraform |
| `VITE_FIREBASE_API_KEY` | Public Firebase Web App API key | Passed as Docker `--build-arg` at Vite build time |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | Passed as Docker `--build-arg` at Vite build time |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID for client SDK | Passed as Docker `--build-arg` at Vite build time |
| `FIRESTORE_EMULATOR_HOST` | Local emulator override | **Must be unset** in production (otherwise forces emulator mode) |
| `FIREBASE_AUTH_EMULATOR_HOST` | Local emulator override | **Must be unset** in production |
