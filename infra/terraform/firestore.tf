# Firestore Native database (Always-Free tier eligible in us-central1: 1 GiB, 50k reads/day, 20k writes/day).
# Composite indexes & security rules are deployed by CI/CD via `firebase deploy --only firestore`
# using `firestore.indexes.json` and `firestore.rules`.
resource "google_firestore_database" "default" {
  project                 = var.project_id
  name                    = "(default)"
  location_id             = var.region
  type                    = "FIRESTORE_NATIVE"
  delete_protection_state = "DELETE_PROTECTION_DISABLED"

  depends_on = [google_project_service.apis]
}
