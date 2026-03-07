module "network" {
  source       = "./modules/network"
  project_name = var.project_name
  aws_region   = var.aws_region
  vpc_cidr     = var.vpc_cidr
}

module "eks" {
  source             = "./modules/eks"
  project_name       = var.project_name
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
}

module "rds" {
  source                = "./modules/rds"
  project_name          = var.project_name
  private_subnet_ids    = module.network.private_subnet_ids
  db_username           = var.db_username
  db_password           = var.db_password
  vpc_security_group_id = module.network.rds_security_group_id
}

module "redis" {
  source             = "./modules/redis"
  project_name       = var.project_name
  private_subnet_ids = module.network.private_subnet_ids
  security_group_id  = module.network.redis_security_group_id
}

module "ecr" {
  source           = "./modules/ecr"
  repository_names = var.ecr_repository_names
}

module "github_oidc" {
  source              = "./modules/github-oidc"
  aws_region          = var.aws_region
  role_name           = var.github_oidc_role_name
  github_repositories = var.github_repositories
  github_branch       = var.github_branch
  eks_cluster_name    = module.eks.cluster_name
}

resource "aws_eks_access_entry" "github_actions" {
  cluster_name  = module.eks.cluster_name
  principal_arn = module.github_oidc.github_actions_role_arn
  type          = "STANDARD"

  depends_on = [module.eks]
}

resource "aws_eks_access_policy_association" "github_actions_admin" {
  cluster_name  = module.eks.cluster_name
  principal_arn = module.github_oidc.github_actions_role_arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }

  depends_on = [aws_eks_access_entry.github_actions]
}
