# Dock Scheduling System

A small web application that replaces a spreadsheet-based dock reservation process at a marine research facility. It automatically **prevents double bookings** and **checks that a vessel physically fits its berth**, which staff currently do by eye.

Built with Next.js (App Router), TypeScript, Tailwind CSS and Supabase/PostgreSQL. Deployable to Vercel.

**Live demo:** https://dock-scheduling-system-sooty.vercel.app

---

## 1. Problem

The facility has managed berth reservations in Excel for about 23 years (1997–2019 in the supplied workbook). Each annual sheet has **berths as rows and days as columns**. A booking is text typed into a run of cells: research vessels, yachts, and non-vessel events such as *Community Sail Day*.

This causes two recurring problems:

1. **Double bookings.** Staff have to scan the grid to spot two bookings on the same berth on the same day.
2. **Berth fit.** Staff have to check by hand that a vessel's length overall (LOA) fits the berth. For example, a 120 ft vessel cannot go on the 75 ft North Pier Face.

Nothing in a spreadsheet stops either mistake from being saved.

## 2. Solution

| Page | What it does |
|---|---|
| **Dashboard** (`/`) | Today's reservations, which berths are occupied or available, the next 14 days of arrivals, and a **data check panel** that re-checks all stored reservations for overlaps and oversize vessels. It also flags tentative bookings that arrive within 7 days. |
| **Schedule** (`/schedule`) | The main view. A berth × date grid, like the spreadsheet, where each reservation is a bar across its dates. You can pick a start date and a range of 2, 4 or 8 weeks, or step earlier and later. Click a bar to see its details (edit or delete from there). Click an empty day to book that berth for that date. A plain list of the same reservations sits under the grid. |
| **New reservation** (`/reservations/new`) | A form that checks the booking as you type. It shows vessel LOA against berth capacity (✓ fits / ✕ exceeds), and whether the berth is free for the chosen dates. If it isn't, it names the reservation in the way and its dates. It suggests other berths that would work. **Save stays disabled until the reservation is valid.** |
| **Vessels** (`/vessels`) | A directory you can search by vessel, operator, contact or email. Each vessel's page shows its particulars, which berths it fits (and by how much), its reservation history, and a "Book this vessel" shortcut. |

Editing and deleting reservations (listed as optional in the brief) are included, because they reuse the same validation with no extra rules.

## 3. Architecture

```
src/
├── lib/
│   ├── domain/            ← pure business logic. No React, no database, no I/O.
│   │   ├── types.ts         Berth, Vessel, Reservation, ReservationInput …
│   │   ├── dates.ts         timezone-safe ISO calendar-date helpers
│   │   ├── rules.ts         canVesselFitBerth, findReservationConflicts,
│   │   │                    findSuitableBerths, validateReservation,
│   │   │                    detectScheduleIssues
│   │   ├── schedule.ts      grid layout (clipping, lanes), occupancy
│   │   ├── input.ts         normalise untrusted form input
│   │   └── *.test.ts        unit tests (Vitest)
│   ├── data/              ← persistence behind one interface
│   │   ├── repository.ts    DockRepository interface + typed errors
│   │   ├── supabase-repository.ts
│   │   ├── memory-repository.ts   seeded in-memory store (demo / no DB)
│   │   ├── seed.ts          representative records
│   │   └── index.ts         picks the implementation from env vars
│   └── services/
│       └── reservations.ts  use cases: check → validate → write; read models
├── app/                   ← Next.js routes (server components) + server actions
│   ├── page.tsx             dashboard
│   ├── schedule/page.tsx
│   ├── reservations/{new,[id]/edit}/page.tsx
│   ├── reservations/actions.ts   thin server actions (parse → service)
│   └── vessels/{page.tsx,[id]/page.tsx}
└── components/            ← UI only (ScheduleGrid, ReservationForm, …)
supabase/
├── migrations/0001_schema.sql   tables + constraints enforcing the same rules
└── seed.sql
```

