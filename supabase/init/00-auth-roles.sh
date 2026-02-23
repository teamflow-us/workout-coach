#!/bin/bash
# Runs after Supabase built-in migrate.sh to:
# 1. Set passwords for all Supabase service roles
# 2. Enable pgvector extension
set -e

psql -v ON_ERROR_STOP=1 --no-password --no-psqlrc -U supabase_admin -d "${POSTGRES_DB:-postgres}" <<-EOSQL
  -- Auth service role
  ALTER ROLE supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
  -- PostgREST authenticator
  ALTER ROLE authenticator WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  -- Admin role (used by Meta, Studio, Realtime)
  ALTER ROLE supabase_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
  -- Storage service role
  ALTER ROLE supabase_storage_admin WITH PASSWORD '${POSTGRES_PASSWORD}';

  -- Enable pgvector
  CREATE EXTENSION IF NOT EXISTS vector;
EOSQL
