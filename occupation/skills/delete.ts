// delete — delete latest N tweets via Playwright
// usage: delete [count]

const count = parseInt(process.argv[2] || "1");

// Use node (not bun) because bun's WebSocket breaks playwright CDP (oven-sh/bun#28450)
const script = `
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222', { timeout: 15000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.goto('https://x.com/yiidtw', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('[data-testid="tweet"]', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));

  for (let d = 0; d < ${count}; d++) {
    // Click ••• menu on first tweet
    const caret = page.locator('[data-testid="tweet"]').first().locator('[data-testid="caret"]');
    await caret.click();
    await new Promise(r => setTimeout(r, 1000));

    // Click Delete in dropdown
    const deleteItem = page.locator('[role="menuitem"]').filter({ hasText: 'Delete' });
    if (await deleteItem.count() === 0) {
      console.log('SKIP: no Delete option (not your tweet?)');
      // close menu
      await page.keyboard.press('Escape');
      continue;
    }
    await deleteItem.click();
    await new Promise(r => setTimeout(r, 1000));

    // Confirm
    const confirm = page.locator('[data-testid="confirmationSheetConfirm"]');
    await confirm.click();
    await new Promise(r => setTimeout(r, 2000));
    console.log('DELETED ' + (d + 1));
  }

  await page.close();
  await browser.close();
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
`;

const proc = Bun.spawnSync(["node", "-e", script], {
  env: { ...process.env, NODE_PATH: "/Users/ydwu/.nvm/versions/node/v22.14.0/lib/node_modules" },
  stdout: "pipe",
  stderr: "pipe",
});

const stdout = proc.stdout.toString().trim();
const stderr = proc.stderr.toString().trim();

if (proc.exitCode !== 0) {
  console.error(stderr || stdout || "Unknown error");
  process.exit(1);
}
if (stdout) console.log(stdout);
if (stderr) console.error(stderr);
