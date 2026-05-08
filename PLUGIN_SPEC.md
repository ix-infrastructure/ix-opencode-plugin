# ix-opencode-plugin — Plugin Specification

Version: 2.0.0-draft  
Root spec: [IX_PLUGIN_OVERHAUL_SPEC.md](../IX_PLUGIN_OVERHAUL_SPEC.md)  
Status: **Overhaul target — v1.0.0 production.** Refactor to match ix-claude-plugin behavior semantics and ix-cursor-plugin tool surface parity (17-tool expansion).

---

## 1. Plugin name

`ix-memory` (OpenCode plugin ID — declared in `opencode.json`)  
Repository: `ix-opencode-plugin`

---

## 2. Target AI platform

**OpenCode** — open-source AI coding agent with a TypeScript/Bun plugin runtime.  
Website: https://opencode.ai  
Distribution: Per-project copy to `.opencode/` directories, or global `~/.config/opencode/`.

---

## 3. Current implementation summary

Fully operational v1.0.0 plugin. Brings Ix graph-first reasoning into OpenCode via its native TypeScript plugin model. Uses **tools** (typed function calls that the AI invokes) as the primary extension surface. Skills are exposed as slash commands. Hooks fire via OpenCode's plugin hook system.

**Core architectural model:**
- `plugins/ix-plugin.ts` — plugin entry point; registers tools and hooks
- `tools/` — 7 TypeScript tools wrapping `ix` CLI subprocess calls
- `commands/` — 7 slash commands (one per skill)
- `agents/` — 5 agent playbooks in JSON/markdown
- `AGENTS.md` — ambient context injection; loaded by OpenCode at session start

**What it does today:**
- Injects Ix operating guidance via `AGENTS.md` at session start
- Intercepts file reads via `ix-read` hook; injects graph context hint
- Intercepts grep/bash via `ix-intercept` hook; front-runs with `ix-query` tool
- Warns before risky edits via `ix-pre-edit` hook; calls `ix-impact` tool
- Injects graph context after file edits via `ix-ingest` hook; calls `ix-map` tool
- Provides seven skill slash commands (`/ix-understand`, `/ix-investigate`, etc.)
- Provides five agents for autonomous complex analysis

---

## 4. Existing files and behavior to preserve

### File tree

```
ix-opencode-plugin/
├── plugins/
│   └── ix-plugin.ts             # Plugin entry point — registers tools and hooks
├── tools/
│   ├── base.ts                  # Tool base class
│   ├── ix-query.ts              # Graph entity lookup (symbol, file, type)
│   ├── ix-neighbors.ts          # Neighbor traversal: callers, callees, imports, depends
│   ├── ix-impact.ts             # Blast radius analysis
│   ├── ix-map.ts                # Architectural map + subsystem overview
│   ├── ix-ingest.ts             # Graph status + refresh trigger
│   ├── ix-history.ts            # Revision/decisions/bugs (Ix Pro only)
│   └── ix-docs-tool.ts          # Condensed context summaries
├── commands/
│   ├── ix-understand.md         # /ix-understand skill command
│   ├── ix-investigate.md        # /ix-investigate skill command
│   ├── ix-impact.md             # /ix-impact skill command
│   ├── ix-plan.md               # /ix-plan skill command
│   ├── ix-debug.md              # /ix-debug skill command
│   ├── ix-architecture.md       # /ix-architecture skill command
│   └── ix-docs.md               # /ix-docs skill command
├── agents/
│   ├── ix-explorer.json
│   ├── ix-system-explorer.json
│   ├── ix-bug-investigator.json
│   ├── ix-safe-refactor-planner.json
│   └── ix-architecture-auditor.json
├── opencode.json                # Plugin config: tool/command/agent registration, watcher ignore
├── AGENTS.md                    # Agent playbooks + ambient context (loaded by OpenCode)
├── ARCHITECTURE.md              # Design decisions
├── TOOL_CONTRACT.md             # Tool API reference and output format
├── QUICKSTART.md
├── ROADMAP.md
├── PLUGIN_SPEC.md               # This file
├── README.md
└── .claude/
    └── settings.local.json      # Permission config (used if OpenCode loads Claude settings)
```

### Tools (7 current)

| Tool | Purpose | Calls (current) |
|---|---|---|
| `ix-query` | Look up graph entity by name | `ix locate <name>` CLI |
| `ix-neighbors` | Traverse entity neighborhood | `ix callers`/`callees`/`depends`/`imports` CLI |
| `ix-impact` | Blast radius analysis | `ix impact <target>` CLI |
| `ix-map` | Architectural map + subsystem overview | `ix map <scope>` CLI |
| `ix-ingest` | Graph status + refresh trigger | `ix status` / `ix map` CLI |
| `ix-history` | Revision/decisions/bugs | `ix history` CLI (Pro only) |
| `ix-docs-tool` | Context summaries | `ix docs <target>` CLI |

