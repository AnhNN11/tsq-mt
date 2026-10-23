import { authenticate, sameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  try {
    const text = await request.text();
    if (text.length > 4000)
      return Response.json(
        { error: "Thông tin đăng nhập quá dài." },
        { status: 400 },
      );
    const { username, password } = JSON.parse(text);
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.length > 100 ||
      password.length > 200
    )
      return Response.json(
        { error: "Vui lòng nhập tài khoản và mật khẩu." },
        { status: 400 },
      );
    const result = await authenticate(username.trim().toLowerCase(), password);
    return Response.json(result, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Chưa đăng nhập được. Vui lòng kiểm tra cấu hình máy chủ." },
      { status: 500 },
    );
  }
}
