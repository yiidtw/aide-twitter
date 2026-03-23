// e2e — end-to-end test: tweet → check → delete → verify no draft
// usage: e2e

const TEST_TEXT = `[e2e-test] aide.sh ${Date.now()}`;

// Use node (not bun) because bun's WebSocket breaks playwright CDP (oven-sh/bun#28450)
const script = `
const { chromium } = require('playwright-core');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222', { timeout: 15000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  let passed = 0;
  let failed = 0;

  function ok(name) { passed++; console.log('PASS: ' + name); }
  function fail(name, reason) { failed++; console.error('FAIL: ' + name + ' — ' + reason); }

  // ── Step 1: Post tweet ──
  console.log('\\n── Step 1: Post tweet ──');
  await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 20000 });
  await page.click('[data-testid="tweetTextarea_0"]');
  await page.getByRole('textbox', { name: 'Post text' }).pressSequentially(${JSON.stringify(TEST_TEXT)});
  await sleep(1500);
  await page.getByTestId('tweetButton').evaluate(el => el.click());
  await sleep(4000);

  // Dismiss draft if compose still open
  const discard = page.locator('[data-testid="confirmationSheetConfirm"]');
  if (await discard.isVisible({ timeout: 1000 }).catch(() => false)) {
    await discard.click();
    await sleep(500);
  }

  const url = page.url();
  if (!url.includes('compose')) {
    ok('tweet posted');
  } else {
    fail('tweet posted', 'compose page still open');
  }

  // ── Step 2: Check tweet exists on profile ──
  console.log('\\n── Step 2: Verify tweet on profile ──');
  await page.goto('https://x.com/yiidtw', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('[data-testid="tweetText"]', { timeout: 20000 });
  await sleep(2000);

  const firstTweet = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="tweetText"]');
    return el ? el.textContent : '';
  });

  if (firstTweet.includes('[e2e-test]')) {
    ok('tweet visible on profile');
  } else {
    fail('tweet visible on profile', 'latest tweet: ' + firstTweet.substring(0, 80));
  }

  // ── Step 3: Delete tweet ──
  console.log('\\n── Step 3: Delete test tweet ──');
  const caret = page.locator('[data-testid="tweet"]').first().locator('[data-testid="caret"]');
  await caret.click();
  await sleep(1000);

  const deleteItem = page.locator('[role="menuitem"]').filter({ hasText: 'Delete' });
  if (await deleteItem.count() > 0) {
    await deleteItem.click();
    await sleep(1000);
    const confirm = page.locator('[data-testid="confirmationSheetConfirm"]');
    await confirm.click();
    await sleep(2000);
    ok('tweet deleted');
  } else {
    fail('tweet deleted', 'no Delete option in menu');
    await page.keyboard.press('Escape');
  }

  // ── Step 4: Verify deleted ──
  console.log('\\n── Step 4: Verify tweet gone ──');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="tweetText"]', { timeout: 20000 });
  await sleep(2000);

  const afterDelete = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="tweetText"]');
    return el ? el.textContent : '';
  });

  if (!afterDelete.includes('[e2e-test]')) {
    ok('tweet no longer on profile');
  } else {
    fail('tweet no longer on profile', 'still visible: ' + afterDelete.substring(0, 80));
  }

  // ── Step 5: Abort any compose drafts, then verify clean ──
  console.log('\\n── Step 5: Verify no compose drafts ──');
  for (const p of ctx.pages()) {
    if (p.url().includes('compose/post')) {
      const textarea = p.locator('[data-testid="tweetTextarea_0"]');
      if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
        await p.keyboard.press('Escape');
        await sleep(500);
        const d = p.locator('[data-testid="confirmationSheetConfirm"]');
        if (await d.isVisible({ timeout: 1000 }).catch(() => false)) {
          await d.click();
          await sleep(500);
        }
      }
      await p.close();
    }
  }
  let draftTabs = 0;
  for (const p of ctx.pages()) {
    if (p.url().includes('compose/post')) draftTabs++;
  }
  if (draftTabs === 0) {
    ok('no compose draft tabs after cleanup');
  } else {
    fail('no compose draft tabs after cleanup', draftTabs + ' compose tab(s) still open');
  }

  // ── Summary ──
  console.log('\\n── Summary ──');
  console.log(passed + ' passed, ' + failed + ' failed');

  await page.close();
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
`;

const proc = Bun.spawnSync(["node", "-e", script], {
  env: { ...process.env, NODE_PATH: "/Users/ydwu/.nvm/versions/node/v22.14.0/lib/node_modules" },
  stdout: "pipe",
  stderr: "pipe",
  timeout: 120_000_000_000, // 2 min in nanoseconds
});

const stdout = proc.stdout.toString().trim();
const stderr = proc.stderr.toString().trim();

if (stdout) console.log(stdout);
if (stderr) console.error(stderr);
process.exit(proc.exitCode || 0);