**How a save works**

```
ReservationForm (client)
  │  as you type: checkReservationAction ──► services.checkReservation ──► rules.validateReservation
  │  on save:     saveReservationAction  ──► services.saveReservation
  │                                           1. validateReservation again, on fresh data (authoritative)
  │                                           2. repository.create/update
  ▼                                           3. PostgreSQL constraints: the final guard against races
```

Main decisions:

- **The business rules are pure functions** in `lib/domain/rules.ts`. The browser (instant fit feedback), the server (validation before a write) and the dashboard audit all call the *same* code, so they can never disagree. The rules are also easy to unit-test.
- **Defence in depth.** The server re-validates every save; the client's view is never trusted. The database then enforces the two core rules itself:
  - an **exclusion constraint** (`btree_gist`) that blocks overlapping `daterange(start_date, end_date, '[]')` values on the same berth, ignoring cancelled rows;
  - a **trigger** that rejects a vessel reservation whose LOA is longer than the berth.

  If two people book the last slot at the same moment, one save fails cleanly with a clear message instead of creating a double booking.
- **A repository interface** keeps Supabase out of the rest of the app. An in-memory implementation with the same guarantees means the app runs with no setup at all, which suits reviewers.
- **Server components by default.** Pages render on the server. The schedule's selection and filters are URL parameters, so views can be bookmarked and shared, and the grid needs no client JavaScript. Only the form, nav and delete button are client components.

## 4. Technology choices

| Choice | Why |
|---|---|
| **Next.js 16 (App Router)** | Server components and server actions let the UI call the service layer directly, with no separate REST API to build and maintain. Deploys to Vercel with no configuration. |
| **TypeScript (strict)** | The domain model and validation codes are types shared by UI, services and tests. |
| **Tailwind CSS v4** | Fast and consistent styling with a small set of design tokens (navy accents). |
| **Supabase / PostgreSQL** | Relational data with real constraints. Range types plus exclusion constraints are an exact fit for "no two bookings on one berth overlap". |
| **Vitest** | Fast unit tests for the domain layer. |
| **IBM Plex (self-hosted via Fontsource)** | A readable, technical typeface. Self-hosted, so the build needs no network access to Google Fonts. |

## 5. Data model

```
berths                       vessels                         reservations
──────                       ───────                         ────────────
id          uuid PK          id            uuid PK           id          uuid PK
name        text unique      name          text unique       type        'vessel' | 'event'
length_ft   numeric > 0      operator      text              vessel_id   uuid FK → vessels  (null for events)
                             loa_ft        numeric > 0       event_name  text               (null for vessels)
                             draft_ft      numeric           berth_id    uuid FK → berths
                             contact_name  text              start_date  date
                             phone         text              end_date    date  (≥ start_date)
                             email         text              notes       text
                             notes         text              status      'confirmed' | 'tentative' | 'cancelled'
```

Constraints on `reservations`:

- `end_date >= start_date`
- exactly one of `vessel_id` / `event_name`, matching `type` (event names cannot be blank)
- `EXCLUDE USING gist (berth_id WITH =, daterange(start_date, end_date, '[]') WITH &&) WHERE status <> 'cancelled'`
- trigger `enforce_vessel_fits_berth`: `vessel.loa_ft <= berth.length_ft`

In TypeScript the same entities use camelCase (`lengthFt`, `loaFt` …). Mapping happens only in `supabase-repository.ts`.

## 6. Validation rules

All of these live in `validateReservation()` (`src/lib/domain/rules.ts`) and have unit tests.

