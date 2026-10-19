import { defineConfig } from '@playwright/test'
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 60_000,
  expect: { timeout: 10_000 }, reporter: 'list',
  use: { baseURL: 'http://localhost:5173', screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {},
  },
  projects: [{ name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }, { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }],
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI, timeout: 60_000 },
})
