-- Dock Scheduling System — schema
-- The core business rules are enforced here as well as in application code
-- (src/lib/domain/rules.ts), so no client or race condition can bypass them.

create extension if not exists btree_gist;   -- lets GiST index a uuid "=" alongside a daterange "&&"

create table if not exists berths (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  length_ft  numeric(6,1) not null check (length_ft > 0),
  created_at timestamptz not null default now()
);

create table if not exists vessels (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  operator     text not null default '',
  loa_ft       numeric(6,1) not null check (loa_ft > 0),
  draft_ft     numeric(5,1) check (draft_ft is null or draft_ft > 0),
  contact_name text,
  phone        text,
  email        text,
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists reservations (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('vessel', 'event')),
  vessel_id  uuid references vessels(id) on delete restrict,
  event_name text,
  berth_id   uuid not null references berths(id) on delete restrict,
  start_date date not null,
  end_date   date not null,
  notes      text,
  status     text not null default 'confirmed' check (status in ('confirmed', 'tentative', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reservations_dates_ordered check (end_date >= start_date),

  -- A vessel reservation names a vessel; an event names an event. Never both.
  constraint reservations_subject check (
    (type = 'vessel' and vessel_id is not null and event_name is null) or
    (type = 'event'  and vessel_id is null and nullif(btrim(event_name), '') is not null)
  ),

  -- RULE 2 + 3: no two active reservations (vessel or event) may share a berth
  -- on any day. '[]' makes both ends inclusive, matching the app's rule
  -- new_start <= existing_end AND new_end >= existing_start.
  constraint reservations_no_overlap exclude using gist (
    berth_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status <> 'cancelled')
);

create index if not exists reservations_dates_idx on reservations (start_date, end_date);
create index if not exists reservations_vessel_idx on reservations (vessel_id);

-- RULE 1: a vessel must fit its berth (LOA <= berth length). A CHECK
-- constraint can't reference other tables, so this is a trigger.
create or replace function enforce_vessel_fits_berth() returns trigger
language plpgsql as $$
declare
  v_loa  numeric;
  b_len  numeric;
begin
  new.updated_at := now();
  if new.type <> 'vessel' or new.status = 'cancelled' then
    return new;
  end if;
  select loa_ft into v_loa from vessels where id = new.vessel_id;
  select length_ft into b_len from berths where id = new.berth_id;
  if v_loa > b_len then
    raise exception 'VESSEL_EXCEEDS_BERTH: vessel LOA % ft exceeds berth length % ft', v_loa, b_len
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_vessel_fit on reservations;
create trigger reservations_vessel_fit
  before insert or update on reservations
  for each row execute function enforce_vessel_fits_berth();

-- The app connects with the service-role key from the server only.
-- Enable RLS so the public anon key cannot read or write anything.
alter table berths enable row level security;
alter table vessels enable row level security;
alter table reservations enable row level security;
