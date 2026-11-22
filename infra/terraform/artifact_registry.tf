resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = var.service_name
  description   = "DailyCheckIn container images (${var.environment})"
  format        = "DOCKER"

  # Free-tier safeguard: keep storage well under 0.5 GiB/month by pruning old images.
  cleanup_policy_dry_run = false

  cleanup_policies {
    id     = "delete-untagged-old"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s" # 7 days
    }
  }

  cleanup_policies {
    id     = "keep-recent-tagged"
    action = "KEEP"
    most_recent_versions {
      keep_count = 5
    }
  }

  depends_on = [google_project_service.apis]
}
