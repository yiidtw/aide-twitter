// abort — dismiss any open compose drafts and close compose tabs
// usage: abort

// Use node (not bun) because bun's WebSocket breaks playwright CDP (oven-sh/bun#28450)
const script = `
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222', { timeout: 15000 });
  const ctx = browser.contexts()[0];
  let closed = 0;

  for (const page of ctx.pages()) {
    if (page.url().includes('compose/post')) {
      // Dismiss draft if present
      const discard = page.locator('[data-testid="confirmationSheetConfirm"]');
      const textarea = page.locator('[data-testid="tweetTextarea_0"]');
      if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 500));
        if (await discard.isVisible({ timeout: 1000 }).catch(() => false)) {
          await discard.click();
          await new Promise(r => setTimeout(r, 500));
        }
      }
      await page.close();
      closed++;
    }
  }

  console.log(closed > 0 ? 'Aborted: closed ' + closed + ' compose tab(s).' : 'No compose tabs open.');
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
