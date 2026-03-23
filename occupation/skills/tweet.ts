// tweet — post a tweet via Playwright (node + playwright-core)
// usage: tweet <text>

const text = process.argv.slice(2).join(" ");
if (!text) {
  console.error('Usage: tweet "your message"');
  process.exit(1);
}

if (text.length > 280) {
  console.error(`ERROR: ${text.length} chars — over 280 limit. Trim it.`);
  process.exit(1);
}

// Use node (not bun) because bun's WebSocket breaks playwright CDP (oven-sh/bun#28450)
const script = `
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222', { timeout: 15000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.goto('https://x.com/compose/post', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 20000 });
  await page.click('[data-testid="tweetTextarea_0"]');
  await page.getByRole('textbox', { name: 'Post text' }).pressSequentially(${JSON.stringify(text)});
  await new Promise(r => setTimeout(r, 1500));
  await page.getByTestId('tweetButton').evaluate(el => el.click());
  await new Promise(r => setTimeout(r, 3000));
  const url = page.url();
  const gone = !url.includes('compose') || await page.$('[data-testid="tweetTextarea_0"]') === null;
  console.log(gone ? 'POSTED' : 'FAILED');
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

if (stdout === "POSTED") {
  console.log(`Tweet posted: ${text}`);
} else {
  console.error(stderr || stdout || "Unknown error");
  process.exit(1);
}
