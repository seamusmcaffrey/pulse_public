-- Create email_events table
create table public.email_events (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  event_type text not null,
  message_id text not null,
  timestamp timestamp with time zone not null,
  metadata jsonb not null default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table public.email_events enable row level security;

-- Email events are insertable by the service role
create policy "Email events are insertable by service role."
  on public.email_events for insert
  with check (auth.role() = 'service_role');

-- Email events are viewable by authenticated users
create policy "Email events are viewable by authenticated users."
  on public.email_events for select
  using (auth.role() = 'authenticated');

-- Create indexes
create index email_events_email_idx on public.email_events(email);
create index email_events_event_type_idx on public.email_events(event_type);
create index email_events_timestamp_idx on public.email_events(timestamp); 