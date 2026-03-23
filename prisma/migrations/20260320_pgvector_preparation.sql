-- pgvector preparation migration
-- This migration is OPTIONAL and only needed when enabling vector search.
-- The system works fully without this migration (SQL-first retrieval).
--
-- To apply:
--   psql -d dentzi_ai -f prisma/migrations/20260320_pgvector_preparation.sql
--
-- Prerequisites:
--   PostgreSQL 16+ with pgvector extension available

-- Step 1: Enable the vector extension (requires superuser or create_extension privilege)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add embedding column to knowledge_document
-- ALTER TABLE knowledge_document ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Step 3: Create vector index for cosine similarity
-- CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
--   ON knowledge_document USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);

-- NOTE: All lines are commented out intentionally.
-- Uncomment and run when ready to enable vector search.
-- The Prisma schema has a commented-out `embedding` field for this purpose.
