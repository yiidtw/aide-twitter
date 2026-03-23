// check — read latest tweets from timeline via Playwright
// usage: check [count]

const count = parseInt(process.argv[2] || "5");

// Use node (not bun) because bun's WebSocket breaks playwright CDP (oven-sh/bun#28450)
const script = `
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222', { timeout: 15000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('[data-testid="tweetText"]', { timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));

  const tweets = await page.evaluate((n) => {
    const texts = document.querySelectorAll('[data-testid="tweetText"]');
    const results = [];
    for (let i = 0; i < Math.min(texts.length, n); i++) {
      const el = texts[i];
      const article = el.closest('article');
      const time = article ? article.querySelector('time') : null;
      const timeStr = time ? time.getAttribute('datetime') : '';
      const user = article ? (article.querySelector('[data-testid="User-Name"]')?.textContent || '') : '';
      results.push({
        user: user.substring(0, 100),
        text: el.textContent.substring(0, 300),
        time: timeStr
      });
    }
    return results;
  }, ${count});

  if (tweets.length === 0) {
    console.log('No tweets found.');
  } else {
    for (let i = 0; i < tweets.length; i++) {
      const t = tweets[i];
      const time = t.time ? new Date(t.time).toLocaleString() : '?';
      console.log('[' + (i + 1) + '] ' + t.user + ' — ' + time);
      console.log('    ' + t.text);
      console.log('');
    }
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
