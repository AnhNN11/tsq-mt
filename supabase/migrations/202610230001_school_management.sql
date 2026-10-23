-- Mầm Xanh: shared Supabase storage and authenticated access only.
create table if not exists public.school_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique, name text not null,
 role text not null check(role in ('admin','manager','teacher')),
 subjects text[] not null default '{}', active boolean not null default true
);
create table if not exists public.school_classes (id text primary key, name text not null unique check(name ~ '^[0-9]{1,2}/[0-9]{1,2}$'), track text not null default '', note text not null default '', sort_order int not null default 0);
create table if not exists public.school_students (id text primary key, class_name text not null references public.school_classes(name) on update cascade on delete cascade, profile jsonb not null, sort_order int not null default 0);
create table if not exists public.school_pending_students (id text primary key, profile jsonb not null, sort_order int not null default 0);
create table if not exists public.school_assessments (student_id text not null references public.school_students(id) on delete cascade, subject text not null, before_level text not null default '' check(length(before_level)<=120), after_level text not null default '' check(after_level in ('','Tốt','Khá','Đạt','Cần hỗ trợ')), interaction text not null default '' check(interaction in ('','Chủ động','Có tham gia','Ít tương tác','Chưa tham gia')), note text not null default '', primary key(student_id,subject));
create table if not exists public.school_talents (id text primary key, student_id text not null references public.school_students(id) on delete cascade, category text not null check(category in ('Tin học','Ngoại ngữ','Văn nghệ','Thể thao','Mỹ thuật','Khác')), level text not null check(level in ('Cần quan sát thêm','Có tiềm năng','Đang bồi dưỡng','Nổi trội')), note text not null default '', plan text not null default '', teacher_id text not null references public.school_profiles(username), teacher_name text not null, updated_at timestamptz not null default now(), sort_order int not null default 0);
create table if not exists public.school_lessons (id text primary key, class_name text not null references public.school_classes(name) on update cascade on delete cascade, subject text not null, title text not null, lesson_date date not null, periods int not null check(periods between 1 and 20), note text not null default '', sort_order int not null default 0);
create table if not exists public.school_settings (id int primary key check(id=1), settings jsonb not null);
create table if not exists public.school_meta (id int primary key check(id=1), revision bigint not null default 0, source_version int not null default 2, updated_at timestamptz not null default now(), updated_by text not null default 'system');
insert into public.school_settings values(1,'{"schoolYear":"2026 – 2027","teacherName":"Giáo viên","subjects":["Tin học","Tiếng Anh"]}') on conflict(id) do nothing;
insert into public.school_meta(id) values(1) on conflict(id) do nothing;

create or replace function public.school_is_member() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.school_profiles where id=auth.uid() and active); $$;
create or replace function public.school_is_manager() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.school_profiles where id=auth.uid() and active and role in ('admin','manager')); $$;
create or replace function public.school_is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.school_profiles where id=auth.uid() and active and role='admin'); $$;
alter table public.school_profiles enable row level security;
revoke all on public.school_profiles from anon, authenticated;
grant select on public.school_profiles to authenticated;
grant all on public.school_profiles to service_role;
do $p$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='school_profiles' and policyname='school_read') then create policy school_read on public.school_profiles for select to authenticated using(id=auth.uid() or public.school_is_admin()); end if; end $p$;
alter table public.school_classes enable row level security;
revoke all on public.school_classes from anon, authenticated;
grant select on public.school_classes to authenticated;
grant all on public.school_classes to service_role;
do $p$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='school_classes' and policyname='school_read') then create policy school_read on public.school_classes for select to authenticated using(public.school_is_member()); end if; end $p$;
alter table public.school_students enable row level security;
revoke all on public.school_students from anon, authenticated;
grant select on public.school_students to authenticated;
grant all on public.school_students to service_role;
do $p$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='school_students' and policyname='school_read') then create policy school_read on public.school_students for select to authenticated using(public.school_is_member()); end if; end $p$;
alter table public.school_pending_students enable row level security;
revoke all on public.school_pending_students from anon, authenticated;
grant select on public.school_pending_students to authenticated;
grant all on public.school_pending_students to service_role;
do $p$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='school_pending_students' and policyname='school_read') then create policy school_read on public.school_pending_students for select to authenticated using(public.school_is_member()); end if; end $p$;
alter table public.school_assessments enable row level security;
revoke all on public.school_assessments from anon, authenticated;
grant select on public.school_assessments to authenticated;
grant all on public.school_assessments to service_role;
do $p$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='school_assessments' and policyname='school_read') then create policy school_read on public.school_assessments for select to authenticated using(public.school_is_member()); end if; end $p$;
alter table public.school_talents enable row level security;
revoke all on public.school_talents from anon, authenticated;
grant select on public.school_talents to authenticated;
grant all on public.school_talents to service_role;
do $p$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='school_talents' and policyname='school_read') then create policy school_read on public.school_talents for select to authenticated using(public.school_is_member()); end if; end $p$;
alter table public.school_lessons enable row level security;
revoke all on public.school_lessons from anon, authenticated;
grant select on public.school_lessons to authenticated;
grant all on public.school_lessons to service_role;
do $p$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='school_lessons' and policyname='school_read') then create policy school_read on public.school_lessons for select to authenticated using(public.school_is_member()); end if; end $p$;
alter table public.school_settings enable row level security;
revoke all on public.school_settings from anon, authenticated;
grant select on public.school_settings to authenticated;
grant all on public.school_settings to service_role;
do $p$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='school_settings' and policyname='school_read') then create policy school_read on public.school_settings for select to authenticated using(public.school_is_member()); end if; end $p$;
alter table public.school_meta enable row level security;
revoke all on public.school_meta from anon, authenticated;
grant select on public.school_meta to authenticated;
grant all on public.school_meta to service_role;
do $p$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='school_meta' and policyname='school_read') then create policy school_read on public.school_meta for select to authenticated using(public.school_is_member()); end if; end $p$;

