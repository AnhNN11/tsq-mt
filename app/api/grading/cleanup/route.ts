import {
  gradeUser,
  gradingRoute,
  cleanupPaperImages,
  GradingError,
} from "@/lib/grading-server";
import { timingSafeEqual } from "node:crypto";
export async function POST(request: Request) {
  return gradingRoute(async () => ({
    removed: await cleanupPaperImages(await gradeUser(request)),
  }));
}
export async function GET(request: Request) {
  return gradingRoute(async () => {
    const expected = process.env.CRON_SECRET;
    const actual = request.headers
      .get("authorization")
      ?.replace(/^Bearer /, "");
    if (
      !expected ||
      !actual ||
      Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    )
      throw new GradingError("Không có quyền dọn ảnh theo lịch.", 401);
    let removed = 0;
    for (let batch = 0; batch < 10; batch++) {
      const count = await cleanupPaperImages();
      removed += count;
      if (count < 100) break;
    }
    return { removed };
  });
}
