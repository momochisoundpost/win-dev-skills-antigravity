import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseFrontmatter } from "./frontmatter.mjs";
import { findHostReferences } from "./lib.mjs";

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

const MARKETPLACE_REQUIRED_KEYS = [
  "name",
  "displayName",
  "description",
  "version",
  "logo",
  "suggestedPrompts",
  "author",
];

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ALLOWED_LOGO_EXTS = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);
const ALLOWED_MODELS = new Set(["inherit", "flash_lite", "flash", "pro"]);
const ALLOWED_POLICIES = new Set(["off", "auto", "eager", "sandbox"]);

function isHttpsUrl(value) {
  return typeof value === "string" && /^https:\/\/\S+$/i.test(value);
}

function validateManifest(pluginDir, dirName, errors, warnings) {
  const manifestPath = path.join(pluginDir, "plugin.json");
  if (!fs.existsSync(manifestPath)) {
    errors.push("Missing plugin.json");
    return null;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (err) {
    errors.push(`Invalid JSON in plugin.json: ${err.message}`);
    return null;
  }

  for (const key of Object.keys(manifest)) {
    if (!ALLOWED_MANIFEST_KEYS.has(key)) {
      errors.push(`Unknown top-level plugin.json key '${key}'`);
    }
  }
  for (const req of MARKETPLACE_REQUIRED_KEYS) {
    if (manifest[req] === undefined || manifest[req] === null || manifest[req] === "") {
      errors.push(`Missing Marketplace-required field '${req}' in plugin.json`);
    }
  }

  if (typeof manifest.name !== "string" || !KEBAB_RE.test(manifest.name)) {
    errors.push(`Invalid plugin.json name '${manifest.name}' (must be kebab-case)`);
  } else if (manifest.name !== dirName) {
    errors.push(`plugin.json name '${manifest.name}' does not match directory '${dirName}'`);
  }

  if (typeof manifest.displayName === "string") {
    if (/^(Antigravity|Gemini|Claude|Cursor)\b/i.test(manifest.displayName)) {
      errors.push(`displayName '${manifest.displayName}' must not start with Antigravity/Gemini/Claude/Cursor`);
    }
    if (/\b(Plugin|MCP)$/i.test(manifest.displayName)) {
      errors.push(`displayName '${manifest.displayName}' should not end with Plugin or MCP`);
    }
  }

  if (typeof manifest.description !== "string" || manifest.description.trim().length === 0) {
    errors.push("plugin.json description must be a non-empty string");
  } else if (manifest.description.length > 240) {
    errors.push(`plugin.json description too long (${manifest.description.length} > 240)`);
  } else if (manifest.description.length < 80 || manifest.description.length > 200) {
    warnings.push(`plugin.json description length (${manifest.description.length}) is outside 80-200 chars`);
  }

  if (!Array.isArray(manifest.suggestedPrompts)) {
    errors.push("plugin.json suggestedPrompts must be an array");
  } else {
    if (manifest.suggestedPrompts.length > 3 || manifest.suggestedPrompts.length === 0) {
      errors.push(`plugin.json suggestedPrompts must contain 1-3 items (found ${manifest.suggestedPrompts.length})`);
    } else if (manifest.suggestedPrompts.length < 3) {
      warnings.push(`plugin.json suggestedPrompts has ${manifest.suggestedPrompts.length} items (3 recommended)`);
    }
    for (const p of manifest.suggestedPrompts) {
      if (typeof p !== "string" || !/\S/.test(p)) {
        errors.push("plugin.json suggestedPrompts entries must be non-empty strings");
      }
    }
  }

  if (manifest.author && typeof manifest.author === "object") {
    if (!manifest.author.name) errors.push("plugin.json author.name is required");
    if (manifest.author.url && !isHttpsUrl(manifest.author.url)) {
      errors.push("plugin.json author.url must use https://");
    }
  }
  if (manifest.homepage && !isHttpsUrl(manifest.homepage)) {
    errors.push("plugin.json homepage must use https://");
  }
  if (manifest.repository && !isHttpsUrl(manifest.repository)) {
    errors.push("plugin.json repository must use https://");
  }

  return manifest;
}

function validateLogo(pluginDir, manifest, errors) {
  if (!manifest || typeof manifest.logo !== "string" || !manifest.logo) return;
  if (/^https?:\/\//i.test(manifest.logo) || path.isAbsolute(manifest.logo)) {
    errors.push(`logo '${manifest.logo}' must be a relative path inside the plugin`);
    return;
  }
  const ext = path.extname(manifest.logo).toLowerCase();
  if (!ALLOWED_LOGO_EXTS.has(ext)) {
    errors.push(`logo extension '${ext}' is unsupported`);
    return;
  }

  const resolved = path.resolve(pluginDir, manifest.logo);
  if (!resolved.startsWith(`${path.resolve(pluginDir)}${path.sep}`)) {
    errors.push(`logo path escapes plugin directory: ${manifest.logo}`);
    return;
  }
  if (!fs.existsSync(resolved)) {
    errors.push(`logo file not found: ${manifest.logo}`);
    return;
  }

  if (ext === ".svg") {
    const svg = fs.readFileSync(resolved, "utf8");
    const vbMatch = /viewBox\s*=\s*["']\s*([0-9.+-]+)[,\s]+([0-9.+-]+)[,\s]+([0-9.+-]+)[,\s]+([0-9.+-]+)\s*["']/i.exec(svg);
    let w;
    let h;
    if (vbMatch) {
      w = Number(vbMatch[3]);
      h = Number(vbMatch[4]);
    } else {
      const wMatch = /\bwidth\s*=\s*["']([0-9.]+)(?:px)?["']/i.exec(svg);
      const hMatch = /\bheight\s*=\s*["']([0-9.]+)(?:px)?["']/i.exec(svg);
      if (wMatch && hMatch) {
        w = Number(wMatch[1]);
        h = Number(hMatch[1]);
      }
    }
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      errors.push(`SVG logo '${manifest.logo}' missing parseable viewBox or width/height`);
    } else {
      if (w !== h) errors.push(`SVG logo '${manifest.logo}' must be square (got ${w}x${h})`);
      if (w < 128) errors.push(`SVG logo '${manifest.logo}' must be >= 128px (got ${w})`);
    }
  } else if (ext === ".png") {
    const buf = fs.readFileSync(resolved);
    if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") {
      errors.push(`PNG logo '${manifest.logo}' is invalid`);
    } else {
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      if (w !== h) errors.push(`PNG logo '${manifest.logo}' must be square (got ${w}x${h})`);
      if (w < 128) errors.push(`PNG logo '${manifest.logo}' must be >= 128px (got ${w})`);
    }
  }
}

function validateDocs(pluginDir, errors) {
  for (const requiredFile of ["README.md", "LICENSE", "NOTICE.md"]) {
    if (!fs.existsSync(path.join(pluginDir, requiredFile))) {
      errors.push(`Missing required file '${requiredFile}'`);
    }
  }
  const readmePath = path.join(pluginDir, "README.md");
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, "utf8");
    if (!/not affiliated/i.test(readme)) {
      errors.push("README.md must include an explicit 'Not affiliated' disclaimer");
    }
  }
}

