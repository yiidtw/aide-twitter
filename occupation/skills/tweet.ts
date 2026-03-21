// tweet.ts — post a tweet via Chrome DevTools Protocol
// usage: bun run tweet.ts <text>
// Connects to Chrome's debug port (localhost:9222), navigates to X compose,
// types the tweet, and clicks Post.

const text = process.argv.slice(2).join(" ");
if (!text) {
  console.error('Usage: tweet "your message"');
  process.exit(1);
}

if (text.length > 280) {
  console.error(`ERROR: ${text.length} chars — over 280 limit. Trim it.`);
  process.exit(1);
}

// --- CDP helpers ---

let msgId = 1;

interface CDPResult {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

function cdpSend(
  ws: WebSocket,
  method: string,
  params: Record<string, unknown> = {}
): Promise<CDPResult["result"]> {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    const handler = (event: MessageEvent) => {
      const msg: CDPResult = JSON.parse(
        typeof event.data === "string" ? event.data : ""
      );
      if (msg.id === id) {
        ws.removeEventListener("message", handler);
        if (msg.error) {
          reject(new Error(`CDP error: ${msg.error.message}`));
        } else {
          resolve(msg.result);
        }
      }
    };
    ws.addEventListener("message", handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", (e) => reject(new Error(`WebSocket error: ${e}`)));
  });
}

// --- Main ---

async function main() {
  // 1. Discover tabs from Chrome debug endpoint
  let tabs: Array<{ url: string; webSocketDebuggerUrl: string; type: string }>;
  try {
    const res = await fetch("http://localhost:9222/json");
    tabs = await res.json();
  } catch {
    console.error("ERROR: Cannot connect to Chrome on localhost:9222.");
    console.error("Launch Chrome with: --remote-debugging-port=9222");
    process.exit(1);
  }

  // 2. Find existing x.com tab or create a new one
  let tab = tabs.find(
    (t) => t.type === "page" && t.url.includes("x.com")
  );
  if (!tab) {
    try {
      const res = await fetch(
        "http://localhost:9222/json/new?https://x.com/compose/post",
        { method: "PUT" }
      );
      tab = await res.json();
    } catch {
      console.error("ERROR: Failed to create new Chrome tab.");
      process.exit(1);
    }
  }

  if (!tab?.webSocketDebuggerUrl) {
    console.error("ERROR: No webSocketDebuggerUrl for tab.");
    process.exit(1);
  }

  // 3. Connect WebSocket
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  try {
    await waitForOpen(ws);
  } catch (e) {
    console.error(`ERROR: WebSocket connection failed: ${e}`);
    process.exit(1);
  }

  try {
    // 4. Navigate to compose
    await cdpSend(ws, "Page.enable");
    await cdpSend(ws, "Page.navigate", {
      url: "https://x.com/compose/post",
    });
    // Wait for SPA to fully load — poll for compose box
    let found = false;
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      const check = await cdpSend(ws, "Runtime.evaluate", {
        expression: `!!document.querySelector('[data-testid="tweetTextarea_0"]')`,
        returnByValue: true,
      });
      if ((check as any)?.result?.value === true) {
        found = true;
        break;
      }
    }
    if (!found) {
      console.error("ERROR: Compose box not found after 20s. Are you logged in?");
      process.exit(1);
    }

    // 5. Type text into compose box
    const escaped = JSON.stringify(text);
    const typeResult = await cdpSend(ws, "Runtime.evaluate", {
      expression: `
        (function() {
          const box = document.querySelector('[data-testid="tweetTextarea_0"]');
          if (!box) return "NOT_FOUND";
          box.focus();
          document.execCommand('insertText', false, ${escaped});
          return "OK";
        })()
      `,
      returnByValue: true,
    });

    const typeValue = (typeResult as any)?.result?.value;
    if (typeValue === "NOT_FOUND") {
      console.error(
        "ERROR: Compose box not found. Are you logged in to x.com?"
      );
      process.exit(1);
    }

    await sleep(1000);

    // 6. Click Post button
    const clickResult = await cdpSend(ws, "Runtime.evaluate", {
      expression: `
        (function() {
          const btn = document.querySelector('[data-testid="tweetButton"]');
          if (!btn) return "NOT_FOUND";
          btn.click();
          return "OK";
        })()
      `,
      returnByValue: true,
    });

    const clickValue = (clickResult as any)?.result?.value;
    if (clickValue === "NOT_FOUND") {
      console.error("ERROR: Post button not found.");
      process.exit(1);
    }

    // 7. Wait and verify
    await sleep(2000);
    console.log(`Tweet posted: ${text}`);
  } finally {
    ws.close();
  }
}

main().catch((e) => {
  console.error(`ERROR: ${e}`);
  process.exit(1);
});
