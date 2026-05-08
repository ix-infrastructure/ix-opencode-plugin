# ix-opencode-plugin

An OpenCode plugin that brings [Ix Memory](https://github.com/ix-infrastructure/Ix)'s graph-first reasoning into OpenCode as a native cognitive layer.

OpenCode + Ix = reasoning engine + persistent code knowledge graph. Skills are cognitive abstractions — not CLI wrappers — that start with cheap graph signals before reading source, and stop early when the question is answered.

## Requirements

- [OpenCode](https://opencode.ai) installed
- [Ix Memory](https://github.com/ix-infrastructure/IX-Memory) CLI (`ix`) installed and connected to a workspace
- [Bun](https://bun.sh) installed — **required** (all tools use Bun's `$` shell API; Node.js is not supported)

## Installation

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/ix-infrastructure/ix-opencode-plugin/main/install.sh | bash
```

Installs globally into `~/.config/opencode/` — active in every OpenCode session automatically.

**Flags:**

```bash
# Per-project install (copies into .opencode/ in current directory)
curl -fsSL ... | bash -s -- --project

# Per-project install in a specific directory
curl -fsSL ... | bash -s -- --project /path/to/myproject

# Force re-install (overwrites existing symlinks and config)
curl -fsSL ... | bash -s -- --force

# Preview what would happen without making changes
curl -fsSL ... | bash -s -- --dry-run

# Uninstall
curl -fsSL ... | bash -s -- --uninstall

# Use an existing local clone instead of downloading
./install.sh --source /path/to/ix-opencode-plugin
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/ix-infrastructure/ix-opencode-plugin/main/install.ps1 | iex
```

Installs globally into `%APPDATA%\opencode\` — active in every OpenCode session automatically.

**Flags:**

```powershell
# Per-project install in current directory
.\install.ps1 -Project

# Per-project install in a specific directory
.\install.ps1 -Project C:\path\to\myproject

# Force re-install
.\install.ps1 -Force

# Preview without making changes
.\install.ps1 -DryRun

# Uninstall
.\install.ps1 -Uninstall

# Use an existing local clone
.\install.ps1 -Source C:\path\to\ix-opencode-plugin
```

> **Note:** If you see a script execution policy error, run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` first.

### Windows (WSL)

Use the macOS/Linux install command above inside your WSL terminal.

### Verify

Open OpenCode and run:

```
Use the ix-health tool
```

Expected output: `Status: OK · CLI: ix x.x.x installed · Graph: indexed`

If the graph isn't built yet, run `ix map` first.

See [QUICKSTART.md](./QUICKSTART.md) for full setup details.

## Skills

Eight slash commands with phased reasoning — graph first, source reads only when needed.

| Command | What it does |
|---------|-------------|
| `/ix-understand [target]` | Build a mental model of a system or the whole repo |
| `/ix-investigate <symbol>` | Deep dive: role, connections, execution path |
| `/ix-impact <target>` | Change risk: blast radius, affected systems, test targets |
| `/ix-plan <targets...>` | Risk-ordered implementation plan |
| `/ix-debug <symptom>` | Root cause analysis from symptom to candidates |
| `/ix-architecture [scope]` | Design health: coupling, smells, hotspots |
| `/ix-docs <target> [--full]` | Generate narrative-first system documentation |
| `/ix-help [question]` | Route to the right skill or tool |

## Agents

| Agent | Purpose |
|-------|---------|
| `ix-explorer` | General-purpose graph exploration, open-ended questions |
| `ix-system-explorer` | Full architectural model of a codebase or region |
| `ix-bug-investigator` | Autonomous investigation from symptom to root cause candidates |
| `ix-safe-refactor-planner` | Blast radius + safe change sequencing for refactors |
| `ix-architecture-auditor` | Full structural health report with ranked improvements |

## Tools

17 TypeScript tools OpenCode can call during any task.

| Tool | Purpose |
|------|---------|
| `ix-query` | Graph entity lookup by name (locate + explain) |
| `ix-neighbors` | Callers, callees, imports, depends traversal |
| `ix-impact` | Blast radius and risk verdict |
| `ix-map` | Architectural overview with subsystem table |
| `ix-ingest` | Graph status and refresh trigger |
| `ix-history` | Revision, decisions, bugs (Ix Pro) |
| `ix-docs-tool` | Condensed context summary for injection |
| `ix-locate` | Text/pattern search across the codebase |
| `ix-explain` | Full symbol explanation with role and importance |
| `ix-rank` | Top symbols by dependents, callers, or members |
| `ix-stats` | Graph-wide statistics and health |
| `ix-subsystems` | Subsystem listing with hierarchy and signals |
| `ix-inventory` | Enumerate files or symbols in a path scope |
| `ix-trace` | Full execution path trace (upstream + downstream) |
| `ix-decide` | Pre-edit policy verdict (ALLOW / REVIEW / BLOCK) |
| `ix-health` | CLI and graph availability check |
| `ix-smells` | Architecture smell detection |

All tools try the [Ix Core Runtime](../IX_PLUGIN_OVERHAUL_SPEC.md) HTTP API first and fall back to the `ix` CLI when the runtime is unavailable.

## Hooks

| Trigger | Hook | Effect |
|---------|------|--------|
| Any session | `AGENTS.md` injection | Always-on graph-first guidance |
| Before file edit | `tool.execute.before` → `ix-decide` | Policy verdict; surfaces risk for REVIEW/BLOCK |
| Before `read` | `tool.execute.before` → `ix-read` | Hints toward graph narrowing first |
| Before grep/bash | `tool.execute.before` → `ix-intercept` | Suggests `ix text` for search |
| After file edit | `tool.execute.after` → `ix-ingest` | Async graph refresh (fire-and-forget) |
| After ix-* tools | `tool.execute.after` → `ix-errors` | Detects stale graph signals |
| Plugin init | `onInit` | Triggers `ix map` if graph is empty |

All hooks return `{ action: "allow" }` — they inject context but never block actions.

## Further reading

- [QUICKSTART.md](./QUICKSTART.md) — step-by-step first use guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) — design decisions and component overview
- [TOOL_CONTRACT.md](./TOOL_CONTRACT.md) — tool API reference and output format
- [ROADMAP.md](./ROADMAP.md) — implementation progress and upcoming work
