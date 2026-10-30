import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  if (
    request.nextUrl.pathname.startsWith("/api/") ||
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/capture/") ||
    request.nextUrl.pathname.startsWith("/grading/")
  )
    response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  if (
    request.nextUrl.pathname.startsWith("/capture/") ||
    request.nextUrl.pathname.startsWith("/api/capture/")
  )
    response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
