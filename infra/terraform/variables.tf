variable "project_id" {
  description = "Google Cloud Project ID."
  type        = string
}

variable "region" {
  description = "GCP region (default us-central1 for Always-Free tier eligibility)."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "production"
}

variable "github_repository" {
  description = "GitHub repository allowed to authenticate via WIF (format: owner/repo)."
  type        = string

  validation {
    condition     = can(regex("^[^/]+/[^/]+$", var.github_repository))
    error_message = "github_repository must be in 'owner/repo' format."
  }
}

variable "service_name" {
  description = "Cloud Run service and Artifact Registry repository base name."
  type        = string
  default     = "dailycheckin"
}

variable "initial_image" {
  description = "Bootstrap container image used on initial Cloud Run creation before CI/CD pushes the app image."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}
