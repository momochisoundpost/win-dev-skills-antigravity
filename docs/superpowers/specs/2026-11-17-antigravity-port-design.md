# Antigravity port of win-dev-skills — design

Date: 2026-11-17
Repo: https://github.com/momochisoundpost/win-dev-skills-antigravity (fork of microsoft/win-dev-skills)

## Intent and why

Microsoft ships Windows development agent plugins (`winui`, `winappcli`, `windbg`) for
GitHub Copilot, Claude Code, Codex, OpenClaw, and OpenCode — but not for Google
Antigravity. Nobody has filled that gap. Many people now use Antigravity because a
Google AI plan is the cheapest way to get a strong coding agent (students, phone-plan
bundles). This project ports all three plugins to native Antigravity plugins so those
Windows developers get the same WinUI 3 / WinApp CLI / WinDbg guidance, and keeps the
port cheap to update as Microsoft ships changes.

## Goals

- Ship three native Antigravity plugins built from Microsoft's MIT-licensed sources:
  - **winui** — 7 skills + `winui-dev` agent (from `microsoft/winappCli`, `plugins/winui/agent-plugin`).
  - **winappcli** — 14 skills + `winapp` agent (from `microsoft/winappCli`, `plugins/winapp`).
  - **windbg** — 11 skills + `diagnostician` and `contrarian` agents + PowerShell
    report validator (from this repo, `plugins/windbg`).
- **Easy install on stock Antigravity**: a Windows user with only the Antigravity app
  installed (no `agy` CLI, no Git, no Node) can install with one PowerShell command.
- **Marketplace-ready**: each plugin passes `agy plugin validate` and carries every
  field the Antigravity Marketplace requires, so it can be submitted via Google's
  partner intake form.
- **Cheap upstream sync**: updating to a newer Microsoft release = bump a pinned commit,
  re-run the generator, review the diff.

## Non-goals

- No MCP server. None of the upstream plugins have one; skills drive `winapp`, `dotnet`,
  `winget`, PowerShell, and WinDbg through the agent's normal shell.
- No new skills or rewritten guidance beyond what is needed to make the content work in
  Antigravity. Content stays Microsoft's.
