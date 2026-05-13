-- Advertising Workload Daily Monitoring
-- Run this in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.workload_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, report_date)
);

create table if not exists public.workload_tasks (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.workload_days(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  owner text not null,
  task_number int not null default 1,
  task text not null,
  due text not null default 'Not specified',
  raw_status text not null default 'Not specified',
  status text not null default 'Unknown',
  blocker text not null default 'None',
  needed_from text not null default 'None',
  cu text not null default 'Not specified',
  notes text not null default 'None',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workload_days_user_date_idx
on public.workload_days(user_id, report_date);

create index if not exists workload_tasks_day_id_idx
on public.workload_tasks(day_id);

create index if not exists workload_tasks_user_id_idx
on public.workload_tasks(user_id);

alter table public.workload_days enable row level security;
alter table public.workload_tasks enable row level security;

drop policy if exists "Users can view their own workload days" on public.workload_days;
drop policy if exists "Users can insert their own workload days" on public.workload_days;
drop policy if exists "Users can update their own workload days" on public.workload_days;
drop policy if exists "Users can delete their own workload days" on public.workload_days;

drop policy if exists "Users can view their own workload tasks" on public.workload_tasks;
drop policy if exists "Users can insert their own workload tasks" on public.workload_tasks;
drop policy if exists "Users can update their own workload tasks" on public.workload_tasks;
drop policy if exists "Users can delete their own workload tasks" on public.workload_tasks;

create policy "Users can view their own workload days"
on public.workload_days
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own workload days"
on public.workload_days
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own workload days"
on public.workload_days
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own workload days"
on public.workload_days
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can view their own workload tasks"
on public.workload_tasks
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own workload tasks"
on public.workload_tasks
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own workload tasks"
on public.workload_tasks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own workload tasks"
on public.workload_tasks
for delete
to authenticated
using (auth.uid() = user_id);
