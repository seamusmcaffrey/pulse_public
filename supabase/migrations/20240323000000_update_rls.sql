-- Drop existing policies
drop policy if exists "Email tokens are insertable by authenticated users." on public.email_tokens;
drop policy if exists "Email tokens are viewable by authenticated users." on public.email_tokens;

-- Create new policies that allow service role and anon role
create policy "Email tokens are insertable by anyone."
  on public.email_tokens for insert
  with check (true);

create policy "Email tokens are viewable by anyone."
  on public.email_tokens for select
  using (true); 