# Windows Dev Skills for Google Antigravity

> **Community port — not affiliated with or endorsed by Microsoft or Google.**
> Converted from Microsoft's MIT-licensed [microsoft/win-dev-skills](https://github.com/microsoft/win-dev-skills) and [microsoft/winappCli](https://github.com/microsoft/winappCli) plugins. If you use GitHub Copilot, Claude Code, Codex, OpenClaw, or OpenCode, install directly from Microsoft's repositories.

Three native Antigravity plugins (32 skills and 4 agents) for building, packaging, testing, and debugging Windows applications:

| Plugin | Display Name | What's inside | Upstream Source |
|---|---|---|---|
| **`winui`** | WinUI 3 Dev (Community) | 7 skills + `winui-dev` agent for WinUI 3, Windows App SDK, XAML, Fluent UI, UI testing, MSIX, and WPF migration | `microsoft/winappCli` (`v0.8.0`) |
| **`winappcli`** | WinApp CLI (Community) | 14 skills + `winapp` agent for packaging, signing, package identity, manifests, WinUI DevTools, Windows Sandbox, and Electron/.NET/C++/Rust/Flutter/Tauri workflows | `microsoft/winappCli` (`v0.8.0`) |
| **`windbg`** | WinDbg Diagnostics (Community) | 11 skills + `diagnostician` & `contrarian` agents + PowerShell report validator for crash, hang, heap, and driver triage | `microsoft/win-dev-skills` |

---

## Install (Windows 10 / 11)

### Option 1: One-line PowerShell install (stock Antigravity)

Works on built-in Windows PowerShell 5.1 with just the Antigravity app installed — **no Git, Node.js, PowerShell 7, or `agy` CLI required**:

```powershell
irm https://raw.githubusercontent.com/momochisoundpost/win-dev-skills-antigravity/main/install.ps1 | iex
```

To install only specific plugins, choose a release tag, or uninstall:

```powershell
# Install only winui and winappcli
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/momochisoundpost/win-dev-skills-antigravity/main/install.ps1))) -Plugins winui,winappcli

# Install a specific release tag
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/momochisoundpost/win-dev-skills-antigravity/main/install.ps1))) -Version v1.0.0

# Uninstall selected plugins
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/momochisoundpost/win-dev-skills-antigravity/main/install.ps1))) -Uninstall
```

Plugins are extracted to `%USERPROFILE%\.gemini\config\plugins\`. Open Antigravity and check **Customizations → Installed** (no restart needed).

### Option 2: Manual zip download

1. Download `win-dev-skills-antigravity.zip` from [Releases](https://github.com/momochisoundpost/win-dev-skills-antigravity/releases).
2. Unzip `winui/`, `winappcli/`, and `windbg/` into `%USERPROFILE%\.gemini\config\plugins\` (global) or `<your-repo>\.agents\plugins\` (workspace-only).

### Option 3: Antigravity CLI (`agy`) from a local clone

```powershell
git clone https://github.com/momochisoundpost/win-dev-skills-antigravity.git
agy plugin install .\win-dev-skills-antigravity\antigravity\plugins\winui
agy plugin install .\win-dev-skills-antigravity\antigravity\plugins\winappcli
agy plugin install .\win-dev-skills-antigravity\antigravity\plugins\windbg
```

### Antigravity Marketplace

Marketplace submission is **pending**. Once listed, you'll be able to install with one click from **Customizations → Marketplace**.

---

## Using the plugins

- **Skills load automatically** from natural language (e.g., *"Create a new WinUI 3 app with MVVM"* or *"Package this Electron app as a signed MSIX"*), or explicitly via `/<skill-name>` (such as `/winui-setup`).
- **Pick a specialized agent** (`winui-dev`, `winapp`, or `diagnostician`) from the Antigravity agent selector, `/agents`, or `agy --agent <name>`.
- **`contrarian` (WinDbg):** Subagent-only (`mainAgent: false`, read-only); `diagnostician` invokes it automatically when subagents are available.

### Prerequisites & Permissions

- **Windows 10 / 11** and the Antigravity app, IDE, or CLI.
- **CLI tools:** The `winui` and `winappcli` skills guide Antigravity to run `winapp`, `dotnet`, `winget`, and PowerShell (and can install missing SDKs/CLIs with your confirmation). They ask before any elevated/administrator action (Developer Mode, trusting certificates, enabling Windows Sandbox).
- **Command sandbox note:** All primary agents default to Antigravity's `sandbox` execution policy. Approve commands when prompted (or adjust project execution settings if `winget`/`dotnet`/`winapp` is blocked).
- **WinDbg:** `windbg` does not bundle an MCP server; paste debugger output directly or connect your own WinDbg MCP integration. Running `validate-diagnosis-output.ps1` uses PowerShell 7 (`pwsh`).

## Updating

Re-run the one-line installer to overwrite the plugin folders cleanly without touching your other plugins or `config.json`:

```powershell
irm https://raw.githubusercontent.com/momochisoundpost/win-dev-skills-antigravity/main/install.ps1 | iex
```

---

## Maintaining / Syncing Upstream (Contributors)

Antigravity assets are generated reproducibly from `antigravity/sources.json`, `antigravity/overrides/`, and `antigravity/rewrites.json` by `scripts/antigravity/build.mjs` (Node.js 22+, zero npm runtime dependencies):

```bash
node scripts/antigravity/build.mjs
node scripts/antigravity/build.mjs --check
node scripts/antigravity/validate.mjs --strict
```

See [RELEASING-antigravity.md](RELEASING-antigravity.md) and [CHANGELOG-antigravity.md](CHANGELOG-antigravity.md) for sync and release details.

## Trademarks & License

This project may contain references to Microsoft or Google product names for compatibility. Use of Microsoft trademarks or logos is subject to [Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general), and this community port must not cause confusion or imply Microsoft or Google sponsorship.

Licensed under the [MIT License](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and each plugin's `NOTICE.md`.
