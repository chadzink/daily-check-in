output "cloud_run_url" {
  description = "Live Cloud Run service URL."
  value       = google_cloud_run_v2_service.app.uri
}

output "cloud_run_service" {
  description = "Cloud Run service name."
  value       = google_cloud_run_v2_service.app.name
}

output "gcp_project_id" {
  description = "GCP Project ID."
  value       = var.project_id
}

output "gcp_region" {
  description = "GCP Region."
  value       = var.region
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository ID."
  value       = google_artifact_registry_repository.docker.repository_id
}

output "wif_provider" {
  description = "Workload Identity Provider resource name for GitHub Actions."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "wif_service_account" {
  description = "Deployer Service Account email for GitHub Actions."
  value       = google_service_account.deployer.email
}

output "firebase_api_key" {
  description = "Firebase Web App API Key (public client config embedded at Vite build time)."
  value       = data.google_firebase_web_app_config.web.api_key
}

output "firebase_auth_domain" {
  description = "Firebase Web App Auth Domain."
  value       = data.google_firebase_web_app_config.web.auth_domain
}

output "firebase_project_id" {
  description = "Firebase Project ID."
  value       = var.project_id
}