| Rule | Behaviour |
|---|---|
| **Berth fit** (vessels only) | `vessel.loa_ft <= berth.length_ft`. Equal is allowed. On failure: *"R/V High Drift is 120 ft long. North Pier Face supports vessels up to 75 ft. Select another berth."* plus suggested berths. |
| **Date conflict** (vessels **and** events) | Conflict when `new_start <= existing_end AND new_end >= existing_start AND same berth`. Cancelled reservations are ignored, and so is the reservation being edited. The message names the existing reservation and its dates. |
| **Events** | Need an event name. No length check. They still block, and are blocked by, other reservations. |
| **Required fields** | Vessel (for vessel type), event name (for event type), berth, start date, end date. |
| **Dates** | Must be real calendar dates. The end date cannot be before the start date. Single-day bookings are allowed. |
| **Unknown references** | A vessel or berth id that no longer exists is rejected. |
| **Database errors** | Caught in the service layer and shown as a friendly message. A constraint violation from a race becomes a specific "berth was just booked" or "vessel too long" message. Page-level load failures show an error boundary with a retry button. |

**Suggested berths** (`findSuitableBerths`) lists berths that are long enough and free for the whole date range, **smallest first**. That way a 72 ft vessel is offered the 75 ft berth before the 410 ft one, which keeps large berths free for large ships.

## 7. Assumptions

- **Dates are inclusive calendar days.** A reservation for 10–12 June occupies the berth on the 10th, 11th and 12th, just like three filled cells in the spreadsheet. So:
  - a booking **starting the day after** another ends is **adjacent and allowed**;
  - a booking **starting the same day** another ends is a **conflict** (no same-day turnover). If the facility wants same-day turnover, the fix is one change to `dateRangesOverlap` plus changing `'[]'` to `'[)'` in the constraint. Both are covered by tests.
- One reservation occupies one whole berth. Berths are not shared or subdivided by length (rafting two small boats on the 410 ft pier is out of scope).
- Fit is checked on **LOA against berth length only**. Draft is recorded and displayed, but there is no depth data per berth to check it against.
- A "tentative" reservation still blocks the berth. It is a hold, and treating it as free would recreate the double-booking problem. "Cancelled" frees the berth.
- "Today" is the facility's local date, set with `NEXT_PUBLIC_FACILITY_TIME_ZONE` (an IANA name such as `America/New_York`; defaults to UTC).
- There is no authentication. This is a single-team internal tool prototype (see Limitations).

### About the source data

The supplied workbook is **semi-structured and inconsistent**. Bookings are free text spread across day columns. Vessel names are written in different ways ("High Drift", "R/V High Drift", abbreviations). Some cells are merged, notes are mixed in with names, and the vessel information is on separate supporting sheets. A reliable automatic import would need a dedicated cleaning step with human review.

For this prototype a **small set of representative records was normalised by hand** (`src/lib/data/seed.ts` and `supabase/seed.sql`, which match each other):

- the six berths with the capacities recorded in the workbook (North Pier West 410 ft, North Pier Face 75 ft, North Pier East 240 ft, Inner Channel 55 ft, South Float West 90 ft, South Float East 90 ft);
- vessels named in the workbook (R/V High Drift 120 ft, R/V Iron Skua 72 ft, R/V Bright Dory 52 ft, R/V Wild Marlin 32 ft), plus one visiting yacht and one small workboat to show the range of users. **Operators, drafts and contact details are placeholders**;
- a few historical bookings in the style of the 1997 and 2019 sheets, including a *Community Sail Day* event. To see them, set the schedule's **From** date to `2019-06-01`;
- a handful of bookings **relative to today**, so the dashboard and schedule show live data during a demo.

Extensive historical data was deliberately *not* invented.

## 8. Running locally

Requirements: Node.js 20.9+.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests
npm run lint         # TypeScript type check
npm run build        # production build
```

With no environment variables, the app runs in **demo mode**: a seeded in-memory store (shown by a "Demo data" badge in the header). It enforces exactly the same rules as the database. Data resets when the server restarts.

### With Supabase (persistent)

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/0001_schema.sql`, then `supabase/seed.sql`.
   (Or with the Supabase CLI: `supabase db push` followed by running the seed.)
