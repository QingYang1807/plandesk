import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:4320",
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  },
  outputDir: "../../artifacts/test-results",
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "../../artifacts/playwright-report", open: "never" },
    ],
  ],
});
