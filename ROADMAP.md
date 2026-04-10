# ix-opencode-plugin Roadmap

## Goal

Bring Ix's graph-first reasoning, phased investigation, and safe change-planning into OpenCode as a native cognitive layer — not a thin CLI wrapper.

> Skills are cognitive capabilities, not command aliases. They reason in phases, use cheap signals before expensive ones, and stop early when the question is answered.

---

## Core Design Principles

1. **Graph-first, source-second** — start with graph structure before reading files
2. **Cheap-to-expensive reasoning** — phase every skill: identify → graph facts → neighbors → source reads → stop
3. **Early stopping** — if graph evidence is sufficient, do not read code
4. **Capability-oriented** — expose skills as user outcomes, not raw commands
5. **Safe change support** — all implementation skills include blast radius, sequencing, and risk detection
6. **Reusable mental model** — help agents build and reuse system models instead of rediscovering them

---

## OpenCode Runtime Findings

Research complete. Here is what OpenCode supports and the constraints that shape implementation.

### Plugin/tool model
- Plugins are JS/TS modules loaded from `.opencode/plugins/`, `~/.config/opencode/plugins/`, or npm via `plugin` field in `opencode.json`
- Custom tools are defined as TS/JS files in `.opencode/tools/` or `~/.config/opencode/tools/`
- Tool structured args: yes. Tool return values: **strings only** — returning objects/non-strings has caused runtime problems in practice; do not rely on structured JSON returns from tools

### Agent model
- Custom agents supported with `prompt` field for custom system prompts
- Old `tools` field deprecated; agents scoped to tools via per-agent permissions (`allow`/`ask`/`deny` per tool, bash can be scoped to specific command patterns)
- `permission.task` controls which subagents an agent may invoke

### Context injection
- Always-on context via `AGENTS.md` — works cleanly
- `experimental.session.compacting` for compaction context injection
- **No clean pre-task hidden context injection hook yet** — open feature request exists; cannot rely on it for V1

### Hooks
- `tool.execute.before` — can inspect, block, or modify tool calls before execution; documented example blocks `.env` reads
- `tool.execute.after`
- `tui.command.execute`, `tui.prompt.append`, `file.edited`, session events
- **Caveat:** `tool.execute.before` has not reliably intercepted subagent tool calls in some cases (open issue)

### Workspace access
- Plugin functions receive `directory` and `worktree`; custom tools receive `context.directory` and `context.worktree`

### Local execution
- Local executables: yes — Bun's `$` shell API available in plugin context; bash tool can run shell commands
- Localhost services: yes — OpenCode runs a local HTTP server at `127.0.0.1:4096`; plugins can call localhost

### State persistence
- Local filesystem persistence: yes — config directories, project/global plugin directories
- No first-class plugin KV store documented; use files

### UI
- **No rich UI primitives** — only TUI toasts (`tui.toast.show`), prompts (`tui.prompt.append`), and `showToast` via SDK
- No tables, cards, or tree views

### Slash commands / named workflows
- Yes — markdown files in `.opencode/commands/` or `command` field in config

---

## Phase 1 — CLI-backed plugin (V1)

### Goal
Ship a working plugin backed by the local `ix` CLI. Skills, agents, slash commands, and hooks implemented against the confirmed OpenCode model.

### Implementation approach

**Tools** call `ix` CLI with `--json` flag and return formatted strings (not raw JSON objects, due to runtime constraint). The agent reasons over the string output.

**Skills** are implemented as slash commands — markdown files in `.opencode/commands/` with phased reasoning instructions, exactly like the Claude plugin's SKILL.md approach.

**Agents** are custom OpenCode agents with system prompts ported from the Claude plugin agent definitions. Scoped to Ix tools via agent permissions.

**Context injection** uses `AGENTS.md` for always-on graph-aware instructions. No pre-task hook available in V1; briefing logic moves into the agent system prompt instead.

**Hooks** use `tool.execute.before` for pre-edit interception and read interception. Accept that subagent interception may be unreliable.

**State** cached to local files under `.opencode/ix-cache/` per workspace.

### Constraints and workarounds

| Constraint | Workaround |
|---|---|
| Tool returns must be strings | Format Ix JSON output as structured markdown string before returning |
| No pre-task context injection hook | Put briefing logic in agent system prompt and AGENTS.md |
| No rich UI | Return structured markdown with headers, bullets, and code blocks |
| tool.execute.before unreliable for subagents | Accept partial coverage; document the gap |

### Required Ix CLI changes

Add stable machine-readable output to all queried commands:
- `ix query --json`
- `ix impact --json`
- `ix map --json`
- `ix ingest --status --json`
- `ix neighbors --json`
- Consistent exit codes and error output to stderr

### Skills (7)

All phased reasoning logic reused from Claude plugin. Only packaging changes.

| Skill | Purpose | Implemented as |
|---|---|---|
| `ix-understand` | Mental model of system/subsystem, graph only | slash command |
| `ix-investigate` | Symbol/feature/bug deep dive, graph first | slash command |
| `ix-impact` | Blast radius and change risk, depth scales with risk level | slash command |
| `ix-plan` | Safe multi-target implementation plan with sequencing | slash command |
| `ix-debug` | Root cause analysis, graph narrowing, reads only at suspects | slash command |
| `ix-architecture` | Structural health audit — coupling, cycles, hotspots, smells | slash command |
| `ix-docs` | Generate narrative docs from graph structure, minimal source reads | slash command |

