#!/usr/bin/env bash
# Copyright 2026 Ix Infrastructure Inc.

# install.sh — ix-opencode-plugin installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ix-infrastructure/ix-opencode-plugin/main/install.sh | bash
#   curl -fsSL ... | bash -s -- --project /path/to/project
#   ./install.sh --force
#   ./install.sh --uninstall

set -euo pipefail

REPO_URL="https://github.com/ix-infrastructure/ix-opencode-plugin.git"
DEFAULT_SOURCE_DIR="${HOME}/.local/share/ix-opencode-plugin"
GLOBAL_CONFIG_DIR="${HOME}/.config/opencode"

# Everything the plugin needs to load, as "<path in the plugin repo>:<path under
# the OpenCode config directory>". A directory stands for every file in it.
# Global mode links each file and --project copies it; both read this one list.
# install.ps1 carries the same list, and tests/install.test.ts checks the two
# match and cover every module the entry point imports.
#
# The TypeScript lives under one ix-opencode-plugin/ directory, not in
# plugins/ and tools/ at the top level: OpenCode loads every file in those two
# as a standalone plugin or tool, and tools/*.ts here are modules of the one
# plugin. The entry imports them as ../tools/*, so they stay side by side.
# commands/ and agents/ are where OpenCode looks for them; the plugin adds its
# own files there and leaves every other file alone.
PLUGIN_SUBDIR="ix-opencode-plugin"
PLUGIN_ENTRY="$PLUGIN_SUBDIR/plugins/ix-plugin.ts"
AGENTS_ENTRY="$PLUGIN_SUBDIR/AGENTS.md"
INSTALL_ITEMS=(
  "plugins:ix-opencode-plugin/plugins"
  "tools:ix-opencode-plugin/tools"
  "runtime:ix-opencode-plugin/runtime"
  "AGENTS.md:ix-opencode-plugin/AGENTS.md"
  "commands:commands"
  "agents:agents"
)

# Every path an install creates, one per line, relative to the OpenCode
# directory; directories end in "/". Uninstall removes exactly these, and an
# install overwrites without --force only these (and anything else under
# ix-opencode-plugin/, which is the plugin's own directory).
MANIFEST_REL="$PLUGIN_SUBDIR/install-manifest.txt"

# Where earlier releases put the entry point and AGENTS.md (relative to the
# OpenCode directory). An install removes their opencode.json entries.
LEGACY_ENTRY="plugins/ix-plugin.ts"
LEGACY_AGENTS="AGENTS.md"

# ── Flags ─────────────────────────────────────────────────────────────────────

INSTALL_MODE="global"
PROJECT_DIR="$(pwd)"
DRY_RUN=false
FORCE=false
UNINSTALL=false
SOURCE_DIR=""

usage() {
  cat <<EOF

ix-opencode-plugin installer

USAGE
  curl -fsSL https://raw.githubusercontent.com/ix-infrastructure/ix-opencode-plugin/main/install.sh | bash [-- OPTIONS]
  ./install.sh [OPTIONS]

OPTIONS
  --global              Install globally into ~/.config/opencode/  (default)
  --project [dir]       Install into .opencode/ in [dir]           (default: current directory)
  --source <path>       Use a local plugin clone instead of downloading
  --force               Also replace files of the same name that the plugin did
                        not install (only those files; nothing else is touched)
  --dry-run             Print what would happen without making changes
  --uninstall           Remove the plugin from the target location
  --help                Show this message

EXAMPLES
  # Global install (recommended)
  curl -fsSL https://raw.githubusercontent.com/ix-infrastructure/ix-opencode-plugin/main/install.sh | bash

  # Update an existing install (re-running is enough)
  curl -fsSL https://raw.githubusercontent.com/ix-infrastructure/ix-opencode-plugin/main/install.sh | bash

  # Per-project install in current directory
  curl -fsSL ... | bash -s -- --project

  # Per-project install in a specific directory
  curl -fsSL ... | bash -s -- --project /path/to/myproject

  # Use an existing local clone (skips git clone)
  ./install.sh --source /path/to/ix-opencode-plugin

  # Preview without making changes
  ./install.sh --dry-run

  # Uninstall global install
  ./install.sh --uninstall

EOF
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --global)    INSTALL_MODE="global"; shift ;;
    --project)
      INSTALL_MODE="project"
      if [[ $# -gt 1 && ! "${2:-}" =~ ^-- ]]; then
        PROJECT_DIR="$(cd "$2" && pwd)"; shift
      fi
      shift ;;
    --source)    SOURCE_DIR="$(cd "$2" && pwd)"; shift 2 ;;
    --force)     FORCE=true; shift ;;
    --dry-run)   DRY_RUN=true; shift ;;
    --uninstall) UNINSTALL=true; shift ;;
    --help|-h)   usage; exit 0 ;;
    *)           echo "Unknown flag: $1"; usage; exit 1 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────

