import { expect, test } from '@playwright/test';

/**
 * The scripted click-through that replaces "tell me what to test" during an
 * autonomous build. It runs against the app in LOCAL TEST MODE with the
 * example person from scripts/seed-example.mjs.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  if (await page.getByLabel('Test password').isVisible().catch(() => false)) {
    await page.getByLabel('Test password').fill('local-test');
    await page.getByRole('button', { name: 'Enter' }).click();
    await page.waitForURL('**/');
  }
});

test('the dashboard shows the mission, the priorities and the people', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'My Germany Job Mission' })).toBeVisible();
  await expect(page.getByText("Today's priorities")).toBeVisible();
  await expect(page.getByText("People I'm helping")).toBeVisible();
  await expect(page.getByText('LOCAL TEST MODE')).toBeVisible();
});

test('the example person opens with their journey, profile and matches', async ({ page }) => {
  await page.goto('/people');
  await expect(page.getByRole('heading', { name: "People I'm helping" })).toBeVisible();
  await page.getByRole('link', { name: /Jean \(example\)/ }).first().click();
  await expect(page.getByRole('heading', { name: /Jean \(example\)/ })).toBeVisible();
  await expect(page.getByText('German A2')).toBeVisible();
  await expect(page.getByText('The journey')).toBeVisible();

  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page.getByText('Germany preferences')).toBeVisible();

  await page.getByRole('link', { name: 'Matches', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Find matches' })).toBeVisible();
});

test('matching is honest about the German gap', async ({ page }) => {
  await page.goto('/people');
  await page.getByRole('link', { name: /Jean \(example\)/ }).first().click();
  await page.getByRole('link', { name: 'Matches', exact: true }).click();
  await page.getByRole('button', { name: 'Find matches' }).click();

  const warning = page.getByText(/Employer asks for German B1, candidate has A2/);
  await expect(warning).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/% match/).first()).toBeVisible();
});

test('the review queue is empty and says nothing is sent without approval', async ({ page }) => {
  await page.goto('/applications/review');
  await expect(page.getByRole('heading', { name: 'Approve applications' })).toBeVisible();
  await expect(page.getByText(/Nothing leaves this tool until you press/)).toBeVisible();
  await expect(page.getByText(/Email sending — NOT CONNECTED/)).toBeVisible();
});

test('the job search reports the source honestly instead of inventing vacancies', async ({ page }) => {
  await page.goto('/jobs');
  await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible();
  await page.getByLabel('Occupation').fill('Elektriker');
  await page.getByRole('button', { name: /Search the Bundesagentur/ }).click();
  await expect(
    page.getByText(/vacancies stored|SOURCE NOT CONNECTED/).first(),
  ).toBeVisible({ timeout: 40_000 });
});

test('the immigration page refuses to start before a real job offer exists', async ({ page }) => {
  await page.goto('/people');
  await page.getByRole('link', { name: /Jean \(example\)/ }).first().click();
  await page.getByRole('link', { name: 'Immigration' }).click();
  await expect(page.getByText('Read this first')).toBeVisible();
  await expect(page.getByText(/Not yet — and that is on purpose/)).toBeVisible();
  await page.getByRole('button', { name: /FASTEST REALISTIC PATH/ }).click();
  await expect(page.getByText(/No job offer exists yet/)).toBeVisible({ timeout: 30_000 });
});

test('settings show how rules.md was understood and which rails cannot be switched off', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How your rules were understood' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Safety rails that no rule can switch off' })).toBeVisible();
  await expect(page.getByText(/Never spend money/)).toBeVisible();
  await expect(page.getByText('Automatic send at')).toBeVisible();
});

test('the Opportunity Radar states the honest limits up front', async ({ page }) => {
  await page.goto('/opportunities');
  await expect(page.getByRole('heading', { name: 'Opportunity Radar' })).toBeVisible();
  await expect(page.getByText(/never lists a short-stay visitor visa/)).toBeVisible();
});

test('Track B says plainly that there is no unskilled work visa', async ({ page }) => {
  await page.goto('/people');
  await page.getByRole('link', { name: /Jean \(example\)/ }).first().click();
  await page.getByRole('link', { name: 'Track B' }).click();
  await expect(page.getByText(/There is no German work visa for unskilled/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Calculate the gap' })).toBeVisible();
});

test('every sidebar page loads without an error', async ({ page }) => {
  for (const path of ['/', '/inbox', '/people', '/jobs', '/applications', '/companies', '/opportunities', '/tasks', '/agent', '/settings']) {
    await page.goto(path);
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('500');
  }
});
