-- Enable pgvector extension
create extension if not exists vector;

-- Code chunks with embeddings for RAG retrieval
create table code_chunks (
  id bigint generated always as identity primary key,
  project_id text not null,
  file_path text not null,
  language text,
  chunk_type text,
  chunk_name text,
  start_line int,
  end_line int,
  content text not null,
  embedding vector(384) not null
);

-- HNSW index (works well regardless of data volume, unlike IVFFlat)
create index idx_code_chunks_embedding
  on code_chunks using hnsw (embedding vector_cosine_ops);

-- Index for filtering by project
create index idx_code_chunks_project_id on code_chunks (project_id);

-- RPC function for vector similarity search
create or replace function match_code_chunks(
  query_embedding vector(384),
  match_project_id text,
  match_count int default 8
)
returns table (
  id bigint,
  file_path text,
  language text,
  chunk_type text,
  chunk_name text,
  start_line int,
  end_line int,
  content text,
  similarity float
)
language sql stable
as $$
  select
    code_chunks.id,
    code_chunks.file_path,
    code_chunks.language,
    code_chunks.chunk_type,
    code_chunks.chunk_name,
    code_chunks.start_line,
    code_chunks.end_line,
    code_chunks.content,
    1 - (code_chunks.embedding <=> query_embedding) as similarity
  from code_chunks
  where code_chunks.project_id = match_project_id
  order by code_chunks.embedding <=> query_embedding
  limit match_count;
$$;