fmt_ok()   { echo "  ✓ $*"; }
fmt_warn() { echo "  ⚠ $*"; }
fmt_info() { echo "    $*"; }
fmt_err()  { echo "  ✗ $*" >&2; exit 1; }
fmt_step() { echo; echo "→ $*"; }

run() {
  if $DRY_RUN; then
    echo "    [dry-run] $*"
  else
    "$@"
  fi
}

write_file() {
  local path="$1" content="$2"
  if $DRY_RUN; then
    echo "    [dry-run] write $path"
  else
    echo "$content" > "$path"
  fi
}

# The plugin's own files, as "<source file><TAB><path under the OpenCode dir>".
plan_files() {
  local entry src dest f
  for entry in "${INSTALL_ITEMS[@]}"; do
    src="${entry%%:*}"
    dest="${entry#*:}"
    if [[ -d "$SOURCE_DIR/$src" ]]; then
      (cd "$SOURCE_DIR/$src" && find . -type f ! -name '.*' | LC_ALL=C sort) |
        while IFS= read -r f; do
          f="${f#./}"
          printf '%s\t%s\n' "$SOURCE_DIR/$src/$f" "$dest/$f"
        done
    else
      printf '%s\t%s\n' "$SOURCE_DIR/$src" "$dest"
    fi
  done
}

# Paths listed in a manifest file (comments dropped).
manifest_paths() {
  if [[ -f "$1" ]]; then
    grep -v '^#' "$1" | grep -v '^$' || true
  fi
}

# True when <rel> belongs to the plugin: listed in the manifest, or inside the
# plugin's own ix-opencode-plugin/ directory.
is_owned() {
  local rel="$1" manifest="$2"
  [[ "$rel" == "$PLUGIN_SUBDIR/"* ]] && return 0
  [[ -f "$manifest" ]] && grep -Fxq -- "$rel" "$manifest"
}

# True when <dest> already is what an install would put there.
is_current() {
  local src="$1" dest="$2"
  if [[ "$INSTALL_MODE" == "global" ]]; then
    [[ -L "$dest" && "$(readlink "$dest")" == "$src" ]]
  else
    [[ -f "$dest" && ! -L "$dest" ]] && cmp -s "$src" "$dest"
  fi
}

# Create <base>/<reldir> one level at a time, appending each directory this
# call creates to CREATED_DIRS (as "<rel>/").
ensure_dir() {
  local base="$1" reldir="$2" part path=""
  local -a parts
  IFS=/ read -r -a parts <<< "$reldir"
  for part in "${parts[@]}"; do
    [[ -n "$part" ]] || continue
    path="${path:+$path/}$part"
    if [[ ! -d "$base/$path" ]]; then
      run mkdir "$base/$path"
      CREATED_DIRS="$CREATED_DIRS$path/"$'\n'
    fi
  done
}

