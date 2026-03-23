import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = "c:\\Git Projects\\openclaw-google-calendar";

test("README points to the detailed local install guide", async () => {
  const readme = await readText("README.md");

  assert.match(readme, /docs\/local-install\.md/i);
  assert.match(readme, /openclaw plugins install -l \./i);
  assert.match(readme, /openclaw gateway restart/i);
  assert.match(readme, /plugins\.entries\.openclaw-google-calendar\.config/i);
});

test("local install guide documents the expected OpenClaw install and validation commands", async () => {
  const installGuide = await readText("docs/local-install.md");

  for (const snippet of [
    "npm install",
    "openclaw plugins install .",
    "openclaw plugins install -l .",
    "openclaw gateway restart",
    "openclaw plugins list",
    "openclaw plugins info openclaw-google-calendar",
    "openclaw plugins doctor",
    "openclaw gateway status",
  ]) {
    assert.ok(
      installGuide.includes(snippet),
      `Expected the local install guide to include: ${snippet}`,
    );
  }
});

test("local install guide documents the first-run Google auth tool flow", async () => {
  const installGuide = await readText("docs/local-install.md");

  assert.match(installGuide, /google_calendar_begin_auth/i);
  assert.match(installGuide, /google_calendar_complete_auth/i);
  assert.match(installGuide, /authorization code/i);
  assert.match(installGuide, /tokenPath/i);
  assert.match(installGuide, /readOnlyMode/i);
});

async function readText(relativePath) {
  return await readFile(path.join(repoRoot, relativePath), "utf8");
}
