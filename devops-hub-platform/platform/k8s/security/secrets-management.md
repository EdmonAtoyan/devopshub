# Secrets Management

Recommended production approach:
- Store secrets in AWS Secrets Manager.
- Sync into Kubernetes using External Secrets Operator.
- Avoid committing plaintext Kubernetes secrets.

Template command:

```bash
kubectl apply -f platform/k8s/base/secret.yaml
```

Replace with ExternalSecret resources in production.
