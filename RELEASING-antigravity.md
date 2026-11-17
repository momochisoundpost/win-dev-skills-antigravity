# Releasing the Antigravity Port

## 1. Syncing Upstream Updates

1. Merge upstream `microsoft/win-dev-skills` into `main` if `plugins/windbg/` updated.
2. Update `antigravity/sources.json` (`sha`, `ref`, `upstreamVersion`) for `winui` / `winappcli` when targeting a new `microsoft/winappCli` tag.
3. Bump plugin `version` fields in `antigravity/overrides/*/plugin.json` (minor on upstream sync, patch on port-only fixes) and update `CHANGELOG-antigravity.md`.
4. Regenerate and validate:
   ```bash
   node scripts/antigravity/build.mjs
   node scripts/antigravity/build.mjs --check
   node scripts/antigravity/validate.mjs --strict
   ```
5. If `build.mjs` reports a stale rewrite or new host-specific reference, update `antigravity/rewrites.json` or `antigravity/overrides/<plugin>/agents/*.yaml` and re-run step 4.

## 2. Pre-Release Checks (Including `agy` CLI)

Run all automated tests locally:

```bash
node scripts/tests/test-antigravity-frontmatter.mjs
node scripts/tests/test-antigravity-build.mjs
node scripts/tests/test-antigravity-validate.mjs
node scripts/tests/test-antigravity-install.mjs
node scripts/tests/test-antigravity-release-zip.mjs
```

On a machine with the `agy` CLI installed, run Antigravity's native validator on each generated plugin before tagging:

```bash
agy plugin validate --strict ./antigravity/plugins/winui
agy plugin validate --strict ./antigravity/plugins/winappcli
agy plugin validate --strict ./antigravity/plugins/windbg
```

## 3. Tagging & GitHub Release

1. Commit all updates and push `main`.
2. Tag and push a release tag (e.g. `v1.0.0`):
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
3. `.github/workflows/antigravity-release.yml` runs all checks, builds `win-dev-skills-antigravity.zip`, and attaches it to the GitHub Release.
4. Smoke-test `install.ps1` on a clean Windows 10/11 machine with stock Antigravity installed.

## 4. Antigravity Marketplace Submission

Submit each validated plugin via the [Antigravity Marketplace partner intake form](https://forms.gle/2EX5RFYPoJe1UgxR9) once `agy plugin validate --strict` passes with zero errors:

- Confirm `plugin.json` includes `name`, `displayName`, `description`, `version`, `logo`, `suggestedPrompts` (3 items), and `author`.
- Confirm each plugin root contains `README.md`, `LICENSE`, `NOTICE.md`, and `assets/logo.svg` (`128x128` original artwork).
- Keep the `"Community port ... Not affiliated with or endorsed by Microsoft or Google"` notice prominent.
