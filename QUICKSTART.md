# Quickstart — ix-opencode-plugin

Get graph-first reasoning into OpenCode in under 5 minutes.

---

## Prerequisites

- [OpenCode](https://opencode.ai) installed
- [Ix Memory](https://github.com/ix-infrastructure/IX-Memory) CLI (`ix`) installed and connected to a workspace
- [Bun](https://bun.sh) installed (used by OpenCode's plugin runtime)

Verify:
```bash
opencode --version
command -v ix && ix status
bun --version
```

---

## Installation

### Option A — Per-project (recommended for trying it out)

Copy or symlink this plugin into your project's `.opencode/` directory:

```bash
# From your project root
mkdir -p .opencode/plugins .opencode/tools .opencode/commands .opencode/agents

# Symlink or copy the plugin files
cp -r /path/to/ix-opencode-plugin/plugins/. .opencode/plugins/
cp -r /path/to/ix-opencode-plugin/tools/.   .opencode/tools/
cp -r /path/to/ix-opencode-plugin/commands/. .opencode/commands/
cp -r /path/to/ix-opencode-plugin/agents/.  .opencode/agents/
cp    /path/to/ix-opencode-plugin/AGENTS.md  .opencode/AGENTS.md
```

Then add to your project's `opencode.json`:
```json
{
  "plugin": [".opencode/plugins/ix-plugin.ts"],
  "instructions": [".opencode/AGENTS.md"]
}
```

### Option B — Global install

Copy to your global OpenCode config directory:

```bash
cp -r /path/to/ix-opencode-plugin/plugins/. ~/.config/opencode/plugins/
cp -r /path/to/ix-opencode-plugin/tools/.   ~/.config/opencode/tools/
cp -r /path/to/ix-opencode-plugin/commands/. ~/.config/opencode/commands/
cp -r /path/to/ix-opencode-plugin/agents/.  ~/.config/opencode/agents/
```

Add `AGENTS.md` content to your global `~/.config/opencode/AGENTS.md` (append or create).

---

## Build the graph

Before using the plugin, ensure Ix has indexed your codebase:

```bash
cd /your/project
ix map          # builds the graph (takes 30s–2min depending on codebase size)
ix status       # verify the graph is present
ix subsystems   # spot-check: should list your top-level systems
```

If `ix status` shows an empty graph, wait for `ix map` to complete before running OpenCode.

---

## First use

Start OpenCode in your project:

```bash
opencode
```

### Try a slash command

In the OpenCode prompt, type a slash command to run a skill:

```
/ix-understand
```

This builds a full architectural model of your codebase. For a specific subsystem:

```
/ix-understand auth
```

Other commands to try:

```
/ix-investigate UserService
/ix-impact PaymentProcessor
/ix-plan "refactor database layer"
/ix-debug "null pointer in checkout flow"
/ix-architecture
/ix-docs api --full
```

### Try an agent

Ask OpenCode to use an Ix agent directly:

```
Use ix-explorer to answer: how does the authentication flow work?
```

```
Use ix-bug-investigator to find why the session expires early.
```

```
Use ix-safe-refactor-planner to plan changes to: UserRepository, AuthService
```

### Try a tool directly

Ask OpenCode to call an Ix tool:

```
Run ix-query on UserService
```

```
Check the impact of changing PaymentProcessor
```

---

## Verify the plugin is working

After OpenCode starts, you should see the Ix tools available. Run a quick health check:

```
Run ix-ingest to check the graph status
```

Expected output:
```
## ix-ingest: status

**Status:** Graph is present.
**Subsystems found:** 5 (auth, api, models, services, utils)
```

If you see `ix CLI not found`, verify the `ix` binary is on your PATH:
```bash
which ix
echo $PATH
```

---

## How it changes OpenCode's behavior

Once installed, the plugin:

1. **Injects always-on context** via `AGENTS.md` — OpenCode knows to use graph data before reading files
2. **Adds 7 tools** — OpenCode can call `ix-query`, `ix-impact`, etc. as part of any task
3. **Adds 7 slash commands** — phased reasoning skills for common investigation tasks
4. **Adds 5 agents** — specialized agents for exploration, debugging, refactoring, and auditing
5. **Registers hooks** — pre-edit impact checks, read hints, grep interception, post-edit graph refresh

You don't need to invoke skills explicitly — the hooks and `AGENTS.md` will nudge OpenCode toward graph-first reasoning automatically.

---

## Next steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the design decisions
- Read [TOOL_CONTRACT.md](./TOOL_CONTRACT.md) for the tool API reference
- Read [SKILLS_AND_AGENTS.md](./SKILLS_AND_AGENTS.md) for the full skill and agent reference
- Run `/ix-understand` on your codebase to see the plugin in action
