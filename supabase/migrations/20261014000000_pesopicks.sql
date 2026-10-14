-- PesoPicks schema. Reads are public (anon) except secrets/sessions/pin hashes.
-- Every write goes through a SECURITY DEFINER function that checks a session token.

create extension if not exists pgcrypto with schema extensions;

create table public.settings (
  id int primary key default 1 check (id = 1),
  trip_name text not null default 'Mexico Trip',
  starting_balance numeric not null default 1000
);
insert into public.settings (id) values (1);

create table public.secrets (
  id int primary key default 1 check (id = 1),
  invite_code text not null default 'MEXICO'
);
insert into public.secrets (id) values (1);

create table public.ticks (
  id int primary key default 1 check (id = 1),
  n bigint not null default 0,
  at timestamptz not null default now()
);
insert into public.ticks (id) values (1);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text,
  emoji text,
  color text,
  photo text,
  created_at timestamptz not null default now()
);

create table public.props (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete restrict,
  stat text not null,
  category text not null default 'Misc',
  line numeric not null,
  kind text not null default 'standard' check (kind in ('standard', 'goblin', 'demon')),
  event text not null default '',
  starts_at timestamptz,
  status text not null default 'open' check (status in ('open', 'locked', 'final', 'void')),
  current numeric not null default 0,
  result numeric,
  created_at timestamptz not null default now()
);
create index props_player_idx on public.props (player_id);

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  is_admin boolean not null default false,
  balance numeric not null default 0,
  player_id uuid references public.players (id) on delete set null,
  avatar text,
  created_at timestamptz not null default now()
);
create unique index app_users_name_idx on public.app_users (lower(name));
create index app_users_player_idx on public.app_users (player_id);

create table public.sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index sessions_user_idx on public.sessions (user_id);

create table public.lineups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  mode text not null check (mode in ('power', 'flex')),
  amount numeric not null,
  picks jsonb not null,
  multiplier numeric not null,
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'refunded')),
  payout numeric not null default 0,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index lineups_user_idx on public.lineups (user_id);

-- ---------- access ----------
alter table public.settings enable row level security;
alter table public.secrets enable row level security;
alter table public.ticks enable row level security;
alter table public.players enable row level security;
alter table public.props enable row level security;
alter table public.app_users enable row level security;
alter table public.sessions enable row level security;
alter table public.lineups enable row level security;

revoke all on public.settings, public.secrets, public.ticks, public.players, public.props,
  public.app_users, public.sessions, public.lineups from anon, authenticated;

grant select on public.settings, public.ticks, public.players, public.props, public.lineups to anon, authenticated;
grant select (id, name, is_admin, balance, player_id, avatar, created_at) on public.app_users to anon, authenticated;

create policy "public read" on public.settings for select to anon, authenticated using (true);
create policy "public read" on public.ticks for select to anon, authenticated using (true);
create policy "public read" on public.players for select to anon, authenticated using (true);
create policy "public read" on public.props for select to anon, authenticated using (true);
create policy "public read" on public.lineups for select to anon, authenticated using (true);
create policy "public read" on public.app_users for select to anon, authenticated using (true);

alter publication supabase_realtime add table public.ticks;

-- ---------- helpers ----------
create or replace function public._pp_bump() returns void
language sql security definer set search_path = public as $$
  update public.ticks set n = n + 1, at = now() where id = 1;
$$;

