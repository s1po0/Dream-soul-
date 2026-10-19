-- DreamSoul foundation. Run as a single migration; no existing data is dropped.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  avatar_url text not null default '/images/luna.webp',
  adult_confirmed boolean not null default false,
  nsfw_enabled boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint adult_settings check ((not nsfw_enabled and not onboarding_completed) or adult_confirmed)
);
create unique index profiles_username_unique on public.profiles (lower(username));

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete cascade,
  creator_name text not null default 'dreamsoul',
  name text not null check (char_length(name) between 2 and 50),
  avatar_url text not null default '/images/luna.webp',
  tagline text not null check (char_length(tagline) between 1 and 100),
  description text not null check (char_length(description) between 20 and 6000),
  greeting text not null check (char_length(greeting) between 5 and 1500),
  example_dialogue text not null default '' check (char_length(example_dialogue) <= 3000),
  voice_style text not null default 'Warm & friendly' check (char_length(voice_style) <= 100),
  categories text[] not null default '{Friends}' check (cardinality(categories) between 1 and 6 and categories <@ array['Romance','Fantasy','Anime','Friends','Helper','Roleplay']::text[]),
  visibility text not null default 'public' check (visibility in ('public','private')),
  is_nsfw boolean not null default false,
  chat_count bigint not null default 0,
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index characters_discover on public.characters(visibility, chat_count desc);
create index characters_categories on public.characters using gin(categories);
create index characters_creator on public.characters(creator_id);

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  last_message text not null default '',
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, character_id)
);
create index chats_user_updated on public.chats(user_id, updated_at desc);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 16000),
  created_at timestamptz not null default clock_timestamp()
);
create index messages_history on public.messages(chat_id, created_at desc);
create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,character_id)
);
create table public.character_blocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,character_id)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  character_id uuid references public.characters(id) on delete set null,
  reason text not null check (reason in ('Inappropriate content','Harmful behavior','Impersonation','Other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'pending' check (status in ('pending','reviewed','resolved')),
  created_at timestamptz not null default now()
);
create table private.chat_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chat_id uuid not null references public.chats(id) on delete cascade,
  status text not null default 'active' check (status in ('active','complete','failed')),
  created_at timestamptz not null default now()
);
create index chat_requests_rate_window on private.chat_requests(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.favorites enable row level security;
alter table public.character_blocks enable row level security;
alter table public.reports enable row level security;
alter table private.chat_requests enable row level security;

create policy "Own profile only" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Public or own characters" on public.characters for select to anon, authenticated using (
  creator_id = (select auth.uid()) or (visibility = 'public' and (not is_nsfw or exists (select 1 from public.profiles where id = (select auth.uid()) and nsfw_enabled and adult_confirmed)))
);
create policy "Adults create own characters" on public.characters for insert to authenticated with check (creator_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and adult_confirmed and onboarding_completed));
create policy "Update own characters" on public.characters for update to authenticated using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));
create policy "Delete own characters" on public.characters for delete to authenticated using (creator_id = (select auth.uid()));
create policy "Own threads" on public.chats for select to authenticated using (user_id = (select auth.uid()));
create policy "Adults start accessible chats" on public.chats for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and adult_confirmed and onboarding_completed)
  and exists (select 1 from public.characters where id = character_id)
  and not exists (select 1 from public.character_blocks where character_id = chats.character_id and user_id = (select auth.uid()))
);
create policy "Read own messages" on public.messages for select to authenticated using (exists (select 1 from public.chats where id = chat_id and user_id = (select auth.uid())));
create policy "Own favorites" on public.favorites for select to authenticated using (user_id = (select auth.uid()));
create policy "Favorite accessible characters" on public.favorites for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.characters where id = character_id));
create policy "Remove own favorites" on public.favorites for delete to authenticated using (user_id = (select auth.uid()));
create policy "Read own blocks" on public.character_blocks for select to authenticated using (user_id = (select auth.uid()));
create policy "Add own blocks" on public.character_blocks for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Remove own blocks" on public.character_blocks for delete to authenticated using (user_id = (select auth.uid()));
create policy "Submit own reports" on public.reports for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.characters where id = character_id));

