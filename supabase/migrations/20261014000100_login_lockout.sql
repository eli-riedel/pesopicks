-- Throttle PIN guessing: 8 wrong PINs for a name within 15 minutes locks that name for 15 minutes.
create table public.login_failures (
  name_key text primary key,
  fails int not null default 0,
  first_at timestamptz not null default now()
);
alter table public.login_failures enable row level security;
revoke all on public.login_failures from anon, authenticated;

create or replace function public.pp_login(p_name text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_hash text; v_tok uuid; v_key text := lower(btrim(p_name)); f public.login_failures;
begin
  select * into f from public.login_failures where name_key = v_key;
  if f.name_key is not null and f.first_at < now() - interval '15 minutes' then
    delete from public.login_failures where name_key = v_key;
    f := null;
  end if;
  if f.fails >= 8 then raise exception 'Too many tries — wait 15 minutes or ask the commissioner to reset your PIN'; end if;

  select id, pin_hash into v_id, v_hash from public.app_users where lower(name) = v_key;
  if v_id is null or v_hash <> crypt(p_pin, v_hash) then
    insert into public.login_failures (name_key, fails) values (v_key, 1)
      on conflict (name_key) do update set fails = public.login_failures.fails + 1;
    -- return (not raise) so the failure count is committed
    return json_build_object('error', 'Wrong name or PIN');
  end if;
  delete from public.login_failures where name_key = v_key;
  insert into public.sessions (user_id) values (v_id) returning token into v_tok;
  return json_build_object('token', v_tok, 'userId', v_id);
end $$;

-- A commissioner PIN reset also clears any lockout
create or replace function public.pp_reset_pin(p_token uuid, p_user uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._pp_admin(p_token);
  if p_pin !~ '^\d{4}$' then raise exception 'PIN must be 4 digits'; end if;
  update public.app_users set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_user;
  delete from public.sessions where user_id = p_user;
  delete from public.login_failures where name_key = (select lower(name) from public.app_users where id = p_user);
end $$;
