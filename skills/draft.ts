// draft — save a tweet draft
// usage: draft <text>

import { mkdirSync, appendFileSync } from "fs";
import { join, dirname } from "path";

const text = process.argv.slice(2).join(" ");
if (!text) {
  console.log('Usage: draft "your message"');
  process.exit(1);
}

const instanceDir = process.env.AIDE_INSTANCE_DIR || join(dirname(process.argv[1]), "..");
const draftDir = join(instanceDir, "memory");
mkdirSync(draftDir, { recursive: true });
const draftFile = join(draftDir, "drafts.md");

const len = Buffer.byteLength(text, "utf8");
if (len > 280) {
  console.log(`WARNING: ${len} chars — over 280 limit`);
}

const now = new Date();
const timestamp = now.toLocaleString("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");
appendFileSync(draftFile, `- [${timestamp}] ${text}\n`);
console.log(`Draft saved (${len} chars)`);
