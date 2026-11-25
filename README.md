# DailyCheckIn

A personal morning ritual and daily execution tool designed for technology and knowledge workers. Combines core Scrum principles (**Yesterday**, **Today**, **Blocked**, **Backlog**) with date-based session tracking, morning/evening ritual wizards, and multi-day task persistence.

---

## Key Features

- **🌅 Morning Check-In Wizard:** Start your day intentionally with automated rollover of incomplete tasks, review of yesterday's accomplishments, and backlog pull prioritization.
- **🌆 End-of-Day Check-Out Ritual:** Review incomplete tasks, demote unfinished work back to the global backlog or roll over, and record daily reflections.
- **📋 4-Row Daily Execution Board:**
  - **Yesterday:** Read-only accomplishments from the previous active workday.
  - **Today:** Actively prioritized list (`1..N` order) with instant completion timestamps, Up/Down arrow & `#N` jump-to-index reordering, edit/delete modals, and a quick "Mark as Blocked" action.
  - **Blocked:** Track blocked items with explicit blocker reasons, quick-add/detailed-add, and 1-click unblock.
  - **Backlog:** Persistent, cross-day master backlog pool of incomplete tasks (`is_completed = false`) that can be prioritized (new tasks insert at `#1`) and pulled into *Today* at any point.
- **📊 Completed Tasks Report & CSV Export:** Date-range filtered report modal (defaulting to the last 7 days) with 1-click RFC 4180 CSV export of all task metadata.
- **📅 Interactive Calendar & History:** Month-view calendar tracking daily check-in/out statuses with instant jump-to-date historical review mode.
- **🚀 1-Click Standup Export:** Generates formatted markdown standup summaries for Slack, Teams, or email.
- **📦 Single Binary Deployment:** Production React SPA build is embedded directly into the Go executable via `go:embed`.

---

## Tech Stack