# Install the plugin into an OpenCode directory, file by file.
#
# Without --force, an existing file is replaced only when the plugin owns it
# (see is_owned) or it already has the plugin's content. Any other file of the
# same name stops the install before anything is changed. --force replaces
# those files too -- only those files. A directory is never removed.
install_into() {
  local base="$1" manifest="$1/$MANIFEST_REL"
  local plan dests src rel dest conflicts="" n=0 replaced=0 rel_old new_manifest
  CREATED_DIRS=""

  plan="$(plan_files)"
  [[ -n "$plan" ]] || fmt_err "No plugin files found in $SOURCE_DIR"
  dests="$(printf '%s\n' "$plan" | cut -f2)"

  while IFS=$'\t' read -r src rel; do
    dest="$base/$rel"
    if [[ -d "$dest" && ! -L "$dest" ]]; then
      fmt_err "$dest is a directory, where the plugin installs a file. Move it and re-run."
    fi
    if [[ -e "$dest" || -L "$dest" ]] && ! is_owned "$rel" "$manifest" \
        && ! cmp -s "$src" "$dest" 2>/dev/null; then
      conflicts="$conflicts$rel"$'\n'
    fi
  done <<< "$plan"

  if [[ -n "$conflicts" ]]; then
    if $FORCE; then
      fmt_warn "--force: replacing these files, which the plugin did not install:"
      printf '%s' "$conflicts" | while IFS= read -r rel; do fmt_info "$base/$rel"; done
    else
      fmt_warn "These files exist and were not installed by this plugin:"
      printf '%s' "$conflicts" | while IFS= read -r rel; do fmt_info "$base/$rel"; done
      fmt_err "Nothing changed. Move them, or re-run with --force to replace exactly these files."
    fi
  fi

  run mkdir -p "$base"
  while IFS=$'\t' read -r src rel; do
    dest="$base/$rel"
    ensure_dir "$base" "$(dirname "$rel")"
    if [[ -e "$dest" || -L "$dest" ]]; then
      if is_current "$src" "$dest"; then
        continue
      fi
      run rm -f "$dest"
      replaced=$((replaced + 1))
    fi
    if [[ "$INSTALL_MODE" == "global" ]]; then
      run ln -s "$src" "$dest"
    else
      run cp "$src" "$dest"
    fi
    n=$((n + 1))
  done <<< "$plan"

  # Files an earlier version installed that this one no longer ships.
  while IFS= read -r rel_old; do
    [[ -n "$rel_old" && "$rel_old" != */ ]] || continue
    if ! grep -Fxq -- "$rel_old" <<< "$dests"; then
      if [[ -L "$base/$rel_old" || -f "$base/$rel_old" ]]; then
        run rm -f "$base/$rel_old"
        fmt_ok "Removed $rel_old (no longer part of the plugin)"
      fi
    fi
  done <<< "$(manifest_paths "$manifest")"

  new_manifest="$(
    {
      printf '%s\n' "$dests"
      manifest_paths "$manifest" | grep '/$' || true
      printf '%s' "$CREATED_DIRS"
    } | grep -v '^$' | LC_ALL=C sort -u
  )"
  if $DRY_RUN; then
    echo "    [dry-run] write $manifest"
  else
    {
      echo "# Written by the ix-opencode-plugin installer. Paths are relative to the"
      echo "# directory that holds $PLUGIN_SUBDIR/. --uninstall removes exactly these"
      echo "# (a directory only if it is empty)."
      printf '%s\n' "$new_manifest"
    } > "$manifest"
  fi

  fmt_ok "$(grep -c . <<< "$dests") plugin files in place ($n written, $replaced replaced)"
}

# Remove what the manifest lists: files and links, then the directories the
# install created, deepest first, each only if it is now empty.
uninstall_from() {
  local base="$1" manifest="$1/$MANIFEST_REL" paths rel n=0
  if [[ ! -f "$manifest" ]]; then
    fmt_warn "No install manifest at $manifest -- nothing to remove there."
    return
  fi
  paths="$(manifest_paths "$manifest")"
  while IFS= read -r rel; do
    [[ -n "$rel" && "$rel" != */ ]] || continue
    if [[ -L "$base/$rel" || -f "$base/$rel" ]]; then
      run rm -f "$base/$rel"
      n=$((n + 1))
    fi
  done <<< "$paths"
  run rm -f "$manifest"
  while IFS= read -r rel; do
    [[ -n "$rel" ]] || continue
    if [[ -d "$base/$rel" ]]; then
      run rmdir "$base/$rel" 2>/dev/null || fmt_info "Kept $base/$rel (not empty)"
    fi
  done <<< "$(printf '%s\n' "$paths" | grep '/$' | LC_ALL=C sort -r)"
  fmt_ok "Removed $n plugin files from $base"
}

# Earlier releases linked whole directories and AGENTS.md into the global
# config (plugins -> <clone>/plugins, and so on). Remove only those links:
# symlinks whose target sits in a clone of this plugin.
remove_legacy_links() {
  local item dest target
  for item in plugins runtime commands agents AGENTS.md \
      "$PLUGIN_SUBDIR/plugins" "$PLUGIN_SUBDIR/tools" "$PLUGIN_SUBDIR/runtime"; do
    dest="$GLOBAL_CONFIG_DIR/$item"
    [[ -L "$dest" ]] || continue
    target="$(readlink "$dest")"
    if [[ -f "$(dirname "$target")/plugins/ix-plugin.ts" ]]; then
      run rm "$dest"
      fmt_ok "Removed old link $item"
    fi
  done
}

