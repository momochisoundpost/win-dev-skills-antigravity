import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const ANTIGRAVITY_SCHEMA_URL = "https://antigravity.google/schemas/v1/plugin.json";

export const HOST_REF_PATTERN =
  /copilot|claude|codex|openclaw|agent_type|user-invocable|`task`/gi;

const TEXT_SCAN_EXTENSIONS = new Set([".md", ".json", ".yaml", ".yml"]);
const TEXT_SCAN_EXCLUDED = new Set(["LICENSE", "NOTICE.md"]);

/** Recursively copy `srcDir` to `dstDir`, preserving POSIX file modes. */
export function copyDirFiltered(srcDir, dstDir, filterFn) {
  fs.mkdirSync(dstDir, { recursive: true });

  function walk(currentSrc, currentDst, relPrefix) {
    const entries = fs.readdirSync(currentSrc, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (filterFn && !filterFn(relPath, entry)) continue;
      const srcPath = path.join(currentSrc, entry.name);
      const dstPath = path.join(currentDst, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(dstPath, { recursive: true });
        walk(srcPath, dstPath, relPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, dstPath);
        const mode = fs.statSync(srcPath).mode & 0o777;
        fs.chmodSync(dstPath, mode);
      }
    }
  }

  walk(srcDir, dstDir, "");
}

/** Return sorted POSIX-normalized relative paths for all files under `rootDir`. */
export function listFilesRelative(rootDir) {
  const results = [];
  if (!fs.existsSync(rootDir)) return results;

  function walk(dir, relPrefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        results.push(relPath);
      }
    }
  }

  walk(rootDir, "");
  return results.sort();
}

function isAllowlisted(allowlist, pluginName, relPath, lineText) {
  return allowlist.some((entry) => {
    if (entry.plugin && pluginName && entry.plugin !== pluginName) return false;
    if (entry.file !== relPath) return false;
    return lineText.includes(entry.pattern);
  });
}

/** Scan text files under `rootDir` for un-allowlisted host-specific references. */
export function findHostReferences(rootDir, allowlist = [], pluginName = undefined) {
  const hits = [];
  for (const relPath of listFilesRelative(rootDir)) {
    const base = path.posix.basename(relPath);
    const ext = path.posix.extname(relPath).toLowerCase();
    if (TEXT_SCAN_EXCLUDED.has(base) || !TEXT_SCAN_EXTENSIONS.has(ext)) continue;

    const fullPath = path.join(rootDir, relPath);
    const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
    for (let idx = 0; idx < lines.length; idx++) {
      const lineText = lines[idx];
      HOST_REF_PATTERN.lastIndex = 0;
      let m;
      while ((m = HOST_REF_PATTERN.exec(lineText)) !== null) {
        if (!isAllowlisted(allowlist, pluginName, relPath, lineText)) {
          hits.push({
            file: relPath,
            line: idx + 1,
            match: m[0],
            text: lineText.trim(),
          });
        }
      }
    }
  }
  return hits;
}

function fileDigestAndExec(fullPath) {
  const data = fs.readFileSync(fullPath);
  const hash = crypto.createHash("sha256").update(data).digest("hex");
  const isExec = (fs.statSync(fullPath).mode & 0o100) !== 0;
  return { hash, isExec };
}

/** Compare two directories by relative file list, SHA-256 content, and executable bit. */
export function diffDirectories(dirA, dirB) {
  const filesA = new Set(listFilesRelative(dirA));
  const filesB = new Set(listFilesRelative(dirB));
  const all = new Set([...filesA, ...filesB]);
  const diffs = [];

  for (const relPath of [...all].sort()) {
    if (!filesA.has(relPath)) {
      diffs.push(`+ ${relPath} (only in second directory)`);
      continue;
    }
    if (!filesB.has(relPath)) {
      diffs.push(`- ${relPath} (missing in second directory)`);
      continue;
    }
    const metaA = fileDigestAndExec(path.join(dirA, relPath));
    const metaB = fileDigestAndExec(path.join(dirB, relPath));
    if (metaA.hash !== metaB.hash) {
      diffs.push(`M ${relPath} (content differs)`);
    } else if (metaA.isExec !== metaB.isExec) {
      diffs.push(`M ${relPath} (executable bit differs)`);
    }
  }
  return diffs;
}
