-- NivaranSetu Legal RAG: Supabase pgvector schema.
-- Apply once through Supabase SQL Editor or migration workflow.
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text not null,
  authority text not null,
  act_title text,
  section_ref text,
  language text not null default 'en',
  effective_date date,
  source_sha256 text,
  verified_by text,
  verification_note text,
  verified_at timestamptz,
  source_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_documents_language_check
    check (language in ('en','hi','bn','mr','ta','te','kn','ml','gu','pa','or','ur'))
);

-- Keep this migration safe for projects where the initial RAG tables were created earlier.
alter table public.legal_documents add column if not exists source_sha256 text;
alter table public.legal_documents add column if not exists verified_by text;
alter table public.legal_documents add column if not exists verification_note text;
alter table public.legal_documents add column if not exists verified_at timestamptz;

create table if not exists public.legal_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  language text not null default 'en',
  embedding extensions.vector(3072) not null,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create index if not exists legal_document_chunks_embedding_hnsw
  on public.legal_document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create index if not exists legal_documents_active_idx
  on public.legal_documents(is_active, source_verified);

alter table public.legal_documents enable row level security;
alter table public.legal_document_chunks enable row level security;

-- Explicit table privileges: authenticated citizens can read through RLS only.
grant usage on schema extensions to authenticated;
grant select on public.legal_documents, public.legal_document_chunks to authenticated;
revoke insert, update, delete on public.legal_documents, public.legal_document_chunks from anon, authenticated;

-- Authenticated users can read only verified, active legal-source records.
drop policy if exists "Read verified active legal documents" on public.legal_documents;
create policy "Read verified active legal documents"
  on public.legal_documents for select to authenticated
  using (is_active = true and source_verified = true);

drop policy if exists "Read chunks from verified active documents" on public.legal_document_chunks;
create policy "Read chunks from verified active documents"
  on public.legal_document_chunks for select to authenticated
  using (
    exists (
      select 1 from public.legal_documents d
      where d.id = legal_document_chunks.document_id
        and d.is_active = true
        and d.source_verified = true
    )
  );

-- No client insert/update/delete policies are intentionally provided.
-- Ingestion uses the server-only service-role client after checking an ingestion secret.

create or replace function public.match_legal_chunks(
  query_embedding extensions.vector(3072),
  match_threshold float default 0.35,
  match_count int default 6
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  source_url text,
  authority text,
  act_title text,
  section_ref text,
  language text,
  content text,
  similarity float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    d.id as document_id,
    d.title,
    d.source_url,
    d.authority,
    d.act_title,
    d.section_ref,
    c.language,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.legal_document_chunks c
  join public.legal_documents d on d.id = c.document_id
  where d.is_active = true
    and d.source_verified = true
    and 1 - (c.embedding <=> query_embedding) >= match_threshold
  order by c.embedding <=> query_embedding
  limit greatest(1, least(match_count, 12));
$$;

revoke all on function public.match_legal_chunks(extensions.vector, float, int) from public, anon;
grant execute on function public.match_legal_chunks(extensions.vector, float, int) to authenticated;
