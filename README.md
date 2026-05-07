# ix-opencode-plugin

An OpenCode plugin that brings [Ix Memory](https://github.com/ix-infrastructure/Ix)'s graph-first reasoning into OpenCode as a native cognitive layer.

OpenCode + Ix = reasoning engine + persistent code knowledge graph. Skills are cognitive abstractions (not CLI wrappers) that start with cheap graph signals before reading source, and stop early when the question is answered.

## Requirements

- [OpenCode](https://opencode.ai) installed
- [Ix Memory](https://github.com/ix-infrastructure/Ix) CLI (`ix`) installed and connected to a workspace
- [Bun](https://bun.sh) installed (OpenCode's plugin runtime)

```bash
opencode --version
command -v ix && ix status
bun --version
```

## Installation

### Per-project (recommended)

```bash
# From your project root
mkdir -p .opencode/plugins .opencode/tools .opencode/commands .opencode/agents

cp -r /path/to/ix-opencode-plugin/plugins/. .opencode/plugins/
cp -r /path/to/ix-opencode-plugin/tools/.   .opencode/tools/
cp -r /path/to/ix-opencode-plugin/commands/. .opencode/commands/
cp -r /path/to/ix-opencode-plugin/agents/.  .opencode/agents/
cp    /path/to/ix-opencode-plugin/AGENTS.md  .opencode/AGENTS.md
```

Add to your project's `opencode.json`:

```json
{
  "plugin": [".opencode/plugins/ix-plugin.ts"],
  "instructions": [".opencode/AGENTS.md"]
}
```

### Global install

```bash
cp -r /path/to/ix-opencode-plugin/plugins/. ~/.config/opencode/plugins/
cp -r /path/to/ix-opencode-plugin/tools/.   ~/.config/opencode/tools/
cp -r /path/to/ix-opencode-plugin/commands/. ~/.config/opencode/commands/
cp -r /path/to/ix-opencode-plugin/agents/.  ~/.config/opencode/agents/
```

Append `AGENTS.md` content to `~/.config/opencode/AGENTS.md`.

### Build the graph first

```bash
cd /your/project
ix map       # index the codebase (30s–2min)
ix status    # verify graph is present
```

## Skills

Slash commands with phased reasoning — graph first, source reads only when needed.

| Command | What it does | Key rule |
|---------|-------------|----------|
| `/ix-understand [target]` | Build a mental model of a system or the whole repo | Graph only — no source reads |
| `/ix-investigate <symbol>` | Deep dive: what it is, how it connects, execution path | Graph first, one symbol read max |
| `/ix-impact <target>` | Change risk: blast radius, affected systems, test targets | Depth scales with risk level |
| `/ix-plan <targets...>` | Risk-ordered implementation plan for a set of changes | Parallel impact, finds shared dependents |
| `/ix-debug <symptom>` | Root cause analysis from symptom to candidates | Targeted reads at suspects only |
| `/ix-architecture [scope]` | Design health: coupling, smells, hotspots | Graph only — never reads source |
| `/ix-docs <target> [--full]` | Generate narrative-first system documentation | Default is onboarding-focused |

## Agents

| Agent | Purpose |
|-------|---------|
| `ix-explorer` | General-purpose graph exploration, open-ended questions |
| `ix-system-explorer` | Full architectural model of a codebase or region |
| `ix-bug-investigator` | Autonomous investigation from symptom to root cause candidates |
| `ix-safe-refactor-planner` | Blast radius + safe change sequencing for refactors |
| `ix-architecture-auditor` | Full structural health report with ranked improvements |

Ask OpenCode to use them directly:

```
Use ix-explorer to answer: how does the authentication flow work?
Use ix-bug-investigator to find why the session expires early.
Use ix-safe-refactor-planner to plan changes to: UserRepository, AuthService
```

## Tools

Seven CLI-backed tools OpenCode can call during any task:

| Tool | Purpose |
|------|---------|
| `ix-query` | Look up a graph entity by name |
| `ix-neighbors` | Traverse the neighborhood of an entity |
| `ix-impact` | Blast radius analysis for a target |
| `ix-map` | Architectural map of a scope |
| `ix-ingest` | Check graph status or trigger a re-index |
| `ix-history` | Revision and history lookup |
| `ix-docs-tool` | Retrieve doc/context summaries |

## Automatic hooks

| Trigger | Hook | Effect |
|---------|------|--------|
| Any task starts | `AGENTS.md` context injection | OpenCode knows to use graph data before reading files |
| Before a file edit | `tool.execute.before` → `ix-pre-edit` | Runs impact check, surfaces blast radius |
| Before a `read` | `tool.execute.before` → `ix-read` | Hints toward graph narrowing first |
| Before grep/bash | `tool.execute.before` → `ix-intercept` | Front-runs with graph search |
| First run in workspace | plugin init → `ix-ingest` | Ensures graph is present and fresh |
| After tool execution | `tool.execute.after` → `ix-errors` | Handles stale graph or missing entities |

All hooks bail silently if `ix` is not in PATH or the backend is unreachable.

## Further reading

- [QUICKSTART.md](./QUICKSTART.md) — step-by-step first use guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) — design decisions and component overview
- [TOOL_CONTRACT.md](./TOOL_CONTRACT.md) — tool API reference and output format
- [AGENTS.md](./AGENTS.md) — always-on context injected into every OpenCode session
