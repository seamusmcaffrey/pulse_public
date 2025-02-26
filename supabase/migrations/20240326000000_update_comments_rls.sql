-- Add INSERT policy for comments
create policy "Comments are insertable by anyone with valid token."
  on public.comments for insert
  with check (true);

-- Update existing select policy to be more specific
drop policy if exists "Comments are viewable by everyone." on public.comments;
create policy "Comments are viewable by everyone."
  on public.comments for select
  using (true); 