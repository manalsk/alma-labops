-- ============================================================
-- ALMA LabOps — Phase 6: Knowledge Base + RAG Schema
-- Run after 005_incoming_packages.sql in Supabase SQL Editor
-- ============================================================

-- ─── Document Visibility Enum ────────────────────────────────────────────────

CREATE TYPE document_visibility AS ENUM ('all_lab_members', 'researchers_only', 'pi_only');

-- ─── Knowledge Base Documents ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kb_documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id           UUID        NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  category         TEXT        NOT NULL DEFAULT 'general',
  file_url         TEXT,
  file_path        TEXT,
  file_type        TEXT        NOT NULL DEFAULT 'text/markdown',
  uploaded_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_by_name TEXT,
  is_indexed       BOOLEAN     NOT NULL DEFAULT false,
  chunk_count      INTEGER     NOT NULL DEFAULT 0,
  visibility       document_visibility NOT NULL DEFAULT 'all_lab_members',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER kb_documents_updated_at
  BEFORE UPDATE ON kb_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Document Chunks + Embeddings ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_chunks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID        NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  lab_id       UUID        NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL,
  chunk_index  INTEGER     NOT NULL,
  embedding    vector(1536),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RAG Query Log ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rag_queries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id      UUID        NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  user_role   TEXT        NOT NULL,
  question    TEXT        NOT NULL,
  answer      TEXT,
  sources     JSONB,
  was_refused BOOLEAN     NOT NULL DEFAULT false,
  model_used  TEXT,
  tokens_used INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_kb_documents_lab        ON kb_documents(lab_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc     ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_lab     ON document_chunks(lab_id);
CREATE INDEX IF NOT EXISTS idx_rag_queries_lab         ON rag_queries(lab_id);
CREATE INDEX IF NOT EXISTS idx_rag_queries_user        ON rag_queries(user_id);

-- IVFFlat index for approximate nearest-neighbour search (cosine distance)
-- lists=5 is safe for small datasets; increase for production scale
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 5);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE kb_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_queries     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_documents_select" ON kb_documents
  FOR SELECT TO authenticated
  USING (lab_id IN (SELECT lab_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "document_chunks_select" ON document_chunks
  FOR SELECT TO authenticated
  USING (lab_id IN (SELECT lab_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "rag_queries_select" ON rag_queries
  FOR SELECT TO authenticated
  USING (lab_id IN (SELECT lab_id FROM profiles WHERE id = auth.uid()));

-- ─── pgvector Semantic Search RPC ────────────────────────────────────────────
-- Called from the backend service. Accepts embedding as float8[] to avoid
-- JSON serialisation issues with the vector type.

CREATE OR REPLACE FUNCTION search_kb_chunks(
  query_embedding float8[],
  p_lab_id        UUID,
  p_visibility    text[],
  p_top_k         INTEGER DEFAULT 5,
  p_threshold     FLOAT   DEFAULT 0.25
)
RETURNS TABLE (
  chunk_id       UUID,
  document_id    UUID,
  document_title TEXT,
  content        TEXT,
  chunk_index    INTEGER,
  visibility     document_visibility,
  similarity     FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id              AS chunk_id,
    dc.document_id,
    kd.title           AS document_title,
    dc.content,
    dc.chunk_index,
    kd.visibility,
    (1 - (dc.embedding <=> query_embedding::vector))::float AS similarity
  FROM document_chunks dc
  JOIN kb_documents kd ON dc.document_id = kd.id
  WHERE
    dc.lab_id = p_lab_id
    AND kd.visibility = ANY(p_visibility::document_visibility[])
    AND kd.is_indexed = true
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding::vector)) >= p_threshold
  ORDER BY dc.embedding <=> query_embedding::vector
  LIMIT p_top_k;
END;
$$;