### Hooks (5 current via `ix-plugin.ts`)

| Hook | Trigger | Behavior |
|---|---|---|
| `ix-read` | Tool execution: read | Injects graph context hint before file reads |
| `ix-intercept` | Tool execution: grep/bash | Front-runs with `ix-query` tool (text search) |
| `ix-pre-edit` | Tool execution: write/edit | Calls `ix-impact` tool; warns on risk |
| `ix-ingest` | Tool execution: post-write | Calls `ix-map` tool async for ingest |
| `ix-errors` | Tool execution: error | Graceful error handling for stale graph |

### Commands / skills (7 current)

`/ix-understand`, `/ix-investigate`, `/ix-impact`, `/ix-plan`, `/ix-debug`, `/ix-architecture`, `/ix-docs`

Each command uses phased reasoning: graph query first, source reads only as last resort.

### Agents (5 current)

`ix-explorer`, `ix-system-explorer`, `ix-bug-investigator`, `ix-safe-refactor-planner`, `ix-architecture-auditor`

Agents are JSON files with `description` and `prompt_file` fields.

### Installation

```bash
# Per-project (recommended)
mkdir -p .opencode/{plugins,tools,commands,agents}
cp -r /path/to/ix-opencode-plugin/{plugins,tools,commands,agents}/. .opencode/
cp /path/to/ix-opencode-plugin/AGENTS.md .opencode/
# Add to opencode.json:
# { "plugin": [".opencode/plugins/ix-plugin.ts"], "instructions": [".opencode/AGENTS.md"] }

# Global install
cp -r ... ~/.config/opencode/{plugins,tools,commands,agents}/
```

---

## 5. Known gaps and stale areas

| Gap | Impact | Priority |
|---|---|---|
| All 7 tools call `ix` CLI directly | Cannot call runtime v2 API yet | High |
| No session-start lifecycle hook | No guarantee AGENTS.md context is injected before first prompt | Medium |
| No lifecycle hook for session end | Full-graph refresh is tool-driven only; may lag with rapid edits | Medium |
| Manual `ix map` required before first use | Onboarding step not automated | Medium |
| `ix-history` is Ix Pro only | Gap in capability for free users | Low |
| No MCP support confirmed | Cannot expose Ix as MCP server within OpenCode currently | Medium (unknown) |
| Bun compatibility unknown | README says "Bun runtime" but code looks like plain TypeScript | Needs verification |
| Tool count (7) less than Cursor (17) | Missing: `locate`, `text`, `explain`, `rank`, `stats`, `subsystems`, `inventory`, `callers`, `callees`, `depends`, `trace`, `decide`, `health`, `smells` | High |
| No `ix-help` skill router | User must know skill names | Low |

---

## 6. Desired refactor outcome

1. **Expand tool set**: Add the missing tools from the Cursor MCP server (17 tools total) to match Cursor's graph query depth. This is the highest-impact capability upgrade.
2. **Migrate all tools to runtime API**: Replace all `ix` CLI subprocess calls with `POST /v2/ix_query`, `POST /v2/ix_decide`, and related runtime API calls.
3. **Add `ix-help` slash command** (skill router).
4. **Verify and document MCP support**: If OpenCode supports MCP, expose Ix as an MCP server using the same 17-tool model as Cursor.
5. **Add session-start lifecycle hook** if supported, to guarantee context injection before the first prompt.
6. **Automate first-run `ix map`** via install script or plugin activation hook.

---

## 7. Platform-specific integration model

OpenCode's plugin system provides:
- **Plugin entry point** — `plugins/ix-plugin.ts` registered in `opencode.json`
- **Tools** — TypeScript functions that the AI can call; registered via plugin entry point
- **Commands** — slash command markdown files in `.opencode/commands/`; format similar to Claude skills
- **Agents** — JSON agent descriptors in `.opencode/agents/`
- **`AGENTS.md`** — loaded as ambient agent context (equivalent to `CLAUDE.md`)
- **Hooks** — plugin-registered hooks on tool execution events (before/after)

**Bun vs Node.js:** The plugin runtime appears to be standard TypeScript. Bun compatibility is mentioned in the README but not verified in code. Unknown / needs verification whether strict Bun APIs are required or if Node.js-compatible TypeScript is sufficient.

**MCP support:** Unknown / needs verification. Check `opencode.json` schema and OpenCode documentation.

**Installation:** Per-project copy is the recommended path; no symlink mechanism confirmed.

---

## 8. Required Ix capabilities

