-- Account records are stored in a dedicated table; passwords stay in Supabase Auth.
begin;
alter table public.school_profiles rename to school_accounts;
alter table public.school_accounts add column email text generated always as (username || '@ph1.tsqmt.edu.vn') stored;
alter table public.school_accounts add constraint school_accounts_email_unique unique(email);
alter table public.school_accounts add constraint school_accounts_username_format check(username ~ '^[a-z][a-z0-9._-]{2,49}$');
alter table public.school_accounts add column created_at timestamptz not null default now();
alter table public.school_accounts add column updated_at timestamptz not null default now();
create or replace function public.school_account_timestamp() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end; $$;
create trigger school_account_updated before update on public.school_accounts for each row execute function public.school_account_timestamp();
comment on table public.school_accounts is 'School login accounts and permissions. Passwords are managed by Supabase Auth.';
create or replace function public.school_is_member() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.school_accounts where id=auth.uid() and active); $$;
create or replace function public.school_is_manager() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.school_accounts where id=auth.uid() and active and role in ('admin','manager')); $$;
create or replace function public.school_is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.school_accounts where id=auth.uid() and active and role='admin'); $$;
create or replace function public.school_save_workspace(p_data jsonb,p_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.school_accounts%rowtype; cur jsonb; old_student jsonb; next_student jsonb; student jsonb; item jsonb; a record; idx int; current_revision bigint; owner_name text; base_keys text[] := array['id','name','className','room','block','gender','birthDate','ethnicity','address','parents','family','priorEducation','strengths','personality','notes','source'];
begin
 select * into actor from public.school_accounts where id=auth.uid() and active;
 if actor.id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select revision into current_revision from public.school_meta where id=1 for update;
 if current_revision<>p_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 if p_data->>'version'<>'1' or p_data->>'sourceVersion'<>'2' or jsonb_typeof(p_data->'students')<>'array' or jsonb_typeof(p_data->'classes')<>'array' or jsonb_typeof(p_data->'lessons')<>'array' or jsonb_typeof(p_data->'pendingStudents')<>'array' or jsonb_array_length(p_data->'students')>10000 or jsonb_array_length(p_data->'lessons')>50000 or length(p_data::text)>20971520 then raise exception 'Invalid workspace'; end if;
 if jsonb_typeof(p_data->'talentTags') is distinct from 'array' or jsonb_array_length(p_data->'talentTags')>200 then raise exception 'Invalid talent tags'; end if;
 cur := public.school_workspace_data();
 if exists(select 1 from jsonb_array_elements(p_data->'classes') c where c->>'name' !~ '^(0?[1-9]|1[0-2])/(0?[1-9]|[1-9][0-9])$') then raise exception 'Invalid class'; end if;
 if (p_data->'settings'->>'schoolYear') !~ '^[0-9]{4} *[–-] *[0-9]{4}$' or right(p_data->'settings'->>'schoolYear',4)::int <> left(p_data->'settings'->>'schoolYear',4)::int + 1 then raise exception 'Invalid school year'; end if;
 if exists(select 1 from jsonb_array_elements(p_data->'students') s group by s->>'className', lower(regexp_replace(s->>'name','\s+','','g')) having count(*)>1) then raise exception 'Duplicate pupil name in class'; end if;
 if actor.role<>'admin' and p_data->'settings' is distinct from cur->'settings' then raise exception 'Settings restricted' using errcode='42501'; end if;
 if actor.role='teacher' then
  if (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(p_data->'talentTags') where value->>'createdBy' is distinct from actor.username) is distinct from (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(cur->'talentTags') where value->>'createdBy' is distinct from actor.username) then raise exception 'Other teacher tags restricted' using errcode='42501'; end if;
  if p_data->'classes' is distinct from cur->'classes' or p_data->'pendingStudents' is distinct from cur->'pendingStudents' or jsonb_array_length(p_data->'students')<>jsonb_array_length(cur->'students') then raise exception 'Profiles restricted' using errcode='42501'; end if;
  for old_student in select value from jsonb_array_elements(cur->'students') loop
   select value into next_student from jsonb_array_elements(p_data->'students') where value->>'id'=old_student->>'id';
   if next_student is null or (next_student-'assessments'-'talents'-'talentTagIds') is distinct from (old_student-'assessments'-'talents'-'talentTagIds') or ((next_student->'assessments')-actor.subjects) is distinct from ((old_student->'assessments')-actor.subjects) then raise exception 'Subject restricted' using errcode='42501'; end if;
   if (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(coalesce(next_student->'talents','[]')) where value->>'teacherId'<>actor.username) is distinct from (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(coalesce(old_student->'talents','[]')) where value->>'teacherId'<>actor.username) then raise exception 'Other teacher talent restricted' using errcode='42501'; end if;
  end loop;
  if (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(p_data->'lessons') where not (value->>'subject'=any(actor.subjects))) is distinct from (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(cur->'lessons') where not (value->>'subject'=any(actor.subjects))) then raise exception 'Lessons restricted' using errcode='42501'; end if;
 end if;
 -- Replace related rows in one locked transaction; failures roll everything back.
 delete from public.school_student_tags where student_id is not null; delete from public.school_talent_tags where id is not null;
 delete from public.school_talents where id is not null; delete from public.school_assessments where student_id is not null; delete from public.school_lessons where id is not null; delete from public.school_students where id is not null; delete from public.school_pending_students where id is not null; delete from public.school_classes where id is not null;
 idx:=0;
 for item in select value from jsonb_array_elements(p_data->'classes') loop
  insert into public.school_classes values(item->>'id',item->>'name',item->>'track',item->>'note',idx); idx:=idx+1;
 end loop;
 idx:=0;
 for item in select value from jsonb_array_elements(p_data->'talentTags') loop
  if item->>'createdBy'<>'system' and not exists(select 1 from public.school_accounts where username=item->>'createdBy') then raise exception 'Unknown tag owner'; end if;
  insert into public.school_talent_tags values(item->>'id',trim(item->>'name'),item->>'category',item->>'color',item->>'createdBy',idx); idx:=idx+1;
 end loop;
 idx:=0;
 for student in select value from jsonb_array_elements(p_data->'students') loop
  if exists(select 1 from unnest(base_keys) k where jsonb_typeof(student->k) is distinct from 'string' or length(student->>k)>20000) or nullif(trim(student->>'name'),'') is null then raise exception 'Invalid student'; end if;
  select value into old_student from jsonb_array_elements(cur->'students') where value->>'id'=student->>'id';
  if length(trim(student->>'name'))<2 or length(student->>'name')>150 then raise exception 'Invalid pupil name'; end if;
  if (old_student is null or old_student->>'gender' is distinct from student->>'gender') and student->>'gender' not in ('','Nam','Nữ','Khác') then raise exception 'Invalid gender'; end if;
  if (old_student is null or old_student->>'birthDate' is distinct from student->>'birthDate') and nullif(trim(student->>'birthDate'),'') is not null then
   if student->>'birthDate' !~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' then raise exception 'Invalid birthday'; end if;
   if to_char(to_date(student->>'birthDate','DD/MM/YYYY'),'FMDD/FMMM/YYYY') <> (split_part(student->>'birthDate','/',1)::int)::text || '/' || (split_part(student->>'birthDate','/',2)::int)::text || '/' || split_part(student->>'birthDate','/',3) or to_date(student->>'birthDate','DD/MM/YYYY')>current_date or to_date(student->>'birthDate','DD/MM/YYYY')<date '1900-01-01' then raise exception 'Invalid birthday'; end if;
  end if;
  insert into public.school_students values(student->>'id',student->>'className',student-'assessments'-'talents'-'talentTagIds',idx); idx:=idx+1;
  if jsonb_typeof(coalesce(student->'talentTagIds','[]'))<>'array' or jsonb_array_length(coalesce(student->'talentTagIds','[]'))>30 then raise exception 'Invalid student tags'; end if;
  insert into public.school_student_tags(student_id,tag_id,sort_order) select student->>'id',value,ordinality::int from jsonb_array_elements_text(coalesce(student->'talentTagIds','[]')) with ordinality;
  for a in select * from jsonb_each(student->'assessments') loop
   if not exists(select 1 from jsonb_array_elements_text(p_data->'settings'->'subjects') s where s=a.key) then raise exception 'Unknown subject'; end if;
   insert into public.school_assessments values(student->>'id',a.key,coalesce(a.value->>'before',''),coalesce(a.value->>'after',''),coalesce(a.value->>'interaction',''),coalesce(a.value->>'note',''));
  end loop;
  for item in select value from jsonb_array_elements(coalesce(student->'talents','[]')) loop
   select name into owner_name from public.school_accounts where username=item->>'teacherId';
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


notify pgrst, 'reload schema';
commit;
