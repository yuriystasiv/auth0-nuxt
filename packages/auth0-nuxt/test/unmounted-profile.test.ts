// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, createPage, url } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import type { Route } from 'playwright-core';

/**
 * Browser-level coverage for the client plugin when `mountRoutes: false` left `/auth/profile`
 * unmounted. The interesting case is an app with a catch-all page: Nuxt answers the plugin's
 * fetch with 200 HTML, and nothing may treat that as a signed-in user.
 */
describe('client hydration with an unmounted profile route', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/unmounted-profile', import.meta.url)),
    browser: true,
    nuxtConfig: {
      runtimeConfig: {
        auth0: {
          domain: 'example.auth0.local',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          sessionSecret: 'a-sufficiently-long-session-secret-value-1234567890',
          appBaseUrl: 'http://127.0.0.1:3003',
        },
      },
    },
  });

  /**
   * Loads a page and reports the profile response status and what `useUser()` ended up as.
   * `answer` stands in for whatever serves `/auth/profile`; without one the fixture's
   * catch-all page does, which is the reported setup.
   */
  async function load(answer?: (route: Route) => Promise<void>) {
    const page = await createPage();
    if (answer) {
      await page.route('**/auth/profile', answer);
    }

    // The plugin fetches after suspense resolves, so wait for that round trip before reading
    // the DOM, otherwise the SSR-rendered "anonymous" passes vacuously.
    const profile = page.waitForResponse((response) => new URL(response.url()).pathname === '/auth/profile');
    await page.goto(url('/anything'), { waitUntil: 'hydration' });
    const status = (await profile).status();
    // One more macrotask so the plugin's assignment after the response has rendered.
    await page.waitForTimeout(100);

    const state = await page.getByTestId('user-state').textContent();
    await page.close();
    return { status, state };
  }

  it('catch-all page answers 200 HTML', async () => {
    expect(await load()).toEqual({ status: 200, state: 'anonymous' });
  });

  it('nothing answers, 404', async () => {
    expect(await load((route) => route.fulfill({ status: 404 }))).toEqual({ status: 404, state: 'anonymous' });
  });

  it('consumer-mounted handler answers a claims object', async () => {
    expect(await load((route) => route.fulfill({ json: { sub: 'self-mounted' } }))).toEqual({
      status: 200,
      state: 'signed in',
    });
  });
});
