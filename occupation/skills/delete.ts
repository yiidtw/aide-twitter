// delete — delete latest N tweets via CDP
// usage: delete [count]
// Deletes the most recent N tweets (default 1)

const count = parseInt(process.argv[2] || "1");

let tabs: any[];
try {
  const res = await fetch("http://localhost:9222/json");
  tabs = await res.json();
} catch {
  console.error("ERROR: Cannot connect to Chrome on localhost:9222.");
  process.exit(1);
}

// Find or create x.com/yiidtw tab
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

let msgId = 1;
function cdpSend(ws: WebSocket, method: string, params: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    const handler = (event: MessageEvent) => {
      const msg = JSON.parse(typeof event.data === "string" ? event.data : "");
      if (msg.id === id) { ws.removeEventListener("message", handler); resolve(msg.result); }
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
  await cdpSend(ws, "Page.enable");
  await cdpSend(ws, "Page.navigate", { url: "https://x.com/yiidtw" });

  // Wait for tweets to load
  for (let i = 0; i < 10; i++) {
    await Bun.sleep(2000);
    const check = await cdpSend(ws, "Runtime.evaluate", {
      expression: `document.querySelectorAll('[data-testid="tweet"]').length`,
      returnByValue: true,
    });
    if ((check as any)?.result?.value > 0) break;
  }

  for (let d = 0; d < count; d++) {
    console.log(`Deleting tweet ${d + 1}/${count}...`);

    // Click the ••• menu on the first tweet
    const menuClick = await cdpSend(ws, "Runtime.evaluate", {
      expression: `
        (function() {
          const tweets = document.querySelectorAll('[data-testid="tweet"]');
          if (!tweets[0]) return "NO_TWEET";
          const menu = tweets[0].querySelector('[data-testid="caret"]');
          if (!menu) return "NO_MENU";
          menu.click();
          return "OK";
        })()
      `,
      returnByValue: true,
    });

    if ((menuClick as any)?.result?.value !== "OK") {
      console.error(`  Failed: ${(menuClick as any)?.result?.value}`);
      break;
    }

    await Bun.sleep(1000);

    // Click "Delete" in the dropdown
    const deleteClick = await cdpSend(ws, "Runtime.evaluate", {
      expression: `
        (function() {
          const items = document.querySelectorAll('[role="menuitem"]');
          for (const item of items) {
            if (item.textContent.includes('Delete')) {
              item.click();
              return "OK";
            }
          }
          return "NO_DELETE_OPTION";
        })()
      `,
      returnByValue: true,
    });

    if ((deleteClick as any)?.result?.value !== "OK") {
      console.error(`  Failed: ${(deleteClick as any)?.result?.value}`);
      break;
    }

    await Bun.sleep(1000);

    // Confirm delete in the dialog
    const confirmClick = await cdpSend(ws, "Runtime.evaluate", {
      expression: `
        (function() {
          const btn = document.querySelector('[data-testid="confirmationSheetConfirm"]');
          if (!btn) return "NO_CONFIRM";
          btn.click();
          return "OK";
        })()
      `,
      returnByValue: true,
    });

    if ((confirmClick as any)?.result?.value === "OK") {
      console.log(`  ✓ Deleted`);
    } else {
      console.error(`  Failed to confirm: ${(confirmClick as any)?.result?.value}`);
      break;
    }

    await Bun.sleep(2000);
  }
} finally {
  ws.close();
}
