# Antigravity Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and validate a repeatable Node.js port pipeline, Antigravity-native plugin bundles (`winui`, `winappcli`, `windbg`), PowerShell 5.1 one-line installer, and CI/release workflows for `momochisoundpost/win-dev-skills-antigravity`.

**Architecture:** Upstream Microsoft content stays separated from Antigravity customizations (`antigravity/sources.json`, `antigravity/overrides/`, `antigravity/rewrites.json`). A zero-dependency Node.js generator (`scripts/antigravity/build.mjs`) fetches pinned upstream commits, transforms `SKILL.md` and Copilot `*.agent.md` files into Antigravity format, applies exact rewrites + host-reference checks, and emits committed plugin directories under `antigravity/plugins/`. A standalone validator (`scripts/antigravity/validate.mjs`), Windows PowerShell 5.1 installer (`install.ps1`), and GitHub Actions CI/release workflows verify and package those plugins for direct install and Antigravity Marketplace submission.

**Tech Stack:** Node.js `>=22` (ESM, built-in `node:*` modules only), Git CLI, Windows PowerShell 5.1 (`install.ps1`), SVG artwork (`128x128`), GitHub Actions + `python3` stdlib `zipfile` (for deterministic release zips on Linux/macOS build hosts).

**Spec:** [docs/superpowers/specs/2026-11-17-antigravity-port-design.md](file:///Users/karyl/CaitDev/win-dev-skills-antigravity/docs/superpowers/specs/2026-11-17-antigravity-port-design.md)

## Global Constraints

- **Node.js `>=22` with zero runtime npm dependencies** in `scripts/antigravity/` (only Node built-ins and `git`).
- **PowerShell 5.1 compatibility** for `install.ps1`: no PowerShell 7 syntax (`??`, `?:`, `&&`, `||`, `-AsHashtable`), no `git`/`node`/`agy` required on the user's machine.
- **Official `plugin.json` schema (`https://antigravity.google/schemas/v1/plugin.json`)**: `additionalProperties: false`; allowed keys: `$schema`, `name`, `displayName`, `description`, `version`, `disabled`, `logo`, `suggestedPrompts` (`maxItems: 3`, non-whitespace), `skills`, `author` (`string` or `{ name, email?, url? }` with `https://`), `homepage`, `repository`, `license`, `keywords`, `extensions`.
- **Marketplace required fields** on every plugin: `name` (`^[a-z0-9]+(-[a-z0-9]+)*$`), `displayName` (must not lead with `"Antigravity"`, `"Gemini"`, `"Claude"`, or `"Cursor"`, omit `"Plugin"`/`"MCP"` suffixes), `description` (concise 1–2 sentences, 120–160 chars recommended), `version` (starts at `1.0.0`), `logo` (square `>=128x128` inside plugin, ~10% transparent padding, light/dark legible), `suggestedPrompts` (3 items), `author` (`{ "name": "momochisoundpost", "url": "https://github.com/momochisoundpost" }`), `homepage`, `repository`, `license` (`"MIT"`), plus `README.md` at plugin root.
- **Skill frontmatter**: `name` (lowercase `kebab-case`, 1–64 chars, must equal parent folder name) and `description` (1–1024 chars); drop `user-invocable`.
- **Agent frontmatter**: `winui-dev`, `winapp`, `diagnostician` use `mainAgent: true`, `subagent: true`, `model: inherit`, `commandExecutionPolicy: sandbox`; `contrarian` uses `mainAgent: false`, `subagent: true`, `model: inherit`, `tools: []`.
- **Branding and attribution**: original artwork only for `assets/logo.svg` (never reuse Microsoft's upstream logos); community-clear `displayName`s; explicit `"Not affiliated with or endorsed by Microsoft or Google"` notice in root `README.md` and every plugin `README.md`; preserve MIT `LICENSE` and `NOTICE.md` in each plugin.
- **Upstream merge cleanliness**: do not alter `plugins/windbg/`, root `CHANGELOG.md`, or delete upstream `.github/workflows/*` files; gate upstream CI workflows with `if: github.repository == 'microsoft/win-dev-skills'`.

## Review Focus

1. **Multi-line YAML frontmatter & Windows CRLF (`\r\n`)**: upstream or future `SKILL.md` / `.agent.md` files may use CRLF endings, folded `>-` / literal `|` blocks, colons inside quoted strings, or `tools: []` — tested in Task 1 (`scripts/tests/test-antigravity-frontmatter.mjs`).
2. **Stale rewrites or newly introduced host-specific references on upstream sync**: a moved/reworded upstream phrase or a new Copilot/Claude/Codex reference must fail `build.mjs` immediately instead of silently skipping or shipping broken instructions — tested in Task 2 (`scripts/tests/test-antigravity-build.mjs`).
3. **Hand-edits inside committed `antigravity/plugins/` or invalid Marketplace/schema fields**: accidental edits to generated files, extra `plugin.json` keys, >3 `suggestedPrompts`, or missing/non-square logos must fail `--check` or `validate.mjs` — tested in Tasks 2 & 3 (`test-antigravity-build.mjs`, `test-antigravity-validate.mjs`).
4. **PowerShell 5.1 TLS, fallback, and dual zip-layout handling in `install.ps1`**: older PS 5.1 TLS defaults, fallback when no GitHub release exists yet, extracting either a release zip (`winui/...`) or GitHub `main.zip` (`win-dev-skills-antigravity-main/antigravity/plugins/winui/...`), and preserving `config.json` and sibling plugins — tested in Task 5 (`scripts/tests/test-antigravity-install.mjs`).
5. **Cross-platform release zip paths and `0755` permissions on `scripts/`**: release packaging must use `/` entry paths rooted at `<plugin>/...` and keep executable bits on `scripts/*` — tested in Task 6 (`scripts/tests/test-antigravity-release-zip.mjs`).

---

## File Map

- `scripts/antigravity/frontmatter.mjs` — Markdown YAML frontmatter parser & serializer.
- `scripts/antigravity/lib.mjs` — Shared constants, filesystem helpers, git pinned-SHA extractor, `NOTICE.md` builder, host-reference scanner.
- `scripts/antigravity/build.mjs` — Generator CLI (`--check`, `--source-override`, `--cache-dir`).
- `scripts/antigravity/validate.mjs` — Zero-dep Antigravity plugin/Marketplace/schema validator CLI (`--root`, `--json`).
- `scripts/antigravity/package-release.mjs` — Deterministic release archive helper (builds `win-dev-skills-antigravity.zip` with `/` paths and `0755` on `scripts/`).
- `antigravity/sources.json` — Upstream source pins (`winappCli` tag `v0.8.0` SHA `696222f72e80c669671845bd6c7b0286eefab987` for `winui`/`winappcli`; local `plugins/windbg` for `windbg`).
- `antigravity/rewrites.json` — Anchored exact text rewrites + explicit scan `allowlist`.
- `antigravity/overrides/{winui,winappcli,windbg}/{plugin.json,README.md,assets/logo.svg,agents/*.yaml}` — Hand-authored Antigravity metadata, original SVG icons, and agent headers.
- `antigravity/plugins/{GENERATED.md,winui/**,winappcli/**,windbg/**}` — Generated & committed plugins.
- `install.ps1` — PowerShell 5.1 one-line installer.
- `README.md`, `CHANGELOG-antigravity.md`, `RELEASING-antigravity.md` — End-user docs, release history, and release/Marketplace runbook.
- `.github/workflows/{antigravity-ci.yml,antigravity-release.yml}` (new) and `.github/workflows/{pr-validation.yml,release-post-merge.yml}` (gated for fork).
- `scripts/tests/test-antigravity-{frontmatter,build,validate,install,release-zip}.mjs` + `scripts/tests/fixtures/antigravity-source/` — Automated test suite.

---

### Task 1: Frontmatter Parser & Shared Generator Helpers

**Files:**
- Create: `scripts/antigravity/frontmatter.mjs`
- Create: `scripts/antigravity/lib.mjs`
- Test: `scripts/tests/test-antigravity-frontmatter.mjs`

**Interfaces:**
- Produces in `scripts/antigravity/frontmatter.mjs`:
  - `parseFrontmatter(markdown: string) -> { data: Record<string, string | boolean | string[]>, rawYaml: string, body: string, lineEnding: "\n" | "\r\n" }`
  - `serializeFrontmatter(dataOrYaml: Record<string, string | boolean | string[]> | string, body: string, lineEnding?: "\n" | "\r\n") -> string`
- Produces in `scripts/antigravity/lib.mjs`:
  - `ANTIGRAVITY_SCHEMA_URL`: `"https://antigravity.google/schemas/v1/plugin.json"`
  - `HOST_REF_PATTERN`: `/copilot|claude|codex|openclaw|agent_type|user-invocable|`task`/gi`
  - `copyDirFiltered(srcDir: string, dstDir: string, filterFn?: (relPath: string, dirent: fs.Dirent) => boolean) -> void`
  - `listFilesRelative(rootDir: string) -> string[]` (POSIX `/` sorted relative paths)
  - `findHostReferences(rootDir: string, allowlist?: Array<{ plugin?: string, file: string, pattern: string }>, pluginName?: string) -> Array<{ file: string, line: number, match: string, text: string }>`
  - `diffDirectories(dirA: string, dirB: string) -> string[]` (human-readable list of added/removed/changed relative paths or permissions)

- [ ] **Step 1: Write the failing test**

Create `scripts/tests/test-antigravity-frontmatter.mjs` using `node:assert/strict`:
- `test_parses_folded_and_quoted_scalars`: parses `---\nname: winui-dev\ndescription: >-\n  First line: with colon.\n  Second line.\nuser-invocable: true\n---` and asserts `data.name === "winui-dev"`, `data.description === "First line: with colon. Second line."`, `data["user-invocable"] === true`.
- `test_parses_crlf_and_inline_and_block_arrays`: parses CRLF input (`\r\n`) with `tools: []` and multi-line `skills:\n  - a\n  - b`, asserting `lineEnding === "\r\n"`, `Array.isArray(data.tools) && data.tools.length === 0`, `deepEqual(data.skills, ["a", "b"])`.
- `test_rejects_missing_frontmatter`: asserts `parseFrontmatter("# No header\n")` throws `/Missing YAML frontmatter/`.
- `test_roundtrip_serialize_object_and_raw_yaml`: serializes `{ name: "win-test", description: "Has: colon" }` and raw YAML string `"name: contrarian\ntools: []"`, re-parses, and verifies fields + body + line endings match.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/tests/test-antigravity-frontmatter.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/antigravity/frontmatter.mjs`.

- [ ] **Step 3: Implement `scripts/antigravity/frontmatter.mjs` and `scripts/antigravity/lib.mjs`**

In `scripts/antigravity/frontmatter.mjs`:
- Match `/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/`, detect `lineEnding` (`/\r\n/.test(markdown) ? "\r\n" : "\n"`), normalize lines for parsing, support boolean literals (`true`/`false`), quoted scalars (single/double, unescaping `\"`/`\\`), folded (`>` / `>-`) and literal (`|` / `|-`) multi-line blocks, inline arrays (`[]`, `[a, b]`), and YAML `- item` lists.
- `serializeFrontmatter` accepts either a pre-formatted YAML string (`rawYaml` from `overrides/<plugin>/agents/*.yaml`) or an object (single-line JSON-quoted strings when containing `:`, `#`, leading/trailing spaces, or newlines; `true`/`false`; inline `[]` or indented `- item` lists).

In `scripts/antigravity/lib.mjs`:
- Implement `copyDirFiltered` preserving file mode bits (`fs.chmodSync` using `srcStat.mode & 0o777` so `scripts/*.ps1` keep executable bits), `listFilesRelative` (normalizing `path.sep` to `/`), `findHostReferences` (scanning `.md`/`.json`/`.yaml`/`.yml` files excluding `LICENSE` and `NOTICE.md` against `HOST_REF_PATTERN`, filtering exact allowlisted `{ plugin, file, pattern }` lines), and `diffDirectories` (comparing file list, SHA-256/byte content, and executable bit `0o100`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/tests/test-antigravity-frontmatter.mjs`
Expected: PASS (exit code 0, all 4 test cases reported passing).

- [ ] **Step 5: Commit**

```bash
git add scripts/antigravity/frontmatter.mjs scripts/antigravity/lib.mjs scripts/tests/test-antigravity-frontmatter.mjs
git commit -m "feat(antigravity): add zero-dep frontmatter parser and generator helpers"
```

---

### Task 2: Generator Script (`scripts/antigravity/build.mjs`)

**Files:**
- Create: `scripts/antigravity/build.mjs`
- Create: `scripts/tests/fixtures/antigravity-source/` (minimal local fixture mimicking `winui` + `windbg`: skills with `user-invocable`, `.ps1` script with `0755`, agent with `*.agent.md`, overrides, `rewrites.json`)
- Test: `scripts/tests/test-antigravity-build.mjs`

**Interfaces:**
- Consumes: `frontmatter.mjs`, `lib.mjs`.
- Produces in `scripts/antigravity/build.mjs`:
  - Exports `buildAll({ repoRoot, sourcesPath?, rewritesPath?, overridesRoot?, outputRoot?, check?, cacheDir? }) -> Promise<{ plugins: string[] }>`
  - CLI entrypoint: `node scripts/antigravity/build.mjs [--check] [--sources <path>] [--cache-dir <dir>]`
  - Upstream git extraction strategy: if `source.local` is set, read `path.resolve(repoRoot, source.local)`; if `source.repo` + `source.sha` is set, derive repo directory `<cacheDir>/<repoName>` (e.g., `winappCli` for `https://github.com/microsoft/winappCli.git`, defaulting `cacheDir` to `process.env.WIN_DEV_SKILLS_CACHE_DIR || path.join(os.tmpdir(), "win-dev-skills-antigravity-cache")`), shallow-clone if absent, verify `git cat-file -e <sha>^{commit}` (fetching that SHA if absent), and `git archive <sha> <source.path>` piped to `tar -x` into a temp directory.
  - Emits `antigravity/plugins/GENERATED.md` and `antigravity/plugins/<plugin>/`:
    - `plugin.json` (merged from `overrides/<plugin>/plugin.json`, setting `$schema` to `ANTIGRAVITY_SCHEMA_URL`, stripping unknown/upstream-only keys if present)
    - `README.md`, `assets/**`, `LICENSE` (from repo root `LICENSE`), `NOTICE.md` (naming upstream repo/path, pinned SHA or local commit, and MIT license attribution)
    - `skills/<skill>/SKILL.md` + `references/**` + `scripts/**` (preserve `0755` on `scripts/*`, drop `user-invocable`, enforce `name === folder`, enforce `description` 1–1024 chars)
    - `agents/<name>.md` (exact 1:1 pairing between `<source>/<agentsDir>/*.agent.md` and `overrides/<plugin>/agents/<name>.yaml`; fail if either side is missing; strip `.agent` suffix from filename; replace frontmatter with override YAML verbatim + upstream markdown body)
  - Applies `rewrites.json` `{ rewrites: [{ plugin, file, find, replace }], allowlist: [...] }`: every rewrite entry must match `find` at least once in `antigravity/plugins/<plugin>/<file>` (exact string match, failing loudly if missing); then runs `findHostReferences` across all generated plugin files (failing on any un-allowlisted hit).
  - `--check`: builds into a temp dir, compares against committed `outputRoot` using `diffDirectories`, exits non-zero listing exact differing files if out of sync.

- [ ] **Step 1: Create test fixture and write failing build tests**

Create `scripts/tests/fixtures/antigravity-source/` with a minimal `sample` plugin (`skills/sample-skill/SKILL.md` containing `user-invocable: false` and `scripts/check.ps1` chmod `0755`, `com.github.copilot/agents/helper.agent.md` containing `` `task` `` and `agent_type`, `overrides/sample/{plugin.json,README.md,assets/logo.svg,agents/helper.yaml}`, `rewrites.json`, and `sources.json` pointing to `local`).

Create `scripts/tests/test-antigravity-build.mjs` testing:
1. `test_builds_clean_plugin_and_drops_user_invocable_and_preserves_script_mode`: runs `buildAll`, asserts `user-invocable` absent from output `SKILL.md`, `agents/helper.md` has override YAML + rewritten body, `LICENSE` + `NOTICE.md` + `GENERATED.md` exist, and `scripts/check.ps1` retains `(stat.mode & 0o111) !== 0`.
2. `test_check_mode_fails_on_hand_edit`: builds, edits a byte in generated `SKILL.md`, runs `buildAll({ ..., check: true })` and asserts rejection matching `/out of sync/`.
3. `test_fails_on_stale_rewrite_find_string`: mutates `rewrites.json` `find` to nonexistent text and asserts rejection matching `/Rewrite did not match/`.
4. `test_fails_on_unrewritten_host_reference`: removes the rewrite entry leaving `` `task` `` in output and asserts rejection matching `/Host-specific reference/`.
5. `test_fails_on_agent_override_mismatch_or_skill_folder_mismatch`: (a) adds an extra `overrides/sample/agents/ghost.yaml` -> fails `/Agent mismatch/`; (b) sets `SKILL.md` `name: wrong-name` -> fails `/does not match folder/`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/tests/test-antigravity-build.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/antigravity/build.mjs`.

- [ ] **Step 3: Implement `scripts/antigravity/build.mjs`**

Implement the 9-step generator cleanly split into small helpers (`resolveSourceTree`, `transformSkills`, `transformAgents`, `applyRewrites`, `writeManifestAndMeta`, `main` with CLI arg parsing `--check`, `--sources`, `--cache-dir`). Clean temp directories in `finally` blocks.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/tests/test-antigravity-build.mjs`
Expected: PASS (exit code 0, all 5 tests passing).

- [ ] **Step 5: Commit**

```bash
git add scripts/antigravity/build.mjs scripts/tests/test-antigravity-build.mjs scripts/tests/fixtures/antigravity-source
git commit -m "feat(antigravity): add plugin generator script and build tests"
```

---

### Task 3: Antigravity Plugin Validator (`scripts/antigravity/validate.mjs`)

**Files:**
- Create: `scripts/antigravity/validate.mjs`
- Test: `scripts/tests/test-antigravity-validate.mjs`

**Interfaces:**
- Consumes: `frontmatter.mjs`, `lib.mjs`.
- Produces in `scripts/antigravity/validate.mjs`:
  - Exports `validatePlugins(pluginsRoot: string, options?: { allowlist?: AllowlistEntry[] }) -> { valid: boolean, results: Array<{ plugin: string, errors: string[], warnings: string[] }> }`
  - CLI entrypoint: `node scripts/antigravity/validate.mjs [--root <dir>] [--json] [--strict]` (defaults `--root` to `antigravity/plugins`, exits non-zero on any error, or on warnings if `--strict`).
- Validation checks per plugin directory (excluding `GENERATED.md`):
  1. `plugin.json` exists, parses as JSON, contains only allowed top-level schema keys (`$schema`, `name`, `displayName`, `description`, `version`, `disabled`, `logo`, `suggestedPrompts`, `skills`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`), and includes all Marketplace-required fields (`name`, `displayName`, `description`, `version`, `logo`, `suggestedPrompts`, `author`).
  2. `name` matches `/^[a-z0-9]+(-[a-z0-9]+)*$/` and matches directory name; `displayName` is non-empty, does not start with `/^(Antigravity|Gemini|Claude|Cursor)\b/i`, and does not end with `/\b(Plugin|MCP)$/i`; `description` is 1–240 chars (warn if outside 80–200); `suggestedPrompts` is array of 1–3 non-whitespace strings (Marketplace target: warn if `< 3`, error if `> 3` or empty string); `author.url`, `homepage`, `repository` start with `https://`.
  3. `logo` points to an existing relative file ending in `.svg|.png|.jpg|.jpeg|.webp` inside the plugin root; if `.svg`, inspect `viewBox` (`0 0 W H`) or `width`/`height` attributes to enforce square (`W === H`) and `>= 128`; if `.png`, read IHDR bytes (offsets 16..23) to enforce `width === height && width >= 128`.
  4. `README.md`, `LICENSE`, `NOTICE.md` exist at plugin root, and `README.md` contains `"not affiliated"` (case-insensitive).
  5. `skills/*/SKILL.md`: every skill folder has `SKILL.md` with `name === folder`, `name` matches `/^[a-z0-9-]{1,64}$/`, `description` 1–1024 chars, no `user-invocable` key; any files under `skills/*/scripts/` exist and on POSIX check executable bit if `.sh`.
  6. `agents/*.md`: every agent file has `name` (`kebab-case`), non-empty `description`, boolean `mainAgent` & `subagent`, `model` in `["inherit", "flash_lite", "flash", "pro"]`, and valid `commandExecutionPolicy` (if set, in `["off", "auto", "eager", "sandbox"]`); `tools` if present is array of strings.
  7. Host-reference scan (`findHostReferences`) returns zero hits (respecting `antigravity/rewrites.json` allowlist if present).

- [ ] **Step 1: Write the failing validation tests**

Create `scripts/tests/test-antigravity-validate.mjs` testing a temp copy of a valid built plugin plus mutations:
1. `test_valid_plugin_passes`: passes with 0 errors and 0 warnings.
2. `test_rejects_unknown_manifest_key`: adds `"extraKey": 1` to `plugin.json` -> errors mention `extraKey`.
3. `test_rejects_four_suggested_prompts`: sets 4 items -> errors mention `suggestedPrompts`.
4. `test_rejects_missing_or_nonsquare_svg_logo`: sets `viewBox="0 0 128 64"` -> errors mention `square`; also tests `viewBox="0 0 64 64"` -> errors mention `128`.
5. `test_rejects_disallowed_display_name_and_missing_affiliation`: sets `"displayName": "Antigravity WinUI Plugin"` and removes `"not affiliated"` from `README.md` -> errors catch both.
6. `test_rejects_bad_agent_or_skill_frontmatter_and_host_ref`: adds `user-invocable: false` back into `SKILL.md` and puts `copilot` in `agents/*.md` -> errors catch both.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/tests/test-antigravity-validate.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/antigravity/validate.mjs`.

- [ ] **Step 3: Implement `scripts/antigravity/validate.mjs`**

Implement each check cleanly with helper functions (`validateManifest`, `validateLogo`, `validateSkills`, `validateAgents`, `validateDocs`), reading optional `allowlist` from `path.resolve(pluginsRoot, "..", "rewrites.json")` when present.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/tests/test-antigravity-validate.mjs`
Expected: PASS (exit code 0, all 6 tests passing).

- [ ] **Step 5: Commit**

```bash
git add scripts/antigravity/validate.mjs scripts/tests/test-antigravity-validate.mjs
git commit -m "feat(antigravity): add strict schema and Marketplace validator"
```

---

### Task 4: Author Overrides, Original SVG Logos, Sources/Rewrites & Generate All 3 Plugins

**Files:**
- Create: `antigravity/sources.json`
- Create: `antigravity/rewrites.json`
- Create: `antigravity/overrides/winui/{plugin.json,README.md,assets/logo.svg,agents/winui-dev.yaml}`
- Create: `antigravity/overrides/winappcli/{plugin.json,README.md,assets/logo.svg,agents/winapp.yaml}`
- Create: `antigravity/overrides/windbg/{plugin.json,README.md,assets/logo.svg,agents/diagnostician.yaml,agents/contrarian.yaml}`
- Generated & Committed: `antigravity/plugins/GENERATED.md`, `antigravity/plugins/{winui,winappcli,windbg}/**`

**Details from verified upstream (`winappCli` tag `v0.8.0` SHA `696222f72e80c669671845bd6c7b0286eefab987` & local `plugins/windbg`):**
- `antigravity/sources.json`:
  - `winui`: `{ "repo": "https://github.com/microsoft/winappCli.git", "ref": "v0.8.0", "sha": "696222f72e80c669671845bd6c7b0286eefab987", "path": "plugins/winui/agent-plugin", "agents": "com.github.copilot/agents", "upstreamVersion": "0.8.0" }`
  - `winappcli`: `{ "repo": "https://github.com/microsoft/winappCli.git", "ref": "v0.8.0", "sha": "696222f72e80c669671845bd6c7b0286eefab987", "path": "plugins/winapp", "agents": "com.github.copilot/agents", "upstreamVersion": "0.8.0" }`
  - `windbg`: `{ "local": "plugins/windbg", "agents": "com.github.copilot/agents", "upstreamVersion": "1.0.0" }`
- `antigravity/rewrites.json` exact replacements:
  1. `winui` / `agents/winui-dev.md`: replace `"You are \`winui-dev\` — don't call \`task\` with \`agent_type: \"winui:winui-dev\"\` (self-hop). \`task\` is fine for scoped helpers (\`explore\` for parallel codebase mapping, \`general-purpose\` for rubber-duck critique), not for the build itself."` → `"You are \`winui-dev\` — do not spawn another \`winui-dev\` subagent to do the build for you. Using \`invoke_subagent\` for scoped helpers (\`research\` for parallel codebase mapping, \`self\` for a critique pass) is fine, not for the build itself."`
  2. `winui` / `skills/winui-setup/SKILL.md`: replace `"If the current harness exposes the \`winui-dev\` orchestrator agent,\nstart a fresh session with that agent and ask it to build a WinUI app. Otherwise,\nstart a fresh session in the current harness and ask it to perform the WinUI task;\nit will load the relevant \`winui-*\` skills on demand.\n\nFor GitHub Copilot CLI, for example:\n\n    copilot --agent winui:winui-dev -p \"build me a WinUI 3 markdown editor\""` → `"Start a fresh session in Antigravity with the **winui-dev** agent selected (in the App agent picker, \`/agents\`, or \`agy --agent winui-dev\`), or stay on the default agent and ask for a WinUI task so it loads the relevant \`winui-*\` skills on demand.\n\nFor example, in Antigravity CLI:\n\n    agy --agent winui-dev"`
  3. `windbg` / `skills/windbg-diagnostic-method/SKILL.md`: replace `"1. When the host supports the bundled Copilot agents, invoke the \`contrarian\`\n   agent once with the complete proposed diagnosis."` → `"1. When subagents are available, invoke the bundled \`contrarian\` subagent once\n   with \`invoke_subagent\` (\`TypeName: \"contrarian\"\`) and pass the complete proposed diagnosis."`
  4. `windbg` / `agents/diagnostician.md`: replace `"1. Invoke the bundled \`contrarian\` agent by name as an independent sub-agent\n   when the host supports sub-agents. Give it the complete proposed diagnosis."` → `"1. Invoke the bundled \`contrarian\` subagent using \`invoke_subagent\`\n   (\`TypeName: \"contrarian\"\`) when subagents are available. Give it the complete proposed diagnosis."`
- Manifest metadata (all `version: "1.0.0"`, `license: "MIT"`, `author: { "name": "momochisoundpost", "url": "https://github.com/momochisoundpost" }`, `homepage` & `repository`: `"https://github.com/momochisoundpost/win-dev-skills-antigravity"`):
  - `winui`: `displayName: "WinUI 3 Dev (Community)"`, 3 `suggestedPrompts`, concise description.
  - `winappcli`: `displayName: "WinApp CLI (Community)"`, 3 `suggestedPrompts`, concise description.
  - `windbg`: `displayName: "WinDbg Diagnostics (Community)"`, 3 `suggestedPrompts`, concise description.
- Original SVG logos (`128x128` `viewBox="0 0 128 128"`, `~12px` margin = ~10% padding, cohesive geometric design with light-and-dark legible high-contrast strokes/accents—NO Microsoft 4-pane logo):
  - `winui`: stylized stacked app window + XAML angle brackets `< />` in teal/slate-blue with light inner highlight + dark outline.
  - `winappcli`: stylized package/crate + terminal prompt `>_` in indigo/amber with crisp dual-theme outline.
  - `windbg`: stylized hex inspect/bug reticle + stack trace bars in emerald/coral with dual-theme outline.
- Agent YAML headers:
  - `winui-dev.yaml`: `name: winui-dev`, `description`, `mainAgent: true`, `subagent: true`, `model: inherit`, `commandExecutionPolicy: sandbox`
  - `winapp.yaml`: `name: winapp`, `description`, `mainAgent: true`, `subagent: true`, `model: inherit`, `commandExecutionPolicy: sandbox`
  - `diagnostician.yaml`: `name: diagnostician`, `description`, `mainAgent: true`, `subagent: true`, `model: inherit`, `commandExecutionPolicy: sandbox`
  - `contrarian.yaml`: `name: contrarian`, `description`, `mainAgent: false`, `subagent: true`, `model: inherit`, `tools: []`
- Plugin `README.md`s: document Antigravity usage, prerequisites (Windows 10/11, CLI tools driven by skills, `sandbox` policy note if a user sees blocked `winapp`/`dotnet`/`winget` prompts), and explicit `"Community port of Microsoft's ... plugin (MIT). Not affiliated with or endorsed by Microsoft or Google."` notice.

- [ ] **Step 1: Write `antigravity/sources.json`, `antigravity/rewrites.json`, and all three `antigravity/overrides/<plugin>/` bundles**

Create all override manifests, READMEs, SVG logos, and agent YAML frontmatter files.

- [ ] **Step 2: Run the generator against the pinned upstream (`v0.8.0` + local `plugins/windbg`)**

Run (reusing the scratch parent directory so `build.mjs` finds `winappCli` directly, or omit for a fresh clone):
`WIN_DEV_SKILLS_CACHE_DIR=/Users/karyl/.gemini/antigravity/brain/0238c9a9-9469-49c9-a5bf-7d200bab1891/scratch node scripts/antigravity/build.mjs`
Expected: Exits 0, generates `antigravity/plugins/{winui,winappcli,windbg}` (7 + 14 + 11 = 32 skills, 4 agents) and `antigravity/plugins/GENERATED.md` with zero host-reference errors.

- [ ] **Step 3: Run strict validation and `--check` verification**

Run:
`node scripts/antigravity/build.mjs --check && node scripts/antigravity/validate.mjs --strict`
Expected: Both commands exit 0 with zero errors and zero warnings across all 3 plugins.

- [ ] **Step 4: Spot-check generated outputs**

Verify `antigravity/plugins/windbg/skills/windbg-diagnostic-method/scripts/validate-diagnosis-output.ps1`, `antigravity/plugins/winui/agents/winui-dev.md`, `antigravity/plugins/windbg/agents/contrarian.md`, `antigravity/plugins/*/NOTICE.md`, and `antigravity/plugins/*/LICENSE` exist and contain expected rewritten content.

- [ ] **Step 5: Commit**

```bash
git add antigravity/
git commit -m "feat(antigravity): add overrides, logos, pins (winappCli v0.8.0) and generated plugins"
```

---

### Task 5: Windows PowerShell 5.1 One-Line Installer (`install.ps1`)

**Files:**
- Create: `install.ps1`
- Test: `scripts/tests/test-antigravity-install.mjs`

**Interfaces:**
- Consumes: GitHub Release asset `win-dev-skills-antigravity.zip` (or fallback `https://github.com/momochisoundpost/win-dev-skills-antigravity/archive/refs/heads/main.zip`) and `antigravity/plugins/{winui,winappcli,windbg}` structure.
- Produces `install.ps1` CLI/script parameters:
  - `[string[]]$Plugins = @('winui', 'winappcli', 'windbg')` (validates against `'winui', 'winappcli', 'windbg'`, supports comma-separated strings too like `-Plugins winui,windbg` for `irm | iex` ergonomics)
  - `[string]$Version = ''` (optional tag e.g. `v1.0.0`, else queries `https://api.github.com/repos/momochisoundpost/win-dev-skills-antigravity/releases/latest` and falls back to `main.zip` on 404 / no release)
  - `[switch]$Uninstall` (removes only the selected plugin directories under `$env:USERPROFILE\.gemini\config\plugins\`, never touching sibling plugins or `config.json`)
  - Sets `[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12` for PS 5.1.
  - Uses `Add-Type -AssemblyName System.IO.Compression.FileSystem` (`[System.IO.Compression.ZipFile]::ExtractToDirectory`) to avoid PS 5.1 `Expand-Archive` edge cases and inspect whether extracted root contains `<plugin>/plugin.json` directly (release zip) or `*/antigravity/plugins/<plugin>/plugin.json` (GitHub branch archive).
  - Stages replacement into a temp dir and swaps only selected plugin folders atomically inside `%USERPROFILE%\.gemini\config\plugins\`.

- [ ] **Step 1: Write the failing `install.ps1` contract & archive-resolution test**

Create `scripts/tests/test-antigravity-install.mjs` checking:
1. `test_install_ps1_uses_ps51_safe_syntax`: asserts `install.ps1` exists, declares `param(`, `$Plugins`, `$Version`, `$Uninstall`, sets `Tls12`, points to `momochisoundpost/win-dev-skills-antigravity`, targets `.gemini`, `config`, `plugins`, never references `config.json` writes, and contains **none** of PS 7–only constructs (`??`, `?:`, `-AsHashtable`, `-Parallel`, `ForEach-Object -Parallel`, `$IsWindows`).
2. `test_install_ps1_handles_both_zip_layouts_and_fallback`: verifies `install.ps1` references both `releases/latest` (and tag URL) and `refs/heads/main.zip` fallback, plus inspects both `<extractRoot>/<plugin>` and `*/antigravity/plugins/<plugin>` lookup logic, and has balanced `{}`/`()` quotes.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/tests/test-antigravity-install.mjs`
Expected: FAIL with `ENOENT` for `install.ps1`.

- [ ] **Step 3: Implement `install.ps1`**

Write clean, well-commented Windows PowerShell 5.1 script with `try { ... } finally { Cleanup temp dir }`, clear progress/summary output ("Open Antigravity → Customizations → Installed"), TLS 1.2 guard, release-then-main fallback, and dual zip-layout detection.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/tests/test-antigravity-install.mjs`
Expected: PASS (exit code 0).

- [ ] **Step 5: Commit**

```bash
git add install.ps1 scripts/tests/test-antigravity-install.mjs
git commit -m "feat(antigravity): add Windows PowerShell 5.1 one-line installer"
```

---

### Task 6: Release Zip Packager, Root Docs, and GitHub Actions CI/Release Workflows

**Files:**
- Create: `scripts/antigravity/package-release.mjs`
- Create: `scripts/tests/test-antigravity-release-zip.mjs`
- Create: `CHANGELOG-antigravity.md`
- Create: `RELEASING-antigravity.md`
- Modify: `README.md` (rewrite for Antigravity users, keeping Microsoft trademark & MIT notice prominent)
- Create: `.github/workflows/antigravity-ci.yml`
- Create: `.github/workflows/antigravity-release.yml`
- Modify: `.github/workflows/pr-validation.yml` (add `if: github.repository == 'microsoft/win-dev-skills'` to `catalog-check` and `vally-lint` jobs)
- Modify: `.github/workflows/release-post-merge.yml` (add `if: github.repository == 'microsoft/win-dev-skills'` to `auto-tag` job)

**Interfaces:**
- Consumes: `validatePlugins` from `scripts/antigravity/validate.mjs`.
- Produces in `scripts/antigravity/package-release.mjs`:
  - Exports `packageReleaseZip({ pluginsRoot, outputZipPath }) -> Promise<{ entries: string[] }>`
  - CLI entrypoint: `node scripts/antigravity/package-release.mjs [--root antigravity/plugins] [--out win-dev-skills-antigravity.zip]`
  - Validates plugins first via `validatePlugins`, then invokes `python3 -c` (`zipfile.ZipFile` setting `ZipInfo.external_attr` with `(0o755 << 16)` on files under `scripts/` and `0o644 << 16` otherwise, and strictly `/` relative paths `winui/...`, `winappcli/...`, `windbg/...`, excluding `GENERATED.md`). Note: Ubuntu GitHub runners and macOS both ship `python3` with stdlib `zipfile`, giving deterministic cross-platform POSIX permission bits in zip central directory without needing extra npm deps!

- [ ] **Step 1: Write failing release-zip packaging test**

Create `scripts/tests/test-antigravity-release-zip.mjs` testing `packageReleaseZip` against `antigravity/plugins`:
1. Output zip exists and is valid (inspected via `python3 -m zipfile -l` or Python `zipfile` mode dump).
2. Top-level folders inside zip are strictly `winui/`, `winappcli/`, `windbg/` (no `GENERATED.md`, no `antigravity/plugins/` prefix, no backslashes).
3. `windbg/skills/windbg-diagnostic-method/scripts/validate-diagnosis-output.ps1` has POSIX mode `0o755` in zip `external_attr >> 16`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/tests/test-antigravity-release-zip.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/antigravity/package-release.mjs`.

- [ ] **Step 3: Implement `scripts/antigravity/package-release.mjs`, docs, and workflows**

- Implement `package-release.mjs` (validates via `validatePlugins`, packages via `python3` stdlib `zipfile` preserving `0755` on `*/scripts/*`).
- Rewrite `README.md` with: what the 3 plugins do, one-line PowerShell install (`irm ... | iex` and parameterized `-Plugins` form), manual zip install, local `agy plugin install <path>` option, Windows prerequisites (`winapp`, `.NET SDK`, sandbox policy note, admin elevation notice), how to use agents & skills, how to update, explicit `"Not affiliated with or endorsed by Microsoft or Google"` notice, and link back to `microsoft/win-dev-skills` & `microsoft/winappCli` for Copilot/Claude/Codex users.
- Write `CHANGELOG-antigravity.md` (`1.0.0` initial release recording `winappCli` tag `v0.8.0` SHA `696222f72e80c669671845bd6c7b0286eefab987` and `windbg` upstream commit `5ce74fa`).
- Write `RELEASING-antigravity.md` documenting: upstream sync steps (`build.mjs` -> `validate.mjs` -> tests), manual `agy plugin validate --strict` check on Windows/CLI before tagging `v*`, GitHub release verification, and Antigravity Marketplace intake form checklist (`https://forms.gle/2EX5RFYPoJe1UgxR9`).
- Gate `.github/workflows/pr-validation.yml` (`catalog-check`, `vally-lint`) and `.github/workflows/release-post-merge.yml` (`auto-tag`) with `if: github.repository == 'microsoft/win-dev-skills'`.
- Add `.github/workflows/antigravity-ci.yml` (using the same pinned `actions/checkout` and `actions/setup-node` SHAs as `pr-validation.yml`, running `build.mjs --check`, `validate.mjs --strict`, and all 5 `scripts/tests/test-antigravity-*.mjs` tests) and `.github/workflows/antigravity-release.yml` (on tag `v*` with `permissions: contents: write`: runs CI checks, builds `win-dev-skills-antigravity.zip`, and publishes/uploads it using `gh release create "$GITHUB_REF_NAME" win-dev-skills-antigravity.zip --generate-notes` with `GH_TOKEN: ${{ github.token }}`).

- [ ] **Step 4: Run full test & validation suite**

Run:
```bash
node scripts/tests/test-antigravity-frontmatter.mjs && \
node scripts/tests/test-antigravity-build.mjs && \
node scripts/tests/test-antigravity-validate.mjs && \
node scripts/tests/test-antigravity-install.mjs && \
node scripts/tests/test-antigravity-release-zip.mjs && \
node scripts/antigravity/build.mjs --check && \
node scripts/antigravity/validate.mjs --strict
```
Expected: All 7 commands pass with exit code 0. Also check `git diff --check` and `git status` for clean repository state (ignoring untracked `.DS_Store` if present, never staging them).

- [ ] **Step 5: Commit**

```bash
git add scripts/antigravity/package-release.mjs scripts/tests/test-antigravity-release-zip.mjs \
  README.md CHANGELOG-antigravity.md RELEASING-antigravity.md \
  .github/workflows/antigravity-ci.yml .github/workflows/antigravity-release.yml \
  .github/workflows/pr-validation.yml .github/workflows/release-post-merge.yml
git commit -m "feat(antigravity): add release zip packager, docs, and CI/release workflows"
```
