import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = "c:\\Git Projects\\openclaw-google-calendar";

test("package, manifest, entrypoint, and example config use the same plugin id", async () => {
  const packageJson = await readJson("package.json");
  const manifest = await readJson("openclaw.plugin.json");
  const exampleConfig = await readJson("examples/openclaw.config.example.jsonc");
  const entrySource = await readText("src/index.ts");

  assert.equal(packageJson.name, "openclaw-google-calendar");
  assert.equal(manifest.id, packageJson.name);
  assert.ok(entrySource.includes('id: "openclaw-google-calendar"'));
  assert.ok(exampleConfig.plugins.entries["openclaw-google-calendar"]);
  assert.deepEqual(exampleConfig.tools.allow, ["openclaw-google-calendar"]);
});

test("package version, manifest version, and plugin entry file stay aligned", async () => {
  const packageJson = await readJson("package.json");
  const manifest = await readJson("openclaw.plugin.json");
  const entryPath = packageJson.openclaw.extensions[0];
  const resolvedEntryPath = path.join(repoRoot, entryPath.replace(/^\.\//, ""));

  assert.equal(manifest.version, packageJson.version);
  assert.equal(entryPath, "./src/index.ts");
  await assert.doesNotReject(() => stat(resolvedEntryPath));
});

test("manifest configSchema properties match the example plugin config keys", async () => {
  const manifest = await readJson("openclaw.plugin.json");
  const exampleConfig = await readJson("examples/openclaw.config.example.jsonc");

  const schemaKeys = Object.keys(manifest.configSchema.properties).sort();
  const exampleKeys = Object.keys(
    exampleConfig.plugins.entries["openclaw-google-calendar"].config,
  ).sort();

  assert.deepEqual(exampleKeys, schemaKeys);
});

test(".env.example documents every supported Google Calendar environment variable", async () => {
  const envExample = await readText(".env.example");

  for (const key of [
    "GOOGLE_CALENDAR_CREDENTIALS_PATH",
    "GOOGLE_CALENDAR_TOKEN_PATH",
    "GOOGLE_CALENDAR_OAUTH_REDIRECT_URI",
    "GOOGLE_CALENDAR_DEFAULT_CALENDAR_ID",
    "GOOGLE_CALENDAR_DEFAULT_TIME_ZONE",
    "GOOGLE_CALENDAR_CONFIRMATION_MODE",
    "GOOGLE_CALENDAR_UPCOMING_WINDOW_DAYS",
    "GOOGLE_CALENDAR_READ_ONLY_MODE",
  ]) {
    assert.match(envExample, new RegExp(`^${key}=`, "m"));
  }
});

test("manifest skills paths exist and contain a SKILL.md file", async () => {
  const manifest = await readJson("openclaw.plugin.json");

  for (const skillPath of manifest.skills) {
    const resolvedSkillDirectory = path.join(repoRoot, skillPath.replace(/^\.\//, ""));
    const skillDocumentPath = path.join(resolvedSkillDirectory, "google-calendar-assistant", "SKILL.md");

    await assert.doesNotReject(() => stat(resolvedSkillDirectory));
    await assert.doesNotReject(() => stat(skillDocumentPath));
  }
});

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
  return await readFile(path.join(repoRoot, relativePath), "utf8");
}
