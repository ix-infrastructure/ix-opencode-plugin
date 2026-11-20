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

# True when Path is a symbolic link or junction.
function Test-Link([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    return [bool]($item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint))
}

# True when a manifest line names a path the installer may act on: relative,
# no empty, "." or ".." segment, not starting with "-", inside one of the
# directories it installs into (ix-opencode-plugin/, commands/, agents/), with
# no linked directory on the way and its parent resolving inside Base.
function Test-ValidManifestPath([string]$Base, [string]$Line) {
    $rel = if ($Line.EndsWith("/")) { $Line.Substring(0, $Line.Length - 1) } else { $Line }
    if (-not $rel -or $rel.StartsWith("-") -or $rel.EndsWith("/") -or $rel.Contains("\") -or
        $rel.Contains(":") -or $rel.StartsWith("/")) { return $false }
    $parts = $rel.Split("/")
    if (@("ix-opencode-plugin", "commands", "agents") -notcontains $parts[0]) { return $false }
    # A file entry needs at least two segments; only a directory entry may have one.
    if (-not $Line.EndsWith("/") -and $parts.Count -lt 2) { return $false }
    $parent = ""
    for ($i = 0; $i -lt $parts.Count; $i++) {
        if (@("", ".", "..") -contains $parts[$i]) { return $false }
        if ($i -lt $parts.Count - 1) {
            $parent = if ($parent) { "$parent/$($parts[$i])" } else { $parts[$i] }
            if (Test-Link (Join-Path $Base $parent)) { return $false }
        }
    }
    if ($parent -and (Test-Path -LiteralPath (Join-Path $Base $parent) -PathType Container)) {
        $realBase = (Resolve-Path -LiteralPath $Base).ProviderPath.TrimEnd('\', '/')
        $realParent = (Resolve-Path -LiteralPath (Join-Path $Base $parent)).ProviderPath
        if (-not $realParent.StartsWith($realBase + [IO.Path]::DirectorySeparatorChar)) { return $false }
    }
    return $true
}

# The manifest's valid entries (see Test-ValidManifestPath). Any other line is
# skipped with a warning.
function Get-ManifestPaths([string]$Base, [string]$Manifest) {
    if (-not (Test-Path -LiteralPath $Manifest -PathType Leaf) -or (Test-Link $Manifest)) { return @() }
    $valid = @()
    foreach ($line in @(Get-Content -LiteralPath $Manifest -Encoding UTF8)) {
        if (-not $line -or $line.StartsWith("#")) { continue }
        if (Test-ValidManifestPath $Base $line) { $valid += $line }
        else { Write-Warn "Ignoring invalid manifest entry: $line" }
    }
    return $valid
}

# Refuse to write through a linked directory: every directory the plugin
# installs into must be a real one (or not exist yet).
function Assert-NoLinkedDirs([string]$Base, [string[]]$Rels) {
    $dirs = @{}
    foreach ($rel in $Rels) {
        $parts = $rel.Split("/")
        $path = ""
        for ($i = 0; $i -lt $parts.Count - 1; $i++) {
            $path = if ($path) { "$path/$($parts[$i])" } else { $parts[$i] }
            $dirs[$path] = $true
        }
    }
    foreach ($dir in $dirs.Keys) {
        if (Test-Link (Join-Path $Base $dir)) {
            if ($DryRun) {
                Write-Warn "$(Join-Path $Base $dir) is a link; a real install would stop here."
            } else {
                Write-Err "$(Join-Path $Base $dir) is a link. The installer writes only into real directories; replace it with a directory and re-run."
            }
        }
    }
}

function Test-SameContent([string]$A, [string]$B) {
    if (-not (Test-Path -LiteralPath $B -PathType Leaf)) { return $false }
    return (Get-FileHash -LiteralPath $A).Hash -eq (Get-FileHash -LiteralPath $B).Hash
}

# Write the manifest: a header, then the given lines sorted and de-duplicated.
function Write-Manifest([string]$Manifest, [string[]]$Lines) {
    $all = @(
        "# Written by the ix-opencode-plugin installer. Paths are relative to the"
        "# directory that holds $PLUGIN_SUBDIR/. -Uninstall removes exactly these"
        "# (a directory only if it is empty)."
    ) + @($Lines | Where-Object { $_ } | Sort-Object -Unique)
    Invoke-Step "write $Manifest" {
        $tmp = "$Manifest.tmp"
        $all | Set-Content -LiteralPath $tmp -Encoding UTF8
        Move-Item -LiteralPath $tmp -Destination $Manifest -Force
    }
}

# Create Base/RelDir one level at a time. Each directory this creates is added
# to $script:Created and, unless this is a dry run, to the manifest at once,
# so a run that fails part-way still leaves a complete record.
function New-OwnedDir([string]$Base, [string]$RelDir, [string]$Manifest) {
    $path = ""
    foreach ($part in $RelDir.Split("/")) {
        if (-not $part -or $part -eq ".") { continue }
        $path = if ($path) { "$path/$part" } else { $part }
        $dir = Join-Path $Base $path
        if (-not (Test-Path -LiteralPath $dir -PathType Container)) {
            Invoke-Step "mkdir $dir" { New-Item -ItemType Directory -Path $dir | Out-Null }
            $script:Created += "$path/"
            if (-not $DryRun -and (Test-Path -LiteralPath $Manifest -PathType Leaf)) {
                Add-Content -LiteralPath $Manifest -Value "$path/" -Encoding UTF8
            }
        }
    }
}

# Install the plugin into an OpenCode directory, file by file.
#
# Without -Force, an existing file is replaced only when the manifest lists
# it, it sits in the plugin's own ix-opencode-plugin\ directory, or it already
# has the plugin's content. Any other file of the same name stops the install
# before anything is changed. -Force replaces those files too -- only those
# files. A directory is never removed, and nothing is written through a
# linked directory.
function Install-Into([string]$Base) {
    $manifest = Join-Path $Base $MANIFEST_REL
    $plan = @(Get-PluginFiles)
    if ($plan.Count -eq 0) { Write-Err "No plugin files found in $SourceDir" }
    $rels = @($plan | ForEach-Object { $_.Rel })

    Assert-NoLinkedDirs $Base $rels
    $owned = @(Get-ManifestPaths $Base $manifest)

    $conflicts = @()
    foreach ($f in $plan) {
        $dest = Join-Path $Base $f.Rel
        if (Test-Path -LiteralPath $dest -PathType Container) {
            Write-Err "$dest is a directory, where the plugin installs a file. Move it and re-run."
        }
        if ((Test-Path -LiteralPath $dest) -and -not $f.Rel.StartsWith("$PLUGIN_SUBDIR/") -and
            ($owned -notcontains $f.Rel) -and -not (Test-SameContent $f.Src $dest)) {
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

    # Record what this run is about to write before writing any of it.
    if (-not (Test-Path -LiteralPath $Base)) {
        Invoke-Step "mkdir $Base" { New-Item -ItemType Directory -Force -Path $Base | Out-Null }
    }
    $script:Created = @()
    New-OwnedDir $Base $PLUGIN_SUBDIR $manifest
    Write-Manifest $manifest (@($owned) + $rels + $script:Created)

    $written = 0
    foreach ($f in $plan) {
        $dest = Join-Path $Base $f.Rel
        New-OwnedDir $Base ($f.Rel.Substring(0, [Math]::Max(0, $f.Rel.LastIndexOf("/")))) $manifest
        if (Test-Link $dest) {
            # Copy-Item would write through the link; replace the link itself.
            Invoke-Step "Remove link $($f.Rel)" { Remove-Item -LiteralPath $dest -Force }
        } elseif (Test-SameContent $f.Src $dest) {
            continue
        }
        Invoke-Step "copy $($f.Rel)" { Copy-Item -LiteralPath $f.Src -Destination $dest -Force }
        $written++
    }

    # Files an earlier version installed that this one no longer ships.
    foreach ($old in $owned) {
        if ($old.EndsWith("/") -or ($rels -contains $old)) { continue }
        $oldPath = Join-Path $Base $old
        if ((Test-ValidManifestPath $Base $old) -and (Test-Path -LiteralPath $oldPath -PathType Leaf)) {
            Invoke-Step "Remove $old" { Remove-Item -LiteralPath $oldPath -Force }
            Write-Ok "Removed $old (no longer part of the plugin)"
        }
    }

    $dirs = @($owned | Where-Object { $_.EndsWith("/") }) + $script:Created
    Write-Manifest $manifest ($rels + $dirs)
    Write-Ok "$($plan.Count) plugin files in place ($written written)"
}

# Remove what the manifest lists: files, then the directories the install
# created, deepest first, each only if it is now empty.
function Uninstall-From([string]$Base) {
    $manifest = Join-Path $Base $MANIFEST_REL
    if (Test-Link (Join-Path $Base $PLUGIN_SUBDIR)) {
        # Its manifest could name anything; do not read it or remove through it.
        Write-Warn "$(Join-Path $Base $PLUGIN_SUBDIR) is a link -- nothing removed, manifest left in place. Remove the plugin's files by hand."
        return
    }
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
        Write-Warn "No install manifest at $manifest -- nothing to remove there."
        return
    }
    $paths = @(Get-ManifestPaths $Base $manifest)
    $n = 0
    # Each entry is checked again right before it is removed.
    foreach ($rel in $paths) {
        if ($rel.EndsWith("/") -or -not (Test-ValidManifestPath $Base $rel)) { continue }
        $file = Join-Path $Base $rel
        if (Test-Path -LiteralPath $file -PathType Leaf) {
            Invoke-Step "Remove $rel" { Remove-Item -LiteralPath $file -Force }
            $n++
        }
    }
    Invoke-Step "Remove $manifest" { Remove-Item -LiteralPath $manifest -Force }
    foreach ($rel in @($paths | Where-Object { $_.EndsWith("/") } | Sort-Object -Descending)) {
        if (-not (Test-ValidManifestPath $Base $rel)) { continue }
        $dir = Join-Path $Base $rel.TrimEnd("/")
        if (-not (Test-Path -LiteralPath $dir -PathType Container) -or (Test-Link $dir)) { continue }
        if (@(Get-ChildItem -LiteralPath $dir -Force).Count -eq 0) {
            Invoke-Step "Remove $rel" { Remove-Item -LiteralPath $dir -Force }
        } else {
            Write-Info "Kept $dir (not empty)"
        }
    }
    Write-Ok "Removed $n plugin files from $Base"
}

# Earlier releases copied the entry point to plugins\ix-plugin.ts, runtime\*.ts
# beside it and AGENTS.md into the OpenCode directory. Those are removed only
# when byte-identical to this version's files, and the runtime\ copies only
# together with the entry point: OpenCode loads every file in plugins\, so an
# old entry point left behind must keep the runtime files it imports.
function Remove-LegacyCopies([string]$Dir) {
    if ((Test-Link (Join-Path $Dir "plugins")) -or (Test-Link (Join-Path $Dir "runtime"))) { return }
    $runtime = @()
    $runtimeSrc = Join-Path $SourceDir "runtime"
    if (Test-Path -LiteralPath $runtimeSrc -PathType Container) {
        foreach ($f in @(Get-ChildItem -LiteralPath $runtimeSrc -File | Where-Object { -not $_.Name.StartsWith(".") })) {
            $runtime += @{ Src = $f.FullName; Rel = "runtime/$($f.Name)" }
        }
    }
    $kept = @()

    $agents = Join-Path $Dir $LEGACY_AGENTS
    if ((Test-Path -LiteralPath $agents -PathType Leaf) -and -not (Test-Link $agents)) {
        if (Test-SameContent (Join-Path $SourceDir "AGENTS.md") $agents) {
            Invoke-Step "Remove old copy $LEGACY_AGENTS" { Remove-Item -LiteralPath $agents -Force }
            Write-Ok "Removed old copy $LEGACY_AGENTS"
        } else {
            $kept += $agents
        }
    }

    $entry = Join-Path $Dir $LEGACY_ENTRY
    if ((Test-Path -LiteralPath $entry -PathType Leaf) -and -not (Test-Link $entry)) {
        if (Test-SameContent (Join-Path $SourceDir "plugins\ix-plugin.ts") $entry) {
            Invoke-Step "Remove old copy $LEGACY_ENTRY" { Remove-Item -LiteralPath $entry -Force }
            Write-Ok "Removed old copy $LEGACY_ENTRY"
            foreach ($r in $runtime) {
                $dest = Join-Path $Dir $r.Rel
                if (-not (Test-Path -LiteralPath $dest -PathType Leaf) -or (Test-Link $dest)) { continue }
                if (Test-SameContent $r.Src $dest) {
                    Invoke-Step "Remove old copy $($r.Rel)" { Remove-Item -LiteralPath $dest -Force }
                    Write-Ok "Removed old copy $($r.Rel)"
                } else {
                    $kept += $dest
                }
            }
        } else {
            Write-Warn "An earlier version of this plugin is still installed at $entry."
            Write-Info "OpenCode loads every file in $(Join-Path $Dir 'plugins'), so it runs beside this install."
            Write-Info "It differs from this version, so it and its runtime\ files were left in place."
            Write-Info "To remove the old version, delete:"
            Write-Info "  $entry"
            foreach ($r in $runtime) {
                $dest = Join-Path $Dir $r.Rel
                if (Test-Path -LiteralPath $dest -PathType Leaf) { Write-Info "  $dest" }
            }
        }
    }

    if ($kept.Count -gt 0) {
        Write-Warn "These files are where an earlier install put the plugin, but differ from this version:"
        foreach ($k in $kept) { Write-Info $k }
        Write-Info "If they are old plugin copies, delete them by hand."
    }
}

# The file a path finally names, following symbolic links.
function Resolve-LinkTarget([string]$Path) {
    for ($hop = 0; $hop -lt 32; $hop++) {
        $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
        if (-not $item -or -not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { return $Path }
        $target = @($item.Target)[0]
        if (-not $target) { return $Path }
        if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path (Split-Path $Path -Parent) $target }
        $Path = $target
    }
    return $Path
}

# Write a file through a temp file beside it, so a failed write never leaves
# it half-written.
function Set-ContentAtomic([string]$Path, [string]$Text) {
    # Write to the file a linked opencode.json points at, not over the link.
    $Path = Resolve-LinkTarget $Path
    $tmp = Join-Path (Split-Path $Path -Parent) (".opencode.json." + [Guid]::NewGuid().ToString("N"))
    try {
        Set-Content -LiteralPath $tmp -Value $Text -Encoding UTF8
        Move-Item -LiteralPath $tmp -Destination $Path -Force
    } finally {
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    }
}

# Add (or with -Action remove, take out) the plugin's opencode.json entries.
# Entries in -Drop are taken out of both lists: the places earlier releases
# registered. Only keys that hold a list are changed; everything else in the
# file is kept.
function Update-OpencodeJson {
    param([string]$Path, [string]$Action, [string]$PluginEntry, [string]$AgentsEntry, [string[]]$Drop = @())

    if (-not (Test-Path -LiteralPath $Path)) {
        if ($Action -ne "add") { return }
        $json = [ordered]@{
            '$schema'    = "https://opencode.ai/config.json"
            plugin       = @($PluginEntry)
            instructions = @($AgentsEntry)
        }
        Invoke-Step "Create $Path" { Set-ContentAtomic $Path ($json | ConvertTo-Json -Depth 5) }
        Write-Ok "Created $Path"
        return
    }

    $problem = $null
    try {
        # -InputObject, not the pipeline: a top-level array must stay one value.
        $cfg = ConvertFrom-Json -InputObject (Get-Content -LiteralPath $Path -Raw -Encoding UTF8)
        if ($null -eq $cfg -or $cfg -isnot [System.Management.Automation.PSCustomObject]) {
            $problem = "$Path does not hold a JSON object"
        }
    } catch {
        $problem = "Could not read $Path as JSON"
    }
    if ($problem) {
        if ($Action -eq "add") {
            Write-Warn "$problem -- edit it by hand:"
            Write-Info "  add `"$PluginEntry`" to `"plugin`" and `"$AgentsEntry`" to `"instructions`""
            if ($Drop.Count -gt 0) { Write-Info "  remove any of: $($Drop -join ', ')" }
        } else {
            Write-Warn "$problem -- remove `"$PluginEntry`" and `"$AgentsEntry`" by hand"
        }
        return
    }

    $before = $cfg | ConvertTo-Json -Depth 20 -Compress
    $updated = [ordered]@{}
    foreach ($prop in $cfg.PSObject.Properties) { $updated[$prop.Name] = $prop.Value }
    $skipped = @()
    foreach ($key in @("plugin", "instructions")) {
        $entry = if ($key -eq "plugin") { $PluginEntry } else { $AgentsEntry }
        if (-not $updated.Contains($key)) {
            if ($Action -eq "add") { $updated[$key] = @($entry) }
            continue
        }
        if ($updated[$key] -isnot [array]) { $skipped += $key; continue }
        $values = @(@($updated[$key]) | Where-Object {
            $_ -and ($Drop -notcontains $_) -and ($Action -eq "add" -or $_ -ne $entry)
        })
        if ($Action -eq "add" -and $values -notcontains $entry) { $values += $entry }
        $updated[$key] = $values
    }
    if (([pscustomobject]$updated | ConvertTo-Json -Depth 20 -Compress) -ne $before) {
        Invoke-Step "Update $Path" { Set-ContentAtomic $Path ($updated | ConvertTo-Json -Depth 20) }
        Write-Ok "Updated $Path"
    } else {
        Write-Ok "$Path already up to date"
    }
    if ($skipped.Count -gt 0) {
        Write-Warn "`"$($skipped -join '" and "')`" in $Path is not a list, so it was left alone -- edit it by hand."
    }
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
    Remove-LegacyCopies $OpencodeDir
    Uninstall-From $OpencodeDir
    $drop = @("$EntryPrefix$LEGACY_ENTRY")
    if (-not (Test-Path -LiteralPath (Join-Path $OpencodeDir $LEGACY_AGENTS))) {
        $drop += "$EntryPrefix$LEGACY_AGENTS"
    }
    Update-OpencodeJson $ConfigFile "remove" "$EntryPrefix$PLUGIN_ENTRY" "$EntryPrefix$AGENTS_ENTRY" $drop
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
Remove-LegacyCopies $OpencodeDir

# Earlier releases registered <dir>/plugins/ix-plugin.ts and <dir>/AGENTS.md.
# Drop the first; drop the second only once no file is there any more.
# opencode.json paths use forward slashes (OpenCode requires this).
$drop = @("$EntryPrefix$LEGACY_ENTRY")
if (-not (Test-Path -LiteralPath (Join-Path $OpencodeDir $LEGACY_AGENTS))) {
    $drop += "$EntryPrefix$LEGACY_AGENTS"
}
Update-OpencodeJson $ConfigFile "add" "$EntryPrefix$PLUGIN_ENTRY" "$EntryPrefix$AGENTS_ENTRY" $drop

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host
Write-Host "Done. Verify in OpenCode:" -ForegroundColor White
Write-Host
Write-Host "  Use the ix-health tool"
Write-Host
Write-Host "If the graph isn't built yet:"
Write-Host "  ix map"
Write-Host
