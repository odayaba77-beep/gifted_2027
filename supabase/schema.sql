-- ====================================================================
-- مخطط قاعدة بيانات Supabase (PostgreSQL) - نظام هيأة رعاية الموهوبين v6.0
-- متوافق 100% مع معمارية Google Apps Script (Code.gs v6.0)
-- ====================================================================

-- --------------------------------------------------------------------
-- الخيار 1: المخطط السريع والمرن (JSONB Schema - الشغال مع الواجهة مباشرة)
-- --------------------------------------------------------------------

-- 1. جدول الطلاب (students)
create table if not exists public.students (
  id text primary key,
  school text,
  name text,
  class text,
  details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. جدول الكادر التدريسي والإداري (staff)
create table if not exists public.staff (
  id text primary key,
  school text,
  name text,
  role text,
  details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. جدول الإعدادات والحقول الديناميكية (settings)
create table if not exists public.settings (
  key text primary key,
  value jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- --------------------------------------------------------------------
-- الخيار 2: المخطط العلاقي المعياري المتقدم (Normalized v6.0 Schema - يطابق Code.gs)
-- --------------------------------------------------------------------

-- 4. جدول سجل التتبع السنوي للطلاب (student_history)
create table if not exists public.student_history (
  history_id text primary key,
  student_id text references public.students(id) on delete cascade,
  academic_year text not null,
  stage text,
  grade text,
  attendance_status text default 'مستمر',
  talent_type text,
  gpa text,
  achievements text,
  certificate text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. جدول المدارس (schools)
create table if not exists public.schools (
  school_id text primary key,
  name text not null,
  gov_name text,
  district text,
  address text,
  phone text,
  email text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. جدول سجل العمليات والحركات (logs)
create table if not exists public.logs (
  log_id text primary key default gen_random_uuid()::text,
  ts timestamp with time zone default timezone('utc'::text, now()),
  action text not null,
  entity text,
  entity_id text,
  school text,
  username text,
  details text,
  version text default '6.0.0'
);

-- --------------------------------------------------------------------
-- الفهارس لتحسين سرعة الاستعلامات والبحث
-- --------------------------------------------------------------------
create index if not exists idx_students_school on public.students(school);
create index if not exists idx_staff_school on public.staff(school);
create index if not exists idx_student_history_student_id on public.student_history(student_id);
create index if not exists idx_student_history_year on public.student_history(academic_year);
create index if not exists idx_logs_ts on public.logs(ts desc);

-- --------------------------------------------------------------------
-- سياسات الأمان والحماية (Row Level Security - RLS)
-- --------------------------------------------------------------------
alter table public.students enable row level security;
alter table public.staff enable row level security;
alter table public.settings enable row level security;
alter table public.student_history enable row level security;
alter table public.schools enable row level security;
alter table public.logs enable row level security;

-- السماح للوصول العام غير الموثق أو الموثق (Anonymous / Authenticated)
drop policy if exists "Allow full access on students" on public.students;
create policy "Allow full access on students" on public.students for all using (true) with check (true);

drop policy if exists "Allow full access on staff" on public.staff;
create policy "Allow full access on staff" on public.staff for all using (true) with check (true);

drop policy if exists "Allow full access on settings" on public.settings;
create policy "Allow full access on settings" on public.settings for all using (true) with check (true);

drop policy if exists "Allow full access on student_history" on public.student_history;
create policy "Allow full access on student_history" on public.student_history for all using (true) with check (true);

drop policy if exists "Allow full access on schools" on public.schools;
create policy "Allow full access on schools" on public.schools for all using (true) with check (true);

drop policy if exists "Allow full access on logs" on public.logs;
create policy "Allow full access on logs" on public.logs for all using (true) with check (true);

-- --------------------------------------------------------------------
-- تفعيل المزامنة الفورية (Supabase Realtime)
-- --------------------------------------------------------------------
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime for table public.students, public.staff, public.settings, public.student_history, public.schools, public.logs;
commit;
