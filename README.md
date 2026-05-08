# ix-opencode-plugin

An OpenCode plugin that brings [Ix Memory](https://github.com/ix-infrastructure/Ix)'s graph-first reasoning into OpenCode as a native cognitive layer.

OpenCode + Ix = reasoning engine + persistent code knowledge graph. Skills are cognitive abstractions — not CLI wrappers — that start with cheap graph signals before reading source, and stop early when the question is answered.

## Requirements

- [OpenCode](https://opencode.ai) installed
- [Ix Memory](https://github.com/ix-infrastructure/IX-Memory) CLI (`ix`) installed and connected to a workspace
- [Bun](https://bun.sh) installed — **required** (all tools use Bun's `$` shell API; Node.js is not supported)

```bash
opencode --version
command -v ix && ix status
bun --version
```

## Installation

```bash
# From your project root
mkdir -p .opencode/plugins .opencode/tools .opencode/runtime .opencode/commands .opencode/agents

cp -r /path/to/ix-opencode-plugin/plugins/.  .opencode/plugins/
cp -r /path/to/ix-opencode-plugin/tools/.    .opencode/tools/
cp -r /path/to/ix-opencode-plugin/runtime/.  .opencode/runtime/
cp -r /path/to/ix-opencode-plugin/commands/. .opencode/commands/
cp -r /path/to/ix-opencode-plugin/agents/.   .opencode/agents/
cp    /path/to/ix-opencode-plugin/AGENTS.md  .opencode/AGENTS.md
```

Add to `opencode.json`:

```json
{
  "plugin": [".opencode/plugins/ix-plugin.ts"],
  "instructions": [".opencode/AGENTS.md"]
}
```

> The `runtime/` directory is required — tools import the Ix Core Runtime client from `../runtime/client.ts`.

See [QUICKSTART.md](./QUICKSTART.md) for full setup instructions.

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
