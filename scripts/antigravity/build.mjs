import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseFrontmatter, serializeFrontmatter } from "./frontmatter.mjs";
import {
  ANTIGRAVITY_SCHEMA_URL,
  copyDirFiltered,
  diffDirectories,
  findHostReferences,
} from "./lib.mjs";

const ALLOWED_MANIFEST_KEYS = new Set([
  "$schema",
  "name",
  "displayName",
  "description",
  "version",
  "disabled",
  "logo",
  "suggestedPrompts",
  "skills",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "extensions",
]);

function runTool(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, { encoding: "utf8", ...options });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${res.status}): ${res.stderr || res.stdout}`);
  }
  return res;
}

function repoNameFromUrl(repoUrl) {
  const base = repoUrl.replace(/\/+$/, "").split("/").pop() || "upstream";
  return base.replace(/\.git$/, "");
}

function resolveSourceTree(source, repoRoot, cacheDir, workTmpDir) {
  if (source.local) {
    const localPath = path.resolve(repoRoot, source.local);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local source path does not exist: ${localPath}`);
    }
    return { sourceDir: localPath };
  }

  if (!source.repo || !source.sha || !source.path) {
    throw new Error(`Remote source requires repo, sha, and path: ${JSON.stringify(source)}`);
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  const repoDir = path.join(cacheDir, repoNameFromUrl(source.repo));
  if (!fs.existsSync(path.join(repoDir, ".git"))) {
    runTool("git", ["clone", "--filter=blob:none", "--no-checkout", source.repo, repoDir]);
  }

  const checkCommit = spawnSync("git", ["-C", repoDir, "cat-file", "-e", `${source.sha}^{commit}`]);
  if (checkCommit.status !== 0) {
    runTool("git", ["-C", repoDir, "fetch", "--depth=1", "origin", source.sha]);
  }

  const archiveRes = spawnSync("git", ["-C", repoDir, "archive", source.sha, source.path], {
    maxBuffer: 64 * 1024 * 1024,
  });
  if (archiveRes.error) throw archiveRes.error;
  if (archiveRes.status !== 0) {
    throw new Error(`git archive failed: ${archiveRes.stderr?.toString()}`);
  }

  const extractDir = path.join(workTmpDir, "extract", repoNameFromUrl(source.repo));
  fs.mkdirSync(extractDir, { recursive: true });
  const tarRes = spawnSync("tar", ["-xf", "-", "-C", extractDir], {
    input: archiveRes.stdout,
  });
  if (tarRes.error) throw tarRes.error;
  if (tarRes.status !== 0) {
    throw new Error(`tar extract failed: ${tarRes.stderr?.toString()}`);
  }

  const sourceDir = path.join(extractDir, source.path);
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Extracted source path missing: ${sourceDir}`);
  }
  return { sourceDir };
}

function transformSkills(srcSkillsDir, dstSkillsDir) {
  if (!fs.existsSync(srcSkillsDir)) {
    throw new Error(`Upstream skills directory missing: ${srcSkillsDir}`);
  }
  copyDirFiltered(srcSkillsDir, dstSkillsDir);

  const skillFolders = fs
    .readdirSync(dstSkillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const folder of skillFolders) {
    const skillMdPath = path.join(dstSkillsDir, folder, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      throw new Error(`Missing SKILL.md in ${skillMdPath}`);
    }
    const raw = fs.readFileSync(skillMdPath, "utf8");
    const parsed = parseFrontmatter(raw);
    const { data, body, lineEnding } = parsed;

    const skillName = data.name || folder;
    if (skillName !== folder) {
      throw new Error(`Skill frontmatter name '${skillName}' does not match folder '${folder}'`);
    }
    if (typeof data.description !== "string" || data.description.trim().length === 0) {
      throw new Error(`Skill '${folder}' is missing a description`);
    }
    if (data.description.length > 1024) {
      throw new Error(`Skill '${folder}' description exceeds 1024 chars (${data.description.length})`);
    }

    const nextData = { ...data, name: skillName };
    delete nextData["user-invocable"];
    fs.writeFileSync(skillMdPath, serializeFrontmatter(nextData, body, lineEnding));
  }
}

function transformAgents(srcAgentsDir, overrideAgentsDir, dstAgentsDir) {
  const upstreamFiles = fs.existsSync(srcAgentsDir)
    ? fs.readdirSync(srcAgentsDir).filter((f) => f.endsWith(".agent.md")).sort()
    : [];
  const overrideFiles = fs.existsSync(overrideAgentsDir)
    ? fs.readdirSync(overrideAgentsDir).filter((f) => f.endsWith(".yaml")).sort()
    : [];

  const upstreamNames = upstreamFiles.map((f) => f.replace(/\.agent\.md$/, ""));
  const overrideNames = overrideFiles.map((f) => f.replace(/\.yaml$/, ""));

  if (JSON.stringify(upstreamNames) !== JSON.stringify(overrideNames)) {
    throw new Error(
      `Agent mismatch: upstream=[${upstreamNames.join(",")}] overrides=[${overrideNames.join(",")}]`,
    );
  }
  if (upstreamNames.length === 0) return;

  fs.mkdirSync(dstAgentsDir, { recursive: true });
  for (const name of upstreamNames) {
    const upstreamRaw = fs.readFileSync(path.join(srcAgentsDir, `${name}.agent.md`), "utf8");
    const overrideYaml = fs.readFileSync(path.join(overrideAgentsDir, `${name}.yaml`), "utf8");
    const parsed = parseFrontmatter(upstreamRaw);
    const rendered = serializeFrontmatter(overrideYaml, parsed.body, parsed.lineEnding);
    fs.writeFileSync(path.join(dstAgentsDir, `${name}.md`), rendered);
  }
}

function applyRewrites(pluginName, pluginOutDir, rewrites) {
  for (const entry of rewrites) {
    if (entry.plugin !== pluginName) continue;
    const targetPath = path.join(pluginOutDir, entry.file);
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Rewrite target missing for ${pluginName}: ${entry.file}`);
    }
    const content = fs.readFileSync(targetPath, "utf8");
    const normalizedContent = content.replace(/\r\n/g, "\n");
    const normalizedFind = entry.find.replace(/\r\n/g, "\n");
    if (!normalizedContent.includes(normalizedFind)) {
      throw new Error(
        `Rewrite did not match in ${pluginName}/${entry.file}: ${JSON.stringify(entry.find)}`,
      );
    }
    const updated = normalizedContent.replaceAll(normalizedFind, entry.replace);
    const finalContent = /\r\n/.test(content) ? updated.replace(/\n/g, "\r\n") : updated;
    fs.writeFileSync(targetPath, finalContent);
  }
}