create or replace function public.school_workspace_data() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',1,'sourceVersion',m.source_version,'settings',g.settings,
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'track',c.track,'note',c.note) order by c.sort_order) from public.school_classes c),'[]'::jsonb),
 'students',coalesce((select jsonb_agg(s.profile || jsonb_build_object('assessments',coalesce((select jsonb_object_agg(a.subject,jsonb_build_object('before',a.before_level,'after',a.after_level,'interaction',a.interaction,'note',a.note)) from public.school_assessments a where a.student_id=s.id),'{}'::jsonb), 'talents',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'category',t.category,'level',t.level,'note',t.note,'plan',t.plan,'teacherId',t.teacher_id,'teacherName',t.teacher_name,'updatedAt',to_char(t.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by t.sort_order) from public.school_talents t where t.student_id=s.id),'[]'::jsonb)) order by s.sort_order) from public.school_students s),'[]'::jsonb),
 'pendingStudents',coalesce((select jsonb_agg(p.profile order by p.sort_order) from public.school_pending_students p),'[]'::jsonb),
 'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'className',l.class_name,'subject',l.subject,'title',l.title,'date',l.lesson_date::text,'periods',l.periods,'note',l.note) order by l.sort_order) from public.school_lessons l),'[]'::jsonb))
 from public.school_meta m cross join public.school_settings g where m.id=1 and g.id=1;
$$;
revoke all on function public.school_workspace_data() from public,anon,authenticated;
create or replace function public.school_read_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.school_is_member() then raise exception 'Unauthorized' using errcode='42501'; end if;
 return (select jsonb_build_object('data',public.school_workspace_data(),'revision',revision,'updatedAt',updated_at,'updatedBy',updated_by) from public.school_meta where id=1);
end; $$;

