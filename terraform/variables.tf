variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "app_name" {
  description = "Application name prefix for resources"
  type        = string
  default     = "meet-artifact"
}

variable "gemini_api_key" {
  description = "Gemini API Key for the backend service"
  type        = string
  sensitive   = true
}

variable "frontend_image_tag" {
  description = "Tag for the frontend Docker image"
  type        = string
  default     = "latest"
}

variable "backend_image_tag" {
  description = "Tag for the backend Docker image"
  type        = string
  default     = "latest"
}
