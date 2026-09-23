-- Representative records normalised from the supplied workbook.
-- Mirrors src/lib/data/seed.ts. Current-season bookings are relative to
-- current_date so the dashboard has live data on the day you seed.

insert into berths (name, length_ft) values
  ('North Pier West', 410),
  ('North Pier Face', 75),
  ('North Pier East', 240),
  ('Inner Channel', 55),
  ('South Float West', 90),
  ('South Float East', 90)
on conflict (name) do nothing;

insert into vessels (name, operator, loa_ft, draft_ft, contact_name, phone, email, notes) values
  ('R/V High Drift',    'Oceanographic Institute',  120, 11.5, 'Marine Operations Desk', '555-0101', 'ops@high-drift.example.org',     'Regional-class research vessel. Requires North Pier West or East.'),
  ('R/V Iron Skua',     'University Marine Lab',     72,  7.0, 'Vessel Coordinator',     '555-0102', 'skua@marinelab.example.edu',     null),
  ('R/V Bright Dory',   'Coastal Survey Programme',  52,  5.0, 'Survey Coordinator',     '555-0103', 'dory@coastalsurvey.example.org', null),
  ('R/V Wild Marlin',   'Facility Research Fleet',   32,  3.5, 'Small Boats Office',     '555-0104', 'smallboats@facility.example.org','Facility-owned. Long-term berth holder.'),
  ('S/Y Northern Tern', 'Private owner',             46,  6.5, 'Owner',                  '555-0105', 'tern@example.com',               'Visiting yacht.'),
  ('M/V Kelp Runner',   'Kelp Ecology Group',        64,  5.5, 'Field Logistics',        '555-0106', 'logistics@kelp.example.org',     null)
on conflict (name) do nothing;

with b as (select id, name from berths), v as (select id, name from vessels)
insert into reservations (type, vessel_id, event_name, berth_id, start_date, end_date, notes, status)
select x.type, v.id, x.event_name, b.id, x.start_date, x.end_date, x.notes, x.status
from (values
  -- historical (source sheets)
  ('vessel', 'R/V High Drift',    null,                 'North Pier West',  date '1997-08-04', date '1997-08-15', 'From 1997 sheet.',            'confirmed'),
  ('vessel', 'R/V Wild Marlin',   null,                 'South Float West', date '2019-05-01', date '2019-09-30', 'Seasonal berth, 2019 sheet.', 'confirmed'),
  ('vessel', 'R/V High Drift',    null,                 'North Pier West',  date '2019-06-03', date '2019-06-21', '2019 sheet.',                 'confirmed'),
  ('vessel', 'R/V Iron Skua',     null,                 'North Pier Face',  date '2019-06-10', date '2019-06-14', '2019 sheet.',                 'confirmed'),
  ('vessel', 'R/V Bright Dory',   null,                 'Inner Channel',    date '2019-07-01', date '2019-07-19', '2019 sheet.',                 'confirmed'),
  ('event',  null,                'Community Sail Day', 'South Float East', date '2019-07-13', date '2019-07-13', '2019 sheet. Non-vessel event.','confirmed'),
  -- current season (relative to today)
  ('vessel', 'R/V High Drift',    null,                 'North Pier West',  current_date - 5,  current_date + 9,  'Mid-cruise port call; shore power requested.', 'confirmed'),
  ('vessel', 'R/V Iron Skua',     null,                 'North Pier Face',  current_date - 2,  current_date + 3,  null,                          'confirmed'),
  ('vessel', 'R/V Wild Marlin',   null,                 'South Float West', current_date - 30, current_date + 45, 'Seasonal berth.',             'confirmed'),
  ('vessel', 'R/V Bright Dory',   null,                 'Inner Channel',    current_date + 1,  current_date + 12, null,                          'confirmed'),
  ('event',  null,                'Community Sail Day', 'South Float East', current_date + 4,  current_date + 4,  'Public event. Float closed to vessel traffic.', 'confirmed'),
  ('vessel', 'S/Y Northern Tern', null,                 'South Float East', current_date + 6,  current_date + 13, 'Awaiting arrival confirmation.', 'tentative'),
  ('vessel', 'M/V Kelp Runner',   null,                 'North Pier Face',  current_date + 5,  current_date + 11, null,                          'confirmed'),
  ('vessel', 'R/V Iron Skua',     null,                 'North Pier East',  current_date + 8,  current_date + 18, 'Gear load-out before survey leg.', 'confirmed')
) as x(type, vessel_name, event_name, berth_name, start_date, end_date, notes, status)
join b on b.name = x.berth_name
left join v on v.name = x.vessel_name;
