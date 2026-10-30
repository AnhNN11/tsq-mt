import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { gradeExam, databaseError } from "@/lib/grading-server";
import { createAdminClient } from "@/utils/supabase/admin";
import PrintableSheets from "@/components/printable-sheets";
type SheetPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ student?: string; variant?: string }>;
};
export default function Sheets(props: SheetPageProps) {
  return (
    <Suspense
      fallback={<div className="app-loading">Đang chuẩn bị phiếu trả lời…</div>}
    >
      <SheetContent {...props} />
    </Suspense>
  );
}
async function SheetContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ student?: string; variant?: string }>;
}) {
  await connection();
  const user = await currentUser();
  if (!user) redirect("/login");
  let printData: Parameters<typeof PrintableSheets>[0] | null = null;
  try {
    const { id } = await params;
    const query = await searchParams;
    const exam = await gradeExam(id, user);
    const variant =
      query.variant && exam.answer_keys.some((k) => k.code === query.variant)
        ? query.variant
        : exam.answer_keys[0].code;
    let q = createAdminClient()
      .from("school_exam_candidates")
      .select("student_name,candidate_number,student_id")
      .eq("exam_id", id)
      .order("candidate_number");
    if (query.student && query.student !== "all" && query.student !== "blank")
      q = q.eq("student_id", query.student);
    const { data, error } = await q;
    databaseError(error);
    printData = {
      title: exam.title,
      groups: exam.paper_template ?? undefined,
      subject: exam.subject,
      variant,
      candidates: query.student === "blank" ? [] : (data ?? []),
    };
  } catch {
    /* Permission and fetch failures render the safe fallback below. */
  }
  return printData ? (
    <PrintableSheets {...printData} />
  ) : (
    <div className="app-loading">
      Chưa mở được phiếu. Quay lại bài kiểm tra, kiểm tra quyền truy cập rồi thử
      lại.
    </div>
  );
}
