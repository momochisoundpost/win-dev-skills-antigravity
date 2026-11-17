import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAll } from "../antigravity/build.mjs";
import { parseFrontmatter } from "../antigravity/frontmatter.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(here, "fixtures", "antigravity-source");

function copyFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ag-build-test-"));
  fs.cpSync(fixtureDir, tmp, { recursive: true });
  fs.chmodSync(
    path.join(tmp, "upstream", "sample", "skills", "sample-skill", "scripts", "check.ps1"),
    0o755,
  );
  return tmp;
}

function buildOpts(root, extra = {}) {
  return {
    repoRoot: root,
    sourcesPath: path.join(root, "sources.json"),
    rewritesPath: path.join(root, "rewrites.json"),
    overridesRoot: path.join(root, "overrides"),
    outputRoot: path.join(root, "out"),
    ...extra,
  };
}

async function run(name, fn) {
  await fn();
  console.log(`pass  ${name}`);
}

await run("test_builds_clean_plugin_and_drops_user_invocable_and_preserves_script_mode", async () => {
  const root = copyFixture();
  try {
    const res = await buildAll(buildOpts(root));
    assert.deepEqual(res.plugins, ["sample"]);

    const skillText = fs.readFileSync(
      path.join(root, "out", "sample", "skills", "sample-skill", "SKILL.md"),
      "utf8",
    );
    const parsedSkill = parseFrontmatter(skillText);
    assert.equal(parsedSkill.data.name, "sample-skill");
    assert.ok(!("user-invocable" in parsedSkill.data));

    const agentText = fs.readFileSync(
      path.join(root, "out", "sample", "agents", "helper.md"),
      "utf8",
    );
    const parsedAgent = parseFrontmatter(agentText);
    assert.equal(parsedAgent.data.mainAgent, true);
    assert.equal(parsedAgent.data.commandExecutionPolicy, "sandbox");
    assert.ok(agentText.includes("Do not spawn another `helper` subagent."));
    assert.ok(!agentText.includes("agent_type"));

    assert.ok(fs.existsSync(path.join(root, "out", "GENERATED.md")));
    assert.ok(fs.existsSync(path.join(root, "out", "sample", "LICENSE")));
    assert.ok(fs.existsSync(path.join(root, "out", "sample", "NOTICE.md")));
    const scriptStat = fs.statSync(
      path.join(root, "out", "sample", "skills", "sample-skill", "scripts", "check.ps1"),
    );
    assert.notEqual(scriptStat.mode & 0o111, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

await run("test_check_mode_fails_on_hand_edit", async () => {
  const root = copyFixture();
  try {
    await buildAll(buildOpts(root));
    await buildAll(buildOpts(root, { check: true }));

    const target = path.join(root, "out", "sample", "skills", "sample-skill", "SKILL.md");
    fs.appendFileSync(target, "\n<!-- manual edit -->\n");
    await assert.rejects(() => buildAll(buildOpts(root, { check: true })), /out of sync/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

await run("test_fails_on_stale_rewrite_find_string", async () => {
  const root = copyFixture();
  try {
    const rwPath = path.join(root, "rewrites.json");
    const rw = JSON.parse(fs.readFileSync(rwPath, "utf8"));
    rw.rewrites[0].find = "THIS_TEXT_DOES_NOT_EXIST";
    fs.writeFileSync(rwPath, JSON.stringify(rw, null, 2));
    await assert.rejects(() => buildAll(buildOpts(root)), /Rewrite did not match/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

await run("test_fails_on_unrewritten_host_reference", async () => {
  const root = copyFixture();
  try {
    const rwPath = path.join(root, "rewrites.json");
    fs.writeFileSync(rwPath, JSON.stringify({ rewrites: [], allowlist: [] }, null, 2));
    await assert.rejects(() => buildAll(buildOpts(root)), /Host-specific reference/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

await run("test_fails_on_agent_override_mismatch_or_skill_folder_mismatch", async () => {
  const rootA = copyFixture();
  try {
    fs.writeFileSync(
      path.join(rootA, "overrides", "sample", "agents", "ghost.yaml"),
      "name: ghost\ndescription: ghost\n",
    );
    await assert.rejects(() => buildAll(buildOpts(rootA)), /Agent mismatch/);
  } finally {
    fs.rmSync(rootA, { recursive: true, force: true });
  }

  const rootB = copyFixture();
  try {
    const skillPath = path.join(
      rootB,
      "upstream",
      "sample",
      "skills",
      "sample-skill",
      "SKILL.md",
    );
    fs.writeFileSync(
      skillPath,
      fs.readFileSync(skillPath, "utf8").replace("name: sample-skill", "name: wrong-name"),
    );
    await assert.rejects(() => buildAll(buildOpts(rootB)), /does not match folder/);
  } finally {
    fs.rmSync(rootB, { recursive: true, force: true });
  }
});
