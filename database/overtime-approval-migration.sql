-- Run once in Supabase SQL Editor.
-- Attendance records stay in the existing attendance_records table.

create table if not exists public.overtime_approvals (
  id uuid primary key default gen_random_uuid(),
  attendance_record_id uuid not null unique references public.attendance_records(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  requested_minutes integer not null check (requested_minutes > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  updated_at timestamptz not null default now()
);

create index if not exists overtime_approvals_employee_date_idx
  on public.overtime_approvals(employee_id, work_date desc);
create index if not exists overtime_approvals_status_idx
  on public.overtime_approvals(status, work_date desc);

alter table public.overtime_approvals enable row level security;

-- Employees can see only their own requests. Only an employer can review requests.
drop policy if exists "Employees view own overtime approvals" on public.overtime_approvals;
create policy "Employees view own overtime approvals"
  on public.overtime_approvals for select to authenticated
  using (employee_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employer'
  ));

drop policy if exists "Employees submit own overtime approvals" on public.overtime_approvals;
create policy "Employees submit own overtime approvals"
  on public.overtime_approvals for insert to authenticated
  with check (employee_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null);

drop policy if exists "Employers update overtime approvals" on public.overtime_approvals;
create policy "Employers update overtime approvals"
  on public.overtime_approvals for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employer'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employer'));

-- Employees can update their own attendance; employer can manage all attendance.
-- These policies supplement the table's existing policies without replacing them.
drop policy if exists "Attendance employee insert own or employer" on public.attendance_records;
create policy "Attendance employee insert own or employer"
  on public.attendance_records for insert to authenticated
  with check (user_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employer'
  ));

drop policy if exists "Attendance employee update own or employer" on public.attendance_records;
create policy "Attendance employee update own or employer"
  on public.attendance_records for update to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employer'
  ))
  with check (user_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employer'
  ));

drop policy if exists "Attendance employee select own or employer" on public.attendance_records;
create policy "Attendance employee select own or employer"
  on public.attendance_records for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employer'
  ));

-- Permit an employee to revise only a still-pending request; they cannot approve/reject it.
drop policy if exists "Employees revise pending overtime request" on public.overtime_approvals;
create policy "Employees revise pending overtime request"
  on public.overtime_approvals for update to authenticated
  using (employee_id = auth.uid() and status = 'pending')
  with check (employee_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null);

drop policy if exists "Employees cancel own pending overtime request" on public.overtime_approvals;
create policy "Employees cancel own pending overtime request"
  on public.overtime_approvals for delete to authenticated
  using (employee_id = auth.uid() and status = 'pending');

drop policy if exists "Employers insert overtime approvals" on public.overtime_approvals;
create policy "Employers insert overtime approvals"
  on public.overtime_approvals for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'employer'));

create or replace function public.log_overtime_approval_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, table_name, record_id, details)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'overtime_requested' else 'overtime_' || new.status end,
    'overtime_approvals',
    new.id,
    jsonb_build_object(
      'employee_id', new.employee_id,
      'work_date', new.work_date,
      'requested_minutes', new.requested_minutes,
      'status', new.status,
      'reviewed_by', new.reviewed_by,
      'reviewed_at', new.reviewed_at
    )
  );
  return new;
end;
$$;

drop trigger if exists overtime_approval_audit_trigger on public.overtime_approvals;
create trigger overtime_approval_audit_trigger
after insert or update of status, requested_minutes on public.overtime_approvals
for each row execute function public.log_overtime_approval_change();
