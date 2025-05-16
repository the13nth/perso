-- Create the match_suggestions function for similarity search
create or replace function match_suggestions(
  query_embedding vector(768),
  match_count int default 5
)
returns table (
  id bigint,
  document_id bigint,
  original_text text,
  suggested_text text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    s.id,
    s.document_id,
    s.original_text,
    s.suggested_text,
    s.metadata,
    1 - (s.embedding <=> query_embedding) as similarity
  from suggestion s
  where s.embedding is not null
  order by s.embedding <=> query_embedding
  limit match_count;
end;
$$; 