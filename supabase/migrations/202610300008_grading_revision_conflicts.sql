-- Business revision conflicts must return immediately, not trigger transaction retries.
-- PT409 is PostgREST's explicit HTTP 409 SQLSTATE.
begin;
do $$
declare f record;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in (
  'school_save_exam','school_save_exam_candidates','school_claim_paper',
  'school_finish_paper','school_save_grade','school_delete_grade'
 ) loop
  execute replace(pg_get_functiondef(f.oid), '''40001''', '''PT409''');
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
