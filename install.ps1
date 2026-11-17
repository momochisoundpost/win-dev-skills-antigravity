<#
.SYNOPSIS
  Install or uninstall the Antigravity Windows development community plugins.

.DESCRIPTION
  Downloads WinUI 3 Dev, WinApp CLI, and WinDbg Diagnostics community plugins
  from momochisoundpost/win-dev-skills-antigravity and installs them into
  %USERPROFILE%\.gemini\config\plugins\ for stock Google Antigravity on Windows.
  Compatible with Windows PowerShell 5.1 (no Git, Node.js, or agy CLI required).
#>
[CmdletBinding()]
param(
  [string[]]$Plugins = @('winui', 'winappcli', 'windbg'),
  [string]$Version = '',
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$RepoSlug = 'momochisoundpost/win-dev-skills-antigravity'
$AssetName = 'win-dev-skills-antigravity.zip'
$KnownPlugins = @('winui', 'winappcli', 'windbg')
$DestRoot = Join-Path $env:USERPROFILE '.gemini\config\plugins'

# Normalize comma-separated or array plugin arguments.
$SelectedPlugins = @(
  $Plugins |
    ForEach-Object { $_ -split ',' } |
    ForEach-Object { $_.Trim().ToLowerInvariant() } |
    Where-Object { $_ -ne '' } |
    Select-Object -Unique
)

if ($SelectedPlugins.Count -eq 0) {
  throw 'No plugins selected. Choose one or more of: winui, winappcli, windbg.'
}

foreach ($p in $SelectedPlugins) {
  if ($KnownPlugins -notcontains $p) {
    throw "Unknown plugin '$p'. Valid plugins: $($KnownPlugins -join ', ')."
  }
}

if ($Uninstall) {
  foreach ($p in $SelectedPlugins) {
    $target = Join-Path $DestRoot $p
    if (Test-Path $target) {
      Remove-Item -Path $target -Recurse -Force
      Write-Host "Removed plugin '$p' from $target"
    } else {
      Write-Host "Plugin '$p' is not installed at $target"
    }
  }
  Write-Host 'Done. Open Antigravity -> Customizations -> Installed to confirm.'
  return
}

# Ensure TLS 1.2 is enabled on Windows PowerShell 5.1.
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Headers = @{ 'User-Agent' = 'win-dev-skills-antigravity-installer' }
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("ag-win-dev-" + [System.Guid]::NewGuid().ToString('N'))

function Resolve-ArchiveSource {
  param([string]$RequestedVersion)

  if ($RequestedVersion -ne '') {
    $tag = if ($RequestedVersion.StartsWith('v')) { $RequestedVersion } else { "v$RequestedVersion" }
    return @{
      Url = "https://github.com/$RepoSlug/releases/download/$tag/$AssetName"
      Label = "release $tag"
    }
  }

  try {
    $latestUrl = "https://api.github.com/repos/$RepoSlug/releases/latest"
    $release = Invoke-RestMethod -Uri $latestUrl -Headers $Headers -Method Get
    if ($release -and $release.assets) {
      $asset = $release.assets | Where-Object { $_.name -eq $AssetName } | Select-Object -First 1
      if ($asset -and $asset.browser_download_url) {
        return @{
          Url = $asset.browser_download_url
          Label = "release $($release.tag_name)"
        }
      }
    }
  } catch {
    Write-Warning "No GitHub release archive available yet; falling back to main branch archive."
  }

  return @{
    Url = "https://github.com/$RepoSlug/archive/refs/heads/main.zip"
    Label = 'main branch archive'
  }
}

function Find-PluginSourceDir {
  param(
    [string]$ExtractDir,
    [string]$PluginName
  )

  # Release zip layout: <extract>/<plugin>/plugin.json
  $direct = Join-Path $ExtractDir $PluginName
  if (Test-Path (Join-Path $direct 'plugin.json')) {
    return $direct
  }

  # GitHub branch archive layout: <extract>/<repo>-<ref>/antigravity/plugins/<plugin>/plugin.json
  $topDirs = Get-ChildItem -Path $ExtractDir -Directory
  foreach ($dir in $topDirs) {
    $nested = Join-Path (Join-Path (Join-Path $dir.FullName 'antigravity') 'plugins') $PluginName
    if (Test-Path (Join-Path $nested 'plugin.json')) {
      return $nested
    }
  }

  return $null
}

try {
  New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $DestRoot -Force | Out-Null

  $source = Resolve-ArchiveSource -RequestedVersion $Version
  $zipPath = Join-Path $TempRoot $AssetName
  $extractDir = Join-Path $TempRoot 'extracted'

  Write-Host "Downloading $($source.Label) from $($source.Url)..."
  Invoke-WebRequest -UseBasicParsing -Headers $Headers -Uri $source.Url -OutFile $zipPath

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $extractDir)

  $installed = @()
  foreach ($p in $SelectedPlugins) {
    $srcDir = Find-PluginSourceDir -ExtractDir $extractDir -PluginName $p
    if (-not $srcDir) {
      throw "Downloaded archive does not contain plugin '$p'."
    }

    $dstDir = Join-Path $DestRoot $p
    $stageDir = Join-Path $DestRoot (".tmp-$p-" + [System.Guid]::NewGuid().ToString('N'))
    try {
      Copy-Item -Path $srcDir -Destination $stageDir -Recurse -Force
      if (Test-Path $dstDir) {
        Remove-Item -Path $dstDir -Recurse -Force
      }
      Rename-Item -Path $stageDir -NewName $p
    } catch {
      if (Test-Path $stageDir) {
        Remove-Item -Path $stageDir -Recurse -Force -ErrorAction SilentlyContinue
      }
      throw
    }

    $installed += $p
    Write-Host "Installed '$p' -> $dstDir"
  }

  Write-Host ''
  Write-Host "Done ($($installed -join ', '))."
  Write-Host 'Open Antigravity -> Customizations -> Installed to view and manage your plugins (no restart needed).'
} finally {
  if (Test-Path $TempRoot) {
    Remove-Item -Path $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
