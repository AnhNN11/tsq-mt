-- Grades use stable roster identifiers and snapshots deliberately: the legacy
-- workspace writer replaces roster rows in one transaction on every edit.
begin;
create function public.school_can_grade(p_subject text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.school_accounts a where a.id=auth.uid() and a.active and (a.role in ('admin','manager') or p_subject=any(a.subjects)));
$$;
revoke all on function public.school_can_grade(text) from public,anon;
grant execute on function public.school_can_grade(text) to authenticated;
create function public.school_grade_actor(p_actor text,p_subject text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.school_accounts a where a.username=p_actor and a.active and (a.role in ('admin','manager') or p_subject=any(a.subjects)));
$$;
revoke all on function public.school_grade_actor(text,text) from public,anon,authenticated;
grant execute on function public.school_grade_actor(text,text) to service_role;
create table public.school_exams (
 id uuid primary key default gen_random_uuid(), school_year text not null,
 semester int not null check(semester in (1,2)), class_id text not null, class_name text not null,
 subject text not null, title text not null check(length(trim(title)) between 2 and 120),
 kind text not null check(kind in ('regular','midterm','final')), weight numeric not null check(weight>0 and weight<=10),
 exam_date date not null, scoring jsonb not null check(jsonb_typeof(scoring)='object'),
 answer_keys jsonb not null check(jsonb_typeof(answer_keys)='array' and jsonb_array_length(answer_keys) between 1 and 30),
 version int not null default 1, archived boolean not null default false,
 created_by text not null references public.school_accounts(username), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index school_exams_scope on public.school_exams(school_year,semester,class_id,subject);
create table public.school_exam_candidates (
 exam_id uuid not null references public.school_exams(id) on delete cascade,
 student_id text not null, student_name text not null,
 candidate_number text not null check(candidate_number ~ '^[0-9]{8}$'),
 primary key(exam_id,student_id), unique(exam_id,candidate_number)
);
create table public.school_capture_sessions (
 id uuid primary key, exam_id uuid not null references public.school_exams(id), token_hash text not null check(token_hash ~ '^[0-9a-f]{64}$'),
 created_by text not null references public.school_accounts(username), expires_at timestamptz not null,
 active boolean not null default true, upload_count int not null default 0,
 max_uploads int not null default 100 check(max_uploads between 1 and 200), created_at timestamptz not null default now()
);
create table public.school_paper_scans (
 id uuid primary key, exam_id uuid not null references public.school_exams(id), session_id uuid references public.school_capture_sessions(id),
 image_hash text not null check(image_hash ~ '^[0-9a-f]{64}$'), image_path text,
 image_width int not null check(image_width between 100 and 4000), image_height int not null check(image_height between 100 and 4000),
 image_expires_at timestamptz not null default now()+interval '7 days', image_purged_at timestamptz,
 status text not null default 'uploaded' check(status in ('uploaded','processing','review','approved','failed','rejected')),
 result jsonb, answers jsonb, error_text text not null default '', version int not null default 1,
 recognized_exam_version int, processing_started_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 reviewed_by text references public.school_accounts(username), approved_at timestamptz,
 unique(exam_id,image_hash)
);
create index school_paper_scan_queue on public.school_paper_scans(exam_id,status,created_at);
create table public.school_grades (
 id uuid primary key default gen_random_uuid(), exam_id uuid not null references public.school_exams(id), student_id text not null,
 student_name text not null, candidate_number text not null, score numeric(8,2) not null,
 max_score numeric(8,2) not null check(max_score>0 and max_score<=100), note text not null default '',
 source text not null check(source in ('manual','scan')), scan_id uuid references public.school_paper_scans(id), variant text not null default '', answers jsonb,
 reviewed_by text not null references public.school_accounts(username), updated_at timestamptz not null default now(),
 version int not null default 1, deleted_at timestamptz,
 unique(exam_id,student_id), check(score>=0 and score<=max_score)
);
create unique index school_grade_scan_unique on public.school_grades(scan_id) where scan_id is not null;
create table public.school_grade_history (
 id bigint generated always as identity primary key, exam_id uuid not null references public.school_exams(id),
 grade_id uuid not null references public.school_grades(id), actor text not null references public.school_accounts(username),
 action text not null, previous_value jsonb, next_value jsonb, created_at timestamptz not null default now()
);
alter table public.school_exams enable row level security;
revoke all on public.school_exams from anon,authenticated;
grant all on public.school_exams to service_role;
alter table public.school_exam_candidates enable row level security;
revoke all on public.school_exam_candidates from anon,authenticated;
grant all on public.school_exam_candidates to service_role;
alter table public.school_capture_sessions enable row level security;
revoke all on public.school_capture_sessions from anon,authenticated;
grant all on public.school_capture_sessions to service_role;
alter table public.school_paper_scans enable row level security;
revoke all on public.school_paper_scans from anon,authenticated;
grant all on public.school_paper_scans to service_role;
alter table public.school_grades enable row level security;
revoke all on public.school_grades from anon,authenticated;
grant all on public.school_grades to service_role;
alter table public.school_grade_history enable row level security;
revoke all on public.school_grade_history from anon,authenticated;
grant all on public.school_grade_history to service_role;
grant usage,select on sequence public.school_grade_history_id_seq to service_role;
grant select on public.school_exams,public.school_exam_candidates,public.school_paper_scans,public.school_grades,public.school_grade_history to authenticated;
create policy school_grade_read on public.school_exams for select to authenticated using(public.school_can_grade(subject));
create policy school_grade_read on public.school_exam_candidates for select to authenticated using(exists(select 1 from public.school_exams e where e.id=exam_id and public.school_can_grade(e.subject)));
create policy school_grade_read on public.school_paper_scans for select to authenticated using(exists(select 1 from public.school_exams e where e.id=exam_id and public.school_can_grade(e.subject)));
create policy school_grade_read on public.school_grades for select to authenticated using(exists(select 1 from public.school_exams e where e.id=exam_id and public.school_can_grade(e.subject)));
create policy school_grade_read on public.school_grade_history for select to authenticated using(exists(select 1 from public.school_exams e where e.id=exam_id and public.school_can_grade(e.subject)));

create function public.school_save_exam(p_actor text,p_exam jsonb,p_version int,p_roster jsonb) returns public.school_exams language plpgsql security definer set search_path='' as $$
declare old public.school_exams%rowtype; saved public.school_exams%rowtype; item jsonb;
begin
 select * into old from public.school_exams where id=(p_exam->>'id')::uuid for update;
 if not public.school_grade_actor(p_actor,p_exam->>'subject') or (old.id is not null and not public.school_grade_actor(p_actor,old.subject)) then raise exception 'Forbidden' using errcode='42501'; end if;
 if (old.id is null and p_version<>0) or (old.id is not null and old.version<>p_version) then raise exception 'Revision conflict' using errcode='40001'; end if;
 if old.id is not null and exists(select 1 from public.school_grades g where g.exam_id=old.id) and
  (old.scoring is distinct from p_exam->'scoring' or old.answer_keys is distinct from p_exam->'answer_keys' or old.subject<>p_exam->>'subject' or old.class_id<>p_exam->>'class_id' or old.school_year<>p_exam->>'school_year' or old.semester<>(p_exam->>'semester')::int)
  then raise exception 'Bài kiểm tra đã có lịch sử điểm; không thay đổi lớp, học kỳ, đáp án hoặc thang điểm.' using errcode='22023'; end if;
 insert into public.school_exams(id,school_year,semester,class_id,class_name,subject,title,kind,weight,exam_date,scoring,answer_keys,created_by)
 values((p_exam->>'id')::uuid,p_exam->>'school_year',(p_exam->>'semester')::int,p_exam->>'class_id',p_exam->>'class_name',p_exam->>'subject',p_exam->>'title',p_exam->>'kind',(p_exam->>'weight')::numeric,(p_exam->>'exam_date')::date,p_exam->'scoring',p_exam->'answer_keys',p_actor)
 on conflict(id) do update set school_year=excluded.school_year,semester=excluded.semester,class_id=excluded.class_id,class_name=excluded.class_name,subject=excluded.subject,title=excluded.title,kind=excluded.kind,weight=excluded.weight,exam_date=excluded.exam_date,scoring=excluded.scoring,answer_keys=excluded.answer_keys,version=school_exams.version+1,updated_at=now()
 returning * into saved;
 if old.id is null then
  for item in select value from jsonb_array_elements(p_roster) loop
   insert into public.school_exam_candidates values(saved.id,item->>'student_id',item->>'student_name',item->>'candidate_number');
  end loop;
 end if;
 return saved;
end $$;

create function public.school_save_exam_candidates(p_actor text,p_exam uuid,p_version int,p_roster jsonb) returns void language plpgsql security definer set search_path='' as $$
declare e public.school_exams%rowtype; item jsonb;
begin
 select * into e from public.school_exams where id=p_exam for update;
 if e.id is null or not public.school_grade_actor(p_actor,e.subject) then raise exception 'Forbidden' using errcode='42501'; end if;
 if e.version<>p_version then raise exception 'Revision conflict' using errcode='40001'; end if;
 if exists(select 1 from public.school_grades g where g.exam_id=p_exam and not exists(select 1 from jsonb_array_elements(p_roster) r where r->>'student_id'=g.student_id and r->>'candidate_number'=g.candidate_number)) then raise exception 'Giữ số báo danh của học sinh đã có lịch sử điểm.' using errcode='22023'; end if;
 delete from public.school_exam_candidates where exam_id=p_exam;
 for item in select value from jsonb_array_elements(p_roster) loop
  insert into public.school_exam_candidates values(p_exam,item->>'student_id',item->>'student_name',item->>'candidate_number');
 end loop;
 update public.school_exams set version=version+1,updated_at=now() where id=p_exam;
end $$;

create function public.school_reserve_paper(p_session uuid,p_token_hash text,p_scan uuid,p_hash text,p_width int,p_height int) returns public.school_paper_scans language plpgsql security definer set search_path='' as $$
declare s public.school_capture_sessions%rowtype; paper public.school_paper_scans%rowtype;
begin
 select * into s from public.school_capture_sessions where id=p_session and token_hash=p_token_hash and active and expires_at>now() for update;
 if s.id is null or not exists(select 1 from public.school_exams e where e.id=s.exam_id and not e.archived) then raise exception 'Phiên chụp đã hết hạn hoặc đã đóng.' using errcode='42501'; end if;
 select * into paper from public.school_paper_scans where exam_id=s.exam_id and image_hash=p_hash;
 if paper.id is not null then return paper; end if;
 if s.upload_count>=s.max_uploads then raise exception 'Phiên đã đủ số ảnh. Tạo phiên mới.' using errcode='22023'; end if;
 update public.school_capture_sessions set upload_count=upload_count+1 where id=s.id;
 insert into public.school_paper_scans(id,exam_id,session_id,image_hash,image_path,image_width,image_height)
 values(p_scan,s.exam_id,s.id,p_hash,s.exam_id::text || '/' || p_scan::text || '.jpg',p_width,p_height) returning * into paper;
 return paper;
end $$;

create function public.school_claim_paper(p_actor text,p_scan uuid,p_version int) returns public.school_paper_scans language plpgsql security definer set search_path='' as $$
declare paper public.school_paper_scans%rowtype; subject_name text;
begin
 select * into paper from public.school_paper_scans where id=p_scan for update;
 select subject into subject_name from public.school_exams where id=paper.exam_id and not archived;
 if paper.id is null or subject_name is null or not public.school_grade_actor(p_actor,subject_name) then raise exception 'Forbidden' using errcode='42501'; end if;
 if paper.version<>p_version then raise exception 'Revision conflict' using errcode='40001'; end if;
 if paper.status in ('approved','rejected') or (paper.status='processing' and paper.processing_started_at>now()-interval '5 minutes') then raise exception 'Ảnh đang xử lý hoặc đã duyệt/loại.' using errcode='22023'; end if;
 if paper.image_path is null then raise exception 'Ảnh tạm đã được dọn. Chụp lại bài.' using errcode='22023'; end if;
 update public.school_paper_scans set status='processing',processing_started_at=now(),error_text='',version=version+1,updated_at=now() where id=p_scan returning * into paper;
 return paper;
end $$;

create function public.school_finish_paper(p_actor text,p_scan uuid,p_version int,p_exam_version int,p_result jsonb,p_error text) returns public.school_paper_scans language plpgsql security definer set search_path='' as $$
declare paper public.school_paper_scans%rowtype; e public.school_exams%rowtype;
begin
 select * into paper from public.school_paper_scans where id=p_scan for update;
 select * into e from public.school_exams where id=paper.exam_id;
 if paper.id is null or not public.school_grade_actor(p_actor,e.subject) then raise exception 'Forbidden' using errcode='42501'; end if;
 if paper.version<>p_version or paper.status<>'processing' or e.version<>p_exam_version then raise exception 'Revision conflict' using errcode='40001'; end if;
 update public.school_paper_scans set status=case when p_error='' then 'review' else 'failed' end,
  result=p_result,answers=p_result->'answers',recognized_exam_version=p_exam_version,error_text=left(p_error,1000),version=version+1,updated_at=now() where id=p_scan returning * into paper;
 return paper;
end $$;

create function public.school_save_grade(p_actor text,p_exam uuid,p_student text,p_grade jsonb,p_version int,p_scan uuid default null,p_scan_version int default null,p_exam_version int default null) returns public.school_grades language plpgsql security definer set search_path='' as $$
declare e public.school_exams%rowtype; candidate public.school_exam_candidates%rowtype; old public.school_grades%rowtype; saved public.school_grades%rowtype; paper public.school_paper_scans%rowtype;
begin
 select * into e from public.school_exams where id=p_exam for update;
 if e.id is null or e.archived or not public.school_grade_actor(p_actor,e.subject) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_exam_version is not null and e.version<>p_exam_version then raise exception 'Đáp án đã thay đổi. Xử lý lại ảnh.' using errcode='40001'; end if;
 select * into candidate from public.school_exam_candidates where exam_id=p_exam and student_id=p_student;
 if candidate.student_id is null then raise exception 'Học sinh chưa có trong danh sách dự thi.' using errcode='22023'; end if;
 select * into old from public.school_grades where exam_id=p_exam and student_id=p_student for update;
 if old.id is not null and old.deleted_at is null and old.version<>p_version then raise exception 'Học sinh đã có điểm hoặc điểm vừa thay đổi. Kiểm tra trước khi thay thế.' using errcode='40001'; end if;
 if old.id is null and p_version<>0 then raise exception 'Revision conflict' using errcode='40001'; end if;
 if p_scan is not null then
  select * into paper from public.school_paper_scans where id=p_scan and exam_id=p_exam for update;
  if paper.id is null or paper.status<>'review' or paper.version<>p_scan_version or paper.recognized_exam_version<>e.version then raise exception 'Ảnh đã thay đổi hoặc chưa sẵn sàng duyệt.' using errcode='40001'; end if;
 end if;
 insert into public.school_grades(exam_id,student_id,student_name,candidate_number,score,max_score,note,source,scan_id,variant,answers,reviewed_by)
 values(p_exam,p_student,candidate.student_name,candidate.candidate_number,(p_grade->>'score')::numeric,(p_grade->>'max_score')::numeric,coalesce(p_grade->>'note',''),case when p_scan is null then 'manual' else 'scan' end,p_scan,coalesce(p_grade->>'variant',''),p_grade->'answers',p_actor)
 on conflict(exam_id,student_id) do update set student_name=excluded.student_name,candidate_number=excluded.candidate_number,score=excluded.score,max_score=excluded.max_score,note=excluded.note,source=excluded.source,scan_id=excluded.scan_id,variant=excluded.variant,answers=excluded.answers,reviewed_by=p_actor,updated_at=now(),version=school_grades.version+1,deleted_at=null returning * into saved;
 insert into public.school_grade_history(exam_id,grade_id,actor,action,previous_value,next_value) values(p_exam,saved.id,p_actor,case when old.id is null then 'created' else 'updated' end,to_jsonb(old),to_jsonb(saved));
 if p_scan is not null then update public.school_paper_scans set status='approved',answers=p_grade->'answers',reviewed_by=p_actor,approved_at=now(),version=version+1,updated_at=now() where id=p_scan; end if;
 return saved;
end $$;

create function public.school_delete_grade(p_actor text,p_id uuid,p_version int) returns void language plpgsql security definer set search_path='' as $$
declare old public.school_grades%rowtype; saved public.school_grades%rowtype; subject_name text;
begin
 select * into old from public.school_grades where id=p_id for update;
 select subject into subject_name from public.school_exams where id=old.exam_id;
 if old.id is null or not public.school_grade_actor(p_actor,subject_name) then raise exception 'Forbidden' using errcode='42501'; end if;
 if old.version<>p_version then raise exception 'Revision conflict' using errcode='40001'; end if;
 update public.school_grades set deleted_at=now(),updated_at=now(),reviewed_by=p_actor,version=version+1 where id=p_id returning * into saved;
 insert into public.school_grade_history(exam_id,grade_id,actor,action,previous_value,next_value) values(old.exam_id,old.id,p_actor,'deleted',to_jsonb(old),to_jsonb(saved));
end $$;
do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('school_save_exam','school_save_exam_candidates','school_reserve_paper','school_claim_paper','school_finish_paper','school_save_grade','school_delete_grade') loop
  execute format('revoke all on function %s from public,anon,authenticated',f);
  execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('school-paper-scans','school-paper-scans',false,4194304,array['image/jpeg']) on conflict(id) do nothing;
notify pgrst,'reload schema';
commit;
