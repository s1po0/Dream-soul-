-- Execute against a test or development project as the database owner.
-- Fixtures, auth users, rate requests and activity-counter changes are rolled back.
begin;
do $$
begin
  perform set_config('dreamsoul.test_owner', gen_random_uuid()::text, true);
  perform set_config('dreamsoul.test_other', gen_random_uuid()::text, true);
  perform set_config('dreamsoul.test_public', gen_random_uuid()::text, true);
  perform set_config('dreamsoul.test_private', gen_random_uuid()::text, true);
  perform set_config('dreamsoul.test_other_private', gen_random_uuid()::text, true);
  insert into auth.users(id,email) values
    (current_setting('dreamsoul.test_owner')::uuid,'ds-test-'||current_setting('dreamsoul.test_owner')||'@example.invalid'),
    (current_setting('dreamsoul.test_other')::uuid,'ds-test-'||current_setting('dreamsoul.test_other')||'@example.invalid');
  update public.profiles set adult_confirmed=true,onboarding_completed=true where id in(current_setting('dreamsoul.test_owner')::uuid,current_setting('dreamsoul.test_other')::uuid);
  insert into public.characters(id,creator_id,name,tagline,description,greeting,visibility) values
    (current_setting('dreamsoul.test_public')::uuid,current_setting('dreamsoul.test_other')::uuid,'Test Public','A safe test.','A friendly adult test character with a warm personality.','Hello, this is a test.','public'),
    (current_setting('dreamsoul.test_private')::uuid,current_setting('dreamsoul.test_owner')::uuid,'Test Private','A private test.','A friendly adult private test character with a warm personality.','Hello, this is a private test.','private'),
    (current_setting('dreamsoul.test_other_private')::uuid,current_setting('dreamsoul.test_other')::uuid,'Other Private','Another private test.','A friendly adult private test character with a warm personality.','Hello, this is another private test.','private');
  perform set_config('request.jwt.claim.sub',current_setting('dreamsoul.test_owner'),true);
end $$;
set local role authenticated;
do $$
declare affected integer;
begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Profile isolation failed'; end if;
  if not exists(select 1 from public.characters where id=current_setting('dreamsoul.test_public')::uuid) then raise exception 'Public reading failed'; end if;
  if not exists(select 1 from public.characters where id=current_setting('dreamsoul.test_private')::uuid) then raise exception 'Own private reading failed'; end if;
  if exists(select 1 from public.characters where id=current_setting('dreamsoul.test_other_private')::uuid) then raise exception 'Other private character leaked'; end if;
  update public.profiles set username='should_not_update' where id=current_setting('dreamsoul.test_other')::uuid;
  get diagnostics affected=row_count;
  if affected <> 0 then raise exception 'Other profile editable'; end if;
  update public.characters set tagline='Should not update' where id=current_setting('dreamsoul.test_public')::uuid;
  get diagnostics affected=row_count;
  if affected <> 0 then raise exception 'Other character editable'; end if;
  if has_table_privilege('authenticated','public.messages','INSERT') then raise exception 'Clients can forge messages'; end if;
  if has_column_privilege('authenticated','public.characters','chat_count','UPDATE') then raise exception 'Clients can forge activity counts'; end if;
  if has_function_privilege('authenticated','public.begin_chat_turn(uuid,uuid,text,text,uuid)','EXECUTE') then raise exception 'Clients can bypass edge authorization'; end if;
end $$;
reset role;
set local role anon;
do $$
begin
  if not exists(select 1 from public.characters where id=current_setting('dreamsoul.test_public')::uuid) then raise exception 'Anonymous public reading failed'; end if;
  if exists(select 1 from public.characters where id=current_setting('dreamsoul.test_other_private')::uuid) then raise exception 'Anonymous private character leaked'; end if;
  if has_table_privilege('anon','public.messages','SELECT') then raise exception 'Anonymous message access'; end if;
end $$;
reset role;
do $$
declare turn jsonb; blocked boolean:=false; rate_limited boolean:=false; i integer;
begin
  turn:=public.begin_chat_turn(current_setting('dreamsoul.test_owner')::uuid,current_setting('dreamsoul.test_public')::uuid,'Test first turn');
  begin
    perform public.begin_chat_turn(current_setting('dreamsoul.test_owner')::uuid,current_setting('dreamsoul.test_public')::uuid,'Concurrent turn');
  exception when raise_exception then
    if sqlerrm like '%CHAT_BUSY%' then blocked:=true; else raise; end if;
  end;
  if not blocked then raise exception 'Concurrent chat lock failed'; end if;
  perform public.finish_chat_turn((turn->>'request_id')::uuid,'A safe first test reply.');
  for i in 2..30 loop
    turn:=public.begin_chat_turn(current_setting('dreamsoul.test_owner')::uuid,current_setting('dreamsoul.test_public')::uuid,'Rate limit test '||i);
    perform public.finish_chat_turn((turn->>'request_id')::uuid,'A safe test reply.');
  end loop;
  begin
    perform public.begin_chat_turn(current_setting('dreamsoul.test_owner')::uuid,current_setting('dreamsoul.test_public')::uuid,'Request 31');
  exception when raise_exception then
    if sqlerrm like '%RATE_LIMIT%' then rate_limited:=true; else raise; end if;
  end;
  if not rate_limited then raise exception '30/hour rate limit failed'; end if;
  if (select count(*) from public.chats where user_id=current_setting('dreamsoul.test_owner')::uuid) <> 1 then raise exception 'Duplicate character threads'; end if;
end $$;
rollback;
select 'PASS: owner isolation, public/private reads, protected message writes, counters, service-only RPCs, chat concurrency, one thread per character, and 30/hour limit' as result;
