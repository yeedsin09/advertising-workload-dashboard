# Advertising Workload Daily Monitoring

A Vite React dashboard for daily Advertising Department workload monitoring.

## Features

- Paste Viber replies and convert them into task rows
- Add one member reply at a time
- Edit parsed task rows
- Sort by Due and Status
- Track received and missing team updates
- Manager follow-up queue
- Local browser storage
- Optional Supabase Auth and database storage

## Team Roster

- Sca: Website Developer
- Anghelli: Copywriter
- Conrad: Video Editor (FMC)
- Regina: Video Editor (WC)
- Joyce: Market Researcher

## Install

```bash
npm install
npm run dev
```

## Supabase Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Copy `.env.example` as `.env.local`.
5. Paste your Supabase URL and anon key.
6. Restart the dev server.

```bash
cp .env.example .env.local
npm run dev
```

## Using Supabase Storage

1. Sign up or sign in through the app.
2. Change Storage mode from `Local storage` to `Supabase`.
3. Choose the report date.
4. Click `Save Day`, `Load Day`, or `Clear Saved Day`.

## Daily Manager Workflow

1. Reset Data at start of monitoring.
2. Send the Daily Viber Message template.
3. Paste one member reply.
4. Click Add This Reply.
5. Review and edit parsed task rows.
6. Repeat for all members.
7. Save Day.
