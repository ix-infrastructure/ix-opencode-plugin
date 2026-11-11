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
# the OpenCode config directory>". A directory stands for every file in it.
# Both install modes copy each file from this one list. It must match
# INSTALL_ITEMS in install.sh; tests/install.test.ts checks that.
#
# The TypeScript lives under one ix-opencode-plugin\ directory, not in
# plugins\ and tools\ at the top level: OpenCode loads every file in those two
# as a standalone plugin or tool, and tools\*.ts here are modules of the one
# plugin. The entry imports them as ../tools/*, so they stay side by side.
# commands\ and agents\ are where OpenCode looks for them; the plugin adds its
# own files there and leaves every other file alone.
$PLUGIN_SUBDIR = "ix-opencode-plugin"
$PLUGIN_ENTRY  = "$PLUGIN_SUBDIR/plugins/ix-plugin.ts"
$AGENTS_ENTRY  = "$PLUGIN_SUBDIR/AGENTS.md"
$INSTALL_ITEMS = @(
    "plugins:ix-opencode-plugin/plugins"
    "tools:ix-opencode-plugin/tools"
    "runtime:ix-opencode-plugin/runtime"
    "AGENTS.md:ix-opencode-plugin/AGENTS.md"
    "commands:commands"
    "agents:agents"
)

# Every path an install creates, one per line, relative to the OpenCode
# directory; directories end in "/". -Uninstall removes exactly these, and an
# install overwrites without -Force only these (and anything else under
# ix-opencode-plugin\, which is the plugin's own directory).
$MANIFEST_REL = "$PLUGIN_SUBDIR/install-manifest.txt"

# Where earlier releases put the entry point and AGENTS.md (relative to the
# OpenCode directory). An install removes their opencode.json entries.
$LEGACY_ENTRY  = "plugins/ix-plugin.ts"
$LEGACY_AGENTS = "AGENTS.md"

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
  -Force              Also replace files of the same name that the plugin did
                      not install (only those files; nothing else is touched)
  -DryRun             Print what would happen without making changes
  -Uninstall          Remove the plugin from the target location
  -Help               Show this message

EXAMPLES
  # Global install (recommended)
  irm https://raw.githubusercontent.com/ix-infrastructure/ix-opencode-plugin/main/install.ps1 | iex

  # Update an existing install (re-running is enough)
  .\install.ps1

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