-- Restrict writable columns as well as rows. Clients cannot forge AI messages,
-- manipulate counters/ratings, change report status, or bypass the rate limiter.
revoke all on public.profiles, public.characters, public.chats, public.messages, public.favorites, public.reports, public.character_blocks from anon, authenticated;
grant select on public.characters to anon, authenticated;
grant select on public.profiles, public.chats, public.messages, public.favorites, public.character_blocks to authenticated;
grant update(username, avatar_url, adult_confirmed, nsfw_enabled, onboarding_completed) on public.profiles to authenticated;
grant insert(creator_id, creator_name, name, avatar_url, tagline, description, greeting, example_dialogue, voice_style, categories, visibility, is_nsfw) on public.characters to authenticated;
grant update(creator_name, name, avatar_url, tagline, description, greeting, example_dialogue, voice_style, categories, visibility, is_nsfw) on public.characters to authenticated;
grant delete on public.characters to authenticated;
grant insert(user_id, character_id) on public.chats, public.favorites, public.character_blocks to authenticated;
grant delete on public.favorites, public.character_blocks to authenticated;
grant insert(user_id, character_id, reason, details) on public.reports to authenticated;
grant all on public.profiles, public.characters, public.chats, public.messages, public.favorites, public.reports, public.character_blocks to service_role;
grant usage on schema private to service_role;
grant all on private.chat_requests to service_role;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, username, avatar_url)
  values (new.id, 'dreamer_' || substr(replace(new.id::text,'-',''),1,12), '/images/luna.webp');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
revoke all on function public.handle_new_user() from public, anon, authenticated;

create function public.character_updated() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at = now();
  if new.creator_id is not null then select username into new.creator_name from public.profiles where id = new.creator_id; end if;
  return new;
end;
$$;
create trigger character_before_write before insert or update on public.characters for each row execute function public.character_updated();
revoke all on function public.character_updated() from public, anon, authenticated;
create function public.count_new_chat() returns trigger language plpgsql security definer set search_path = '' as $$
begin update public.characters set chat_count = chat_count + 1 where id = new.character_id; return new; end;
$$;
create trigger count_character_chat after insert on public.chats for each row execute function public.count_new_chat();
revoke all on function public.count_new_chat() from public, anon, authenticated;

