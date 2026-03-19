// tweet — post a tweet
// usage: tweet <text>
// Outputs TWEET_POST:<text> for the caller (Claude) to execute via debug Chrome.

const text = process.argv.slice(2).join(" ");
if (!text) {
  console.log('Usage: tweet "your message"');
  process.exit(1);
}

const len = Buffer.byteLength(text, "utf8");
if (len > 280) {
  console.log(`ERROR: ${len} chars — over 280 limit. Trim it.`);
  process.exit(1);
}

console.log(`TWEET_POST:${text}`);
