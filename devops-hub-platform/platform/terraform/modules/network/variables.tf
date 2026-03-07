variable "project_name" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"

  validation {
    condition     = var.vpc_cidr == "10.0.0.0/16"
    error_message = "vpc_cidr must be 10.0.0.0/16."
  }
}
