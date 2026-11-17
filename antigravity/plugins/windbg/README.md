# WinDbg Diagnostics (Community)

> Community port of Microsoft's `windbg` plugin from [microsoft/win-dev-skills](https://github.com/microsoft/win-dev-skills) (MIT). Not affiliated with or endorsed by Microsoft or Google.

Evidence-first WinDbg crash, hang, heap corruption, memory exhaustion, and user/kernel-mode driver triage workflows with adversarial contrarian review and PowerShell report validation.

## Included

- **Agents:** `diagnostician` (primary or subagent) and `contrarian` (read-only adversarial review subagent)
- **Skills (11):** `windbg-diagnostic-method` (plus `scripts/validate-diagnosis-output.ps1`) and 10 user-mode/kernel-mode triage skills

## Prerequisites & Notes

- **OS & tools:** Windows 10/11 with WinDbg (optional external WinDbg MCP server or pasted debugger output) and PowerShell 7 (`pwsh`) to run `validate-diagnosis-output.ps1`.
- **No bundled MCP server:** This plugin supplies diagnostic workflows and validation scripts; connect your own WinDbg MCP integration or paste debugger output directly.
