import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageReleaseZip } from "../antigravity/package-release.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pluginsRoot = path.join(repoRoot, "antigravity", "plugins");

async function run(name, fn) {
  await fn();
  console.log(`pass  ${name}`);
}

await run("test_packages_valid_zip_with_posix_paths_and_0755_scripts", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ag-zip-test-"));
  const outZip = path.join(tmp, "win-dev-skills-antigravity.zip");
  try {
    const res = await packageReleaseZip({ pluginsRoot, outputZipPath: outZip });
    assert.ok(fs.existsSync(outZip));
    assert.ok(res.entries.length > 0);

    const pyInspect = spawnSync(
      "python3",
      [
        "-c",
        [
          "import json, sys, zipfile",
          "with zipfile.ZipFile(sys.argv[1]) as zf:",
          "    data = [{'name': i.filename, 'mode': (i.external_attr >> 16) & 0o777} for i in zf.infolist()]",
          "print(json.dumps(data))",
        ].join("\n"),
        outZip,
      ],
      { encoding: "utf8" },
    );
    assert.equal(pyInspect.status, 0, pyInspect.stderr);
    const items = JSON.parse(pyInspect.stdout);

    const topDirs = new Set(items.map((x) => x.name.split("/")[0]));
    assert.deepEqual([...topDirs].sort(), ["winappcli", "windbg", "winui"]);
    assert.ok(items.every((x) => !x.name.includes("\\")));
    assert.ok(items.every((x) => x.name !== "GENERATED.md"));

    const ps1 = items.find(
      (x) => x.name === "windbg/skills/windbg-diagnostic-method/scripts/validate-diagnosis-output.ps1",
    );
    assert.ok(ps1, "Expected validate-diagnosis-output.ps1 in release zip");
    assert.equal(ps1.mode, 0o755);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