# Add (or with "remove", take out) the plugin's opencode.json entries.
# Entries after the first four arguments are dropped from both lists: the
# places earlier releases registered. Everything else in the file is kept.
update_opencode_json() {
  local path="$1" action="$2" plugin_entry="$3" agents_entry="$4"
  shift 4

  if [[ ! -f "$path" ]]; then
    [[ "$action" == "add" ]] || return 0
    write_file "$path" '{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["'"$plugin_entry"'"],
  "instructions": ["'"$agents_entry"'"]
}'
    fmt_ok "Created $path"
    return
  fi

  local status=0 result
  if command -v python3 &>/dev/null; then
    result="$(DRY_RUN="$DRY_RUN" python3 - "$path" "$action" "$plugin_entry" "$agents_entry" "$@" <<'PYEOF'
import json, os, sys
path, action, plugin_entry, agents_entry, *drop = sys.argv[1:]
try:
  with open(path) as f:
    cfg = json.load(f)
except (OSError, ValueError) as e:
  print(f"could not read {path} as JSON ({e})")
  sys.exit(3)
before = json.dumps(cfg, sort_keys=True)
for key, entry in (("plugin", plugin_entry), ("instructions", agents_entry)):
  if key not in cfg and action != "add":
    continue
  values = [v for v in cfg.get(key, []) if v not in drop and (action == "add" or v != entry)]
  if action == "add" and entry not in values:
    values.append(entry)
  cfg[key] = values
if json.dumps(cfg, sort_keys=True) == before:
  print("unchanged")
  sys.exit(0)
if os.environ.get("DRY_RUN") != "true":
  with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
print("updated")
PYEOF
)" || status=$?
  else
    result="python3 not found"
    status=3
  fi

  if [[ $status -eq 0 ]]; then
    if [[ "$result" == "updated" ]]; then
      if $DRY_RUN; then fmt_info "[dry-run] update $path"; else fmt_ok "Updated $path"; fi
    else
      fmt_ok "$path already up to date"
    fi
  elif [[ "$action" == "add" ]]; then
    fmt_warn "$result -- edit $path by hand:"
    fmt_info "  add \"$plugin_entry\" to \"plugin\" and \"$agents_entry\" to \"instructions\""
    [[ $# -eq 0 ]] || fmt_info "  remove any of: $*"
  else
    fmt_warn "$result -- remove \"$plugin_entry\" and \"$agents_entry\" from $path by hand"
  fi
}

# ── Banner ────────────────────────────────────────────────────────────────────

echo
echo "ix-opencode-plugin"
if $DRY_RUN; then echo "  (dry run — no changes will be made)"; fi
echo

# ── Prerequisites ─────────────────────────────────────────────────────────────

fmt_step "Checking prerequisites"

check_cmd() {
  local name="$1" cmd="$2" hint="$3"
  if command -v "$cmd" &>/dev/null; then
    fmt_ok "$name"
  else
    fmt_err "$name not found — $hint"
  fi
}

check_cmd "OpenCode" "opencode" "install from https://opencode.ai"
check_cmd "ix CLI"   "ix"       "install from https://github.com/ix-infrastructure/Ix"
check_cmd "Bun"      "bun"      "install from https://bun.sh"

# ── Resolve source directory ──────────────────────────────────────────────────

if [[ -z "$SOURCE_DIR" ]]; then
  # Check if running from a local clone (./install.sh)
  if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
    CANDIDATE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "$CANDIDATE/plugins/ix-plugin.ts" ]]; then
      SOURCE_DIR="$CANDIDATE"
    fi
  fi
  # Fall back to default location (curl install or already cloned)
  if [[ -z "$SOURCE_DIR" ]]; then
    SOURCE_DIR="$DEFAULT_SOURCE_DIR"
  fi
fi

fmt_step "Plugin source"

