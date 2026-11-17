import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseFrontmatter, serializeFrontmatter } from "../antigravity/frontmatter.mjs";
import {
  ANTIGRAVITY_SCHEMA_URL,
  copyDirFiltered,
  diffDirectories,
  findHostReferences,
} from "../antigravity/lib.mjs";

function run(name, fn) {
  fn();
  console.log(`pass  ${name}`);
}

run("test_parses_folded_and_quoted_scalars", () => {
  const md = [
    "---",
    "name: winui-dev",
    "description: >-",
    "  First line: with colon.",
    "  Second line.",
    'quoted: "Hello: \\"world\\""',
    "user-invocable: true",
    "---",
    "",
    "# Body",
  ].join("\n");
  const parsed = parseFrontmatter(md);
  assert.equal(parsed.data.name, "winui-dev");
  assert.equal(parsed.data.description, "First line: with colon. Second line.");
  assert.equal(parsed.data.quoted, 'Hello: "world"');
  assert.equal(parsed.data["user-invocable"], true);
  assert.equal(parsed.body, "\n# Body");
  assert.equal(parsed.lineEnding, "\n");
});

run("test_parses_crlf_and_inline_and_block_arrays", () => {
  const md = [
    "---",
    "name: contrarian",
    "tools: []",
    "skills:",
    "  - a",
    "  - b",
    "---",
    "Body line",
  ].join("\r\n");
  const parsed = parseFrontmatter(md);
  assert.equal(parsed.lineEnding, "\r\n");
  assert.ok(Array.isArray(parsed.data.tools) && parsed.data.tools.length === 0);
  assert.deepEqual(parsed.data.skills, ["a", "b"]);
  assert.equal(parsed.body, "Body line");
});

run("test_rejects_missing_frontmatter", () => {
  assert.throws(() => parseFrontmatter("# No header\n"), /Missing YAML frontmatter/);
});

run("test_roundtrip_serialize_object_and_raw_yaml", () => {
  const outObj = serializeFrontmatter(
    { name: "win-test", description: "Has: colon", tools: ["read_file", "run_command"] },
    "\n# Heading\n",
    "\n",
  );
  const parsedObj = parseFrontmatter(outObj);
  assert.equal(parsedObj.data.name, "win-test");
  assert.equal(parsedObj.data.description, "Has: colon");
  assert.deepEqual(parsedObj.data.tools, ["read_file", "run_command"]);
  assert.equal(parsedObj.body, "\n# Heading\n");

  const outRaw = serializeFrontmatter("name: contrarian\ntools: []", "\nReview body\r\n", "\r\n");
  assert.ok(outRaw.includes("\r\n"));
  const parsedRaw = parseFrontmatter(outRaw);
  assert.equal(parsedRaw.data.name, "contrarian");
  assert.deepEqual(parsedRaw.data.tools, []);
  assert.equal(parsedRaw.body, "\nReview body\r\n");
});

run("test_lib_helpers_preserve_modes_diff_and_scan_host_refs", () => {
  assert.equal(ANTIGRAVITY_SCHEMA_URL, "https://antigravity.google/schemas/v1/plugin.json");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ag-lib-test-"));
  try {
    const src = path.join(tmp, "src");
    const dst = path.join(tmp, "dst");
    fs.mkdirSync(path.join(src, "scripts"), { recursive: true });
    const scriptPath = path.join(src, "scripts", "run.ps1");
    fs.writeFileSync(scriptPath, "Write-Output 'ok'\n");
    fs.chmodSync(scriptPath, 0o755);
    fs.writeFileSync(path.join(src, "SKILL.md"), "---\nname: x\n---\nUse copilot here.\n");
    fs.writeFileSync(path.join(src, "NOTICE.md"), "Ported from copilot plugin.\n");

    copyDirFiltered(src, dst);
    const dstStat = fs.statSync(path.join(dst, "scripts", "run.ps1"));
    assert.notEqual(dstStat.mode & 0o111, 0);
    assert.deepEqual(diffDirectories(src, dst), []);

    fs.writeFileSync(path.join(dst, "SKILL.md"), "---\nname: x\n---\nChanged.\n");
    const diffs = diffDirectories(src, dst);
    assert.ok(diffs.some((d) => d.includes("SKILL.md")));

    const hits = findHostReferences(src, [], "sample");
    assert.equal(hits.length, 1);
    assert.equal(hits[0].file, "SKILL.md");

    const allowHits = findHostReferences(
      src,
      [{ plugin: "sample", file: "SKILL.md", pattern: "Use copilot here." }],
      "sample",
    );
    assert.equal(allowHits.length, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
