#!/usr/bin/env node
/**
 * Runs every *.test.cjs in this directory, one Node process each.
 *
 * Requires the dev dependencies (npm install): jsdom + react + react-dom.
 * Already-installed copies can be reused through NODE_PATH instead.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const files = fs.readdirSync(__dirname)
  .filter((name) => name.endsWith(".test.cjs"))
  .sort();

let failed = 0;
for (const file of files) {
  process.stdout.write("• " + file + "\n");
  const res = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: "inherit" });
  if (res.status !== 0) {
    failed++;
    process.stderr.write("✗ " + file + "\n");
  }
}

if (failed) {
  process.stderr.write("\n" + failed + " of " + files.length + " test files failed\n");
  process.exit(1);
}
process.stdout.write("\nAll " + files.length + " test files passed\n");