create or replace function public._pp_uid(p_token uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select user_id into v from public.sessions where token = p_token;
  if v is null then raise exception 'Please log in again'; end if;
  return v;
end $$;

create or replace function public._pp_admin(p_token uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  v := public._pp_uid(p_token);
  if not exists (select 1 from public.app_users where id = v and is_admin) then
    raise exception 'Commissioner only';
  end if;
  return v;
end $$;

revoke execute on function public._pp_bump(), public._pp_uid(uuid), public._pp_admin(uuid) from public, anon, authenticated;

-- ---------- auth ----------
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
    values (p_name, crypt(p_pin, gen_salt('bf')), v_first, v_bal) returning id into v_id;
  insert into public.sessions (user_id) values (v_id) returning token into v_tok;
  perform public._pp_bump();
  return json_build_object('token', v_tok, 'userId', v_id);
end $$;

create or replace function public.pp_login(p_name text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_hash text; v_tok uuid;
begin
  select id, pin_hash into v_id, v_hash from public.app_users where lower(name) = lower(btrim(p_name));
  if v_id is null or v_hash <> crypt(p_pin, v_hash) then raise exception 'Wrong name or PIN'; end if;
  insert into public.sessions (user_id) values (v_id) returning token into v_tok;
  return json_build_object('token', v_tok, 'userId', v_id);
end $$;

create or replace function public.pp_logout(p_token uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.sessions where token = p_token;
$$;

create or replace function public.pp_whoami(p_token uuid) returns uuid
language sql security definer set search_path = public as $$
  select user_id from public.sessions where token = p_token;
$$;

-- ---------- player actions ----------
create or replace function public.pp_submit_lineup(p_token uuid, p_mode text, p_amount numeric, p_picks jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid; v_n int; v_pick jsonb; v_prop public.props; v_side text;
  v_out jsonb := '[]'::jsonb; v_players uuid[] := '{}'; v_factor numeric := 1;
  v_bal numeric; v_mult numeric; v_id uuid;
begin
  v_uid := public._pp_uid(p_token);
  v_n := jsonb_array_length(p_picks);
  if p_mode not in ('power', 'flex') then raise exception 'Bad play type'; end if;
  if v_n < 2 then raise exception 'Add at least 2 picks'; end if;
  if v_n > 6 then raise exception 'Max 6 picks per lineup'; end if;
  if p_mode = 'flex' and v_n < 3 then raise exception 'Flex Play needs 3+ picks'; end if;
  for v_pick in select * from jsonb_array_elements(p_picks) loop
    select * into v_prop from public.props where id = (v_pick ->> 'propId')::uuid;
    if v_prop.id is null or v_prop.status <> 'open' or (v_prop.starts_at is not null and v_prop.starts_at <= now()) then
      raise exception 'A pick is no longer available';
    end if;
    v_side := v_pick ->> 'side';
    if v_side not in ('more', 'less') then raise exception 'Bad pick'; end if;
    if v_prop.kind <> 'standard' and v_side <> 'more' then raise exception 'Goblins & Demons are More only'; end if;
    if v_prop.player_id = any (v_players) then raise exception 'Only one pick per person'; end if;
    v_players := v_players || v_prop.player_id;
    v_factor := v_factor * case v_prop.kind when 'goblin' then 0.8 when 'demon' then 1.5 else 1 end;
    v_out := v_out || jsonb_build_object('propId', v_prop.id, 'playerId', v_prop.player_id, 'side', v_side, 'line', v_prop.line, 'kind', v_prop.kind);
  end loop;
  p_amount := round(p_amount, 2);
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount'; end if;
  select balance into v_bal from public.app_users where id = v_uid for update;
  if p_amount > v_bal then raise exception 'Not enough balance'; end if;
  v_mult := case when p_mode = 'power' then
              case v_n when 2 then 3 when 3 then 5 when 4 then 10 when 5 then 20 else 37.5 end
            else
              case v_n when 3 then 2.25 when 4 then 5 when 5 then 10 else 25 end
            end;
  v_mult := round(v_mult * v_factor, 2);
  update public.app_users set balance = balance - p_amount where id = v_uid;
  insert into public.lineups (user_id, mode, amount, picks, multiplier)
    values (v_uid, p_mode, p_amount, v_out, v_mult) returning id into v_id;
  perform public._pp_bump();
  return v_id;
end $$;

create or replace function public.pp_update_profile(p_token uuid, p_avatar text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.app_users set avatar = p_avatar where id = public._pp_uid(p_token);
  perform public._pp_bump();
end $$;

-- ---------- commissioner ----------
create or replace function public.pp_save_settings(p_token uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._pp_admin(p_token);
  update public.settings set
    trip_name = coalesce(p ->> 'tripName', trip_name),
    starting_balance = coalesce((p ->> 'startingBalance')::numeric, starting_balance)
  where id = 1;
  if p ? 'inviteCode' and btrim(p ->> 'inviteCode') <> '' then
    update public.secrets set invite_code = btrim(p ->> 'inviteCode') where id = 1;
  end if;
  perform public._pp_bump();
end $$;

create or replace function public.pp_get_invite_code(p_token uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform public._pp_admin(p_token);
  return (select invite_code from public.secrets where id = 1);
end $$;

create or replace function public.pp_save_player(p_token uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public._pp_admin(p_token);
  if p ? 'id' and p ->> 'id' is not null then
    update public.players set name = p ->> 'name', nickname = p ->> 'nickname', emoji = p ->> 'emoji',
      color = p ->> 'color', photo = p ->> 'photo'
    where id = (p ->> 'id')::uuid returning id into v_id;
  else
    insert into public.players (name, nickname, emoji, color, photo)
      values (p ->> 'name', p ->> 'nickname', p ->> 'emoji', p ->> 'color', p ->> 'photo') returning id into v_id;
  end if;
  perform public._pp_bump();
  return v_id;
end $$;

create or replace function public.pp_delete_player(p_token uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._pp_admin(p_token);
  if exists (select 1 from public.props where player_id = p_id) then raise exception 'Delete their props first'; end if;
  delete from public.players where id = p_id;
  perform public._pp_bump();
end $$;

create or replace function public._pp_prop_from_json(p jsonb) returns public.props
language plpgsql set search_path = public as $$
declare r public.props;
begin
  r.player_id := (p ->> 'playerId')::uuid;
  r.stat := p ->> 'stat';
  r.category := coalesce(nullif(p ->> 'category', ''), 'Misc');
  r.line := (p ->> 'line')::numeric;
  r.kind := coalesce(nullif(p ->> 'kind', ''), 'standard');
  r.event := coalesce(p ->> 'event', '');
  r.starts_at := nullif(p ->> 'startsAt', '')::timestamptz;
  return r;
end $$;
revoke execute on function public._pp_prop_from_json(jsonb) from public, anon, authenticated;

create or replace function public.pp_save_prop(p_token uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare r public.props; v_id uuid;
begin
  perform public._pp_admin(p_token);
  r := public._pp_prop_from_json(p);
  if p ? 'id' and p ->> 'id' is not null then
    update public.props set player_id = r.player_id, stat = r.stat, category = r.category, line = r.line,
      kind = r.kind, event = r.event, starts_at = r.starts_at
    where id = (p ->> 'id')::uuid returning id into v_id;
  else
    insert into public.props (player_id, stat, category, line, kind, event, starts_at)
      values (r.player_id, r.stat, r.category, r.line, r.kind, r.event, r.starts_at) returning id into v_id;
  end if;
  perform public._pp_bump();
  return v_id;
end $$;

create or replace function public.pp_add_props(p_token uuid, p_list jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare p jsonb; r public.props;
begin
  perform public._pp_admin(p_token);
  for p in select * from jsonb_array_elements(p_list) loop
    r := public._pp_prop_from_json(p);
    insert into public.props (player_id, stat, category, line, kind, event, starts_at)
      values (r.player_id, r.stat, r.category, r.line, r.kind, r.event, r.starts_at);
  end loop;
  perform public._pp_bump();
end $$;

create or replace function public.pp_delete_prop(p_token uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._pp_admin(p_token);
  if exists (select 1 from public.lineups l, jsonb_array_elements(l.picks) e where (e ->> 'propId')::uuid = p_id) then
    raise exception 'Someone picked this — void it instead';
  end if;
  delete from public.props where id = p_id;
  perform public._pp_bump();
end $$;

create or replace function public.pp_update_prop_state(p_token uuid, p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._pp_admin(p_token);
  update public.props set
    status = coalesce(p ->> 'status', status),
    current = coalesce((p ->> 'current')::numeric, current),
    result = case when p ? 'result' then (p ->> 'result')::numeric else result end
  where id = p_id;
  perform public._pp_bump();
end $$;

create or replace function public.pp_settle_lineup(p_token uuid, p_id uuid, p_status text, p_payout numeric) returns void
language plpgsql security definer set search_path = public as $$
declare l public.lineups; v_pay numeric;
begin
  perform public._pp_admin(p_token);
  if p_status not in ('open', 'won', 'lost', 'refunded') then raise exception 'Bad status'; end if;
  select * into l from public.lineups where id = p_id for update;
  v_pay := case when p_status = 'open' then 0 else round(greatest(p_payout, 0), 2) end;
  update public.app_users set balance = balance - l.payout + v_pay where id = l.user_id;
  update public.lineups set status = p_status, payout = v_pay,
    settled_at = case when p_status = 'open' then null else now() end
  where id = p_id;
  perform public._pp_bump();
end $$;

create or replace function public.pp_adjust_balance(p_token uuid, p_user uuid, p_delta numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._pp_admin(p_token);
  update public.app_users set balance = round(balance + p_delta, 2) where id = p_user;
  perform public._pp_bump();
end $$;

create or replace function public.pp_update_user(p_token uuid, p_user uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._pp_admin(p_token);
  update public.app_users set
    is_admin = case when p ? 'isAdmin' then (p ->> 'isAdmin')::boolean else is_admin end,
    player_id = case when p ? 'playerId' then nullif(p ->> 'playerId', '')::uuid else player_id end
  where id = p_user;
  perform public._pp_bump();
end $$;

create or replace function public.pp_reset_pin(p_token uuid, p_user uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._pp_admin(p_token);
  if p_pin !~ '^\d{4}$' then raise exception 'PIN must be 4 digits'; end if;
  update public.app_users set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_user;
  delete from public.sessions where user_id = p_user;
end $$;

grant execute on function
  public.pp_signup(text, text, text), public.pp_login(text, text), public.pp_logout(uuid), public.pp_whoami(uuid),
  public.pp_submit_lineup(uuid, text, numeric, jsonb), public.pp_update_profile(uuid, text),
  public.pp_save_settings(uuid, jsonb), public.pp_get_invite_code(uuid),
  public.pp_save_player(uuid, jsonb), public.pp_delete_player(uuid, uuid),
  public.pp_save_prop(uuid, jsonb), public.pp_add_props(uuid, jsonb), public.pp_delete_prop(uuid, uuid),
  public.pp_update_prop_state(uuid, uuid, jsonb), public.pp_settle_lineup(uuid, uuid, text, numeric),
  public.pp_adjust_balance(uuid, uuid, numeric), public.pp_update_user(uuid, uuid, jsonb), public.pp_reset_pin(uuid, uuid, text)
to anon, authenticated;
