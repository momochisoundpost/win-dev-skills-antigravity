# WinApp CLI (Community)

> Community port of Microsoft's `winappcli` plugin from [microsoft/winappCli](https://github.com/microsoft/winappCli) (MIT). Not affiliated with or endorsed by Microsoft or Google.

Package, sign, inspect, and ship Windows apps across Electron, .NET, MAUI, C++, Rust, Flutter, and Tauri using the **winapp CLI**.

## Included

- **Agent:** `winapp` (selectable in the Antigravity agent picker, `/agents`, or `agy --agent winapp`)
- **Skills (14):** `winapp-setup`, `winapp-frameworks`, `winapp-manifest`, `winapp-identity`, `winapp-package`, `winapp-signing`, `winapp-maui`, `winapp-find-api`, `winapp-find-ui`, `winapp-ui-automation`, `winui-devtools`, `winapp-sandbox`, `winapp-performance`, `winapp-troubleshoot`

## Prerequisites & Notes

- **OS:** Windows 10/11.
- **Tools run by skills:** `winapp`, your project's build tools (`dotnet`, `npm`, `cargo`, `cmake`), PowerShell, and Windows Sandbox (`wsb`, `dism`). Skills ask before elevated/administrator actions or attaching to running apps.
- **Command sandbox note:** `winapp` defaults to Antigravity's `sandbox` command execution policy. If `winapp` or package-install commands require approval on Windows, confirm the prompt or adjust your execution settings.
