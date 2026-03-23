// engage — check Twitter notifications via Playwright
// usage: engage

// Use node (not bun) because bun's WebSocket breaks playwright CDP (oven-sh/bun#28450)
const script = `
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222', { timeout: 15000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  await page.goto('https://x.com/notifications', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('article', { timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  const notifs = await page.evaluate(() => {
    const articles = document.querySelectorAll('article');
    const results = [];
    for (let i = 0; i < Math.min(articles.length, 10); i++) {
      const el = articles[i];
      const text = el.textContent || '';
      const time = el.querySelector('time');
      const timeStr = time ? time.getAttribute('datetime') : '';
      results.push({ text: text.substring(0, 300), time: timeStr });
    }
    return results;
  });

  if (notifs.length === 0) {
    console.log('No notifications.');
  } else {
    for (let i = 0; i < notifs.length; i++) {
      const n = notifs[i];
      const t = n.time ? new Date(n.time).toLocaleString() : '?';
      console.log('[' + (i + 1) + '] ' + t);
      console.log('    ' + n.text.replace(/\\n/g, ' ').substring(0, 200));
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
