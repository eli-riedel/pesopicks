-- 1) Single-pick bets ("singles"): one pick per lineup, pays 2X (x Goblin/Demon factor).
alter table public.lineups drop constraint lineups_mode_check;
alter table public.lineups add constraint lineups_mode_check check (mode in ('power', 'flex', 'single'));

-- Place one single bet per pick, all in one transaction. p_amount is per pick.
create or replace function public.pp_submit_singles(p_token uuid, p_amount numeric, p_picks jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid; v_n int; v_pick jsonb; v_prop public.props; v_side text; v_bal numeric; v_seen uuid[] := '{}';
begin
  v_uid := public._pp_uid(p_token);
  v_n := jsonb_array_length(p_picks);
  if v_n < 1 then raise exception 'Add a pick'; end if;
  p_amount := round(p_amount, 2);
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount'; end if;
  select balance into v_bal from public.app_users where id = v_uid for update;
  if p_amount * v_n > v_bal then raise exception 'Not enough balance'; end if;
  for v_pick in select * from jsonb_array_elements(p_picks) loop
    select * into v_prop from public.props where id = (v_pick ->> 'propId')::uuid;
    if v_prop.id is null or v_prop.status <> 'open' or (v_prop.starts_at is not null and v_prop.starts_at <= now()) then
      raise exception 'A pick is no longer available';
    end if;
    if v_prop.id = any (v_seen) then raise exception 'Duplicate pick'; end if;
    v_seen := v_seen || v_prop.id;
    v_side := v_pick ->> 'side';
    if v_side not in ('more', 'less') then raise exception 'Bad pick'; end if;
    if v_prop.kind <> 'standard' and v_side <> 'more' then raise exception 'Goblins & Demons are More only'; end if;
    insert into public.lineups (user_id, mode, amount, picks, multiplier)
      values (v_uid, 'single', p_amount,
        jsonb_build_array(jsonb_build_object('propId', v_prop.id, 'playerId', v_prop.player_id, 'side', v_side, 'line', v_prop.line, 'kind', v_prop.kind)),
        round(2 * case v_prop.kind when 'goblin' then 0.8 when 'demon' then 1.5 else 1 end, 2));
  end loop;
  update public.app_users set balance = balance - p_amount * v_n where id = v_uid;
  perform public._pp_bump();
  return v_n;
end $$;
grant execute on function public.pp_submit_singles(uuid, numeric, jsonb) to anon, authenticated;

-- 2) Daily recurring lines. When a recurring prop locks (time passes, manual lock, graded or voided),
--    a copy for the next day is created once (parent_id is unique so it can't double up).
alter table public.props add column recurring boolean not null default false;
alter table public.props add column parent_id uuid references public.props (id) on delete set null;
create unique index props_parent_unique on public.props (parent_id) where parent_id is not null;

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
  r.recurring := coalesce((p ->> 'recurring')::boolean, false);
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
      kind = r.kind, event = r.event, starts_at = r.starts_at, recurring = r.recurring
    where id = (p ->> 'id')::uuid returning id into v_id;
  else
    insert into public.props (player_id, stat, category, line, kind, event, starts_at, recurring)
      values (r.player_id, r.stat, r.category, r.line, r.kind, r.event, r.starts_at, r.recurring) returning id into v_id;
  end if;
  perform public._pp_roll_recurring();
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
    insert into public.props (player_id, stat, category, line, kind, event, starts_at, recurring)
      values (r.player_id, r.stat, r.category, r.line, r.kind, r.event, r.starts_at, r.recurring);
  end loop;
  perform public._pp_bump();
end $$;

-- Spawn tomorrow's copy for every recurring prop that is no longer pickable. Idempotent.
create or replace function public._pp_roll_recurring() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into public.props (player_id, stat, category, line, kind, event, starts_at, recurring, parent_id)
  select p.player_id, p.stat, p.category, p.line, p.kind, p.event,
    case when p.starts_at is null then null
         else p.starts_at + interval '1 day' * greatest(1, ceil(extract(epoch from (now() - p.starts_at)) / 86400.0)) end,
    true, p.id
  from public.props p
  where p.recurring
    and (p.status <> 'open' or (p.starts_at is not null and p.starts_at <= now()))
    and not exists (select 1 from public.props c where c.parent_id = p.id)
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public._pp_roll_recurring() from public, anon, authenticated;

-- Public, harmless trigger the app calls on load: only copies existing recurring lines.
create or replace function public.pp_roll_recurring() returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  v := public._pp_roll_recurring();
  if v > 0 then perform public._pp_bump(); end if;
  return v;
end $$;
grant execute on function public.pp_roll_recurring() to anon, authenticated;

create or replace function public.pp_update_prop_state(p_token uuid, p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._pp_admin(p_token);
  update public.props set
    status = coalesce(p ->> 'status', status),
    current = coalesce((p ->> 'current')::numeric, current),
    result = case when p ? 'result' then (p ->> 'result')::numeric else result end,
    recurring = coalesce((p ->> 'recurring')::boolean, recurring)
  where id = p_id;
  perform public._pp_roll_recurring();
  perform public._pp_bump();
end $$;
