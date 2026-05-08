#!/usr/bin/env bash
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
  --force               Overwrite existing symlinks and config entries
  --dry-run             Print what would happen without making changes
  --uninstall           Remove the plugin from the target location
  --help                Show this message

EXAMPLES
  # Global install (recommended)
  curl -fsSL https://raw.githubusercontent.com/ix-infrastructure/ix-opencode-plugin/main/install.sh | bash

  # Force re-install
  curl -fsSL ... | bash -s -- --force

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

link_or_warn() {
  local src="$1" dest="$2" label="$3"
  if [[ -L "$dest" ]]; then
    if $FORCE; then
      run rm "$dest"
    else
      fmt_warn "$label already linked — use --force to re-link"
      return
    fi
  elif [[ -e "$dest" ]]; then
    if $FORCE; then
      run rm -rf "$dest"
    else
      fmt_warn "$label already exists (not a symlink) — use --force to overwrite"
      return
    fi
  fi
  run ln -s "$src" "$dest"
  fmt_ok "Linked $label"
}

copy_or_warn() {
  local src="$1" dest="$2" label="$3"
  if [[ -e "$dest" ]]; then
    if $FORCE; then
      run rm -rf "$dest"
    else
      fmt_warn "$label already exists — use --force to overwrite"
      return
    fi
  fi
  run cp -r "$src" "$dest"
  fmt_ok "Copied $label"
}

merge_opencode_json() {
  local path="$1" plugin_entry="$2" agents_entry="$3"

  if [[ ! -f "$path" ]]; then
    write_file "$path" '{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["'"$plugin_entry"'"],
  "instructions": ["'"$agents_entry"'"]
}'
    fmt_ok "Created $(basename "$path")"
    return
  fi

  if grep -qF "$plugin_entry" "$path" && ! $FORCE; then
    fmt_warn "Plugin already registered in $(basename "$path") — use --force to re-add"
    return
  fi

  if command -v python3 &>/dev/null; then
    if $DRY_RUN; then
      fmt_info "[dry-run] merge plugin/instructions entries into $path"
    else
      python3 - "$path" "$plugin_entry" "$agents_entry" <<'PYEOF'
import sys, json
path, plugin_entry, agents_entry = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as f:
  cfg = json.load(f)
plugins = cfg.get("plugin", [])
if plugin_entry not in plugins:
  plugins.append(plugin_entry)
cfg["plugin"] = plugins
instructions = cfg.get("instructions", [])
if agents_entry not in instructions:
  instructions.append(agents_entry)
cfg["instructions"] = instructions
with open(path, "w") as f:
  json.dump(cfg, f, indent=2)
  f.write("\n")
PYEOF
      fmt_ok "Updated $(basename "$path")"
    fi
  else
    fmt_warn "python3 not found — add these lines to $path manually:"
    fmt_info "  \"plugin\": [\"$plugin_entry\"]"
    fmt_info "  \"instructions\": [\"$agents_entry\"]"
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
check_cmd "ix CLI"   "ix"       "install from https://github.com/ix-infrastructure/IX-Memory"
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
else
  fmt_info "Not found at $SOURCE_DIR — cloning from GitHub..."
  if ! command -v git &>/dev/null; then
    fmt_err "git not found. Clone manually: git clone $REPO_URL $SOURCE_DIR"
  fi
  run git clone --depth 1 "$REPO_URL" "$SOURCE_DIR"
  fmt_ok "Cloned to $SOURCE_DIR"
fi

# ── Install dependencies ──────────────────────────────────────────────────────

fmt_step "Installing dependencies"
run bash -c "cd '$SOURCE_DIR' && bun install --silent"
fmt_ok "@opencode-ai/plugin ready"

# ── Uninstall ─────────────────────────────────────────────────────────────────

if $UNINSTALL; then
  fmt_step "Uninstalling"
  if [[ "$INSTALL_MODE" == "global" ]]; then
    for item in plugins commands agents runtime AGENTS.md; do
      local_dest="$GLOBAL_CONFIG_DIR/$item"
      if [[ -L "$local_dest" ]]; then
        run rm "$local_dest"
        fmt_ok "Removed $item"
      fi
    done
    fmt_warn "opencode.json not modified — remove plugin/instructions entries manually if needed"
  else
    run rm -rf "$PROJECT_DIR/.opencode"
    fmt_ok "Removed .opencode/"
    fmt_warn "opencode.json not modified — remove plugin/instructions entries manually if needed"
  fi
  echo
  fmt_ok "Uninstall complete"
  exit 0
fi

# ── Install: global ───────────────────────────────────────────────────────────

if [[ "$INSTALL_MODE" == "global" ]]; then
  fmt_step "Installing globally → $GLOBAL_CONFIG_DIR"
  run mkdir -p "$GLOBAL_CONFIG_DIR"

  for item in plugins commands agents runtime AGENTS.md; do
    link_or_warn "$SOURCE_DIR/$item" "$GLOBAL_CONFIG_DIR/$item" "$item"
  done

  merge_opencode_json "$GLOBAL_CONFIG_DIR/opencode.json" \
    "./plugins/ix-plugin.ts" \
    "./AGENTS.md"

# ── Install: per-project ──────────────────────────────────────────────────────

else
  fmt_step "Installing into project → $PROJECT_DIR/.opencode"
  run mkdir -p "$PROJECT_DIR/.opencode"

  for item in plugins commands agents runtime AGENTS.md; do
    copy_or_warn "$SOURCE_DIR/$item" "$PROJECT_DIR/.opencode/$item" "$item"
  done

  merge_opencode_json "$PROJECT_DIR/opencode.json" \
    ".opencode/plugins/ix-plugin.ts" \
    ".opencode/AGENTS.md"
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
