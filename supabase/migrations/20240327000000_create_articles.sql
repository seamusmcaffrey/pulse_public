-- Create articles table
create table public.articles (
  id text primary key,
  link text not null,
  title text not null,
  authors text[],
  journal text,
  publication_date date,
  doi text,
  abstract text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add indexes for performance
create index articles_link_idx on public.articles(link);
create index articles_doi_idx on public.articles(doi);

-- Add RLS policies
alter table public.articles enable row level security;

-- Articles are viewable by everyone
create policy "Articles are viewable by everyone."
  on public.articles for select
  using (true);

-- Articles are insertable by authenticated users
create policy "Articles are insertable by authenticated users."
  on public.articles for insert
  with check (auth.role() = 'authenticated'); 