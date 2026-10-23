import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { loadStaffAccounts } from "./staff-accounts";
test("all dashboard sections remain readable within desktop and mobile viewports", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const admin = (await loadStaffAccounts()).find((a) => a.role === "admin")!;
  expect(
    (
      await page.request.post("/api/auth/login", {
        data: { username: admin.email, password: admin.password },
      })
    ).status(),
  ).toBe(200);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const sections = [
    "Tổng quan quản lý",
    "Quản lý lớp và học sinh",
    "Quản lý học lực",
    "Quản lý năng khiếu",
    "Quản lý giảng dạy",
    "Báo cáo và thống kê",
    "Quản trị hệ thống",
  ];
  await mkdir("data/qa/ui-review", { recursive: true });
  for (const width of [1512, 390]) {
    await page.setViewportSize({ width, height: 1050 });
    for (const [i, section] of sections.entries()) {
      if (width < 700)
        await page
          .getByRole("button", { name: "Mở menu", exact: true })
          .click();
      await page.getByRole("button", { name: section, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: `${section}.`, exact: true }),
      ).toBeVisible();
      await expect(page.locator(".ant-skeleton")).toHaveCount(0);
      await expect(page.locator(".ant-alert-error")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 2,
        ),
        `${section} at ${width}px`,
      ).toBe(true);
      await page.screenshot({
        path: `data/qa/ui-review/${width}-${i}.png`,
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1512, height: 1050 });
  await page
    .getByRole("button", { name: "Tổng quan quản lý", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kiểm tra hồ sơ", exact: true })
    .click();
  await expect(page.locator(".review-panel")).toBeVisible();
  await expect(page.locator(".review-panel")).toContainText(
    "Kết quả học tập đầu vào chưa xác minh",
  );
  await page
    .getByRole("button", { name: "Quản lý học lực", exact: true })
    .click();
  await page.getByRole("button", { name: "Thẻ học lực", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Hoàn thành xuất sắc");
  await page
    .getByRole("dialog")
    .screenshot({ path: "data/qa/ui-review/academic-catalog.png" });
  expect(errors).toEqual([]);
});
