-- NivaranSetu Legal RAG: Supabase pgvector + Private Storage schema.
-- Apply once through Supabase SQL Editor or migration workflow.
create extension if not exists vector with schema extensions;

-- Private storage bucket(s) for original verified official legal PDFs (server-side ingestion only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'legal-sources',
    'legal-sources',
    false,
    52428800,
    array['application/pdf', 'text/plain']
  ),
  (
    'legal-documents',
    'legal-documents',
    false,
    52428800,
    array['application/pdf', 'text/plain']
  )
on conflict (id) do update
set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = array['application/pdf', 'text/plain'];

create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_url text not null,
  authority text not null,
  act_title text,
  section_ref text,
  language text not null default 'en',
  effective_date date,
  total_pages integer not null default 1 check (total_pages >= 1),
  storage_bucket text,
  storage_path text,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  file_sha256 text,
  source_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_documents_language_check
    check (language in ('en','hi','bn','mr','ta','te','kn','ml','gu','pa','or','ur'))
);

alter table public.legal_documents
  add column if not exists total_pages integer not null default 1,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists file_sha256 text;

create table if not exists public.legal_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  chunk_index integer not null,
  page_number integer not null default 1 check (page_number >= 1),
  section_ref text,
  content text not null,
  language text not null default 'en',
  embedding extensions.vector(3072) not null,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

alter table public.legal_document_chunks
  add column if not exists page_number integer not null default 1,
  add column if not exists section_ref text;

-- pgvector HNSW index: vector supports up to 2000 dims; cast to halfvec(3072) when available (pgvector >= 0.7)
-- while preserving full 3072-dimensional vector(3072) storage and exact cosine scoring in match_legal_chunks.
drop index if exists public.legal_document_chunks_embedding_hnsw;
do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'extensions' and t.typname = 'halfvec'
  ) then
    execute '
      create index if not exists legal_document_chunks_embedding_hnsw
      on public.legal_document_chunks
      using hnsw ((embedding::extensions.halfvec(3072)) extensions.halfvec_cosine_ops)
    ';
  end if;
end $$;

create index if not exists legal_documents_active_idx
  on public.legal_documents(is_active, source_verified);

create index if not exists legal_document_chunks_doc_page_idx
  on public.legal_document_chunks(document_id, page_number, chunk_index);

alter table public.legal_documents enable row level security;
alter table public.legal_document_chunks enable row level security;

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

drop function if exists public.match_legal_chunks(extensions.vector, float, int);
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
  page_number integer,
  storage_path text,
  effective_date date,
  source_verified boolean,
  is_active boolean,
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
    coalesce(c.section_ref, d.section_ref) as section_ref,
    c.language,
    c.page_number,
    d.storage_path,
    d.effective_date,
    d.source_verified,
    d.is_active,
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

revoke all on function public.match_legal_chunks(extensions.vector, float, int) from public;
grant execute on function public.match_legal_chunks(extensions.vector, float, int) to authenticated;
grant execute on function public.match_legal_chunks(extensions.vector, float, int) to service_role;
