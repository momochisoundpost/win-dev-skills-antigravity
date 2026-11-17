import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { listFilesRelative } from "./lib.mjs";
import { validatePlugins } from "./validate.mjs";

const PYTHON_ZIP_SCRIPT = `
import json, os, sys, zipfile

plugins_root = sys.argv[1]
out_zip = sys.argv[2]
entries = json.loads(sys.stdin.read())

os.makedirs(os.path.dirname(os.path.abspath(out_zip)), exist_ok=True)
with zipfile.ZipFile(out_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for rel in entries:
        src = os.path.join(plugins_root, rel)
        parts = rel.split("/")
        is_script = "scripts" in parts[:-1]
        mode = 0o755 if is_script else 0o644
        info = zipfile.ZipInfo(rel)
        info.create_system = 3
        info.external_attr = (0o100000 | mode) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        with open(src, "rb") as fh:
            zf.writestr(info, fh.read())
`;

/**
 * Validate `pluginsRoot` and package all plugin folders into a deterministic zip
 * preserving UNIX 0755 permissions on files under `scripts/`.
 */
export async function packageReleaseZip({ pluginsRoot, outputZipPath }) {
  const validation = validatePlugins(pluginsRoot);
  if (!validation.valid) {
    const details = validation.results
      .filter((r) => r.errors.length > 0)
      .map((r) => `${r.plugin}: ${r.errors.join("; ")}`)
      .join("\n");
    throw new Error(`Cannot package invalid plugins:\n${details}`);
  }

  const pluginDirs = new Set(validation.results.map((r) => r.plugin));
  const entries = listFilesRelative(pluginsRoot).filter((rel) =>
    pluginDirs.has(rel.split("/")[0]),
  );

  const res = spawnSync("python3", ["-c", PYTHON_ZIP_SCRIPT, pluginsRoot, outputZipPath], {
    input: JSON.stringify(entries),
    encoding: "utf8",
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`Release zip creation failed (exit ${res.status}): ${res.stderr}`);
  }
  return { entries };
}

function parseCliArgs(argv) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const opts = {
    pluginsRoot: path.join(repoRoot, "antigravity", "plugins"),
    outputZipPath: path.join(repoRoot, "win-dev-skills-antigravity.zip"),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) opts.pluginsRoot = path.resolve(argv[++i]);
    else if (argv[i] === "--out" && argv[i + 1]) opts.outputZipPath = path.resolve(argv[++i]);
    else throw new Error(`Unknown CLI argument: ${argv[i]}`);
  }
  return opts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opts = parseCliArgs(process.argv.slice(2));
  const { entries } = await packageReleaseZip(opts);
  console.log(`Packaged ${entries.length} files into ${opts.outputZipPath}`);
}
