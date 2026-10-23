-- Shared talent tag catalog and pupil assignments. Existing records stay intact.
begin;
create table if not exists public.school_talent_tags (
 id text primary key, name text not null unique check(length(trim(name)) between 1 and 60),
 category text not null check(category in ('Tin học','Ngoại ngữ','Văn nghệ','Thể thao','Mỹ thuật','Khác')),
 color text not null check(color ~ '^#[0-9A-Fa-f]{6}$'), created_by text not null, sort_order int not null default 0
);
create table if not exists public.school_student_tags (
 student_id text not null references public.school_students(id) on delete cascade,
 tag_id text not null references public.school_talent_tags(id) on delete cascade,
 sort_order int not null default 0, primary key(student_id,tag_id)
);
alter table public.school_talent_tags enable row level security;
alter table public.school_student_tags enable row level security;
revoke all on public.school_talent_tags,public.school_student_tags from anon,authenticated;
grant select on public.school_talent_tags,public.school_student_tags to authenticated;
grant all on public.school_talent_tags,public.school_student_tags to service_role;
create policy school_read on public.school_talent_tags for select to authenticated using(public.school_is_member());
create policy school_read on public.school_student_tags for select to authenticated using(public.school_is_member());
insert into public.school_talent_tags(id,name,category,color,created_by,sort_order) values
 ('lap-trinh','Lập trình','Tin học','#315b35','system',0),
 ('tin-hoc-van-phong','Tin học văn phòng','Tin học','#4d7c57','system',1),
 ('tieng-anh','Giao tiếp tiếng Anh','Ngoại ngữ','#2563a6','system',2),
 ('hat','Hát','Văn nghệ','#b64646','system',3),
 ('mua','Múa','Văn nghệ','#9b4a86','system',4),
 ('bong-da','Bóng đá','Thể thao','#ad7427','system',5),
 ('bong-chuyen','Bóng chuyền','Thể thao','#8a652c','system',6),
 ('ve','Vẽ','Mỹ thuật','#6d58a0','system',7)
on conflict(id) do nothing;
create or replace function public.school_workspace_data() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',1,'sourceVersion',m.source_version,'settings',g.settings,
 'talentTags',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'category',t.category,'color',t.color,'createdBy',t.created_by) order by t.sort_order) from public.school_talent_tags t),'[]'::jsonb),
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'track',c.track,'note',c.note) order by c.sort_order) from public.school_classes c),'[]'::jsonb),
 'students',coalesce((select jsonb_agg(s.profile || jsonb_build_object('talentTagIds',coalesce((select jsonb_agg(t.tag_id order by t.sort_order) from public.school_student_tags t where t.student_id=s.id),'[]'::jsonb),'assessments',coalesce((select jsonb_object_agg(a.subject,jsonb_build_object('before',a.before_level,'after',a.after_level,'interaction',a.interaction,'note',a.note)) from public.school_assessments a where a.student_id=s.id),'{}'::jsonb), 'talents',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'category',t.category,'level',t.level,'note',t.note,'plan',t.plan,'teacherId',t.teacher_id,'teacherName',t.teacher_name,'updatedAt',to_char(t.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by t.sort_order) from public.school_talents t where t.student_id=s.id),'[]'::jsonb)) order by s.sort_order) from public.school_students s),'[]'::jsonb),
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
 if jsonb_typeof(p_data->'talentTags') is distinct from 'array' or jsonb_array_length(p_data->'talentTags')>200 then raise exception 'Invalid talent tags'; end if;
 cur := public.school_workspace_data();
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
  if item->>'createdBy'<>'system' and not exists(select 1 from public.school_profiles where username=item->>'createdBy') then raise exception 'Unknown tag owner'; end if;
  insert into public.school_talent_tags values(item->>'id',trim(item->>'name'),item->>'category',item->>'color',item->>'createdBy',idx); idx:=idx+1;
 end loop;
 idx:=0;
 for student in select value from jsonb_array_elements(p_data->'students') loop
  if exists(select 1 from unnest(base_keys) k where jsonb_typeof(student->k) is distinct from 'string' or length(student->>k)>20000) or nullif(trim(student->>'name'),'') is null then raise exception 'Invalid student'; end if;
  insert into public.school_students values(student->>'id',student->>'className',student-'assessments'-'talents'-'talentTagIds',idx); idx:=idx+1;
  if jsonb_typeof(coalesce(student->'talentTagIds','[]'))<>'array' or jsonb_array_length(coalesce(student->'talentTagIds','[]'))>30 then raise exception 'Invalid student tags'; end if;
  insert into public.school_student_tags(student_id,tag_id,sort_order) select student->>'id',value,ordinality::int from jsonb_array_elements_text(coalesce(student->'talentTagIds','[]')) with ordinality;
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

update public.school_meta set revision=revision+1,updated_at=now() where id=1;
notify pgrst, 'reload schema';
commit;
