# Quickstart — ix-opencode-plugin

Get graph-first reasoning into OpenCode in under 5 minutes.

---

## Prerequisites

- [OpenCode](https://opencode.ai) installed
- [Ix Memory](https://github.com/ix-infrastructure/Ix) CLI (`ix`) installed and connected to a workspace
- [Bun](https://bun.sh) installed — **required** (OpenCode's plugin runtime; all tools use Bun's `$` shell API)

Verify:
```bash
opencode --version
command -v ix && ix status
bun --version
```

---

## Installation

### Option A — Per-project (recommended)

Copy this plugin into your project's `.opencode/` directory:

```bash
# From your project root
mkdir -p .opencode/plugins .opencode/tools .opencode/commands .opencode/agents .opencode/runtime

cp -r /path/to/ix-opencode-plugin/plugins/.  .opencode/plugins/
cp -r /path/to/ix-opencode-plugin/tools/.    .opencode/tools/
cp -r /path/to/ix-opencode-plugin/runtime/.  .opencode/runtime/
cp -r /path/to/ix-opencode-plugin/commands/. .opencode/commands/
cp -r /path/to/ix-opencode-plugin/agents/.   .opencode/agents/
cp    /path/to/ix-opencode-plugin/AGENTS.md  .opencode/AGENTS.md
```

Then add to your project's `opencode.json`:
```json
{
  "plugin": [".opencode/plugins/ix-plugin.ts"],
  "instructions": [".opencode/AGENTS.md"]
}
```

> **Note:** The `runtime/` directory must be copied — `tools/*.ts` imports the Ix Core Runtime client from `../runtime/client.ts`.

### Option B — Global install

```bash
mkdir -p ~/.config/opencode/{plugins,tools,runtime,commands,agents}

cp -r /path/to/ix-opencode-plugin/plugins/.  ~/.config/opencode/plugins/
cp -r /path/to/ix-opencode-plugin/tools/.    ~/.config/opencode/tools/
cp -r /path/to/ix-opencode-plugin/runtime/.  ~/.config/opencode/runtime/
cp -r /path/to/ix-opencode-plugin/commands/. ~/.config/opencode/commands/
cp -r /path/to/ix-opencode-plugin/agents/.   ~/.config/opencode/agents/
```

Append `AGENTS.md` content to your global `~/.config/opencode/AGENTS.md` (append or create).

---

## First use

Start OpenCode in your project:

```bash
cd /your/project
opencode
```

The plugin runs `ix map --silent` automatically on startup if the graph is empty. For large codebases (>500 files), you can pre-build the graph to avoid the wait:

```bash
ix map        # builds the graph (30s–2min depending on codebase size)
ix status     # verify the graph is present
```

---

## Try a slash command

In the OpenCode prompt, type `/ix-help` to see all available skills and tools:

```
/ix-help
```

Or go straight to a skill:

```
/ix-understand
/ix-understand auth
/ix-investigate UserService
/ix-impact PaymentProcessor
/ix-plan "refactor database layer"
/ix-debug "null pointer in checkout flow"
/ix-architecture
/ix-docs api --full
```

---

## Try an agent

Ask OpenCode to use an Ix agent directly:

```
Use ix-explorer to answer: how does the authentication flow work?
Use ix-bug-investigator to find why the session expires early.
Use ix-safe-refactor-planner to plan changes to: UserRepository, AuthService
```

---

## Try a tool directly

Ask OpenCode to call an Ix tool:

```
Run ix-health to check if the graph is ready
Run ix-stats to see how big this codebase is
Run ix-query on UserService
Run ix-smells to find architecture problems
Check the impact of changing PaymentProcessor
```

---

## Verify the plugin is working

Run a health check:

```
Run ix-health
```

Expected output:
```
## ix-health

**Status:** OK
**CLI:** ix 2.1.0 — installed
**Graph:** indexed (312 files)
**Runtime (v2):** not available (expected until 2026-07-15)
```

If you see `ix CLI not found`, verify `ix` is on your PATH:
```bash
which ix
echo $PATH
```

---

## What the plugin adds

Once installed, the plugin provides:

| Category | Count | What |
|---|---|---|
| Tools | 17 | TypeScript functions OpenCode can call during any task |
| Slash commands | 8 | Phased reasoning skills (`/ix-understand`, `/ix-investigate`, etc.) |
| Agents | 5 | Specialized autonomous agents for exploration, debugging, refactoring, auditing |
| Hooks | 5 | Pre-edit gate, read hints, grep interception, post-edit ingest, stale detection |
| Context | 1 | `AGENTS.md` injected into every session as always-on guidance |

### All 17 tools

| Tool | Purpose |
|---|---|
| `ix-query` | Graph entity lookup by name |
| `ix-neighbors` | Callers, callees, imports, depends |
| `ix-impact` | Blast radius and risk verdict |
| `ix-map` | Architectural overview with subsystem table |
| `ix-ingest` | Graph status and refresh trigger |
| `ix-history` | Revision, decisions, bugs (Ix Pro) |
| `ix-docs-tool` | Condensed context summary |
| `ix-locate` | Text/pattern search across the codebase |
| `ix-explain` | Full symbol explanation with role and importance |
| `ix-rank` | Top symbols by dependents, callers, or members |
| `ix-stats` | Graph-wide statistics and health |
| `ix-subsystems` | Subsystem listing with hierarchy |
| `ix-inventory` | Enumerate files or symbols in a path scope |
| `ix-trace` | Full execution path trace |
| `ix-decide` | Pre-edit policy verdict (ALLOW/REVIEW/BLOCK) |
| `ix-health` | CLI and graph availability check |
| `ix-smells` | Architecture smell detection |

You don't need to invoke tools explicitly — the hooks and `AGENTS.md` nudge OpenCode toward graph-first reasoning automatically.

---

## Ix Core Runtime

All tools try the [Ix Core Runtime](../IX_PLUGIN_OVERHAUL_SPEC.md) HTTP API before falling back to the `ix` CLI. The runtime is not yet deployed (local alpha target: 2026-07-15), so all tools currently operate in CLI mode. When the runtime is available at `http://127.0.0.1:7743`, tools automatically upgrade to richer API-backed responses with no configuration change.

Override the runtime URL if needed:
```bash
IX_RUNTIME_URL=http://localhost:7743 opencode
```

---

## Further reading

- [ARCHITECTURE.md](./ARCHITECTURE.md) — design decisions and component overview
- [TOOL_CONTRACT.md](./TOOL_CONTRACT.md) — tool API reference and output format
- [AGENTS.md](./AGENTS.md) — always-on context injected into every session
- [ROADMAP.md](./ROADMAP.md) — implementation progress and upcoming work