function validateSkills(pluginDir, errors) {
  const skillsDir = path.join(pluginDir, "skills");
  if (!fs.existsSync(skillsDir)) return;

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const dir of entries) {
    const skillPath = path.join(skillsDir, dir.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      errors.push(`Skill '${dir.name}' missing SKILL.md`);
      continue;
    }
    let parsed;
    try {
      parsed = parseFrontmatter(fs.readFileSync(skillPath, "utf8"));
    } catch (err) {
      errors.push(`skills/${dir.name}/SKILL.md: ${err.message}`);
      continue;
    }

    const { data } = parsed;
    if ("user-invocable" in data) {
      errors.push(`skills/${dir.name}/SKILL.md retains unsupported 'user-invocable' field`);
    }
    if (typeof data.name !== "string" || !KEBAB_RE.test(data.name) || data.name.length > 64) {
      errors.push(`skills/${dir.name}/SKILL.md invalid skill name '${data.name}'`);
    } else if (data.name !== dir.name) {
      errors.push(`skills/${dir.name}/SKILL.md name '${data.name}' does not match folder '${dir.name}'`);
    }
    if (typeof data.description !== "string" || !/\S/.test(data.description)) {
      errors.push(`skills/${dir.name}/SKILL.md missing description`);
    } else if (data.description.length > 1024) {
      errors.push(`skills/${dir.name}/SKILL.md description exceeds 1024 chars`);
    }
  }
}