| Capability | Current | Target |
|---|---|---|
| Graph entity lookup | `ix-query` tool → `ix locate` CLI | `POST /v2/graph/query` op `"locate"` |
| Neighbor traversal | `ix-neighbors` tool → `ix callers/callees` CLI | `POST /v2/graph/query` op `"neighbors"` |
| Blast radius | `ix-impact` tool → `ix impact` CLI | `POST /v2/ix_query` mode `"impact"` |
| Architectural map | `ix-map` tool → `ix map` CLI | `POST /v2/ix_query` mode `"understand"` |
| Ingest/refresh | `ix-ingest` tool → `ix map` CLI | `POST /v2/ingest/map` |
| Pre-edit gate | `ix-pre-edit` hook → `ix-impact` tool | `POST /v2/ix_decide` |
| Context summaries | `ix-docs-tool` → `ix docs` CLI | `POST /v2/ix_query` mode `"docs"` |
| All seven skills | `ix` CLI via commands | `POST /v2/ix_query` appropriate mode |
| Text/semantic search | **Not available** (missing tool) | `POST /v2/ix_query` mode `"locate"` text search |
| Architecture smells | **Not available** (missing tool) | `POST /v2/insights/derive` type `"smells"` |
| Claims and conflicts | **Not available** | `POST /v2/claims/query`, `POST /v2/conflicts/check` |

---

## 9. Required hooks, skills, commands, agents, and MCP integrations

### Tools required (target: 17 to match Cursor)

Existing 7 to be migrated: `ix-query`, `ix-neighbors`, `ix-impact`, `ix-map`, `ix-ingest`, `ix-history`, `ix-docs-tool`

New tools to add (10):
`ix-locate` (text/semantic search), `ix-explain`, `ix-rank`, `ix-stats`, `ix-subsystems`, `ix-inventory`, `ix-trace`, `ix-decide`, `ix-health`, `ix-smells`

### Hooks required

Existing 5 (migrate to runtime API): `ix-read`, `ix-intercept`, `ix-pre-edit`, `ix-ingest`, `ix-errors`

Add: session-start hook (if supported) to guarantee AGENTS.md is active before first prompt.

### Commands / skills

Add: `ix-help` slash command (skill router). All 7 existing commands migrate to runtime API.

### MCP

Verify OpenCode MCP support. If available: register Ix as MCP server with 17 tools (matching Cursor).

---

## 10. Required folder structure after refactor

```
ix-opencode-plugin/
├── plugins/
│   └── ix-plugin.ts             # Updated: register 17 tools, all hooks
├── tools/
│   ├── base.ts
│   ├── [7 existing tools — migrated to runtime API]
│   ├── ix-locate.ts             # NEW
│   ├── ix-explain.ts            # NEW
│   ├── ix-rank.ts               # NEW
│   ├── ix-stats.ts              # NEW
│   ├── ix-subsystems.ts         # NEW
│   ├── ix-inventory.ts          # NEW
│   ├── ix-trace.ts              # NEW
│   ├── ix-decide.ts             # NEW
│   ├── ix-health.ts             # NEW
│   └── ix-smells.ts             # NEW
├── commands/
│   ├── ix-help.md               # NEW: skill router
│   └── [7 existing commands]
├── agents/
│   └── [5 existing agents]
├── runtime/
│   └── client.ts                # NEW: Ix Core Runtime HTTP client
├── mcp/                         # NEW (if MCP confirmed)
│   └── server.ts                # MCP server entry point
├── opencode.json                # Updated: register new tools
├── AGENTS.md
├── ARCHITECTURE.md
├── TOOL_CONTRACT.md             # Updated: v2 API contracts
├── QUICKSTART.md
├── PLUGIN_SPEC.md               # This file
└── README.md
```

---

## 11. Shared Ix Core Runtime requirements

See [IX_PLUGIN_OVERHAUL_SPEC.md](../IX_PLUGIN_OVERHAUL_SPEC.md). Plugin-specific notes:

- `caller.surface = "opencode-plugin"` in all API calls.
- `runtime/client.ts` must handle `IX_UPSTREAM_UNAVAILABLE` gracefully; tools must fail non-fatally.
- If MCP is available, prefer typed MCP tool calls over direct HTTP.
- Git revision must be detected from the workspace root; fall back to content hash if not in a git repo.

---

## 12. API contracts used by this plugin

| API | Tool/hook | Notes |
|---|---|---|
| `POST /v2/ix_query` | All skill commands, `ix-map`, `ix-docs-tool` | `caller.surface = "opencode-plugin"` |
| `POST /v2/ix_decide` | `ix-pre-edit` hook, new `ix-decide` tool | |
| `POST /v2/graph/query` | `ix-query`, `ix-neighbors`, `ix-locate`, `ix-trace` | |
| `POST /v2/insights/derive` | `ix-rank`, `ix-smells` | |
| `POST /v2/ingest/map` | `ix-ingest` tool, `ix-ingest` hook | |
| `GET /v2/status` | `ix-health` tool, `ix-stats` tool | |