3. Copy `.env.example` to `.env.local` and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   NEXT_PUBLIC_FACILITY_TIME_ZONE=America/New_York   # optional
   ```
4. `npm run dev`. The "Demo data" badge disappears.

The service-role key is only read in server code (`src/lib/data/index.ts` imports `server-only`). Row Level Security is enabled with no policies, so the public anon key cannot read or write anything.

## 9. Deploying to Vercel

1. Push the repository to GitHub/GitLab.
2. In Vercel, **Add New → Project** and import the repo. `vercel.json` pins the framework preset to Next.js, so no build settings need changing.
3. Add the environment variables from step 3 above (Production and Preview).
4. Deploy.

If you deploy **without** Supabase variables, the app still works in demo mode. On serverless hosting, though, each function instance keeps its own in-memory copy, so new reservations may not persist or show up consistently. Use Supabase for anything beyond a quick look.

## 10. Limitations

- **No authentication or roles.** Anyone with the URL can change reservations. A real deployment needs Supabase Auth (or SSO), plus RLS policies or a server-side role check.
- **No spreadsheet importer.** Only representative records are seeded (see *About the source data*).
- **Vessels and berths are read-only in the UI.** They are managed through the database or seed files.
- **The dashboard audit loads all active reservations.** That is fine for this data size. At full 23-year scale it should be a SQL view or query limited to a date range. The database constraint already makes new overlaps impossible, so the audit is mainly for imported legacy data.
- The fit trigger runs when a reservation is written. If a vessel's LOA or a berth's length is edited later, existing bookings are not re-checked automatically. The dashboard audit flags them instead.
- Whole-day granularity only. There are no arrival or departure times.
- No end-to-end browser tests in the repo. Unit tests cover the domain layer, and the UI flows were checked by hand and with scripted browser runs during development.

## 11. Future improvements

1. **Workbook importer.** Parse each annual sheet, group runs of cells into bookings, fuzzy-match vessel names to the vessel sheet, and send anything unclear (conflicts, unknown vessels, oversize) to a review queue built on `detectScheduleIssues`.
2. **Authentication and audit trail.** Record who created or changed each reservation, and when.
3. **Vessel and berth management screens**, with re-validation of affected future bookings when an LOA or berth length changes.
4. **Draft/depth checks**, once each berth has depth data (tide-aware if needed).
5. **Arrival/departure times**, to allow same-day turnover where operations permit.
6. **Drag-to-create and drag-to-move** on the schedule, using the same validation.
7. **Notifications** to vessel contacts for tentative holds nearing arrival.
8. End-to-end tests (Playwright) for the booking flow, and integration tests against a disposable Postgres to exercise the constraints.

---

### Test coverage (business rules)

`npm test` runs 42 tests, including every case the brief requires:

| Case | Expected |
|---|---|
| Vessel shorter than berth | valid |
| Vessel equal to berth | valid |
| Vessel longer than berth | invalid, with the exact message |
| Non-overlapping reservations | valid |
| Partially overlapping (either side) | conflict |
| Contained / containing reservation | conflict |
| Same dates | conflict |
| Adjacent (starts the day after the other ends) | valid |
| Same-day turnover | conflict (inclusive end dates) |
| Different berth, same dates | valid |
| Cancelled reservation / reservation being edited | ignored |
| Events: no length check, still conflict both ways, name required | ✓ |
| End before start, missing fields, impossible dates, unknown ids | rejected |
| Suggested berths: fit + availability, smallest first | ✓ |
| Audit detects overlaps and oversize vessels in stored data | ✓ |
| Grid layout: clipping to window, lane stacking, cancelled hidden | ✓ |

The SQL constraints were also checked against PostgreSQL 16. Overlap is rejected, adjacent is accepted, an oversize vessel is rejected, a blank event name and a reversed date range are rejected, and a cancelled overlap is accepted.
