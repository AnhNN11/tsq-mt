import "server-only";
import { createClient } from "@/utils/supabase/server";
import { parseWorkspace, type Workspace } from "./model";
export async function readWorkspace(): Promise<{
  data: Workspace;
  revision: number;
  updatedAt: string;
  updatedBy: string;
}> {
  const supabase = await createClient();
  const { data: result, error } = await supabase.rpc("school_read_workspace");
  if (error)
    throw new Error(
      "Chưa tải được dữ liệu Supabase. Vui lòng kiểm tra kết nối và cấu hình bảng dữ liệu.",
    );
  const data = parseWorkspace(result?.data);
  if (!data) throw new Error("Dữ liệu Supabase chưa hợp lệ.");
  return {
    data,
    revision: Number(result.revision),
    updatedAt: result.updatedAt ?? "",
    updatedBy: result.updatedBy ?? "",
  };
}
export async function writeWorkspace(data: Workspace, revision: number) {
  const supabase = await createClient();
  const { data: result, error } = await supabase.rpc("school_save_workspace", {
    p_data: data,
    p_revision: revision,
  });
  if (["40001", "PT409"].includes(error?.code ?? "")) return null;
  if (error)
    throw new Error(
      error.code === "42501"
        ? "Bạn không có quyền thay đổi dữ liệu này."
        : "Chưa lưu được dữ liệu vào Supabase. Vui lòng thử lại.",
    );
  return result;
}