-- Atomic, service-only reservation. Every generation, edit and regeneration counts.
-- The lock prevents simultaneous requests from passing the rolling-hour limit.
create function public.begin_chat_turn(p_user_id uuid, p_character_id uuid, p_content text default '', p_mode text default 'send', p_edit_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_character public.characters;
  v_profile public.profiles;
  v_chat public.chats;
  v_last public.messages;
  v_user_message public.messages;
  v_request uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into v_profile from public.profiles where id = p_user_id;
  if not found or not v_profile.adult_confirmed or not v_profile.onboarding_completed then raise exception 'ONBOARDING_REQUIRED'; end if;
  select * into v_character from public.characters where id = p_character_id;
  if not found or (v_character.visibility <> 'public' and v_character.creator_id is distinct from p_user_id) then raise exception 'CHARACTER_NOT_FOUND'; end if;
  if v_character.is_nsfw and not v_profile.nsfw_enabled then raise exception 'SAFETY_FILTER'; end if;
  if exists (select 1 from public.character_blocks where user_id = p_user_id and character_id = p_character_id) then raise exception 'CHARACTER_BLOCKED'; end if;
  if p_mode not in ('send','edit','regenerate','restart') then raise exception 'INVALID_MODE'; end if;

  if p_mode <> 'restart' and (select count(*) from private.chat_requests where user_id = p_user_id and created_at > now() - interval '1 hour') >= 30 then raise exception 'RATE_LIMIT'; end if;
  insert into public.chats(user_id,character_id) values(p_user_id,p_character_id) on conflict(user_id,character_id) do nothing;
  select * into v_chat from public.chats where user_id = p_user_id and character_id = p_character_id for update;
  if v_chat.locked_until > now() then raise exception 'CHAT_BUSY'; end if;

  if p_mode = 'restart' then
    delete from public.messages where chat_id = v_chat.id;
    update public.chats set last_message = '', updated_at = now(), locked_until = null where id = v_chat.id;
    return jsonb_build_object('chat_id',v_chat.id);
  end if;
  if p_mode in ('send','edit') and (p_content is null or char_length(trim(p_content)) not between 1 and 4000) then raise exception 'INVALID_MESSAGE'; end if;
  select * into v_last from public.messages where chat_id = v_chat.id order by created_at desc, id desc limit 1;
  if p_mode = 'regenerate' then
    if v_last.id is null then raise exception 'NOTHING_TO_REGENERATE'; end if;
    if v_last.role = 'assistant' then
      if not exists (select 1 from public.messages where chat_id = v_chat.id and role = 'user') then raise exception 'NOTHING_TO_REGENERATE'; end if;
      delete from public.messages where id = v_last.id;
    end if;
  elsif p_mode = 'edit' then
    select * into v_user_message from public.messages where chat_id = v_chat.id and role = 'user' order by created_at desc, id desc limit 1;
    if v_user_message.id is null or v_user_message.id is distinct from p_edit_id then raise exception 'ONLY_LAST_MESSAGE_EDITABLE'; end if;
    delete from public.messages where chat_id = v_chat.id and created_at > v_user_message.created_at;
    update public.messages set content = trim(p_content) where id = v_user_message.id returning * into v_user_message;
  else
    if v_last.id is null then insert into public.messages(chat_id,role,content) values(v_chat.id,'assistant',v_character.greeting); end if;
    insert into public.messages(chat_id,role,content) values(v_chat.id,'user',trim(p_content)) returning * into v_user_message;
  end if;
  insert into private.chat_requests(user_id,chat_id) values(p_user_id,v_chat.id) returning id into v_request;
  update public.chats set locked_until = now() + interval '2 minutes', last_message = coalesce(v_user_message.content,last_message), updated_at = now() where id = v_chat.id;
  return jsonb_build_object('request_id',v_request,'chat_id',v_chat.id,'user_message',to_jsonb(v_user_message));
end;
$$;
revoke all on function public.begin_chat_turn(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.begin_chat_turn(uuid,uuid,text,text,uuid) to service_role;

create function public.finish_chat_turn(p_request_id uuid, p_content text default '', p_failed boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request private.chat_requests; v_message public.messages;
begin
  select * into v_request from private.chat_requests where id = p_request_id for update;
  if not found or v_request.status <> 'active' then raise exception 'INVALID_REQUEST'; end if;
  if not p_failed and length(trim(p_content)) > 0 then
    insert into public.messages(chat_id,role,content) values(v_request.chat_id,'assistant',left(p_content,16000)) returning * into v_message;
  end if;
  update private.chat_requests set status = case when p_failed then 'failed' else 'complete' end where id = p_request_id;
  update public.chats set locked_until = null, updated_at = now(), last_message = coalesce(v_message.content,last_message) where id = v_request.chat_id;
  return to_jsonb(v_message);
end;
$$;
revoke all on function public.finish_chat_turn(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.finish_chat_turn(uuid,text,boolean) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "Public avatar reading" on storage.objects for select to anon, authenticated using(bucket_id = 'avatars');
create policy "Upload own avatars" on storage.objects for insert to authenticated with check(bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Update own avatars" on storage.objects for update to authenticated using(bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text) with check(bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own avatars" on storage.objects for delete to authenticated using(bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Backfill any accounts created before DreamSoul was installed.
insert into public.profiles(id, username) select id, 'dreamer_' || substr(replace(id::text,'-',''),1,12) from auth.users on conflict(id) do nothing;
