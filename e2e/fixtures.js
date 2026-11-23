import { chromium, test as base } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist-e2e');

export const PAGE_URL = 'https://inpulator.test/';

/**
 * Waits until the content script in this page or frame has attached its
 * listeners. It is injected at document_idle, which can come after the load
 * event that goto() waits for; selecting text earlier would go unnoticed.
 * @param {import('@playwright/test').Page | import('@playwright/test').FrameLocator} target
 */
export function waitForExtension(target) {
  return target.locator('html[data-inpulator-ready]').waitFor({ state: 'attached' });
}

/** Fake MyMemory: uppercases the text so results are easy to assert. */
export function myMemoryReply(url) {
  const q = new URL(url).searchParams.get('q') || '';
  return {
    responseStatus: 200,
    responseData: { translatedText: `EN:${q.toUpperCase()}` },
    matches: [],
  };
}

export const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    const worker =
      context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
    await use(worker);
  },

  /** Sets extension settings (merged over defaults). */
  setSettings: async ({ serviceWorker }, use) => {
    await use((patch) =>
      serviceWorker.evaluate(async (value) => {
        const key = 'extensionSettings';
        // onInstalled writes defaults on first run; wait so it can't overwrite the patch.
        for (let i = 0; i < 50 && !(await chrome.storage.local.get(key))[key]; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        const current = (await chrome.storage.local.get(key))[key] || {};
        await chrome.storage.local.set({ [key]: { ...current, ...value } });
      }, patch)
    );
  },

  /** Opens a test page with the given body HTML at PAGE_URL. */
  openPage: async ({ context }, use) => {
    await use(async (body, { head = '' } = {}) => {
      const page = await context.newPage();
      await page.route(PAGE_URL, (route) =>
        route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`,
        })
      );
      await page.goto(PAGE_URL);
      await waitForExtension(page);
      return page;
    });
  },
});

export { expect } from '@playwright/test';
