-- Apply the same immediate business-conflict response to the existing workspace writer.
-- https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions
begin;
do $$
declare f record;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('school_save_workspace','school_save_workspace_v4') loop
  execute replace(pg_get_functiondef(f.oid), '''40001''', '''PT409''');
 end loop;
end $$;
create index school_paper_scans_expiry on public.school_paper_scans(image_expires_at) where image_path is not null;
notify pgrst,'reload schema';
commit;