# The plugin's own files: Src (full path) and Rel (path under the OpenCode
# directory, "/"-separated).
function Get-PluginFiles {
    foreach ($entry in $INSTALL_ITEMS) {
        $src, $dest = $entry.Split(":", 2)
        $srcPath = Join-Path $SourceDir $src
        if (Test-Path -LiteralPath $srcPath -PathType Container) {
            $root = (Resolve-Path -LiteralPath $srcPath).Path.TrimEnd('\', '/')
            Get-ChildItem -LiteralPath $srcPath -Recurse -File |
                Where-Object { -not $_.Name.StartsWith(".") } |
                Sort-Object FullName |
                ForEach-Object {
                    $sub = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
                    [pscustomobject]@{ Src = $_.FullName; Rel = "$dest/$sub" }
                }
        } else {
            [pscustomobject]@{ Src = $srcPath; Rel = $dest }
        }
    }
}

# Paths listed in a manifest file (comments dropped).
function Get-ManifestPaths([string]$Manifest) {
    if (-not (Test-Path -LiteralPath $Manifest -PathType Leaf)) { return @() }
    return @(Get-Content -LiteralPath $Manifest -Encoding UTF8 |
        Where-Object { $_ -and -not $_.StartsWith("#") })
}

# True when Rel belongs to the plugin: listed in the manifest, or inside the
# plugin's own ix-opencode-plugin\ directory.
function Test-Owned([string]$Rel, [string[]]$Owned) {
    return $Rel.StartsWith("$PLUGIN_SUBDIR/") -or ($Owned -contains $Rel)
}

function Test-SameContent([string]$A, [string]$B) {
    if (-not (Test-Path -LiteralPath $B -PathType Leaf)) { return $false }
    return (Get-FileHash -LiteralPath $A).Hash -eq (Get-FileHash -LiteralPath $B).Hash
}

# Install the plugin into an OpenCode directory, file by file.
#
# Without -Force, an existing file is replaced only when the plugin owns it
# (see Test-Owned) or it already has the plugin's content. Any other file of
# the same name stops the install before anything is changed. -Force replaces
# those files too -- only those files. A directory is never removed.
function Install-Into([string]$Base) {
    $manifest = Join-Path $Base $MANIFEST_REL
    $owned = @(Get-ManifestPaths $manifest)
    $plan = @(Get-PluginFiles)
    if ($plan.Count -eq 0) { Write-Err "No plugin files found in $SourceDir" }

    $conflicts = @()
    foreach ($f in $plan) {
        $dest = Join-Path $Base $f.Rel
        if (Test-Path -LiteralPath $dest -PathType Container) {
            Write-Err "$dest is a directory, where the plugin installs a file. Move it and re-run."
        }
        if ((Test-Path -LiteralPath $dest) -and -not (Test-Owned $f.Rel $owned) -and
            -not (Test-SameContent $f.Src $dest)) {
            $conflicts += $f.Rel
        }
    }
    if ($conflicts.Count -gt 0) {
        if ($Force) {
            Write-Warn "-Force: replacing these files, which the plugin did not install:"
        } else {
            Write-Warn "These files exist and were not installed by this plugin:"
        }
        foreach ($c in $conflicts) { Write-Info (Join-Path $Base $c) }
        if (-not $Force) {
            Write-Err "Nothing changed. Move them, or re-run with -Force to replace exactly these files."
        }
    }

    if (-not (Test-Path -LiteralPath $Base)) {
        Invoke-Step "mkdir $Base" { New-Item -ItemType Directory -Force -Path $Base | Out-Null }
    }
    $created = @()
    $written = 0
    foreach ($f in $plan) {
        $dest = Join-Path $Base $f.Rel
        # Create missing parent directories one level at a time, recording each.
        $parts = $f.Rel.Split("/")
        $path = ""
        for ($i = 0; $i -lt $parts.Count - 1; $i++) {
            $path = if ($path) { "$path/$($parts[$i])" } else { $parts[$i] }
            $dir = Join-Path $Base $path
            if (-not (Test-Path -LiteralPath $dir -PathType Container)) {
                Invoke-Step "mkdir $dir" { New-Item -ItemType Directory -Path $dir | Out-Null }
                $created += "$path/"
            }
        }
        if (Test-SameContent $f.Src $dest) { continue }
        Invoke-Step "copy $($f.Rel)" { Copy-Item -LiteralPath $f.Src -Destination $dest -Force }
        $written++
    }

    # Files an earlier version installed that this one no longer ships.
    $rels = @($plan | ForEach-Object { $_.Rel })
    foreach ($old in $owned) {
        if ($old.EndsWith("/") -or ($rels -contains $old)) { continue }
        $oldPath = Join-Path $Base $old
        if (Test-Path -LiteralPath $oldPath -PathType Leaf) {
            Invoke-Step "Remove $old" { Remove-Item -LiteralPath $oldPath -Force }
            Write-Ok "Removed $old (no longer part of the plugin)"
        }
    }

    $dirs = @($owned | Where-Object { $_.EndsWith("/") }) + $created
    $lines = @(
        "# Written by the ix-opencode-plugin installer. Paths are relative to the"
        "# directory that holds $PLUGIN_SUBDIR/. -Uninstall removes exactly these"
        "# (a directory only if it is empty)."
    ) + @($rels + $dirs | Sort-Object -Unique)
    Invoke-Step "write $manifest" { $lines | Set-Content -LiteralPath $manifest -Encoding UTF8 }
    Write-Ok "$($plan.Count) plugin files in place ($written written)"
}

# Remove what the manifest lists: files, then the directories the install
# created, deepest first, each only if it is now empty.
function Uninstall-From([string]$Base) {
    $manifest = Join-Path $Base $MANIFEST_REL
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
        Write-Warn "No install manifest at $manifest -- nothing to remove there."
        return
    }
    $paths = @(Get-ManifestPaths $manifest)
    $n = 0
    foreach ($rel in $paths) {
        if ($rel.EndsWith("/")) { continue }
        $file = Join-Path $Base $rel
        if (Test-Path -LiteralPath $file -PathType Leaf) {
            Invoke-Step "Remove $rel" { Remove-Item -LiteralPath $file -Force }
            $n++
        }
    }
    Invoke-Step "Remove $manifest" { Remove-Item -LiteralPath $manifest -Force }
    foreach ($rel in @($paths | Where-Object { $_.EndsWith("/") } | Sort-Object -Descending)) {
        $dir = Join-Path $Base $rel.TrimEnd("/")
        if (-not (Test-Path -LiteralPath $dir -PathType Container)) { continue }
        if (@(Get-ChildItem -LiteralPath $dir -Force).Count -eq 0) {
            Invoke-Step "Remove $rel" { Remove-Item -LiteralPath $dir -Force }
        } else {
            Write-Info "Kept $dir (not empty)"
        }
    }
    Write-Ok "Removed $n plugin files from $Base"
}

# Earlier releases copied the entry point to plugins\ix-plugin.ts, the runtime
# to runtime\ and AGENTS.md beside them. Those copies cannot be told apart from
# the user's own files, so they are left in place with a warning.
function Write-LegacyWarning([string]$Dir) {
    if (Test-Path -LiteralPath (Join-Path $Dir "plugins\ix-plugin.ts")) {
        Write-Warn "An earlier install left plugins\ix-plugin.ts, runtime\ and AGENTS.md in $Dir."
        Write-Info "OpenCode loads every file in plugins\; delete those copies by hand."
    }
}

