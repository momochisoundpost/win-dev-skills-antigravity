import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "../antigravity/build.mjs";
import { validatePlugins } from "../antigravity/validate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(here, "fixtures", "antigravity-source");

async function makeBuiltFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ag-val-test-"));
  fs.cpSync(fixtureDir, tmp, { recursive: true });
  fs.chmodSync(
    path.join(tmp, "upstream", "sample", "skills", "sample-skill", "scripts", "check.ps1"),
    0o755,
  );
  const outRoot = path.join(tmp, "plugins");
  await buildAll({
    repoRoot: tmp,
    sourcesPath: path.join(tmp, "sources.json"),
    rewritesPath: path.join(tmp, "rewrites.json"),
    overridesRoot: path.join(tmp, "overrides"),
    outputRoot: outRoot,
  });
  return { tmp, outRoot };
}

async function run(name, fn) {
  await fn();
  console.log(`pass  ${name}`);
}

await run("test_valid_plugin_passes", async () => {
  const { tmp, outRoot } = await makeBuiltFixture();
  try {
    const res = validatePlugins(outRoot);
    assert.equal(res.valid, true);
    assert.equal(res.results.length, 1);
    assert.deepEqual(res.results[0].errors, []);
    assert.deepEqual(res.results[0].warnings, []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

await run("test_rejects_unknown_manifest_key", async () => {
  const { tmp, outRoot } = await makeBuiltFixture();
  try {
    const manifestPath = path.join(outRoot, "sample", "plugin.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.extraKey = 1;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const res = validatePlugins(outRoot);
    assert.equal(res.valid, false);
    assert.ok(res.results[0].errors.some((e) => e.includes("extraKey")));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

await run("test_rejects_four_suggested_prompts", async () => {
  const { tmp, outRoot } = await makeBuiltFixture();
  try {
    const manifestPath = path.join(outRoot, "sample", "plugin.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.suggestedPrompts.push("Fourth prompt");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const res = validatePlugins(outRoot);
    assert.equal(res.valid, false);
    assert.ok(res.results[0].errors.some((e) => e.includes("suggestedPrompts")));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

await run("test_rejects_missing_or_nonsquare_svg_logo", async () => {
  const { tmp, outRoot } = await makeBuiltFixture();
  try {
    const logoPath = path.join(outRoot, "sample", "assets", "logo.svg");
    fs.writeFileSync(logoPath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 64"/>');
    let res = validatePlugins(outRoot);
    assert.equal(res.valid, false);
    assert.ok(res.results[0].errors.some((e) => /square/i.test(e)));

    fs.writeFileSync(logoPath, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"/>');
    res = validatePlugins(outRoot);
    assert.equal(res.valid, false);
    assert.ok(res.results[0].errors.some((e) => e.includes("128")));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

await run("test_rejects_disallowed_display_name_and_missing_affiliation", async () => {
  const { tmp, outRoot } = await makeBuiltFixture();
  try {
    const manifestPath = path.join(outRoot, "sample", "plugin.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.displayName = "Antigravity WinUI Plugin";
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(outRoot, "sample", "README.md"), "# Sample\nJust docs.\n");

    const res = validatePlugins(outRoot);
    assert.equal(res.valid, false);
    assert.ok(res.results[0].errors.some((e) => /displayName/i.test(e)));
    assert.ok(res.results[0].errors.some((e) => /not affiliated/i.test(e)));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

await run("test_rejects_bad_agent_or_skill_frontmatter_and_host_ref", async () => {
  const { tmp, outRoot } = await makeBuiltFixture();
  try {
    const skillPath = path.join(outRoot, "sample", "skills", "sample-skill", "SKILL.md");
    fs.writeFileSync(
      skillPath,
      fs.readFileSync(skillPath, "utf8").replace("description:", "user-invocable: false\ndescription:"),
    );
    const agentPath = path.join(outRoot, "sample", "agents", "helper.md");
    fs.appendFileSync(agentPath, "\nRun copilot CLI.\n");

    const res = validatePlugins(outRoot);
    assert.equal(res.valid, false);
    assert.ok(res.results[0].errors.some((e) => e.includes("user-invocable")));
    assert.ok(res.results[0].errors.some((e) => /host-specific/i.test(e)));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
