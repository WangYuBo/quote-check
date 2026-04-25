/**
 * Smoke tests (m3 · E2E · L-01/02/03/07/10)
 *
 * Covers five critical user paths:
 *   L-01  登录页可访问，未认证用户被重定向
 *   L-02  注册 + 邮箱登录
 *   L-03  上传页在登录后可访问
 *   L-07  报告页有三维度区域
 *   L-10  历史页展示任务列表
 *
 * Runs against a live dev server (or PLAYWRIGHT_BASE_URL env in CI).
 * Tests are sequential (workers:1) — they share a registered user account.
 *
 * IMPORTANT: Requires E2E_TEST_EMAIL / E2E_TEST_PASSWORD env vars pointing
 * to an existing test account, or the signup test must run first.
 */

import { expect, test } from '@playwright/test';

const TEST_EMAIL = process.env['E2E_TEST_EMAIL'] ?? `e2e-${Date.now()}@example.com`;
const TEST_PASSWORD = process.env['E2E_TEST_PASSWORD'] ?? 'TestPass123!';
const TEST_NAME = 'E2E Smoke';

// L-01 — unauthenticated users are redirected to sign-in
test('L-01: unauthenticated → redirect to sign-in', async ({ page }) => {
  await page.goto('/upload');
  await expect(page).toHaveURL(/\/sign-in/);
});

// L-02 — sign-up flow creates account and lands on authenticated page
test('L-02: sign-up with email + password', async ({ page }) => {
  await page.goto('/sign-up');
  await expect(page.locator('h1, h2')).toContainText(['注册', '创建账号', 'Sign up'], {
    ignoreCase: true,
  });

  await page.getByLabel(/邮箱|Email/i).fill(TEST_EMAIL);
  await page.getByLabel(/密码|Password/i).fill(TEST_PASSWORD);

  const nameInput = page.getByLabel(/姓名|昵称|Name/i);
  if (await nameInput.isVisible()) {
    await nameInput.fill(TEST_NAME);
  }

  await page.getByRole('button', { name: /注册|Sign up|创建/i }).click();

  // After sign-up, should land on a non-sign-up page
  await page.waitForURL((url) => !url.pathname.includes('/sign-up'), { timeout: 10_000 });
});

// L-03 — upload page is accessible after login
test('L-03: upload page accessible after sign-in', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel(/邮箱|Email/i).fill(TEST_EMAIL);
  await page.getByLabel(/密码|Password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /登录|Sign in/i }).click();

  await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 10_000 });
  await page.goto('/upload');
  await expect(page).not.toHaveURL(/\/sign-in/);

  // Should see upload UI elements
  await expect(page.locator('main')).toBeVisible();
});

// L-07 — report page shows three verdict dimensions (requires a completed task)
test('L-07: report page has three verdict dimensions', async ({ page }) => {
  const taskId = process.env['E2E_COMPLETED_TASK_ID'];
  if (!taskId) {
    test.skip(true, 'E2E_COMPLETED_TASK_ID not set — skipping report page check');
    return;
  }

  await page.goto('/sign-in');
  await page.getByLabel(/邮箱|Email/i).fill(TEST_EMAIL);
  await page.getByLabel(/密码|Password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /登录|Sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 10_000 });

  await page.goto(`/reports/${taskId}`);
  await expect(page.getByText('引用核查报告')).toBeVisible();

  // Three dimensions should appear
  await expect(page.getByText('字词准确性')).toBeVisible();
  await expect(page.getByText('解释一致性')).toBeVisible();
  await expect(page.getByText('上下文相符')).toBeVisible();

  // Export buttons present
  await expect(page.getByRole('link', { name: /CSV/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Word/i })).toBeVisible();
});

// L-10 — history page shows task list after sign-in
test('L-10: history page accessible and shows task list', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel(/邮箱|Email/i).fill(TEST_EMAIL);
  await page.getByLabel(/密码|Password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /登录|Sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 10_000 });

  await page.goto('/history');
  await expect(page).not.toHaveURL(/\/sign-in/);
  await expect(page.locator('main')).toBeVisible();
  // Page either shows tasks or empty state — both are valid
  const hasRows = (await page.getByText(/任务|COMPLETED|PENDING/i).count()) > 0;
  const hasEmpty = (await page.getByText(/还没有/i).count()) > 0;
  expect(hasRows || hasEmpty).toBeTruthy();
});
