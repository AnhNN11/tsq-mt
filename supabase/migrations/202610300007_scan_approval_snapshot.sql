-- Keep the actual teacher-approved identity, variant and score with each paper.
begin;
alter table public.school_paper_scans add column approval jsonb;
create or replace function public.school_save_grade(p_actor text,p_exam uuid,p_student text,p_grade jsonb,p_version int,p_scan uuid default null,p_scan_version int default null,p_exam_version int default null) returns public.school_grades language plpgsql security definer set search_path='' as $$
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
 if p_scan is not null then update public.school_paper_scans set status='approved',answers=p_grade->'answers',approval=jsonb_build_object('studentId',candidate.student_id,'studentName',candidate.student_name,'variant',p_grade->>'variant','score',saved.score,'maxScore',saved.max_score,'note',saved.note),reviewed_by=p_actor,approved_at=now(),version=version+1,updated_at=now() where id=p_scan; end if;
 return saved;
end $$;
notify pgrst,'reload schema';
commit;
