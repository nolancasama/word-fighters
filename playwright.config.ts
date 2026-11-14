import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:4181", screenshot: "only-on-failure" },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4181 --strictPort",
    url: "http://127.0.0.1:4181",
    reuseExistingServer: true,
    timeout: 60_000
  },
  projects: [
    { name: "chromebook", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 657 } } },
    { name: "chromebook-touch", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 689 }, hasTouch: true } }
  ]
});
