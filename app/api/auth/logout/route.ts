import { logout, sameOrigin } from "@/lib/auth";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  await logout();
  return Response.json({ ok: true });
}
