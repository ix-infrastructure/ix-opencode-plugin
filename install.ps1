# Copyright 2026 Ix Infrastructure Inc.

# install.ps1 — ix-opencode-plugin installer for Windows
#
# Usage:
#   irm https://raw.githubusercontent.com/ix-infrastructure/ix-opencode-plugin/main/install.ps1 | iex
#   .\install.ps1 -Force
#   .\install.ps1 -Project C:\path\to\project
#   .\install.ps1 -Uninstall

[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$Global,
    [string]$Project,
    [string]$Source,
    [switch]$Force,
    [switch]$DryRun,
    [switch]$Uninstall,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$REPO_URL         = "https://github.com/ix-infrastructure/ix-opencode-plugin.git"
$DEFAULT_SOURCE   = Join-Path $env:LOCALAPPDATA "ix-opencode-plugin"
$GLOBAL_CONFIG    = Join-Path $env:APPDATA "opencode"

# Everything the plugin needs to load, as "<path in the plugin repo>:<path under
# the OpenCode config directory>". Both install modes read this one list. It
# must match INSTALL_ITEMS in install.sh; tests/install.test.ts checks that.
#
# The TypeScript lives under one ix-opencode-plugin\ directory, not in
# plugins\ and tools\ at the top level: OpenCode loads every file in those two
# as a standalone plugin or tool, and tools\*.ts here are modules of the one
# plugin. The entry imports them as ../tools/*, so they stay side by side.
$PLUGIN_SUBDIR = "ix-opencode-plugin"
$PLUGIN_ENTRY  = "$PLUGIN_SUBDIR/plugins/ix-plugin.ts"
$INSTALL_ITEMS = @(
    "plugins:ix-opencode-plugin/plugins"
    "tools:ix-opencode-plugin/tools"
    "runtime:ix-opencode-plugin/runtime"
    "commands:commands"
    "agents:agents"
    "AGENTS.md:AGENTS.md"
)
# Where releases before the list above put the entry point (relative to the
# OpenCode directory). An install removes the opencode.json entry for it.
$LEGACY_ENTRY = "plugins/ix-plugin.ts"

# ── Help ──────────────────────────────────────────────────────────────────────

if ($Help) {
    Write-Host @"

ix-opencode-plugin installer (Windows)

USAGE
  irm https://raw.githubusercontent.com/ix-infrastructure/ix-opencode-plugin/main/install.ps1 | iex
  .\install.ps1 [OPTIONS]

OPTIONS
  -Global             Install globally into %APPDATA%\opencode\  (default)
  -Project [path]     Install into .opencode\ in [path]          (default: current directory)
  -Source <path>      Use a local plugin clone instead of downloading
  -Force              Overwrite existing files and config entries
  -DryRun             Print what would happen without making changes
  -Uninstall          Remove the plugin from the target location
  -Help               Show this message

EXAMPLES
  # Global install (recommended)
  irm https://raw.githubusercontent.com/ix-infrastructure/ix-opencode-plugin/main/install.ps1 | iex

  # Force re-install
  .\install.ps1 -Force

  # Per-project install in current directory
  .\install.ps1 -Project

  # Per-project install in a specific directory
  .\install.ps1 -Project C:\path\to\myproject

  # Preview without making changes
  .\install.ps1 -DryRun

  # Uninstall global install
  .\install.ps1 -Uninstall

"@
    exit 0
}

# ── Helpers ───────────────────────────────────────────────────────────────────

function Write-Ok($msg)   { Write-Host "  [+] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Info($msg) { Write-Host "      $msg" }
function Write-Err($msg)  { Write-Host "  [x] $msg" -ForegroundColor Red; exit 1 }
function Write-Step($msg) { Write-Host; Write-Host "-> $msg" -ForegroundColor Cyan }

function Invoke-Step {
    param([string]$Description, [scriptblock]$Action)
    if ($DryRun) {
        Write-Info "[dry-run] $Description"
    } else {
        & $Action
    }
}

function Copy-ItemSafe {
    param([string]$Src, [string]$Dest, [string]$Label)
    $parent = Split-Path $Dest -Parent
    if (-not (Test-Path $parent)) {
        Invoke-Step "mkdir $parent" { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    }
    if (Test-Path $Dest) {
        if ($Force) {
            Invoke-Step "Remove existing $Label" { Remove-Item $Dest -Recurse -Force }
        } else {
            Write-Warn "$Label already exists — use -Force to overwrite"
            return
        }
    }
    Invoke-Step "Copy $Label" { Copy-Item $Src $Dest -Recurse -Force }
    Write-Ok "Copied $Label"
}

# Earlier releases copied the entry point to plugins\ix-plugin.ts and the
# runtime to runtime\. Those copies cannot be told apart from the user's own
# files, so they are left in place with a warning.
function Write-LegacyWarning {
    param([string]$Dir, [string]$Label)
    if (Test-Path (Join-Path $Dir "plugins\ix-plugin.ts")) {
        Write-Warn "An earlier install left $Label (and runtime\ beside it)."
        Write-Info "OpenCode loads every file in plugins\; delete that copy by hand."
    }
}

function Merge-OpencodeJson {
    param([string]$Path, [string]$PluginEntry, [string]$AgentsEntry, [string]$LegacyEntry)

    if (-not (Test-Path $Path)) {
        $json = [ordered]@{
            '$schema'    = "https://opencode.ai/config.json"
            plugin       = @($PluginEntry)
            instructions = @($AgentsEntry)
        }
        Invoke-Step "Create $(Split-Path $Path -Leaf)" {
            $json | ConvertTo-Json -Depth 5 | Set-Content $Path -Encoding UTF8
        }
        Write-Ok "Created $(Split-Path $Path -Leaf)"
        return
    }

    $content = Get-Content $Path -Raw -Encoding UTF8
    if (($content -match [regex]::Escape("`"$PluginEntry`"")) -and
        -not ($content -match [regex]::Escape("`"$LegacyEntry`""))) {
        if (-not $Force) {
            Write-Warn "Plugin already registered in $(Split-Path $Path -Leaf) — use -Force to re-add"
            return
        }
    }

    Invoke-Step "Merge plugin/instructions into $(Split-Path $Path -Leaf)" {
        $cfg = $content | ConvertFrom-Json

        # Ensure plugin array exists and contains our entry
        # The entry point used to live at $LegacyEntry; drop that registration.
        $plugins = @(@($cfg.plugin) | Where-Object { $_ -and $_ -ne $LegacyEntry })
        if ($plugins -notcontains $PluginEntry) { $plugins += $PluginEntry }

        # Ensure instructions array exists and contains our entry
        $instrs = @($cfg.instructions) | Where-Object { $_ }
        if ($instrs -notcontains $AgentsEntry) { $instrs += $AgentsEntry }

        # Rebuild config preserving existing keys
        $updated = [ordered]@{}
        foreach ($prop in $cfg.PSObject.Properties) {
            $updated[$prop.Name] = $prop.Value
        }
        $updated["plugin"]       = $plugins
        $updated["instructions"] = $instrs

        $updated | ConvertTo-Json -Depth 5 | Set-Content $Path -Encoding UTF8
    }
    Write-Ok "Updated $(Split-Path $Path -Leaf)"
}

# ── Banner ────────────────────────────────────────────────────────────────────

Write-Host
Write-Host "ix-opencode-plugin" -ForegroundColor White
if ($DryRun) { Write-Host "  (dry run — no changes will be made)" -ForegroundColor Yellow }
Write-Host

# ── Resolve install mode ──────────────────────────────────────────────────────

$InstallMode = "global"
$ProjectDir  = (Get-Location).Path

if ($PSBoundParameters.ContainsKey("Project")) {
    $InstallMode = "project"
    if ($Project -ne "") {
        $ProjectDir = (Resolve-Path $Project).Path
    }
}

# ── Prerequisites ─────────────────────────────────────────────────────────────

Write-Step "Checking prerequisites"

function Assert-Command {
    param([string]$Name, [string]$Cmd, [string]$Hint)
    if (Get-Command $Cmd -ErrorAction SilentlyContinue) {
        Write-Ok "$Name found"
    } else {
        Write-Err "$Name not found — $Hint"
    }
}

Assert-Command "OpenCode" "opencode" "install from https://opencode.ai"
Assert-Command "ix CLI"   "ix"       "install from https://github.com/ix-infrastructure/Ix"
Assert-Command "Bun"      "bun"      "install from https://bun.sh"

# ── Resolve source directory ──────────────────────────────────────────────────

Write-Step "Plugin source"

if ($Source -ne "") {
    $SourceDir = $Source
} elseif ($PSScriptRoot -ne "" -and (Test-Path (Join-Path $PSScriptRoot "plugins\ix-plugin.ts"))) {
    $SourceDir = $PSScriptRoot
} else {
    $SourceDir = $DEFAULT_SOURCE
}

if (-not (Test-Path (Join-Path $SourceDir "plugins\ix-plugin.ts"))) {
    Write-Info "Not found at $SourceDir — cloning from GitHub..."
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Err "git not found. Clone manually: git clone $REPO_URL `"$SourceDir`""
    }
    Invoke-Step "git clone $REPO_URL $SourceDir" {
        git clone --depth 1 $REPO_URL $SourceDir 2>&1 | Out-Null
    }
    Write-Ok "Cloned to $SourceDir"
} else {
    Write-Ok "Found at $SourceDir"
    # Update shallow clone on re-installs so cached copies stay current
    if ((Test-Path (Join-Path $SourceDir ".git")) -and (Get-Command git -ErrorAction SilentlyContinue)) {
        Invoke-Step "git fetch + reset" {
            git -C $SourceDir fetch --depth 1 origin --quiet 2>&1 | Out-Null
            git -C $SourceDir reset --hard origin/HEAD --quiet 2>&1 | Out-Null
        }
        Write-Ok "Updated to latest"
    }
}

# ── Install dependencies ──────────────────────────────────────────────────────

# node_modules is not committed: this step is what provides @opencode-ai/plugin.
# --production skips the dev toolchain (typescript, bun-types).
Write-Step "Installing dependencies"
Invoke-Step "bun install --production" {
    Push-Location $SourceDir
    $bunOut = bun install --production --silent 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Err "bun install failed:`n$bunOut"
    }
    Pop-Location
}
Write-Ok "@opencode-ai/plugin ready"

# ── Uninstall ─────────────────────────────────────────────────────────────────

if ($Uninstall) {
    Write-Step "Uninstalling"
    if ($InstallMode -eq "global") {
        foreach ($entry in $INSTALL_ITEMS) {
            $item = $entry.Split(":", 2)[1]
            $dest = Join-Path $GLOBAL_CONFIG $item
            if (Test-Path $dest) {
                Invoke-Step "Remove $item" { Remove-Item $dest -Recurse -Force }
                Write-Ok "Removed $item"
            }
        }
        $pluginDir = Join-Path $GLOBAL_CONFIG $PLUGIN_SUBDIR
        if ((Test-Path $pluginDir) -and -not (Get-ChildItem $pluginDir -Force)) {
            Invoke-Step "Remove $PLUGIN_SUBDIR" { Remove-Item $pluginDir -Force }
        }
        Write-Warn "opencode.json not modified — remove plugin/instructions entries manually if needed"
    } else {
        $dotOpencode = Join-Path $ProjectDir ".opencode"
        Invoke-Step "Remove .opencode\" { Remove-Item $dotOpencode -Recurse -Force }
        Write-Ok "Removed .opencode\"
        Write-Warn "opencode.json not modified — remove plugin/instructions entries manually if needed"
    }
    Write-Host
    Write-Ok "Uninstall complete"
    exit 0
}

# ── Install: global ───────────────────────────────────────────────────────────

if ($InstallMode -eq "global") {
    Write-Step "Installing globally -> $GLOBAL_CONFIG"
    Invoke-Step "mkdir $GLOBAL_CONFIG" { New-Item -ItemType Directory -Force -Path $GLOBAL_CONFIG | Out-Null }

    foreach ($entry in $INSTALL_ITEMS) {
        $src, $item = $entry.Split(":", 2)
        Copy-ItemSafe `
            (Join-Path $SourceDir $src) `
            (Join-Path $GLOBAL_CONFIG $item) `
            $item
    }

    # Use forward slashes in opencode.json paths (OpenCode requires this)
    Merge-OpencodeJson `
        (Join-Path $GLOBAL_CONFIG "opencode.json") `
        "./$PLUGIN_ENTRY" `
        "./AGENTS.md" `
        "./$LEGACY_ENTRY"

    Write-LegacyWarning $GLOBAL_CONFIG "plugins\ix-plugin.ts"

# ── Install: per-project ──────────────────────────────────────────────────────

} else {
    $DotOpencode = Join-Path $ProjectDir ".opencode"
    Write-Step "Installing into project -> $DotOpencode"
    Invoke-Step "mkdir .opencode" { New-Item -ItemType Directory -Force -Path $DotOpencode | Out-Null }

    foreach ($entry in $INSTALL_ITEMS) {
        $src, $item = $entry.Split(":", 2)
        Copy-ItemSafe `
            (Join-Path $SourceDir $src) `
            (Join-Path $DotOpencode $item) `
            $item
    }

    Merge-OpencodeJson `
        (Join-Path $ProjectDir "opencode.json") `
        ".opencode/$PLUGIN_ENTRY" `
        ".opencode/AGENTS.md" `
        ".opencode/$LEGACY_ENTRY"

    Write-LegacyWarning $DotOpencode ".opencode\plugins\ix-plugin.ts"
}

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host
Write-Host "Done. Verify in OpenCode:" -ForegroundColor White
Write-Host
Write-Host "  Use the ix-health tool"
Write-Host
Write-Host "If the graph isn't built yet:"
Write-Host "  ix map"
Write-Host
