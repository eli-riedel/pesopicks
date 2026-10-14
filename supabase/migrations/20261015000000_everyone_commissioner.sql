-- Everyone in the crew is a commissioner: new sign-ups get admin rights.
-- The trip code is still required for everyone after the first person.
create or replace function public.pp_signup(p_name text, p_pin text, p_code text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_first boolean; v_id uuid; v_tok uuid; v_bal numeric;
begin
  p_name := btrim(p_name);
  if p_name = '' then raise exception 'Enter your name'; end if;
  if p_pin !~ '^\d{4}$' then raise exception 'PIN must be 4 digits'; end if;
  v_first := not exists (select 1 from public.app_users);
  if not v_first and upper(btrim(coalesce(p_code, ''))) <> (select upper(invite_code) from public.secrets where id = 1) then
    raise exception 'Wrong trip code';
  end if;
  if exists (select 1 from public.app_users where lower(name) = lower(p_name)) then
    raise exception 'Name already taken — log in instead';
  end if;
  select starting_balance into v_bal from public.settings where id = 1;
  insert into public.app_users (name, pin_hash, is_admin, balance)
    values (p_name, crypt(p_pin, gen_salt('bf')), true, v_bal) returning id into v_id;
  insert into public.sessions (user_id) values (v_id) returning token into v_tok;
  perform public._pp_bump();
  return json_build_object('token', v_tok, 'userId', v_id);
end $$;

-- Anyone who already joined becomes a commissioner too
update public.app_users set is_admin = true where not is_admin;
