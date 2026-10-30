-- All pre-upgrade exams used this same calibrated layout. Preserve it explicitly.
begin;
update public.school_exams e set template_id=t.id, template_name='Phiếu ba phần · Bố cục trước nâng cấp', paper_template=t.groups
from public.school_paper_templates t
where t.id='30000000-0000-4000-8000-000000000001' and e.template_id is null and e.paper_template is null;
notify pgrst,'reload schema';
commit;
