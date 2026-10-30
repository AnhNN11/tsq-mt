import { randomBytes, randomUUID } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  gradeUser,
  gradingRoute,
  gradeExam,
  tokenHash,
  cleanupPaperImages,
  databaseError,
  GradingError,
} from "@/lib/grading-server";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return gradingRoute(async () => {
    const user = await gradeUser(request);
    const { id } = await ctx.params;
    await gradeExam(id, user, true);
    let base: URL;
    try {
      base = new URL(process.env.APP_PUBLIC_URL || new URL(request.url).origin);
      if (
        !["https:", "http:"].includes(base.protocol) ||
        base.username ||
        base.password
      )
        throw new Error();
    } catch {
      throw new GradingError("APP_PUBLIC_URL phải là địa chỉ web hợp lệ.", 503);
    }
    const token = randomBytes(32).toString("base64url");
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const db = createAdminClient();
    const old = await db
      .from("school_capture_sessions")
      .update({ active: false })
      .eq("exam_id", id)
      .eq("created_by", user.username)
      .eq("active", true);
    databaseError(old.error);
    const result = await db.from("school_capture_sessions").insert({
      id: sessionId,
      exam_id: id,
      token_hash: tokenHash(token),
      created_by: user.username,
      expires_at: expiresAt,
    });
    databaseError(result.error);
    // Cleanup is awaited; no abandoned background work in a serverless request.
    let cleaned = 0;
    try {
      cleaned = await cleanupPaperImages(user);
    } catch {
      /* A cleanup retry remains available in the UI. */
    }
    return {
      id: sessionId,
      expiresAt,
      maxUploads: 100,
      cleaned,
      url: new URL(`/capture/${sessionId}`, base).href + `#${token}`,
    };
  });
}
