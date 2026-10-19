-- Separate policies by role so anonymous Discover does not require access to
-- the private profiles table even when the SQL planner checks subqueries.
drop policy "Public or own characters" on public.characters;
create policy "Anonymous safe public characters" on public.characters for select to anon
  using (visibility = 'public' and not is_nsfw);
create policy "Public or own characters" on public.characters for select to authenticated
  using (creator_id = (select auth.uid()) or (visibility = 'public' and (not is_nsfw or exists (
    select 1 from public.profiles where id = (select auth.uid()) and nsfw_enabled and adult_confirmed
  ))));
