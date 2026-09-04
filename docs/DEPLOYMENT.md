# DailyCheckIn - Google Cloud Deployment Guide

This guide provides step-by-step instructions for deploying **DailyCheckIn** to **Google Cloud Run** using the single-binary container packaging created in Milestone 6.

---

## 1. Architecture & Overview

DailyCheckIn compiles the React TypeScript frontend directly into the Go Echo binary using `go:embed`. The multi-stage `Dockerfile` produces a hardened, minimal Alpine Linux image (**~28MB**) with an integrated health check and non-root execution (`nobody:nobody`).

```text
[React SPA Source] ──(Vite build)──> [frontend/dist]
                                            │
[Go Echo Backend] ──────(go:embed)──────────┴──> [Stripped Binary (19MB)]
                                                        │
[Alpine 3.21 Runtime] ──(Multi-Stage Docker)───────────┴──> [Cloud Run Container (28MB)]
                                                                    │
                                                                    ▼
                                                            [Google Cloud Run]
                                                                    │
                                                                    ▼
                                                         [Google Cloud Firestore]
```

---

## 2. Prerequisites

1. **Google Cloud Platform (GCP) Account:** Active billing-enabled account.
2. **Google Cloud SDK (`gcloud` CLI):** Installed and authenticated:
   ```bash
   gcloud auth login
   ```
3. **Docker:** Installed and running locally (if building images locally).
4. **Firebase CLI:** Installed for deploying Firestore rules & indexes:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

---

## 3. Initial Google Cloud Project Setup

### 3.1 Set Active Project
```bash
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_REGION="us-central1"

gcloud config set project $GCP_PROJECT_ID
```

### 3.2 Enable Required APIs
Enable the services required for Cloud Run, Artifact Registry, Cloud Build, and Firestore:
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com
```

### 3.3 Create Firestore Database
If you haven't already created a Firestore database in your project:
```bash
gcloud firestore databases create --location=$GCP_REGION --type=firestore-native
```

### 3.4 Deploy Firestore Rules & Indexes
Deploy the project's security rules and indexes:
```bash
firebase use $GCP_PROJECT_ID
firebase deploy --only firestore
```

---

## 4. Deployment Methods

Choose the deployment method that fits your workflow:

### Method A: One-Command Deployment via Cloud Build (Recommended for Quickstart)

Google Cloud Build will upload the source repository, build the multi-stage `Dockerfile`, and deploy the container directly to Cloud Run:

```bash
gcloud run deploy dailycheckin \
  --source . \
  --region $GCP_REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars APP_ENV=production,GCP_PROJECT_ID=$GCP_PROJECT_ID
```

*Upon completion, `gcloud` will output the live Cloud Run service URL (e.g. `https://dailycheckin-xyz-uc.a.run.app`).*

---

### Method B: Manual Docker Build & Artifact Registry

Use this method to build and test the container locally before pushing:

#### 1. Create an Artifact Registry Repository
```bash
gcloud artifacts repositories create dailycheckin-repo \
  --repository-format=docker \
  --location=$GCP_REGION \
  --description="DailyCheckIn Container Repository"
```

#### 2. Authenticate Docker with Artifact Registry
```bash
gcloud auth configure-docker ${GCP_REGION}-docker.pkg.dev
```

#### 3. Build & Tag the Multi-Stage Image
```bash
IMAGE_TAG="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/dailycheckin-repo/dailycheckin:latest"

docker build -t $IMAGE_TAG .
```

#### 4. Push to Artifact Registry
```bash
docker push $IMAGE_TAG
```

#### 5. Deploy to Cloud Run
```bash
gcloud run deploy dailycheckin \
  --image $IMAGE_TAG \
  --region $GCP_REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars APP_ENV=production,GCP_PROJECT_ID=$GCP_PROJECT_ID
```

---

### Method C: Automated CI/CD via GitHub Actions

This repository includes an automated pipeline in `.github/workflows/ci-cd.yml` that lints, runs tests against a Firebase emulator container, builds the multi-stage container, and deploys to Cloud Run on pushes to `main`.

#### 1. Create a Dedicated Service Account
```bash
gcloud iam service-accounts create dailycheckin-deployer \
  --description="GitHub Actions deployment service account for DailyCheckIn" \
  --display-name="DailyCheckIn Deployer"
```

#### 2. Grant Required IAM Roles
```bash
# Cloud Run Admin
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:dailycheckin-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Artifact Registry Writer
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:dailycheckin-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Service Account User (to act as the runtime service account)
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:dailycheckin-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

#### 3. Generate Service Account Key & Add GitHub Secrets
```bash
gcloud iam service-accounts keys create sa-key.json \
  --iam-account=dailycheckin-deployer@${GCP_PROJECT_ID}.iam.gserviceaccount.com
```

Add the following repository secrets under **GitHub Repository Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions**:
- `GCP_PROJECT_ID`: Your Google Cloud Project ID.
- `GCP_SA_KEY`: The entire JSON contents of `sa-key.json`.

*(Remember to securely delete `sa-key.json` locally after uploading to GitHub).*

---

## 5. Runtime Configuration & Environment Variables

| Variable | Description | Production Setting |
| :--- | :--- | :--- |
| `PORT` | Listening port for Echo server | Automatically set by Cloud Run (default: `8080`) |
| `APP_ENV` | Application environment | `production` |
| `GCP_PROJECT_ID` | Project ID for Firestore SDK | Set to `$GCP_PROJECT_ID` |
| `FIRESTORE_EMULATOR_HOST` | Local emulator override | **Must be unset** in production |
| `FIREBASE_AUTH_EMULATOR_HOST` | Local emulator override | **Must be unset** in production |

---

## 6. Runtime IAM Permissions (Cloud Run Service Identity)

By default, Cloud Run uses the Compute Engine default service account (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`). Ensure this account has access to Firestore:

```bash
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

---

## 7. Health Check & Post-Deployment Verification

1. **Verify Health Endpoint:**
   ```bash
   SERVICE_URL=$(gcloud run services describe dailycheckin --region $GCP_REGION --format='value(status.url)')
   curl -i "$SERVICE_URL/api/health"
   ```
   *Expected output: `HTTP/1.1 200 OK` with JSON `{"status":"healthy",...}`.*

2. **Verify Static Asset Caching Headers:**
   ```bash
   curl -I "$SERVICE_URL/"
   ```
   *Expected output: `Cache-Control: no-cache` on `index.html`.*

3. **Verify SPA Fallback:**
   ```bash
   curl -I "$SERVICE_URL/calendar"
   ```
   *Expected output: `HTTP/1.1 200 OK` serving the embedded SPA.*

---

## 8. Custom Domains & HTTPS

To map a custom domain (e.g. `checkin.yourdomain.com`):
```bash
gcloud run domain-mappings create \
  --service dailycheckin \
  --domain checkin.yourdomain.com \
  --region $GCP_REGION
```
Google Cloud Run will automatically provision and renew a managed SSL/TLS certificate for your custom domain once the DNS records are verified.
