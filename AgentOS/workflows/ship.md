# Workflow: /ship
Production readiness verification and release deployment.

## Steps
1. **Run All Deterministic Gates**: Typecheck, lint, unit tests, integration tests, E2E browser tests.
2. **Deployment Health Verification**: Test health endpoints, database connection, and latency.
3. **Autonomy Guardrail**: Enforce human authorization for Level 3 Production deployments.
4. **Delivery**: Tag release and summarize deployment metrics.
