# Changelog (Antigravity Port)

All notable changes to the Antigravity community port live here (the upstream `CHANGELOG.md` is left untouched for clean merges).

## [1.0.0] - 2026-11-17

### Added
- Native Antigravity plugin generator (`scripts/antigravity/build.mjs`), strict schema/Marketplace validator (`scripts/antigravity/validate.mjs`), and deterministic release zip packager (`scripts/antigravity/package-release.mjs`) with zero npm runtime dependencies.
- Three generated Antigravity plugins under `antigravity/plugins/` with original SVG artwork, community branding, MIT attribution (`LICENSE` + `NOTICE.md`), and Antigravity-adapted agent/subagent references:
  - **winui** (`1.0.0`, 7 skills + `winui-dev` agent) — pinned to `microsoft/winappCli` tag `v0.8.0` (`696222f72e80c669671845bd6c7b0286eefab987`) instead of the older `v0.7.1` catalog pointer so `winui-devtools` and `winapp-performance` workflows are included from day one.
  - **winappcli** (`1.0.0`, 14 skills + `winapp` agent) — pinned to `microsoft/winappCli` tag `v0.8.0` (`696222f72e80c669671845bd6c7b0286eefab987`).
  - **windbg** (`1.0.0`, 11 skills + `diagnostician` & `contrarian` agents + `validate-diagnosis-output.ps1`) — generated from local `plugins/windbg` (upstream commit `5ce74fa`).
- Windows PowerShell 5.1 one-line installer (`install.ps1`) supporting `-Plugins`, `-Version`, `-Uninstall`, and automatic fallback to `main` branch archives.
- GitHub Actions workflows for Antigravity CI validation and tagged release packaging, while gating upstream Microsoft catalog/auto-tag workflows to `microsoft/win-dev-skills`.
