import { currentUser, sameOrigin } from "@/lib/auth";
import { assertCanUpdate } from "@/lib/access";
import { parseWorkspace } from "@/lib/model";
import { readWorkspace, writeWorkspace } from "@/lib/server-workspace";
import { assertValidChanges } from "@/lib/validation";

export async function GET() {
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Phiên đăng nhập đã hết hạn." },
      { status: 401 },
    );
  try {
    return Response.json(await readWorkspace(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "Chưa tải được dữ liệu Supabase. Vui lòng thử lại." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user)
    return Response.json(
      { error: "Phiên đăng nhập đã hết hạn." },
      { status: 401 },
    );
  if (!sameOrigin(request))
    return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  try {
    if (Number(request.headers.get("content-length")) > 20 * 1024 * 1024)
      return Response.json({ error: "Dữ liệu quá lớn." }, { status: 413 });
    const text = await request.text();
    if (text.length > 20 * 1024 * 1024)
      return Response.json({ error: "Dữ liệu quá lớn." }, { status: 413 });
    const body = JSON.parse(text);
    const current = await readWorkspace();
    if (
      !Number.isSafeInteger(body.revision) ||
      body.revision !== current.revision
    )
      return Response.json(
        {
          error:
            "Dữ liệu vừa được người khác cập nhật. Đã tải bản mới; vui lòng thực hiện lại thao tác.",
        },
        { status: 409 },
      );
    if (body.legacy && (user.role !== "admin" || current.revision > 1))
      return Response.json(
        { error: "Chỉ admin được chuyển dữ liệu cũ khi kho dữ liệu còn mới." },
        { status: 403 },
      );
    const next = parseWorkspace(body.data, Boolean(body.legacy), current.data);
    if (!next)
      return Response.json({ error: "Dữ liệu chưa hợp lệ." }, { status: 400 });
    try {
      assertValidChanges(current.data, next);
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
    try {
      assertCanUpdate(user, current.data, next);
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 403 });
    }
    const saved = await writeWorkspace(next, body.revision);
    return saved
      ? Response.json(saved, { headers: { "Cache-Control": "no-store" } })
      : Response.json(
          { error: "Dữ liệu đã thay đổi. Vui lòng tải lại." },
          { status: 409 },
        );
  } catch {
    return Response.json(
      { error: "Không lưu được dữ liệu trên máy chủ." },
      { status: 500 },
    );
  }
}