function buildNoticeText(pluginName, source) {
  const lines = [
    `# Third-Party Attribution (${pluginName})`,
    "",
    "This plugin is an Antigravity community port of MIT-licensed Microsoft agent skills/plugins.",
    "Not affiliated with or endorsed by Microsoft or Google.",
    "",
  ];
  if (source.repo) {
    lines.push(`- Upstream repository: ${source.repo}`);
    if (source.ref) lines.push(`- Upstream tag/ref: ${source.ref}`);
    lines.push(`- Upstream commit: ${source.sha}`);
    lines.push(`- Upstream path: ${source.path}`);
  } else {
    lines.push(`- Upstream source: microsoft/win-dev-skills (${source.local})`);
  }
  if (source.upstreamVersion) {
    lines.push(`- Upstream plugin version: ${source.upstreamVersion}`);
  }
  lines.push("", "See `LICENSE` in this directory for the MIT license terms.");
  return `${lines.join("\n")}\n`;
}

function writeManifestAndMeta(pluginName, source, overrideDir, repoRoot, pluginOutDir) {
  const manifestPath = path.join(overrideDir, "plugin.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing override plugin.json for ${pluginName}`);
  }
  const rawManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const cleanManifest = { $schema: ANTIGRAVITY_SCHEMA_URL };
  for (const [key, val] of Object.entries(rawManifest)) {
    if (ALLOWED_MANIFEST_KEYS.has(key) && key !== "$schema") {
      cleanManifest[key] = val;
    }
  }
  fs.writeFileSync(
    path.join(pluginOutDir, "plugin.json"),
    `${JSON.stringify(cleanManifest, null, 2)}\n`,
  );

  const readmeSrc = path.join(overrideDir, "README.md");
  if (!fs.existsSync(readmeSrc)) {
    throw new Error(`Missing override README.md for ${pluginName}`);
  }
  fs.copyFileSync(readmeSrc, path.join(pluginOutDir, "README.md"));

  const assetsSrc = path.join(overrideDir, "assets");
  if (fs.existsSync(assetsSrc)) {
    copyDirFiltered(assetsSrc, path.join(pluginOutDir, "assets"));
  }

  const licenseSrc = path.join(repoRoot, "LICENSE");
  if (!fs.existsSync(licenseSrc)) {
    throw new Error(`Missing repository LICENSE at ${licenseSrc}`);
  }
  fs.copyFileSync(licenseSrc, path.join(pluginOutDir, "LICENSE"));
  fs.writeFileSync(path.join(pluginOutDir, "NOTICE.md"), buildNoticeText(pluginName, source));
}

