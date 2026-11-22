#!/usr/bin/env bash
set -euo pipefail

# Bootstrap a GCP project and a Free-Tier-eligible GCS Terraform remote state bucket.
# Safe to re-run (idempotent).
#
# Usage:
#   ./scripts/bootstrap-gcp.sh \
#     --project-id dailycheckin-prod-1234 \
#     --state-bucket dailycheckin-tfstate-1234 \
#     --github-repo owner/DailyCheckIn \
#     [--billing-account XXXXXX-XXXXXX-XXXXXX] \
#     [--region us-central1]

REGION="us-central1"
PROJECT_ID=""
STATE_BUCKET=""
ENVIRONMENT="production"
GITHUB_REPO=""
BILLING_ACCOUNT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-id) PROJECT_ID="$2"; shift 2 ;;
    --state-bucket) STATE_BUCKET="$2"; shift 2 ;;
    --environment) ENVIRONMENT="$2"; shift 2 ;;
    --github-repo) GITHUB_REPO="$2"; shift 2 ;;
    --billing-account) BILLING_ACCOUNT="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    -h|--help)
      sed -n '3,15p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PROJECT_ID" || -z "$STATE_BUCKET" || -z "$GITHUB_REPO" ]]; then
  echo "Error: --project-id, --state-bucket, and --github-repo are required." >&2
  exit 1
fi

echo "==> Checking GCP project: $PROJECT_ID"
if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  echo "==> Creating GCP project: $PROJECT_ID"
  gcloud projects create "$PROJECT_ID" --name="DailyCheckIn ${ENVIRONMENT}"
else
  echo "==> Project $PROJECT_ID already exists."
fi

if [[ -n "$BILLING_ACCOUNT" ]]; then
  echo "==> Linking billing account $BILLING_ACCOUNT to $PROJECT_ID"
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
fi

echo "==> Enabling bootstrap APIs on $PROJECT_ID"
gcloud services enable \
  storage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project="$PROJECT_ID"

echo "==> Checking GCS Terraform state bucket: gs://${STATE_BUCKET}"
if ! gcloud storage buckets describe "gs://${STATE_BUCKET}" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "==> Creating GCS bucket gs://${STATE_BUCKET} in ${REGION} (Standard class, Uniform access)"
  gcloud storage buckets create "gs://${STATE_BUCKET}" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --default-storage-class=STANDARD \
    --uniform-bucket-level-access
fi

echo "==> Enabling object versioning on gs://${STATE_BUCKET}"
gcloud storage buckets update "gs://${STATE_BUCKET}" --versioning

LIFECYCLE_FILE="$(mktemp)"
trap 'rm -f "$LIFECYCLE_FILE"' EXIT
cat >"$LIFECYCLE_FILE" <<'JSON'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "numNewerVersions": 5, "isLive": false }
    }
  ]
}
JSON
gcloud storage buckets update "gs://${STATE_BUCKET}" --lifecycle-file="$LIFECYCLE_FILE"

TFVARS_FILE="infra/terraform/${ENVIRONMENT}.tfvars"
cat >"$TFVARS_FILE" <<EOF
project_id        = "${PROJECT_ID}"
region            = "${REGION}"
environment       = "${ENVIRONMENT}"
github_repository = "${GITHUB_REPO}"
service_name      = "dailycheckin"
EOF

cat <<EOF

Bootstrap complete for '${ENVIRONMENT}'!
Generated: ${TFVARS_FILE} (gitignored)

Next steps:
  cd infra/terraform
  terraform init -reconfigure \\
    -backend-config="bucket=${STATE_BUCKET}" \\
    -backend-config="prefix=dailycheckin/${ENVIRONMENT}"
  terraform apply -var-file="${ENVIRONMENT}.tfvars"
EOF