function validateAgents(pluginDir, errors) {
  const agentsDir = path.join(pluginDir, "agents");
  if (!fs.existsSync(agentsDir)) return;

  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const agentPath = path.join(agentsDir, file);
    let parsed;
    try {
      parsed = parseFrontmatter(fs.readFileSync(agentPath, "utf8"));
    } catch (err) {
      errors.push(`agents/${file}: ${err.message}`);
      continue;
    }

    const { data } = parsed;
    const stem = file.replace(/\.md$/, "");
    if (typeof data.name !== "string" || !KEBAB_RE.test(data.name) || data.name !== stem) {
      errors.push(`agents/${file}: frontmatter name '${data.name}' must match '${stem}'`);
    }
    if (typeof data.description !== "string" || !/\S/.test(data.description)) {
      errors.push(`agents/${file}: missing description`);
    }
    if (typeof data.mainAgent !== "boolean") {
      errors.push(`agents/${file}: mainAgent must be boolean`);
    }
    if (typeof data.subagent !== "boolean") {
      errors.push(`agents/${file}: subagent must be boolean`);
    }
    if (data.model !== undefined && !ALLOWED_MODELS.has(String(data.model))) {
      errors.push(`agents/${file}: invalid model '${data.model}'`);
    }
    if (data.commandExecutionPolicy !== undefined && !ALLOWED_POLICIES.has(String(data.commandExecutionPolicy))) {
      errors.push(`agents/${file}: invalid commandExecutionPolicy '${data.commandExecutionPolicy}'`);
    }
    if (data.tools !== undefined && !Array.isArray(data.tools)) {
      errors.push(`agents/${file}: tools must be an array`);
    }
  }
}

function loadDefaultAllowlist(pluginsRoot) {
  const rewritesPath = path.resolve(pluginsRoot, "..", "rewrites.json");
  if (!fs.existsSync(rewritesPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(rewritesPath, "utf8")).allowlist || [];
  } catch {
    return [];
  }
}

/** Validate all plugin subdirectories under `pluginsRoot`. */
export function validatePlugins(pluginsRoot, options = {}) {
  const allowlist = options.allowlist ?? loadDefaultAllowlist(pluginsRoot);
  if (!fs.existsSync(pluginsRoot)) {
    return { valid: false, results: [{ plugin: "<root>", errors: [`Missing pluginsRoot: ${pluginsRoot}`], warnings: [] }] };
  }

  const dirs = fs
    .readdirSync(pluginsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  if (dirs.length === 0) {
    return { valid: false, results: [{ plugin: "<root>", errors: [`No plugin directories found in ${pluginsRoot}`], warnings: [] }] };
  }

  const results = [];
  for (const dirName of dirs) {
    const pluginDir = path.join(pluginsRoot, dirName);
    const errors = [];
    const warnings = [];

    const manifest = validateManifest(pluginDir, dirName, errors, warnings);
    validateLogo(pluginDir, manifest, errors);
    validateDocs(pluginDir, errors);
    validateSkills(pluginDir, errors);
    validateAgents(pluginDir, errors);

    const hits = findHostReferences(pluginDir, allowlist, dirName);
    for (const h of hits) {
      errors.push(`Host-specific reference in ${h.file}:${h.line} [${h.match}]`);
    }

    results.push({ plugin: dirName, errors, warnings });
  }

  const valid = results.every((r) => r.errors.length === 0);
  return { valid, results };
}

function parseCliArgs(argv) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const opts = {
    root: path.join(repoRoot, "antigravity", "plugins"),
    json: false,
    strict: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) opts.root = path.resolve(argv[++i]);
    else if (argv[i] === "--json") opts.json = true;
    else if (argv[i] === "--strict") opts.strict = true;
    else throw new Error(`Unknown CLI argument: ${argv[i]}`);
  }
  return opts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opts = parseCliArgs(process.argv.slice(2));
  const report = validatePlugins(opts.root);
  const failed = !report.valid || (opts.strict && report.results.some((r) => r.warnings.length > 0));

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const r of report.results) {
      const status = r.errors.length === 0 && (!opts.strict || r.warnings.length === 0) ? "ok" : "FAIL";
      console.log(`${status}  ${r.plugin} (errors=${r.errors.length}, warnings=${r.warnings.length})`);
      for (const err of r.errors) console.error(`  error: ${err}`);
      for (const warn of r.warnings) console.warn(`  warn:  ${warn}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
