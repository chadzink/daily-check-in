#!/usr/bin/env bash
set -euo pipefail

# Populate the GitHub Environment (default: production) with variables
# exported from `terraform output -json`.
#
# Prerequisites:
#   - GitHub CLI (`gh`) authenticated with repo admin permissions
#   - `jq` and `terraform` installed
#   - `terraform init` & `terraform apply` already run
#
# Usage:
#   ./scripts/configure-github-env.sh --github-repo owner/DailyCheckIn [--environment production]

ENVIRONMENT="production"
GITHUB_REPO=""
TF_DIR="infra/terraform"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --environment) ENVIRONMENT="$2"; shift 2 ;;
    --github-repo) GITHUB_REPO="$2"; shift 2 ;;
    --tf-dir) TF_DIR="$2"; shift 2 ;;
    -h|--help)
      sed -n '3,13p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$GITHUB_REPO" ]]; then
  echo "Error: --github-repo is required." >&2
  exit 1
fi

for cmd in gh jq terraform; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: '$cmd' is required but not installed." >&2
    exit 1
  fi
done

echo "==> Ensuring GitHub Environment '${ENVIRONMENT}' exists on ${GITHUB_REPO}"
gh api --method PUT "repos/${GITHUB_REPO}/environments/${ENVIRONMENT}" >/dev/null

TF_JSON="$(terraform -chdir="$TF_DIR" output -json)"

set_var() {
  local name="$1"
  local value="$2"
  gh variable set "$name" --repo "$GITHUB_REPO" --env "$ENVIRONMENT" --body "$value"
}

set_var "GCP_PROJECT_ID" "$(echo "$TF_JSON" | jq -r '.gcp_project_id.value')"
set_var "GCP_REGION" "$(echo "$TF_JSON" | jq -r '.gcp_region.value')"
set_var "ARTIFACT_REGISTRY_REPO" "$(echo "$TF_JSON" | jq -r '.artifact_registry_repository.value')"
set_var "CLOUD_RUN_SERVICE" "$(echo "$TF_JSON" | jq -r '.cloud_run_service.value')"
set_var "WIF_PROVIDER" "$(echo "$TF_JSON" | jq -r '.wif_provider.value')"
set_var "WIF_SERVICE_ACCOUNT" "$(echo "$TF_JSON" | jq -r '.wif_service_account.value')"
set_var "VITE_FIREBASE_API_KEY" "$(echo "$TF_JSON" | jq -r '.firebase_api_key.value')"
set_var "VITE_FIREBASE_AUTH_DOMAIN" "$(echo "$TF_JSON" | jq -r '.firebase_auth_domain.value')"
set_var "VITE_FIREBASE_PROJECT_ID" "$(echo "$TF_JSON" | jq -r '.firebase_project_id.value')"

echo "==> GitHub Environment '${ENVIRONMENT}' configured successfully!"
echo "Tip: Optionally add Required Reviewers to the '${ENVIRONMENT}' environment in GitHub Settings -> Environments."
