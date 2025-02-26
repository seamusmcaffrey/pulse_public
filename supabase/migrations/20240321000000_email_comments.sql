-- Create experts table
create table public.experts (
  email text primary key,
  name text not null,
  title text,
  organization text,
  h_index integer,
  citations integer,
  verified boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create comments table
create table public.comments (
  id uuid primary key default uuid_generate_v4(),
  article_id text not null,
  expert_email text references public.experts(email),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create email tokens table
create table public.email_tokens (
  token uuid primary key default uuid_generate_v4(),
  expert_email text references public.experts(email),
  article_id text not null,
  expires_at timestamp with time zone not null,
  used boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table public.experts enable row level security;
alter table public.comments enable row level security;
alter table public.email_tokens enable row level security;

-- Experts policies
create policy "Experts are viewable by everyone."
  on public.experts for select
  using (true);

-- Comments policies
create policy "Comments are viewable by everyone."
  on public.comments for select
  using (true);

-- Email tokens policies
create policy "Email tokens are insertable by authenticated users."
  on public.email_tokens for insert
  with check (auth.role() = 'authenticated');

create policy "Email tokens are viewable by authenticated users."
  on public.email_tokens for select
  using (auth.role() = 'authenticated');