### Agents (5)

| Agent | Purpose | System prompt source |
|---|---|---|
| `ix-explorer` | General graph-first exploration | ported from Claude plugin |
| `ix-system-explorer` | Full architectural model building | ported from Claude plugin |
| `ix-bug-investigator` | Autonomous debugging with ranked hypotheses | ported from Claude plugin |
| `ix-safe-refactor-planner` | Blast radius + safe change sequencing | ported from Claude plugin |
| `ix-architecture-auditor` | Full structural health audit | ported from Claude plugin |

### Hooks

| Hook | OpenCode mechanism | Purpose |
|---|---|---|
| `ix-briefing` | AGENTS.md + agent system prompt | Always-on graph context |
| `ix-pre-edit` | `tool.execute.before` | Impact + risk before file edits |
| `ix-ingest` | plugin init + `tool.execute.before` on first run | Ensure graph is present and fresh |
| `ix-read` | `tool.execute.before` on read tool | Encourage graph narrowing before broad reads |
| `ix-intercept` | `tool.execute.before` on bash/edit | Detect risky/broad actions |
| `ix-errors` | `tool.execute.after` | Handle stale graph, missing entities gracefully |

`ix-map` and `ix-report` deferred — no clean mechanism for post-task summary or map triggers in V1.

### Tool contract

Tools call `ix` CLI and return formatted markdown strings. Logical shape of content:

```
Summary: ...
Confidence: high | medium | low

Entities:
- name | type | relationship

Evidence:
- entity | relationship | confidence

Warnings:
- ...

Next steps:
- ...
```

### V1 File Structure

```
ix-opencode-plugin/
  opencode.json              # plugin manifest
  AGENTS.md                  # always-on context injection
  plugins/
    ix-plugin.ts             # plugin entry: registers tools, hooks
  tools/
    ix-query.ts              # graph entity lookup
    ix-neighbors.ts          # neighborhood traversal
    ix-impact.ts             # blast radius analysis
    ix-map.ts                # architectural map
    ix-ingest.ts             # ingest status + trigger
    ix-history.ts            # revision/history lookup
    ix-docs-tool.ts          # doc/context summary retrieval
  commands/
    ix-understand.md         # slash command: /ix-understand
    ix-investigate.md        # slash command: /ix-investigate
    ix-impact.md             # slash command: /ix-impact
    ix-plan.md               # slash command: /ix-plan
    ix-debug.md              # slash command: /ix-debug
    ix-architecture.md       # slash command: /ix-architecture
    ix-docs.md               # slash command: /ix-docs
  agents/
    ix-explorer.json
    ix-system-explorer.json
    ix-bug-investigator.json
    ix-safe-refactor-planner.json
    ix-architecture-auditor.json
```

### V1 Deliverables

- [ ] `opencode.json` plugin manifest
- [ ] `AGENTS.md` with always-on graph briefing instructions
- [ ] 7 Ix tools (CLI-backed, string output)
- [ ] `ix-plugin.ts` registering tools and hooks
- [ ] 7 slash command skill files
- [ ] 5 agent configs with ported system prompts
- [ ] Hook implementations via `tool.execute.before`
- [ ] Stable `--json` output on required `ix` CLI commands
- [ ] Fallback behavior if Ix backend unavailable
- [ ] Quickstart doc
- [ ] Architecture overview doc
- [ ] Tool contract reference
- [ ] Skill + agent behavior reference

---

## Phase 2 — Native integration

### Goal
Replace CLI subprocess calls with direct HTTP calls to the Ix local service. Improve context injection when OpenCode adds pre-task hooks. Tighter hook enforcement.

### Work items

- Move tools from CLI-backed to `127.0.0.1` Ix service calls
- Return typed structured data if OpenCode resolves the runtime JSON issue
- Per-workspace graph cache with staleness detection
- Proper pre-task briefing hook when OpenCode supports it
- `ix-map` and `ix-report` hooks once post-task summary mechanism exists
- Tighter `tool.execute.before` enforcement once subagent interception is reliable
- Hybrid fallback: service if available, CLI otherwise

---

## What to Reuse from the Claude Plugin

Transfer directly, packaging changes only:

- Skill definitions and phased reasoning instructions
- Stop conditions per skill
- Risk-level depth behavior for `ix-impact`
- Hook intent and semantics
- Agent role definitions and system prompts

Do not assume Claude-specific prompt scaffolding transfers 1:1. Adapt to OpenCode's system prompt and AGENTS.md model.

---

## Success Criteria

The plugin succeeds if OpenCode agents:

- read fewer irrelevant files per task
- find architectural answers faster
- produce safer implementation plans
- surface blast radius before edits
- give more coherent subsystem explanations
- stop repeatedly rediscovering the same architecture

---

## Non-Goals for V1

- Full autonomous coding stack
- Cloud collaboration features
- Rich visualization UI (OpenCode does not support it yet)
- Complete parity with every Ix command
- Replacing source-level reasoning entirely
