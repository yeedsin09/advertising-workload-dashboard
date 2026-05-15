# V2 Changelog

## Authentication

- Added `src/lib/supabaseClient.js`.
- Added Supabase session checking in `src/App.jsx`.
- Added login/signup page in `src/components/LoginPage.jsx`.
- Dashboard is hidden until a valid Supabase session exists.
- Added optional email allowlist support through `VITE_ALLOWED_EMAIL` and `VITE_ALLOWED_EMAILS`.

## Task Board

- Added editable task rows.
- Added `managerNotes` field per task.
- Added task duplication.
- Added individual task deletion.
- Added blank task row creation.

## Filters

- Added owner filter.
- Added status filter.
- Added search field across owner, task, status, blocker, needed from, and manager notes.

## Exports

- Added CSV export for visible rows.
- Added Excel export through `xlsx`.

## Reports

- Added weekly summary counters.
- Added weekly summary text report.
- Added copy-to-clipboard weekly summary.

## Supabase Storage

- Added `public.daily_reports` table.
- Added unique record per user and report date.
- Added Row Level Security policies.
