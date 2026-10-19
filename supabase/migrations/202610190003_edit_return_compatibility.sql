-- Compatibility for the first hosted function revision. A fresh installation
-- already has RETURNING in the foundation, so this is intentionally a no-op.
do $patch$
declare definition text;
begin
 select pg_get_functiondef('public.begin_chat_turn(uuid,uuid,text,text,uuid)'::regprocedure) into definition;
 if position('update public.messages set content=trim(p_content) where id=v_user_message.id;' in definition) > 0 then
  execute replace(definition,
    'update public.messages set content=trim(p_content) where id=v_user_message.id;',
    'update public.messages set content=trim(p_content) where id=v_user_message.id returning * into v_user_message;');
 end if;
end;
$patch$;