create or replace function public.school_save_workspace(p_data jsonb,p_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.school_profiles%rowtype; cur jsonb; old_student jsonb; next_student jsonb; student jsonb; item jsonb; a record; idx int; current_revision bigint; owner_name text; base_keys text[] := array['id','name','className','room','block','gender','birthDate','ethnicity','address','parents','family','priorEducation','strengths','personality','notes','source'];
begin
 select * into actor from public.school_profiles where id=auth.uid() and active;
 if actor.id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select revision into current_revision from public.school_meta where id=1 for update;
 if current_revision<>p_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 if p_data->>'version'<>'1' or p_data->>'sourceVersion'<>'2' or jsonb_typeof(p_data->'students')<>'array' or jsonb_typeof(p_data->'classes')<>'array' or jsonb_typeof(p_data->'lessons')<>'array' or jsonb_typeof(p_data->'pendingStudents')<>'array' or jsonb_array_length(p_data->'students')>10000 or jsonb_array_length(p_data->'lessons')>50000 or length(p_data::text)>20971520 then raise exception 'Invalid workspace'; end if;
 cur := public.school_workspace_data();
 if actor.role<>'admin' and p_data->'settings' is distinct from cur->'settings' then raise exception 'Settings restricted' using errcode='42501'; end if;
 if actor.role='teacher' then
  if p_data->'classes' is distinct from cur->'classes' or p_data->'pendingStudents' is distinct from cur->'pendingStudents' or jsonb_array_length(p_data->'students')<>jsonb_array_length(cur->'students') then raise exception 'Profiles restricted' using errcode='42501'; end if;
  for old_student in select value from jsonb_array_elements(cur->'students') loop
   select value into next_student from jsonb_array_elements(p_data->'students') where value->>'id'=old_student->>'id';
   if next_student is null or (next_student-'assessments'-'talents') is distinct from (old_student-'assessments'-'talents') or ((next_student->'assessments')-actor.subjects) is distinct from ((old_student->'assessments')-actor.subjects) then raise exception 'Subject restricted' using errcode='42501'; end if;
   if (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(coalesce(next_student->'talents','[]')) where value->>'teacherId'<>actor.username) is distinct from (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(coalesce(old_student->'talents','[]')) where value->>'teacherId'<>actor.username) then raise exception 'Other teacher talent restricted' using errcode='42501'; end if;
  end loop;
  if (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(p_data->'lessons') where not (value->>'subject'=any(actor.subjects))) is distinct from (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(cur->'lessons') where not (value->>'subject'=any(actor.subjects))) then raise exception 'Lessons restricted' using errcode='42501'; end if;
 end if;
 -- Replace related rows in one locked transaction; failures roll everything back.
 delete from public.school_talents where id is not null; delete from public.school_assessments where student_id is not null; delete from public.school_lessons where id is not null; delete from public.school_students where id is not null; delete from public.school_pending_students where id is not null; delete from public.school_classes where id is not null;
 idx:=0;
 for item in select value from jsonb_array_elements(p_data->'classes') loop
  insert into public.school_classes values(item->>'id',item->>'name',item->>'track',item->>'note',idx); idx:=idx+1;
 end loop;
 idx:=0;
 for student in select value from jsonb_array_elements(p_data->'students') loop
  if exists(select 1 from unnest(base_keys) k where jsonb_typeof(student->k) is distinct from 'string' or length(student->>k)>20000) or nullif(trim(student->>'name'),'') is null then raise exception 'Invalid student'; end if;
  insert into public.school_students values(student->>'id',student->>'className',student-'assessments'-'talents',idx); idx:=idx+1;
  for a in select * from jsonb_each(student->'assessments') loop
   if not exists(select 1 from jsonb_array_elements_text(p_data->'settings'->'subjects') s where s=a.key) then raise exception 'Unknown subject'; end if;
   insert into public.school_assessments values(student->>'id',a.key,coalesce(a.value->>'before',''),coalesce(a.value->>'after',''),coalesce(a.value->>'interaction',''),coalesce(a.value->>'note',''));
  end loop;
  for item in select value from jsonb_array_elements(coalesce(student->'talents','[]')) loop
   select name into owner_name from public.school_profiles where username=item->>'teacherId';
   if owner_name is null then raise exception 'Unknown teacher'; end if;
   insert into public.school_talents values(item->>'id',student->>'id',item->>'category',item->>'level',coalesce(item->>'note',''),coalesce(item->>'plan',''),item->>'teacherId',owner_name,(item->>'updatedAt')::timestamptz,0);
  end loop;
 end loop;
 idx:=0;
 for item in select value from jsonb_array_elements(p_data->'pendingStudents') loop
  insert into public.school_pending_students values(item->>'id',item,idx); idx:=idx+1;
 end loop;
 idx:=0;
 for item in select value from jsonb_array_elements(p_data->'lessons') loop
  if not exists(select 1 from jsonb_array_elements_text(p_data->'settings'->'subjects') s where s=item->>'subject') then raise exception 'Unknown subject'; end if;
  insert into public.school_lessons values(item->>'id',item->>'className',item->>'subject',item->>'title',(item->>'date')::date,(item->>'periods')::int,coalesce(item->>'note',''),idx); idx:=idx+1;
 end loop;
 update public.school_settings set settings=p_data->'settings' where id=1;
 update public.school_meta set revision=revision+1,source_version=2,updated_at=now(),updated_by=actor.username where id=1;
 return public.school_read_workspace();
end; $$;
revoke all on function public.school_is_member() from public,anon;
grant execute on function public.school_is_member() to authenticated;
revoke all on function public.school_is_manager() from public,anon;
grant execute on function public.school_is_manager() to authenticated;
revoke all on function public.school_is_admin() from public,anon;
grant execute on function public.school_is_admin() to authenticated;
revoke all on function public.school_read_workspace() from public,anon;
grant execute on function public.school_read_workspace() to authenticated;
revoke all on function public.school_save_workspace(jsonb,bigint) from public,anon;
grant execute on function public.school_save_workspace(jsonb,bigint) to authenticated;
notify pgrst, 'reload schema';
