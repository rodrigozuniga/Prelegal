const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 15000,
  use: {
    baseURL: 'http://localhost:8090',
    channel: 'chrome',
  },
  webServer: {
    command: 'python3 -m http.server 8090',
    url: 'http://localhost:8090/index.html',
    reuseExistingServer: true,
  },
});