### Backend
- **Language:** Go (1.25+)
- **HTTP Framework:** [Echo v4](https://echo.labstack.com/)
- **Database & Auth:** Google Cloud Firestore (ADC in production, Emulator locally) & Firebase Authentication (Admin SDK)
- **Static Asset Embedding:** Go `embed.FS`

### Frontend
- **Framework:** React 18+ (TypeScript)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **State Management & Caching:** [TanStack Query (React Query)](https://tanstack.com/query/latest) & React Context
- **Ordering & Controls:** Accessible Up/Down arrow buttons & clickable `#N` jump-to-index reordering
- **Icons & Utilities:** `lucide-react`, `date-fns`

### Infrastructure & DevOps
- **Hosting / Compute:** Google Cloud Run (Serverless container runtime, Free-Tier defaults)
- **Database & Auth:** Google Cloud Firestore & Firebase Authentication
- **Infrastructure as Code (IaC):** Terraform (`infra/terraform/`) with GCS remote state
- **CI/CD:** GitHub Actions (Keyless Workload Identity Federation OIDC for `production`)
- **Local Dev:** Firebase Local Emulator Suite (Firestore & Auth)
- **Containerization:** Multi-stage Dockerfile (Vite build $\rightarrow$ Go build $\rightarrow$ Scratch/Alpine runtime)

---

## Directory Structure

```text
DailyCheckIn/
├── cmd/
│   └── server/
│       └── main.go                 # Echo server entrypoint & graceful shutdown
├── internal/
│   ├── api/                        # HTTP handlers & router setup (tasks, days, backlog, rituals, calendar, reports)
│   ├── middleware/                 # Firebase auth & request logging middleware
│   ├── service/                    # Business logic (check-in/out wizards, rollover, date-range reports)
│   ├── repository/                 # Firestore client (ADC/emulator) & collection repositories
│   └── model/                      # Go structs & API envelopes
├── frontend/
│   ├── src/
│   │   ├── api/                    # Typed API client with JWT injection
│   │   ├── components/             # UI components (Calendar, Board, Reports, Wizards, Tasks)
│   │   ├── context/                # AuthContext, DateContext
│   │   ├── hooks/                  # TanStack Query data hooks
│   │   ├── utils/                  # Standup markdown & RFC 4180 CSV export utilities
│   │   ├── App.tsx                 # Main layout & router
│   │   └── main.tsx                # Application root
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docs/
│   ├── AGENTS.md                   # Multi-agent squad guide & collaboration workflows
│   ├── DEPLOYMENT.md               # Portable Terraform, GitHub & Cloud Run deployment guide
│   ├── SPECIFICATION.md            # Detailed product & technical specification
│   └── WORKFLOWS.md                # Agile squad scrum workflows & lifecycle guide
├── infra/
│   └── terraform/                  # Portable GCP IaC (Cloud Run, Firestore, Firebase, WIF)
├── scripts/
│   ├── bootstrap-gcp.sh            # Idempotent GCP project & GCS remote state bootstrap
│   └── configure-github-env.sh     # Automated GitHub Environment setup from Terraform outputs
├── docker-compose.yml              # Local Firebase Emulators
├── Dockerfile                      # Multi-stage production container build
├── Makefile                        # Development and build tasks
├── firebase.json                   # Firebase Emulator Suite config
└── firestore.indexes.json          # Firestore composite indexes
```

---

## Getting Started

### Prerequisites

- **Go:** 1.23+
- **Node.js:** 20+ & `npm` / `pnpm`
- **Docker & Docker Compose:** For running Firebase Local Emulators
- **Firebase CLI:** `npm install -g firebase-tools` (optional, if running emulators natively)

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/DailyCheckIn.git
   cd DailyCheckIn
   ```

2. **Start Firebase Local Emulators & Seed Demo User:**
   ```bash
   docker compose up -d
   # Or using Firebase CLI: firebase emulators:start

   # Seed the local demo account (demo@dailycheckin.com / Password123!)
   make seed-demo-user
   ```

3. **Install Frontend Dependencies:**
   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Run the Application:**
   - **Full Stack Development (Concurrent backend + Vite dev server):**
     ```bash
     make dev
     ```
   - **Backend only:**
     ```bash
     go run cmd/server/main.go
     ```
   - **Frontend only:**
     ```bash
     cd frontend && npm run dev
     ```

---

## Configuration & Environment Variables

| Variable | Description | Default (Dev) | Production (Cloud Run) |
| :--- | :--- | :--- | :--- |
| `PORT` | HTTP server listening port | `8080` | `8080` |
| `APP_ENV` | Environment identifier (`development` / `production`) | `development` | `production` |
| `FIREBASE_PROJECT_ID` | GCP / Firebase project ID | `dailycheckin-local` | `dailycheckin-prod` |
| `FIRESTORE_EMULATOR_HOST` | Local Firestore emulator endpoint | `localhost:8085` | *Unset* |
| `FIREBASE_AUTH_EMULATOR_HOST` | Local Auth emulator endpoint | `localhost:9099` | *Unset* |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account JSON key path | *Unset (emulators)* | Default GCP Service Account |

---

## Build & Deployment

### Build Single Production Binary
```bash
make build
```
This builds the frontend assets with Vite and compiles the Go server binary with embedded static files (`bin/dailycheckin`, 19MB).

### Docker Multi-Stage Build
```bash
make docker-build
# Or directly: docker build -t dailycheckin:latest .
```
Compiles a minimal, hardened Alpine production container image (**28.3MB**) running as non-root user `nobody:nobody` with an active `HEALTHCHECK` directive.

### 🚀 Deploying to Google Cloud Run

#### Recommended: Terraform IaC + Keyless GitHub Actions (`production`)
Anyone cloning this repository can bootstrap a GCP project (with **Always-Free Tier** defaults), GCS remote state, Firebase Auth, and keyless GitHub Actions OIDC deployments:

1. Run `scripts/bootstrap-gcp.sh` to create the GCP project and GCS state bucket.
2. Provision infrastructure with `terraform init` & `terraform apply` in `infra/terraform/`.
3. Configure the `production` GitHub Environment with `scripts/configure-github-env.sh`.

#### Quickstart: 1-Command Deploy via Cloud Build
Deploy directly from your terminal using Google Cloud Build and Cloud Run:
```bash
gcloud run deploy dailycheckin \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars APP_ENV=production,FIREBASE_PROJECT_ID=your-project-id
```

For the complete clone-to-deploy walkthrough covering Terraform IaC, GCS remote state, Firebase Auth, GitHub Environment & branch protection, and automated CI/CD, see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

---

## Documentation

For full details on data models, API schemas, Firestore structure, and workflow state machines, refer to the [Product & Technical Specification](docs/SPECIFICATION.md).
