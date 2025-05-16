-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store document embeddings
create table if not exists documents (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(768)
);

-- Enable Row Level Security
alter table documents enable row level security;

-- Create a policy that allows users to read only their own documents
create policy "Users can read their own documents"
  on documents
  for select
  using (
    (metadata->>'userId')::text = auth.uid()
  );

-- Create a policy that allows users to insert their own documents
create policy "Users can insert their own documents"
  on documents
  for insert
  with check (
    (metadata->>'userId')::text = auth.uid()
  );

-- Create a function to search for similar documents
create or replace function match_suggestions(
  query_embedding vector(768),
  match_count int DEFAULT 5,
  filter jsonb DEFAULT '{}'
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  and (metadata->>'userId')::text = auth.uid()
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$; 