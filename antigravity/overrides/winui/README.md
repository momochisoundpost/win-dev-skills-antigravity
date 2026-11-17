# WinUI 3 Dev (Community)

> Community port of Microsoft's `winui` plugin from [microsoft/winappCli](https://github.com/microsoft/winappCli) (MIT). Not affiliated with or endorsed by Microsoft or Google.

Build native Windows desktop applications with **WinUI 3** and the **Windows App SDK** in Antigravity: setup, XAML/Fluent UI design, build-and-run workflows, code review, UI testing, MSIX packaging, and WPF migration.

## Included

- **Agent:** `winui-dev` (selectable in the Antigravity agent picker, `/agents`, or `agy --agent winui-dev`)
- **Skills:** `winui-setup`, `winui-dev-workflow`, `winui-design`, `winui-code-review`, `winui-ui-testing`, `winui-packaging`, `winui-wpf-migration`

## Prerequisites & Notes

- **OS:** Windows 10/11.
- **Tools run by skills:** `winapp`, `dotnet`, `winget`, and PowerShell. Skills ask before elevated/administrator operations (such as Developer Mode or trusting development certificates).
- **Command sandbox note:** `winui-dev` defaults to Antigravity's `sandbox` command execution policy. If `dotnet`, `winget`, or `winapp` hits sandbox blocks on Windows, approve the command when prompted or adjust your project/app execution settings.
