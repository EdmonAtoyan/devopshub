variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "state_bucket_name" {
  type    = string
  default = "devops-hub-terraform-state"
}

variable "lock_table_name" {
  type    = string
  default = "devops-hub-terraform-locks"
}
