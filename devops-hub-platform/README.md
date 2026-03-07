# devops-hub-platform

Production-grade cloud-native DevOps platform with NestJS microservices, Kubernetes, Terraform, AWS EKS, RDS PostgreSQL, Redis, CI/CD, and observability.

## Architecture Goals

- Scalable microservices architecture
- High availability (multi-AZ infra + autoscaling + PDBs)
- Production-grade DevOps practices (IaC, CI/CD, observability, security)

## Project Structure

- `microservices/`: NestJS services (`api-gateway`, `auth-service`, `profile-service`, `notification-service`, `media-service`)
- `platform/k8s/`: Kubernetes manifests (deployments, services, ingress, HPA, PDB, config, secret, security)
- `platform/terraform/`: AWS infrastructure modules (VPC, EKS, RDS, Redis, ECR, IAM/OIDC)
- `.github/workflows/`: CI/CD pipeline
- `observability/`: Prometheus, Grafana, Loki, Jaeger

## Local Development

1. Copy env examples:
   ```bash
   cp microservices/api-gateway/.env.example microservices/api-gateway/.env
   ```
2. Install and run one service:
   ```bash
   cd microservices/api-gateway
   npm install
   npm run start:dev
   ```
3. Test health and metrics:
   ```bash
   curl http://localhost:3000/api/health
   curl http://localhost:3000/api/metrics
   ```

## Terraform Deploy

1. Configure AWS credentials.
2. Bootstrap remote state infrastructure (S3 + DynamoDB lock table):
   ```bash
   cd platform/terraform/bootstrap
   terraform init
   terraform apply
   ```
3. Configure backend:
   ```bash
   cd ../
   cp backend.hcl.example backend.hcl
   ```
4. Create tfvars from example:
   ```bash
   cp environments/prod/terraform.tfvars.example environments/prod/terraform.tfvars
   ```
5. Deploy infra:
   ```bash
   terraform init -backend-config=backend.hcl
   terraform plan -var-file=environments/prod/terraform.tfvars
   terraform apply -var-file=environments/prod/terraform.tfvars
   ```

## CI IAM/OIDC and ECR

- The active platform workflow lives at `/.github/workflows/devopshub-deploy.yml`.
- Pull requests validate Terraform, Kustomize, and all deployable Docker images.
- Pushes to `main` build versioned ECR images and deploy them to EKS.
- Terraform creates the GitHub OIDC provider, the GitHub Actions IAM role, and an EKS access entry so the workflow can run `kubectl apply`.
- Set `github_repositories` in `terraform.tfvars` to your real `org/repo` so GitHub can assume the role.
- The production deploy workflow expects these GitHub secrets:
  - `AWS_GITHUB_ACTIONS_ROLE_ARN`
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `REDIS_HOST`
  - `REDIS_PASSWORD`
  - `NEXT_PUBLIC_SITE_URL`
- Optional secret:
  - `CORS_ORIGIN` (falls back to `NEXT_PUBLIC_SITE_URL` when omitted)

## Kubernetes Deploy

1. Update kubeconfig for EKS.
2. Create production overlay env files:
   ```bash
   cd platform/k8s/overlays/prod
   cp config.env.example config.env
   cp secrets.env.example secrets.env
   ```
3. Set real ECR image tags in `kustomization.yaml` and real runtime values in the env files.
4. Apply platform manifests through Kustomize:
   ```bash
   kubectl apply -k platform/k8s/overlays/prod
   ```
5. Resolve the public website URLs from the ingress:
   ```bash
   INGRESS_HOST=$(kubectl get ingress platform-ingress -n devops-hub -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
   if [ -z "$INGRESS_HOST" ]; then
     echo "Ingress hostname is still pending."
   else
     echo "Website URL: http://${INGRESS_HOST}/"
     echo "API health: http://${INGRESS_HOST}/api/health"
     echo "Auth health: http://${INGRESS_HOST}/auth/health"
     echo "Profile health: http://${INGRESS_HOST}/profiles/health"
     echo "Notifications health: http://${INGRESS_HOST}/notifications/health"
     echo "Media health: http://${INGRESS_HOST}/media/health"
   fi
   ```

## Monitoring Setup

1. Deploy observability namespace and stack:
   ```bash
   kubectl apply -f observability/namespace.yaml
   kubectl apply -f observability/prometheus
   kubectl apply -f observability/grafana
   kubectl apply -f observability/loki
   kubectl apply -f observability/jaeger
   ```
2. Expose dashboards (port-forward or ingress) for Grafana and Jaeger.

## Security Best Practices Included

- RBAC service accounts and least-privilege role bindings
- Network policies with default deny baseline
- Secret templating and recommendation for AWS Secrets Manager + External Secrets
- Resource requests/limits and health checks on all services

## Production Hardening Checklist

- Replace placeholder IAM role ARNs and account IDs
- Enforce TLS on the public load balancer and in-transit encryption for all services
- Enable image scanning/signing and policy enforcement (OPA/Gatekeeper or Kyverno)
- Add backup/restore validation for RDS and Redis
- Install metrics-server in EKS before relying on HPA
