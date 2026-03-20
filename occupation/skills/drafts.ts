// drafts — list saved drafts
// usage: drafts

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

const instanceDir = process.env.AIDE_INSTANCE_DIR || join(dirname(process.argv[1]), "..");
const draftFile = join(instanceDir, "memory", "drafts.md");

if (existsSync(draftFile)) {
  console.log("=== Drafts ===");
  console.log(readFileSync(draftFile, "utf8").trimEnd());
} else {
  console.log("No drafts.");
}