function writeGeneratedHeader(targetRoot) {
  const banner = [
    "# Generated Antigravity Plugins",
    "",
    "Do not edit files in this directory directly.",
    "Update `antigravity/sources.json`, `antigravity/overrides/`, or `antigravity/rewrites.json`,",
    "then re-run `node scripts/antigravity/build.mjs`.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(targetRoot, "GENERATED.md"), banner);
}

/**
 * Generate Antigravity plugins from pinned upstream sources, overrides, and rewrites.
 * When `check` is true, builds into a temporary directory and fails if `outputRoot` differs.
 */
export async function buildAll({
  repoRoot,
  sourcesPath = path.join(repoRoot, "antigravity", "sources.json"),
  rewritesPath = path.join(repoRoot, "antigravity", "rewrites.json"),
  overridesRoot = path.join(repoRoot, "antigravity", "overrides"),
  outputRoot = path.join(repoRoot, "antigravity", "plugins"),
  check = false,
  cacheDir = process.env.WIN_DEV_SKILLS_CACHE_DIR ||
    path.join(os.tmpdir(), "win-dev-skills-antigravity-cache"),
}) {
  const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf8"));
  const rewritesConfig = JSON.parse(fs.readFileSync(rewritesPath, "utf8"));
  const rewrites = rewritesConfig.rewrites || [];
  const allowlist = rewritesConfig.allowlist || [];

  const workTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ag-build-work-"));
  const stagingRoot = path.join(workTmpDir, "plugins");
  fs.mkdirSync(stagingRoot, { recursive: true });

  try {
    const pluginNames = Object.keys(sources);
    for (const pluginName of pluginNames) {
      const source = sources[pluginName];
      const overrideDir = path.join(overridesRoot, pluginName);
      const pluginOutDir = path.join(stagingRoot, pluginName);
      fs.mkdirSync(pluginOutDir, { recursive: true });

      const { sourceDir } = resolveSourceTree(source, repoRoot, cacheDir, workTmpDir);
      transformSkills(path.join(sourceDir, "skills"), path.join(pluginOutDir, "skills"));
      transformAgents(
        path.join(sourceDir, source.agents || "com.github.copilot/agents"),
        path.join(overrideDir, "agents"),
        path.join(pluginOutDir, "agents"),
      );
      writeManifestAndMeta(pluginName, source, overrideDir, repoRoot, pluginOutDir);
      applyRewrites(pluginName, pluginOutDir, rewrites);

      const hits = findHostReferences(pluginOutDir, allowlist, pluginName);
      if (hits.length > 0) {
        const formatted = hits
          .map((h) => `${pluginName}/${h.file}:${h.line} [${h.match}] ${h.text}`)
          .join("\n");
        throw new Error(`Host-specific reference detected after transforms:\n${formatted}`);
      }
    }

    writeGeneratedHeader(stagingRoot);

    if (check) {
      const diffs = diffDirectories(stagingRoot, outputRoot);
      if (diffs.length > 0) {
        throw new Error(
          `Generated plugins at ${outputRoot} are out of sync with sources/overrides:\n${diffs.join("\n")}`,
        );
      }
      return { plugins: pluginNames };
    }

    fs.rmSync(outputRoot, { recursive: true, force: true });
    copyDirFiltered(stagingRoot, outputRoot);
    return { plugins: pluginNames };
  } finally {
    fs.rmSync(workTmpDir, { recursive: true, force: true });
  }
}

function parseCliArgs(argv) {
  const opts = { check: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") {
      opts.check = true;
    } else if (arg === "--sources" && argv[i + 1]) {
      opts.sourcesPath = path.resolve(argv[++i]);
    } else if (arg === "--cache-dir" && argv[i + 1]) {
      opts.cacheDir = path.resolve(argv[++i]);
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }
  return opts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const cliOpts = parseCliArgs(process.argv.slice(2));
  const { plugins } = await buildAll({ repoRoot, ...cliOpts });
  console.log(
    `${cliOpts.check ? "Verified" : "Built"} Antigravity plugins: ${plugins.join(", ")}`,
  );
}
