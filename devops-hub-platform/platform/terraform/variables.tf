variable "aws_region" {
  type = string
}

variable "project_name" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "db_username" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "ecr_repository_names" {
  type = list(string)
  default = [
    "frontend",
    "community-api",
    "api-gateway",
    "auth-service",
    "profile-service",
    "media-service",
    "notification-service"
  ]
}

variable "github_oidc_role_name" {
  type    = string
  default = "devops-hub-github-actions-role"
}

variable "github_repositories" {
  type    = list(string)
  default = ["your-org/devops-hub-platform"]
}

variable "github_branch" {
  type    = string
  default = "main"
}
