-- ---------------------------------------------------------------------------
-- Migration 048 - Expiration date and lot number move to the delivery.
--
-- Run after 047-service-profiles-and-safeguards.sql.
--
-- inventory.expiration_date (migration 003) was one date per PRODUCT, typed on
-- the Add Item form. Expiry is printed on a CONTAINER, and two deliveries of
-- the same chemical carry two dates: the field could only ever hold one of
-- them, and after the older stock was used up it went on reporting a date for
-- containers that were no longer on the shelf. On Add Item nothing has even
-- arrived yet.
--
-- So the date is now captured where the container is in someone's hand: on
-- the Stock In line, alongside the manufacturer's lot number. Both land on the
-- IN movement.
--
-- What is on the shelf is DERIVED, not stored. inventory.quantity stays the
-- one authoritative stock figure (the same reasoning as migration 036's design
-- note: a batches table would change what that number means everywhere). The
-- app assumes first-in-first-out, so the stock still on hand is the most
-- recent deliveries, and walks the IN movements newest-first until the current
-- quantity is accounted for — see src/utils/expiry.js. If containers are used
-- out of order the estimate is off by exactly that, which is the trade the
-- advisor note accepted.
--
-- inventory.expiration_date is kept, not dropped: the app no longer writes
-- it, and section 3 copies what it held onto each item's latest delivery so
-- nothing typed there is lost. The item view falls back to it only for an item
-- whose deliveries carry no date at all.
--
-- Safe to run more than once.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. The expiry, on the movement that brought the container in.
--
--    batch_number already exists (migration 036) and was only written on the
--    way out. It is now written on the way in too, so a recall can be traced
--    from the supplier's delivery as well as to the client.
-- ---------------------------------------------------------------------------

alter table public.inventory_movements
  add column if not exists expiration_date date;

comment on column public.inventory_movements.expiration_date is
  'Expiry printed on the containers received in this Stock In line. IN movements only.';
comment on column public.inventory.expiration_date is
  'Superseded by inventory_movements.expiration_date (migration 048). No longer written by the app.';

alter table public.inventory_movements
  drop constraint if exists inventory_movements_expiration_in_only_check;
alter table public.inventory_movements
  add constraint inventory_movements_expiration_in_only_check
  check (expiration_date is null or movement_type = 'IN') not valid;

create index if not exists inventory_movements_expiration_date_idx
  on public.inventory_movements (item_id, expiration_date)
  where expiration_date is not null;

-- ---------------------------------------------------------------------------
-- 2. stock_in_batch() carries expiration_date and batch_number per line.
--
--    Same arguments and same RETURNS TABLE as migration 040 — the new fields
--    ride inside p_items — so nothing calling it needs to change. It is
--    dropped and recreated rather than `create or replace`d only to match the
--    040 pattern, which keeps re-running either migration predictable.
--
--    An expiry is refused on anything that is not a chemical (equipment does
--    not expire, and silently dropping the date would hide a wrong pick), and
--    refused when it falls before the delivery date: an already-expired
--    container is not stock, it is a return to the supplier.
-- ---------------------------------------------------------------------------

drop function if exists public.stock_in_batch(jsonb, date, text, text, uuid);

create function public.stock_in_batch(
  p_items                    jsonb,
  p_movement_date            date,
  p_reference                text,
  p_intake_branch_or_station text,
  p_idempotency_key          uuid
)
returns table (
  movement_id  uuid,
  item_id      uuid,
  amount       numeric,
  movement_date date,
  reference    text,
  actor        text,
  unit_cost    numeric,
  total_cost   numeric,
  created_at   timestamptz,
  new_quantity numeric
)
language plpgsql security definer set search_path = public
as $stock_in_batch$
declare
  entry record;
  item_status inventory_status;
  item_type_value text;
  item_name text;
  actor_name text;
  actor_account_id uuid;
  movement_id_value uuid;
  created_at_value timestamptz;
  new_quantity_value numeric;
  resolved_cost numeric;
  resolved_amount numeric;
  resolved_date date := coalesce(p_movement_date, current_date);
  entry_key uuid;
  row_index integer := 0;
