import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    ...(process.env.BATYSKAF_BROWSER_MATRIX === '1'
      ? [
          { name: 'chrome', use: { browserName: 'chromium' as const, channel: 'chrome' } },
          { name: 'edge', use: { browserName: 'chromium' as const, channel: 'msedge' } },
          {
            name: 'firefox',
            use: {
              browserName: 'firefox' as const,
              launchOptions: {
                args: [],
                firefoxUserPrefs: { 'webgl.force-enabled': true, 'gfx.webrender.software': true },
              },
            },
          },
        ]
      : []),
  ],
});