- No installer for macOS/Linux. The skills only make sense on Windows (Antigravity on a
  Mac can still load the plugins manually; we just don't script it).
- Not keeping the Copilot/Claude/Codex catalogs working from this fork — users of those
  tools should install from Microsoft.

## Anti-goals (failure even if it technically works)

- Anything that looks like an official Microsoft or Google product: Microsoft logos,
  "Microsoft WinUI" style names, or a missing "not affiliated" notice. Microsoft's README
  requires that modified versions "must not cause confusion or imply Microsoft
  sponsorship."
- Hand-edited generated files that get silently overwritten by the next generator run.
- An install path that requires tools a student on a fresh Windows machine won't have.
- Plugins that load but whose agents/skills still tell the model to use Copilot-only tools
  (`task` with `agent_type`, "invoke the bundled Copilot agents", `copilot --agent ...`).

## Constraints (verified facts)

- **Antigravity plugin format** (https://antigravity.google/docs/build-plugins):
  `plugin.json` at plugin root, `skills/<name>/SKILL.md`, `agents/<name>.md`,
  `rules/`, `mcp_config.json`, `hooks.json`. `plugin.json` schema has
  `additionalProperties: false`; allowed keys: `$schema, name, displayName, description,
  version, disabled, logo, suggestedPrompts (≤3), skills, author, homepage, repository,
  license, keywords, extensions`. Unknown keys are silently dropped by the loader.
- **Marketplace-required manifest fields**: `name`, `displayName`, `description`
  (120–160 chars recommended), `version`, `logo` (bundled square ≥128px, ~10% padding,
  legible on light and dark), `suggestedPrompts`, `author`; plus `README.md` at plugin
  root. `displayName` must not lead with "Antigravity", "Gemini", "Claude", or "Cursor"
  and should omit "Plugin"/"MCP" suffixes.
- **Skill frontmatter**: `name` must match the folder name; `description` 1–1024 chars.
  Optional `disable-model-invocation`, `license`, `compatibility`. Upstream's
  `user-invocable` has no Antigravity equivalent.
- **Agent frontmatter**: `name`, `description`, `mainAgent` (default true), `subagent`
  (default true), `model`, `tools` (allowlist; `send_message` always included),
  `commandExecutionPolicy`, `skills`, `inheritMcp`, `inheritCustomizations`.
- **Global install location**: plugin folders dropped into
  `%USERPROFILE%\.gemini\config\plugins\` are auto-discovered by the Antigravity app,
  CLI, and IDE; no restart needed.
- **Plugin and MCP names share one global namespace**; collisions drop one silently.
- **Scripts** placed under `scripts/` keep `0755` in Marketplace bundles.
- **Upstream sources**: `winui` and `winappcli` are pinned by commit SHA in
  `.agents/plugins/marketplace.json` (`winui` @ `5a064a42…`, `winappcli` @ `e3cd0b94…`
  tag `v0.7.1`); `microsoft/winappCli` main is currently at plugin version 0.8.1.
  `windbg` lives in this repo at `plugins/windbg` and arrives via normal upstream merges.
- **Host-specific content found upstream (complete list as of today)**:
  - `winui/agent-plugin/com.github.copilot/agents/winui-dev.agent.md`: "don't call `task`
    with `agent_type: "winui:winui-dev"` … `task` is fine for scoped helpers (`explore`,
    `general-purpose`)"; `user-invocable: true`.
  - `winui/agent-plugin/skills/winui-setup/SKILL.md` lines ~161–163: "For GitHub Copilot
    CLI, for example: `copilot --agent winui:winui-dev -p "…"`".
  - `windbg/skills/windbg-diagnostic-method/SKILL.md`: `user-invocable: false`; "When the
    host supports the bundled Copilot agents, invoke the `contrarian` agent once".
  - `windbg/com.github.copilot/agents/contrarian.agent.md`: `tools: []`,
    `user-invocable: false`.
  - `windbg/com.github.copilot/agents/diagnostician.agent.md`: "Invoke the bundled
    `contrarian` agent by name as an independent sub-agent when the host supports
    sub-agents."
  - `plugins/winui/agents/winui-dev.agent.md` is a near-duplicate of the agent-plugin copy
    (whitespace diff); use the `agent-plugin/com.github.copilot` copy.

## Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Generator script** pulls upstream at pinned SHAs, converts to Antigravity format, writes plugins; CI validates. | Must build/maintain a converter; updates are minutes and edits are repeatable rules. | **Chosen** — the port is meant to be relied on, so cheap re-sync matters more than first-day speed. |
| B. Copy once, edit by hand. | Fastest first release; every upstream update means redoing edits. winappCli changes often (new `winui-devtools` skill last month). | Rejected. |
| C. Overlay Antigravity files next to upstream files (`.antigravity-plugin/plugin.json`) + `git subtree` for winappCli. | Least churn for windbg; subtrees are messy and Copilot wording stays in content unless hand-edited. | Rejected. |

Scope considered: windbg-only vs. all three. **All three chosen** — `winui` and
`winappcli` are what most app developers and students will come for.

Distribution considered: GitHub-only vs. Marketplace. **Both chosen** — GitHub install
works from day one; plugins are Marketplace-ready for submission.

## Design

### Repo layout

Upstream files stay untouched wherever possible so `git merge upstream/main` from
`microsoft/win-dev-skills` stays clean. New work lives in new paths:

```text
antigravity/
  sources.json              # pinned upstream sources (see below)
  overrides/<plugin>/       # hand-written Antigravity-specific files merged over output
    plugin.json             #   manifest fields (displayName, prompts, logo, author…)
    README.md               #   Antigravity-facing plugin README
    assets/logo.svg|png     #   original logo
    agents/<agent>.yaml     #   Antigravity frontmatter for each agent (body comes from upstream)
  rewrites.json             # targeted text replacements, each anchored to a file + exact match
  plugins/                  # GENERATED — committed; one folder per plugin
    winui/  winappcli/  windbg/
scripts/antigravity/
  build.mjs                 # the generator (Node 22, no runtime deps beyond Node built-ins + git)
  validate.mjs              # schema + structure checks that don't need agy
install.ps1                 # one-line installer for stock Antigravity on Windows
```

`antigravity/plugins/` is committed so the repo itself is installable and diffs show
exactly what changed in a sync. A header file `antigravity/plugins/GENERATED.md` says
"do not edit; change overrides/rewrites and re-run `node scripts/antigravity/build.mjs`".

### `sources.json`

```json
{
  "winui":     { "repo": "https://github.com/microsoft/winappCli.git", "sha": "<pinned>", "path": "plugins/winui/agent-plugin",
                 "agents": "com.github.copilot/agents" },
  "winappcli": { "repo": "https://github.com/microsoft/winappCli.git", "sha": "<pinned>", "path": "plugins/winapp",
                 "agents": "com.github.copilot/agents" },
  "windbg":    { "local": "plugins/windbg", "agents": "com.github.copilot/agents" }
}
```

Initial pins: the SHAs in `.agents/plugins/marketplace.json`, unless the builder finds
winappCli main (0.8.1, adds `winui-devtools`) clean to convert, in which case pin to the
latest tagged release. Builder's call; record the choice in the CHANGELOG.

### Generator behavior (`build.mjs`)

For each plugin in `sources.json`:

1. Fetch the source at the pinned SHA (shallow/partial git fetch into a temp/cache dir;
   `local` sources read from the working tree).
2. Copy `skills/**` verbatim (including `references/` and `scripts/`).
3. **Skill frontmatter**: keep `name`, `description`; drop `user-invocable`; fail the build
   if `name` ≠ folder name or `description` is missing/over 1024 chars.
4. **Agents**: for each upstream `*.agent.md`, take the markdown body, replace the
   frontmatter with `overrides/<plugin>/agents/<name>.yaml`, write `agents/<name>.md`.
   Fail if an upstream agent has no override yaml, or an override has no upstream agent
   (forces a human look when Microsoft adds/removes agents).
5. **Rewrites**: apply each entry in `rewrites.json`
   (`{ plugin, file, find, replace }`). Fail the build if a `find` string no longer
   matches exactly — stale rewrites must be noticed, not silently skipped.
6. **Manifest**: build `plugin.json` from `overrides/<plugin>/plugin.json`; take `version`
   rules below; set `$schema` to `https://antigravity.google/schemas/v1/plugin.json`;
   drop upstream-only keys (`extensions.com.github.copilot`, agent-plugins `$schema`).
7. Copy `overrides/<plugin>/README.md` and `assets/`; copy upstream `LICENSE`
   attribution into each plugin folder (`LICENSE` + `NOTICE.md` naming the upstream repo
   and commit).
8. **Host-reference scan**: after transforms, grep output for
   `copilot|claude|codex|openclaw|agent_type|user-invocable|\`task\``
   (case-insensitive) and fail on any hit not listed in an allowlist in `rewrites.json`.
   This catches new Copilot-specific wording in future upstream releases.
9. Write to `antigravity/plugins/<plugin>/` (clean the folder first).

`build.mjs --check` re-generates into a temp dir and fails if it differs from the
committed `antigravity/plugins/` (used in CI to catch hand edits).

### Content rewrites (initial set)

- **winui-dev agent**: replace the `task`/`agent_type` paragraph with the Antigravity
  equivalent: you are `winui-dev`, do the build yourself; don't delegate the build to
  another `winui-dev`; using `invoke_subagent` for scoped helpers (e.g. `research` for
  parallel codebase mapping, `self` for a critique pass) is fine.
- **winui-setup skill**: replace the `copilot --agent winui:winui-dev -p "…"` example
  with Antigravity's: select **winui-dev** in the agent picker, or
  `agy --agent winui-dev` in the CLI.
- **windbg-diagnostic-method skill** and **diagnostician agent**: "bundled Copilot agents"
  / "host supports sub-agents" → invoke the bundled `contrarian` subagent via
  `invoke_subagent`; keep the existing "if it cannot run, say so" fallback.

### Agent mapping

| Agent | `mainAgent` | `subagent` | `tools` | Notes |
|---|---|---|---|---|
| `winui-dev` | true | true | default (all) | User picks it as primary agent for WinUI work. |
| `winapp` | true | true | default (all) | |
| `diagnostician` | true | true | default (all) | Needs shell for WinDbg/pwsh validator; investigation stays read-only by its own rules. |
| `contrarian` | false | true | `[]` (only `send_message`) | Mirrors upstream `tools: []`: reviews only what it's handed. |

`model`: `inherit` for all. `commandExecutionPolicy`: leave the default (`sandbox`) —
builder to verify that default doesn't block `winapp`/`dotnet`/`winget` on Windows; if
it does, document it in the README rather than silently loosening it.

### Naming and branding

- Plugin `name` stays upstream (`winui`, `winappcli`, `windbg`) so skills, docs, and
  muscle memory match Microsoft's, and Antigravity's MCP namespacing is unaffected
  (no MCP servers anyway). Builder checks for collisions with existing Marketplace
  plugin names; if one collides, prefix with `win-`.
- `displayName` makes the community status obvious, e.g. **"WinUI 3 Dev (Community)"**,
  **"WinApp CLI (Community)"**, **"WinDbg Diagnostics (Community)"**.
- `author`: `{ "name": "momochisoundpost", "url": "https://github.com/momochisoundpost" }`.
  `homepage`/`repository`: the fork. `license`: `MIT`.
- Logos: **original artwork**, not Microsoft's WinUI logo (upstream ships
  `assets/logo.svg`; do not reuse). One consistent family for the three plugins, square,
  transparent, readable on light and dark.
- Each plugin README and the repo README carry: "Community port of Microsoft's
  [win-dev-skills]/[winappCli] plugins (MIT). Not affiliated with or endorsed by
  Microsoft or Google."
- 3 `suggestedPrompts` per plugin, drawn from upstream READMEs (e.g. winui: "Create a
  new WinUI 3 app with MVVM", "Migrate this WPF app to WinUI 3", "Package this app as a
  signed MSIX").

### Versioning

Each plugin has its own semver, starting at `1.0.0`, independent of upstream numbers.
`sources.json` + each plugin's `NOTICE.md` record the upstream version and SHA. Bump
minor on an upstream sync, patch on port-only fixes. A root `CHANGELOG-antigravity.md`
logs releases (upstream `CHANGELOG.md` stays untouched).

### Install paths

1. **One-line installer (primary, stock Antigravity)** — README shows:
   ```powershell
   irm https://raw.githubusercontent.com/momochisoundpost/win-dev-skills-antigravity/main/install.ps1 | iex
   ```
   `install.ps1` (Windows PowerShell 5.1 compatible — no pwsh 7 required):
   - Downloads the latest GitHub release zip (`win-dev-skills-antigravity.zip`)
     via the GitHub releases API; falls back to the `main` branch zip if no release.
   - Extracts the chosen plugins into `%USERPROFILE%\.gemini\config\plugins\<name>\`,
     replacing previous copies of those folders only.
   - Parameters: `-Plugins winui,winappcli,windbg` (default all), `-Uninstall`,
     `-Version <tag>`. Because `irm | iex` can't pass params directly, README also shows
     the `& ([scriptblock]::Create((irm …))) -Plugins winui` form.
   - Prints what was installed and "open Antigravity → Customizations → Installed".
   - Never touches other plugins or `config.json`.
2. **Manual** — download the release zip, unzip the plugin folders into
   `%USERPROFILE%\.gemini\config\plugins\` (or `<project>\.agents\plugins\` for one
   project).
3. **`agy` CLI** — `agy plugin install <path>` from a clone. If `agy plugin install`
   accepts a GitHub URL (docs say GitHub installs are supported but don't show the
   syntax), the builder verifies the exact command and adds it; otherwise omit.
4. **Marketplace** — once accepted, the one-click **Add** button. Until then, README
   says "Marketplace submission pending".

### CI and release (GitHub Actions)

- **PR/push**: `node scripts/antigravity/build.mjs --check`, `node
  scripts/antigravity/validate.mjs` (manifest against the official JSON schema, skill
  name/folder match, description length, agent frontmatter keys, logo exists/square,
  ≤3 prompts, no host references). Run `agy plugin validate` per plugin too **if** `agy`
  can be installed non-interactively on a runner; otherwise it's a manual pre-release
  step in `RELEASING-antigravity.md`.
- **Release**: on tag `v*`, build the zip of `antigravity/plugins/*` (preserving
  `scripts/` executable bits) and attach to a GitHub release.
- **Upstream workflows** that check Copilot/Claude/Codex catalogs (`pr-validation.yml`
  catalog-check, `release-post-merge.yml`) are disabled in the fork (path filters or
  `if: github.repository == 'microsoft/win-dev-skills'`) rather than deleted, to keep
  upstream merges clean.
- **Optional, later**: a scheduled workflow that notices new winappCli releases and
  opens a PR bumping `sources.json`.

### Repo README

Rewrite the root README for Antigravity users: what the three plugins do, the one-line
install, manual install, prerequisites (Windows 10/11, Antigravity app; the skills
themselves install WinApp CLI / .NET via winget and ask before admin steps), how to use
(pick the agent or just ask), not-affiliated notice, link to Microsoft's repos for other
hosts, and how to update (`re-run the one-liner`).

## Left to the builder

- Generator internals (YAML/frontmatter parsing approach, git fetch strategy, caching).
- Exact wording of rewrites, as long as meaning matches the intent above.
- Initial upstream pins (see `sources.json` note).
- Logo production (can use an image generator; must be original).
- Whether `agy` runs in CI.
- Exact `install.ps1` UX/messages, error handling, and TLS/proxy handling.
- Test approach for `build.mjs` and `install.ps1` (fixtures in `scripts/tests/` follow
  existing repo conventions).

## Done looks like

- `antigravity/plugins/{winui,winappcli,windbg}` generated from pinned upstream, passing
  `validate.mjs` and `agy plugin validate --strict` (other-tool warnings only).
- On a clean Windows machine with only the Antigravity app: the one-liner installs all
  three; Customizations → Installed lists them with logos and starter prompts; asking
  "Create a new WinUI 3 app with MVVM" loads `winui-*` skills; `winui-dev`, `winapp`,
  `diagnostician` appear in the agent picker; diagnostician can invoke `contrarian`.
- GitHub release with the zip; README rewritten; not-affiliated notice everywhere.
- Marketplace submission materials ready (all required fields + README + logo).
