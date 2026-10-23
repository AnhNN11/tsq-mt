import { loadEnvConfig } from "@next/env";
import { defineConfig } from "@playwright/test";

loadEnvConfig(process.cwd());
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 1512, height: 1050 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