if [[ -f "$SOURCE_DIR/plugins/ix-plugin.ts" ]]; then
  fmt_ok "Found at $SOURCE_DIR"
  # Update the installer's own clone so curl re-installs stay current. Any other
  # clone (--source, or ./install.sh from a checkout) is used as it is: it may
  # hold someone's work.
  if [[ "$SOURCE_DIR" == "$DEFAULT_SOURCE_DIR" && -d "$SOURCE_DIR/.git" ]] && command -v git &>/dev/null; then
    run git -C "$SOURCE_DIR" fetch --depth 1 origin --quiet < /dev/null || true
    run git -C "$SOURCE_DIR" reset --hard origin/HEAD --quiet < /dev/null || true
    fmt_ok "Updated to latest"
  fi
else
  fmt_info "Not found at $SOURCE_DIR — cloning from GitHub..."
  if ! command -v git &>/dev/null; then
    fmt_err "git not found. Clone manually: git clone $REPO_URL $SOURCE_DIR"
  fi
  run git clone --depth 1 "$REPO_URL" "$SOURCE_DIR" < /dev/null
  fmt_ok "Cloned to $SOURCE_DIR"
fi

# ── Install dependencies ──────────────────────────────────────────────────────

# node_modules is not committed: this step is what provides @opencode-ai/plugin
# for the linked plugin. --production skips the dev toolchain (typescript,
# bun-types), which only the repo's own CI and contributors need.
fmt_step "Installing dependencies"
# shellcheck disable=SC2016 # $1 expands in the child shell
run bash -c 'cd "$1" && bun install --production --silent' bun-install "$SOURCE_DIR" < /dev/null
fmt_ok "@opencode-ai/plugin ready"

# ── Uninstall ─────────────────────────────────────────────────────────────────

if [[ "$INSTALL_MODE" == "global" ]]; then
  OPENCODE_DIR="$GLOBAL_CONFIG_DIR"
  CONFIG_FILE="$GLOBAL_CONFIG_DIR/opencode.json"
  ENTRY_PREFIX="./"
else
  OPENCODE_DIR="$PROJECT_DIR/.opencode"
  CONFIG_FILE="$PROJECT_DIR/opencode.json"
  ENTRY_PREFIX=".opencode/"
fi

if $UNINSTALL; then
  fmt_step "Uninstalling from $OPENCODE_DIR"
  if [[ "$INSTALL_MODE" == "global" ]]; then
    remove_legacy_links
  fi
  uninstall_from "$OPENCODE_DIR"
  update_opencode_json "$CONFIG_FILE" remove \
    "$ENTRY_PREFIX$PLUGIN_ENTRY" "$ENTRY_PREFIX$AGENTS_ENTRY" "$ENTRY_PREFIX$LEGACY_ENTRY"
  echo
  fmt_ok "Uninstall complete"
  exit 0
fi

# ── Install ───────────────────────────────────────────────────────────────────

if [[ "$INSTALL_MODE" == "global" ]]; then
  fmt_step "Installing globally → $OPENCODE_DIR"
  remove_legacy_links
else
  fmt_step "Installing into project → $OPENCODE_DIR"
fi

install_into "$OPENCODE_DIR"

# Earlier releases registered <dir>/plugins/ix-plugin.ts and <dir>/AGENTS.md.
# Drop the first; drop the second only once no file is there any more.
DROP=("$ENTRY_PREFIX$LEGACY_ENTRY")
if [[ ! -e "$OPENCODE_DIR/$LEGACY_AGENTS" ]]; then
  DROP+=("$ENTRY_PREFIX$LEGACY_AGENTS")
fi
update_opencode_json "$CONFIG_FILE" add \
  "$ENTRY_PREFIX$PLUGIN_ENTRY" "$ENTRY_PREFIX$AGENTS_ENTRY" "${DROP[@]}"

# Earlier --project installs copied the entry point to .opencode/plugins/, the
# runtime to .opencode/runtime/ and AGENTS.md to .opencode/AGENTS.md. Those
# copies cannot be told apart from the project's own files, so they stay.
if [[ "$INSTALL_MODE" == "project" && -f "$OPENCODE_DIR/$LEGACY_ENTRY" ]]; then
  fmt_warn "An earlier install left .opencode/$LEGACY_ENTRY, .opencode/runtime/ and .opencode/$LEGACY_AGENTS."
  fmt_info "OpenCode loads every file in .opencode/plugins/; delete those copies by hand."
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo
echo "Done. Verify in OpenCode:"
echo
echo "  Use the ix-health tool"
echo
echo "If the graph isn't built yet:"
echo "  ix map"
echo
