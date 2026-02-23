#!/bin/bash
# Runs after Supabase built-in migrate.sh to:
# 1. Set supabase_auth_admin password so GoTrue can connect
# 2. Enable pgvector extension
set -e

psql -v ON_ERROR_STOP=1 --no-password --no-psqlrc -U supabase_admin -d "${POSTGRES_DB:-postgres}" <<-EOSQL
  ALTER ROLE supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
  ALTER ROLE authenticator WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  ALTER ROLE supabase_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
  CREATE EXTENSION IF NOT EXISTS vector;
EOSQL
