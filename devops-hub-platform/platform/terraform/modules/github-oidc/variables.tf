variable "aws_region" {
  type = string
}

variable "role_name" {
  type = string
}

variable "github_repositories" {
  type = list(string)
}

variable "github_branch" {
  type = string
}

variable "eks_cluster_name" {
  type = string
}
