-- Configurable academic badges; keep source strings and assessment identifiers intact.
begin;
create table public.school_academic_tags (
 id text primary key check(length(id) between 1 and 120 and id=trim(id)),
 name text not null check(length(name) between 1 and 60 and name=trim(name)),
 color text not null check(color ~ '^#[0-9A-Fa-f]{6}$'),
 stage text not null check(stage in ('before','after','both')),
 created_by text not null, sort_order int not null default 0
);
create unique index school_academic_tags_name_unique on public.school_academic_tags(lower(name));
alter table public.school_academic_tags enable row level security;
revoke all on public.school_academic_tags from anon,authenticated;
grant select on public.school_academic_tags to authenticated;
grant all on public.school_academic_tags to service_role;
create policy school_read on public.school_academic_tags for select to authenticated using(public.school_is_member());
insert into public.school_academic_tags values
 ('XS','Hoàn thành xuất sắc','#97671d','before','system',0),
 ('HTT','Hoàn thành tốt','#315b35','before','system',1),
 ('HT','Hoàn thành','#265c9a','before','system',2),
 ('Tốt','Tốt','#315b35','both','system',3),
 ('Khá','Khá','#265c9a','both','system',4),
 ('Đạt','Đạt','#637067','both','system',5),
 ('Cần hỗ trợ','Cần hỗ trợ','#ad343b','both','system',6);
alter table public.school_assessments drop constraint school_assessments_after_level_check;
alter table public.school_assessments add constraint school_assessments_after_length check(length(after_level)<=120);

alter function public.school_workspace_data() rename to school_workspace_data_v4;
create function public.school_workspace_data() returns jsonb language sql stable security definer set search_path='' as $$
 select public.school_workspace_data_v4() || jsonb_build_object('academicTags', coalesce((
  select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'color',t.color,'stage',t.stage,'createdBy',t.created_by) order by t.sort_order)
  from public.school_academic_tags t),'[]'::jsonb));
$$;
revoke all on function public.school_workspace_data(),public.school_workspace_data_v4() from public,anon,authenticated;

alter function public.school_save_workspace(jsonb,bigint) rename to school_save_workspace_v4;
revoke all on function public.school_save_workspace_v4(jsonb,bigint) from public,anon,authenticated;
create function public.school_save_workspace(p_data jsonb,p_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.school_accounts%rowtype; cur jsonb; item jsonb; current_revision bigint; idx int;
begin
 select * into actor from public.school_accounts where id=auth.uid() and active;
 if actor.id is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 select revision into current_revision from public.school_meta where id=1 for update;
 if current_revision<>p_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 -- Requests from an older open tab retain the existing catalog.
 cur := public.school_workspace_data();
 if not (p_data ? 'academicTags') then p_data := p_data || jsonb_build_object('academicTags',cur->'academicTags'); end if;
 if jsonb_typeof(p_data->'academicTags') is distinct from 'array' or jsonb_array_length(p_data->'academicTags')>100 then raise exception 'Invalid academic tags'; end if;
 if exists(select 1 from jsonb_array_elements(p_data->'academicTags') t where
  jsonb_typeof(t->'id') is distinct from 'string' or length(t->>'id') not between 1 and 120 or trim(t->>'id')<>t->>'id' or
  jsonb_typeof(t->'name') is distinct from 'string' or length(t->>'name') not between 1 and 60 or trim(t->>'name')<>t->>'name' or
  coalesce(t->>'color','') !~ '^#[0-9A-Fa-f]{6}$' or coalesce(t->>'stage','') not in ('before','after','both') or
  (coalesce(t->>'createdBy','')<>'system' and not exists(select 1 from public.school_accounts a where a.username=t->>'createdBy')))
 then raise exception 'Invalid academic tag'; end if;
 if exists(select 1 from jsonb_array_elements(p_data->'academicTags') t group by lower(t->>'id') having count(*)>1) or
 exists(select 1 from jsonb_array_elements(p_data->'academicTags') t group by lower(t->>'name') having count(*)>1) or
 exists(select 1 from jsonb_array_elements(p_data->'academicTags') t cross join jsonb_array_elements(p_data->'academicTags') o where t->>'id'<>o->>'id' and lower(t->>'name')=lower(o->>'id'))
 then raise exception 'Duplicate academic tag'; end if;
 if actor.role='teacher' and
 (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(p_data->'academicTags') where value->>'createdBy' is distinct from actor.username)
 is distinct from
 (select coalesce(jsonb_agg(value order by value->>'id'),'[]') from jsonb_array_elements(cur->'academicTags') where value->>'createdBy' is distinct from actor.username)
 then raise exception 'Other teacher academic tags restricted' using errcode='42501'; end if;
 -- Do not remove a badge referenced by an assessment or the original intake record.
 if exists(select 1 from public.school_academic_tags t where not exists(select 1 from jsonb_array_elements(p_data->'academicTags') n where n->>'id'=t.id) and (
  exists(select 1 from public.school_assessments a where a.before_level in (t.id,t.name) or a.after_level in (t.id,t.name) or (t.id='XS' and a.before_level='HTSX')) or
  exists(select 1 from (select profile from public.school_students union all select profile from public.school_pending_students) s
   where regexp_replace(trim(split_part(s.profile->>'priorEducation',E'\n',1)),'^(HTSX|HTT|HT|XS|SX|G|Khá|TB|Đạt|Giỏi|Tốt)\s*Tốt$','\1','i') in (t.id,t.name) or (t.id='XS' and split_part(s.profile->>'priorEducation',E'\n',1)='HTSX'))))
 then raise exception 'Academic tag in use'; end if;
 if exists(select 1 from jsonb_array_elements(p_data->'students') s cross join lateral jsonb_each(s->'assessments') a
  where coalesce(a.value->>'after','')<>'' and a.value->>'after' not in ('Tốt','Khá','Đạt','Cần hỗ trợ') and not exists(
   select 1 from jsonb_array_elements(p_data->'academicTags') t where t->>'id'=a.value->>'after' and t->>'stage' in ('after','both')))
 then raise exception 'Unknown academic tag'; end if;
 delete from public.school_academic_tags where id is not null;
 idx:=0;
 for item in select value from jsonb_array_elements(p_data->'academicTags') loop
  insert into public.school_academic_tags values(item->>'id',item->>'name',item->>'color',item->>'stage',item->>'createdBy',idx); idx:=idx+1;
 end loop;
 return public.school_save_workspace_v4(p_data,p_revision);
end; $$;
revoke all on function public.school_save_workspace(jsonb,bigint) from public,anon;
grant execute on function public.school_save_workspace(jsonb,bigint) to authenticated;
update public.school_meta set revision=revision+1,updated_at=now() where id=1;
notify pgrst, 'reload schema';
commit;
