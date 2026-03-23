// abort — close any open compose tabs (discard draft tweets)
// usage: abort

const tabs: any[] = await fetch("http://localhost:9222/json").then(r => r.json()).catch(() => []);
let closed = 0;

for (const t of tabs) {
  if (t.url?.includes("compose/post") && t.type === "page") {
    await fetch(`http://localhost:9222/json/close/${t.id}`, { method: "PUT" }).catch(() => {});
    closed++;
  }
}

if (closed > 0) {
  console.log(`Aborted: closed ${closed} compose tab(s).`);
} else {
  console.log("No compose tabs open.");
}
