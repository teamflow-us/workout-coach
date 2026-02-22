-- Run after drizzle-kit push creates the coaching_embeddings table.
-- Can be run manually: psql $DATABASE_URL -f supabase/init/01-pgvector-index.sql
CREATE INDEX IF NOT EXISTS coaching_embeddings_vector_idx
  ON coaching_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
