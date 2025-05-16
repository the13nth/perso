-- Create a function to set up the documents table and vector extension
create or replace function create_documents_table()
returns void
language plpgsql
security definer
as $$
begin
  -- Enable the vector extension if not already enabled
  create extension if not exists vector;

  -- Create the documents table if it doesn't exist
  create table if not exists documents (
    id bigserial primary key,
    content text,
    metadata jsonb,
    embedding vector(768)
  );

  -- Enable RLS
  alter table documents enable row level security;

  -- Create policies if they don't exist
  do $$
  begin
    -- Check if the select policy exists
    if not exists (
      select 1 from pg_policies 
      where tablename = 'documents' 
      and policyname = 'Users can read their own documents'
    ) then
      create policy "Users can read their own documents"
        on documents for select
        using ((metadata->>'userId')::text = auth.uid());
    end if;

    -- Check if the insert policy exists
    if not exists (
      select 1 from pg_policies 
      where tablename = 'documents' 
      and policyname = 'Users can insert their own documents'
    ) then
      create policy "Users can insert their own documents"
        on documents for insert
        with check ((metadata->>'userId')::text = auth.uid());
    end if;
  end;
  $$;

  -- Create the similarity search function if it doesn't exist
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
end;
$$; 