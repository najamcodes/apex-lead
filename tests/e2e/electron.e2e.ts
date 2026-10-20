import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'path';

test.describe('Desktop Electron Application', () => {
  test('Electron desktop window boots, exposes IPC bridge and renders', async () => {
    const electronApp = await electron.launch({
      args: [resolve('.')],
    });

    try {
      const window = await electronApp.firstWindow();
      await window.waitForLoadState('domcontentloaded');

      const title = await window.title();
      expect(title).toBeDefined();

      // Verify secure preload window.api bridge is exposed
      const hasApi = await window.evaluate(() => typeof (window as any).api !== 'undefined');
      expect(hasApi).toBe(true);

      // Verify essential API methods exist on window.api
      const apiMethods = await window.evaluate(() => {
        const api = (window as any).api;
        return {
          hasLeads: typeof api?.leads !== 'undefined',
          hasSettings: typeof api?.settings !== 'undefined',
          hasPipelines: typeof api?.pipelines !== 'undefined',
        };
      });

      expect(apiMethods.hasLeads).toBe(true);
      expect(apiMethods.hasSettings).toBe(true);
      expect(apiMethods.hasPipelines).toBe(true);
    } finally {
      await electronApp.close();
    }
  });
});
