// tweet — validate and prepare tweet text
// usage: tweet <text>
//
// Validates length, then outputs the text for posting.
// Actual posting is done via Playwright MCP tools:
//   1. browser_navigate to x.com/compose/post
//   2. browser_type (slowly:true) on compose textbox
//   3. browser_evaluate el.click() on Post button
//
// See knowledge/x-testids.md for the full posting flow.
// DO NOT use puppeteer — it does not trigger React state updates.

const text = process.argv.slice(2).join(" ");
if (!text) {
  console.error('Usage: tweet "your message"');
  process.exit(1);
}

if (text.length > 280) {
  console.error(`ERROR: ${text.length} chars — over 280 limit. Trim it.`);
  process.exit(1);
}

console.log(`TWEET_READY (${text.length}/280):`);
console.log(text);
console.log();
console.log("Post via Playwright MCP:");
console.log("  1. browser_navigate → https://x.com/compose/post");
console.log("  2. browser_type (slowly:true) on 'Post text' textbox");
console.log("  3. browser_evaluate (el => el.click()) on Post button ref");
