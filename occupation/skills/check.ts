// check — read latest tweets from @yiidtw via CDP
// usage: check [count]
// Returns the latest N tweets (default 5)

const count = parseInt(process.argv[2] || "5");

// Connect to Chrome CDP
let tabs: any[];
try {
  const res = await fetch("http://localhost:9222/json");
  tabs = await res.json();
} catch {
  console.error("ERROR: Cannot connect to Chrome on localhost:9222.");
  process.exit(1);
}

// Find or create x.com tab
let tab = tabs.find((t: any) => t.type === "page" && t.url.includes("x.com/yiidtw"));
if (!tab) {
  try {
    const res = await fetch("http://localhost:9222/json/new?https://x.com/yiidtw", { method: "PUT" });
    tab = await res.json();
  } catch {
    console.error("ERROR: Failed to open x.com tab.");
    process.exit(1);
  }
}

if (!tab?.webSocketDebuggerUrl) {
  console.error("ERROR: No webSocketDebuggerUrl.");
  process.exit(1);
}

// CDP helpers
let msgId = 1;
function cdpSend(ws: WebSocket, method: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    const handler = (event: MessageEvent) => {
      const msg = JSON.parse(typeof event.data === "string" ? event.data : "");
      if (msg.id === id) {
        ws.removeEventListener("message", handler);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise<void>((resolve, reject) => {
  if (ws.readyState === WebSocket.OPEN) return resolve();
  ws.addEventListener("open", () => resolve());
  ws.addEventListener("error", () => reject(new Error("WebSocket failed")));
});

try {
  // Navigate to profile
  await cdpSend(ws, "Page.enable");
  await cdpSend(ws, "Page.navigate", { url: "https://x.com/yiidtw" });

  // Wait for tweets to load
  let found = false;
  for (let i = 0; i < 10; i++) {
    await Bun.sleep(2000);
    const check = await cdpSend(ws, "Runtime.evaluate", {
      expression: `document.querySelectorAll('[data-testid="tweetText"]').length`,
      returnByValue: true,
    });
    if ((check as any)?.result?.value > 0) { found = true; break; }
  }

  if (!found) {
    console.error("ERROR: No tweets found after 20s.");
    process.exit(1);
  }

  // Extract tweets
  const result = await cdpSend(ws, "Runtime.evaluate", {
    expression: `
      (function() {
        const tweets = document.querySelectorAll('[data-testid="tweetText"]');
        const times = document.querySelectorAll('time');
        const results = [];
        for (let i = 0; i < Math.min(tweets.length, ${count}); i++) {
          const text = tweets[i]?.textContent || "";
          const time = times[i]?.getAttribute("datetime") || "";
          results.push({ text: text.substring(0, 300), time });
        }
        return JSON.stringify(results);
      })()
    `,
    returnByValue: true,
  });

  const tweets = JSON.parse((result as any)?.result?.value || "[]");
  if (tweets.length === 0) {
    console.log("No tweets found.");
  } else {
    for (let i = 0; i < tweets.length; i++) {
      const t = tweets[i];
      const timeStr = t.time ? new Date(t.time).toLocaleString() : "?";
      console.log(`[${i + 1}] ${timeStr}`);
      console.log(`    ${t.text}`);
      console.log("");
    }
  }
} finally {
  ws.close();
}
