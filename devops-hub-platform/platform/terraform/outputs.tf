output "vpc_id" { value = module.network.vpc_id }
output "eks_cluster_name" { value = module.eks.cluster_name }
output "rds_endpoint" { value = module.rds.rds_endpoint }
output "redis_endpoint" { value = module.redis.redis_endpoint }
output "ecr_repository_urls" { value = module.ecr.repository_urls }
output "github_actions_role_arn" { value = module.github_oidc.github_actions_role_arn }