# Add (or with -Action remove, take out) the plugin's opencode.json entries.
# Entries in -Drop are taken out of both lists: the places earlier releases
# registered. Everything else in the file is kept.
function Update-OpencodeJson {
    param([string]$Path, [string]$Action, [string]$PluginEntry, [string]$AgentsEntry, [string[]]$Drop = @())

    if (-not (Test-Path -LiteralPath $Path)) {
        if ($Action -ne "add") { return }
        $json = [ordered]@{
            '$schema'    = "https://opencode.ai/config.json"
            plugin       = @($PluginEntry)
            instructions = @($AgentsEntry)
        }
        Invoke-Step "Create $Path" {
            $json | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Path -Encoding UTF8
        }
        Write-Ok "Created $Path"
        return
    }

    try {
        $cfg = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        if ($Action -eq "add") {
            Write-Warn "Could not read $Path as JSON -- edit it by hand:"
            Write-Info "  add `"$PluginEntry`" to `"plugin`" and `"$AgentsEntry`" to `"instructions`""
            if ($Drop.Count -gt 0) { Write-Info "  remove any of: $($Drop -join ', ')" }
        } else {
            Write-Warn "Could not read $Path as JSON -- remove `"$PluginEntry`" and `"$AgentsEntry`" by hand"
        }
        return
    }

    $before = $cfg | ConvertTo-Json -Depth 20 -Compress
    $updated = [ordered]@{}
    foreach ($prop in $cfg.PSObject.Properties) { $updated[$prop.Name] = $prop.Value }
    foreach ($key in @("plugin", "instructions")) {
        $entry = if ($key -eq "plugin") { $PluginEntry } else { $AgentsEntry }
        if (-not $updated.Contains($key) -and $Action -ne "add") { continue }
        $values = @(@($updated[$key]) | Where-Object {
            $_ -and ($Drop -notcontains $_) -and ($Action -eq "add" -or $_ -ne $entry)
        })
        if ($Action -eq "add" -and $values -notcontains $entry) { $values += $entry }
        $updated[$key] = $values
    }
    if (([pscustomobject]$updated | ConvertTo-Json -Depth 20 -Compress) -eq $before) {
        Write-Ok "$Path already up to date"
        return
    }
    Invoke-Step "Update $Path" {
        $updated | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
    }
    Write-Ok "Updated $Path"
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
    # Update the installer's own clone so re-installs stay current. Any other
    # clone (-Source, or .\install.ps1 from a checkout) is used as it is: it
    # may hold someone's work.
    if (($SourceDir -eq $DEFAULT_SOURCE) -and (Test-Path (Join-Path $SourceDir ".git")) -and
        (Get-Command git -ErrorAction SilentlyContinue)) {
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

if ($InstallMode -eq "global") {
    $OpencodeDir = $GLOBAL_CONFIG
    $ConfigFile  = Join-Path $GLOBAL_CONFIG "opencode.json"
    $EntryPrefix = "./"
} else {
    $OpencodeDir = Join-Path $ProjectDir ".opencode"
    $ConfigFile  = Join-Path $ProjectDir "opencode.json"
    $EntryPrefix = ".opencode/"
}

# ── Uninstall ─────────────────────────────────────────────────────────────────

if ($Uninstall) {
    Write-Step "Uninstalling from $OpencodeDir"
    Uninstall-From $OpencodeDir
    Update-OpencodeJson $ConfigFile "remove" "$EntryPrefix$PLUGIN_ENTRY" "$EntryPrefix$AGENTS_ENTRY" `
        @("$EntryPrefix$LEGACY_ENTRY")
    Write-Host
    Write-Ok "Uninstall complete"
    exit 0
}

# ── Install ───────────────────────────────────────────────────────────────────

if ($InstallMode -eq "global") {
    Write-Step "Installing globally -> $OpencodeDir"
} else {
    Write-Step "Installing into project -> $OpencodeDir"
}

Install-Into $OpencodeDir

# Earlier releases registered <dir>/plugins/ix-plugin.ts and <dir>/AGENTS.md.
# Drop the first; drop the second only once no file is there any more.
# opencode.json paths use forward slashes (OpenCode requires this).
$drop = @("$EntryPrefix$LEGACY_ENTRY")
if (-not (Test-Path -LiteralPath (Join-Path $OpencodeDir $LEGACY_AGENTS))) {
    $drop += "$EntryPrefix$LEGACY_AGENTS"
}
Update-OpencodeJson $ConfigFile "add" "$EntryPrefix$PLUGIN_ENTRY" "$EntryPrefix$AGENTS_ENTRY" $drop

Write-LegacyWarning $OpencodeDir

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host
Write-Host "Done. Verify in OpenCode:" -ForegroundColor White
Write-Host
Write-Host "  Use the ix-health tool"
Write-Host
Write-Host "If the graph isn't built yet:"
Write-Host "  ix map"
Write-Host