---

## 13. Security and privacy requirements

- All tool implementations must remain thin wrappers — no business logic beyond routing.
- `AGENTS.md` must not include secrets, tokens, or machine-specific paths.
- `opencode.json` must not contain long-lived credentials.
- Tools must not log raw source code or prompt text in telemetry.
- `ix-docs-tool` and `ix-map` must exclude secret-pattern strings from submitted queries.

---

## 14. Testing requirements

| Test | Coverage |
|---|---|
| `OpenCodeToolContractParity` | All 17 tools match expected schemas after v2 migration |
| `OpenCodePreEditGateFired` | `ix-pre-edit` hook reliably calls `ix_decide` before file writes |
| `OpenCodePostEditIngestFired` | `ix-ingest` hook fires after file edits |
| `OpenCodeMcpAvailability` | MCP support status verified and documented |
| `BunCompatibility` | Confirm whether Bun-specific APIs are required or standard TypeScript suffices |
| `RuntimeUnavailableFallback` | All tools degrade gracefully when runtime is unavailable |
| Shared golden cases | `UnderstandLargeMonorepo`, `ImpactCrossBoundaryEdit`, `DebugWithStaleClaim` |

---

## 15. Migration plan

| Step | Action | Risk |
|---|---|---|
| 1. Freeze tool output fixtures | Capture current output from all 7 tools | Low |
| 2. Verify MCP and Bun support | Check OpenCode docs; run test config | Medium (unknown) |
| 3. Add `runtime/client.ts` | HTTP client for Ix Core Runtime; TypeScript with fallback | Low |
| 4. Migrate ingest and map tools | Switch `ix-ingest` and `ix-map` to runtime API | Low |
| 5. Migrate query tools | Switch `ix-query`, `ix-neighbors`, `ix-impact`, `ix-docs-tool` to runtime API | Medium |
| 6. Migrate pre-edit hook | Switch to `POST /v2/ix_decide` | Medium |
| 7. Add 10 new tools | Implement `ix-locate`, `ix-explain`, `ix-rank`, `ix-stats`, `ix-subsystems`, `ix-inventory`, `ix-trace`, `ix-decide`, `ix-health`, `ix-smells` | High |
| 8. Add `ix-help` command | Write skill router command | Low |
| 9. Update `opencode.json` | Register new tools and updated hooks | Low |
| 10. Add MCP server (if confirmed) | Implement `mcp/server.ts` with 17 tools | High |
| 11. Dual-run validation | Compare old/new tool output against fixtures | High |

---

## 16. Acceptance criteria

- [~] All 7 existing tools call the Ix Core Runtime API; no direct `ix` CLI calls remain. **Partial** — all 7 tools try the runtime API first (via `runtime/client.ts`); CLI calls remain as the fallback path until the runtime alpha ships (2026-07-15).
- [x] 10 new tools implemented and registered (`ix-locate`, `ix-explain`, `ix-rank`, `ix-stats`, `ix-subsystems`, `ix-inventory`, `ix-trace`, `ix-decide`, `ix-health`, `ix-smells`).
- [x] `ix-help` slash command added.
- [x] `ix-pre-edit` hook reliably calls `ix_decide` before file writes.
- [x] `ix-ingest` hook fires after file edits.
- [x] MCP support status verified and documented. **Result: not supported.**
- [x] Bun vs Node.js runtime requirement documented. **Result: Bun required.**
- [x] All tools degrade gracefully when runtime is unavailable.
- [x] `TOOL_CONTRACT.md` updated to reflect v2 API contracts.
- [ ] Shared golden cases pass. **Blocked — requires live OpenCode session.**

---

## 17. Open questions

1. **Does OpenCode support MCP?** **Resolved: No.** `opencode.json` has no MCP section. Documented in ARCHITECTURE.md as a Phase 2 target.
2. **Is the plugin runtime strictly Bun, or does standard TypeScript/Node work?** **Resolved: Bun required.** All tools use `import { $ } from "bun"` (Bun-only shell API). Documented in ARCHITECTURE.md.
3. **Does OpenCode have a session-start lifecycle event?** **Resolved: No.** `AGENTS.md` via `instructions` field is the always-on alternative. See ARCHITECTURE.md.
4. Does OpenCode's `opencode.json` support a global plugin install path, or is per-project copy the only supported model? **Unknown — needs verification.**
5. What is the maximum tool response size in OpenCode? **Unknown — needs verification.**
6. Do agent `.json` files support subagent delegation, or are they context-only? **Unknown — needs verification.**
7. Can `AGENTS.md` include conditional instructions (e.g., only inject Ix briefing if graph is available)? **Unknown — needs verification.**


---

## Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for phased implementation tasks and progress tracking.
