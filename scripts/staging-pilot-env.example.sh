#!/usr/bin/env sh
# Example env for local/staging multi-tenant pilot — copy to staging-pilot-env.sh and fill secrets.
export MASTYF_AI_MULTI_TENANT_ENABLED=true
export MASTYF_AI_STRICT_MODE=true
export MASTYF_AI_JWT_TENANT_CLAIM=tenant_id
export DASHBOARD_ENABLED=true
export DASHBOARD_AUTH_DISABLED=false
export DASHBOARD_JWT_SECRET=change-me-staging-jwt-secret
export DATABASE_URL=postgresql://mastyf-ai:mastyf-ai@127.0.0.1:5432/mastyf-ai
export REDIS_URL=redis://127.0.0.1:6379
export MASTYF_AI_RESPONSE_DLP_MODE=block
export DB_TYPE=postgres