begin
  if not public.has_role_table_session() then raise exception 'Not signed in.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one item is required.';
  end if;
  if nullif(trim(p_reference), '') is null then
    raise exception 'A purchase order or supplier invoice reference is required.';
  end if;
  if nullif(trim(p_intake_branch_or_station), '') is null then
    raise exception 'An intake branch or station is required.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as entries(item_id uuid)
    group by entries.item_id having count(*) > 1
  ) then
    raise exception 'Each inventory item can only be added once per Stock In.';
  end if;

  if p_idempotency_key is not null
     and exists (select 1 from public.inventory_movements m where m.batch_key = p_idempotency_key) then
    return query
      select m.id, m.item_id, m.amount, m.movement_date, m.reference, m.actor,
             coalesce(m.unit_cost, 0), coalesce(m.total_cost, 0), m.created_at, i.quantity
      from public.inventory_movements m
      join public.inventory i on i.id = m.item_id
      where m.batch_key = p_idempotency_key
      order by m.created_at;
    return;
  end if;

  select r.id, coalesce(a.name, s.name, t.name) into actor_account_id, actor_name
  from public.role_account_for_session(nullif(current_setting('request.headers', true)::json->>'x-session-token', '')::uuid) r
  left join public.admins a on a.id = r.id
  left join public.staff s on s.id = r.id
  left join public.technicians t on t.id = r.id
  limit 1;

  for entry in
    select entries.item_id, entries.amount, entries.unit_cost,
           entries.entered_amount, entries.entered_unit, entries.conversion_factor,
           entries.expiration_date, entries.batch_number
    from jsonb_to_recordset(p_items) as entries(
      item_id uuid, amount numeric, unit_cost numeric,
      entered_amount numeric, entered_unit text, conversion_factor numeric,
      expiration_date date, batch_number text
    )
  loop
    resolved_amount := round(entry.amount, 4);
    if resolved_amount is null or resolved_amount <= 0 then
      raise exception 'Stock In amounts must be greater than 0.';
    end if;

    select status, type::text, name into item_status, item_type_value, item_name
    from public.inventory where id = entry.item_id for update;
    if item_status is null then raise exception 'Inventory item not found.'; end if;
    if item_status = 'DISABLED' then raise exception 'Cannot Stock In on a disabled item.'; end if;

    if entry.expiration_date is not null then
      if item_type_value <> 'CHEMICAL' then
        raise exception 'Only chemicals carry an expiration date (%).', item_name;
      end if;
      if entry.expiration_date < resolved_date then
        raise exception 'The expiration date for % is before the delivery date.', item_name;
      end if;
    end if;

    resolved_cost := coalesce(entry.unit_cost, 0);
    if resolved_cost < 0 then raise exception 'Purchase cost cannot be negative.'; end if;

    entry_key := case when row_index = 0 then p_idempotency_key else null end;
    row_index := row_index + 1;

    insert into public.inventory_movements (
      item_id, amount, quantity_delta, movement_date, reference, actor, actor_id,
      intake_branch_or_station, purchase_reference, idempotency_key, batch_key, movement_type,
      unit_cost, total_cost, entered_amount, entered_unit, conversion_factor,
      expiration_date, batch_number
    )
    values (
      entry.item_id, resolved_amount, resolved_amount, resolved_date,
      nullif(trim(p_reference), ''), actor_name, actor_account_id,
      nullif(trim(p_intake_branch_or_station), ''), nullif(trim(p_reference), ''),
      entry_key, p_idempotency_key, 'IN',
      resolved_cost, round(resolved_cost * resolved_amount, 2),
      entry.entered_amount, nullif(trim(coalesce(entry.entered_unit, '')), ''),
      coalesce(entry.conversion_factor, 1),
      entry.expiration_date, nullif(trim(coalesce(entry.batch_number, '')), '')
    )
    returning id, inventory_movements.created_at into movement_id_value, created_at_value;

    update public.inventory
    set quantity = quantity + resolved_amount,
        cost = case when entry.unit_cost is null then cost else resolved_cost end
    where id = entry.item_id
    returning quantity into new_quantity_value;

    return query select
      movement_id_value, entry.item_id, resolved_amount,
      resolved_date, nullif(trim(p_reference), ''), actor_name,
      resolved_cost, round(resolved_cost * resolved_amount, 2),
      created_at_value, new_quantity_value;
  end loop;
end;
$stock_in_batch$;

grant execute on function public.stock_in_batch(jsonb, date, text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Carry the old per-item dates onto the deliveries.
--
--    Each chemical's inventory.expiration_date is copied onto its most recent
--    IN movement — the delivery most likely to still be on the shelf. Items
--    that already have a dated delivery are skipped, so re-running this after
--    real Stock Ins have been recorded changes nothing.
--
--    An item with a date but no IN movement at all (quantity set before
--    movements existed, or seeded directly) has nothing to attach to; the app
--    keeps showing its legacy date for exactly that case.
-- ---------------------------------------------------------------------------

update public.inventory_movements m
set expiration_date = i.expiration_date::date
from public.inventory i
where m.item_id = i.id
  and i.type = 'CHEMICAL'
  and i.expiration_date is not null
  and m.movement_type = 'IN'
  and m.id = (
    select latest.id from public.inventory_movements latest
    where latest.item_id = i.id and latest.movement_type = 'IN'
    order by latest.movement_date desc, latest.created_at desc
    limit 1
  )
  and not exists (
    select 1 from public.inventory_movements dated
    where dated.item_id = i.id and dated.movement_type = 'IN' and dated.expiration_date is not null
  );

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verify
--
--   select column_name from information_schema.columns
--   where table_name = 'inventory_movements' and column_name = 'expiration_date';
--     -> 1 row
--
--   select i.name, i.expiration_date::date as legacy, m.movement_date, m.expiration_date
--   from public.inventory i
--   join public.inventory_movements m on m.item_id = i.id and m.expiration_date is not null
--   where i.expiration_date is not null;
--     -> legacy = expiration_date on each chemical's latest delivery
-- ---------------------------------------------------------------------------
