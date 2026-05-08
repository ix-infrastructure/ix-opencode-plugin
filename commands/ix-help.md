---
name: ix-help
description: Route to the right Ix skill or tool for your task
argument-hint: <task or question>
---

Goal: route only. Do not perform the task. Always return an exact invocation the user can copy-paste.

If `$ARGUMENTS` is empty, return this menu:

**Skills (slash commands):**
- `/ix-understand <target>` — architectural mental model of a repo, subsystem, or file
- `/ix-investigate <symbol>` — deep dive on one symbol, class, or feature
- `/ix-impact <target>` — blast radius and risk before editing
- `/ix-plan <targets...>` — risk-ordered multi-file change plan
- `/ix-debug <symptom>` — root-cause analysis for a bug or failure
- `/ix-architecture [scope]` — design health, coupling, and structural smells
- `/ix-docs <target>` — onboarding or reference documentation

**Direct tool calls (for quick lookups):**
- `ix-query` — look up a symbol by exact name
- `ix-locate` — search by text pattern or keyword
- `ix-explain` — full role, importance, and caller details for a symbol
- `ix-neighbors` — callers, callees, and dependencies
- `ix-impact` — blast radius for a file or symbol
- `ix-trace` — full execution path trace
- `ix-rank` — top symbols by dependents, callers, or members
- `ix-subsystems` — all subsystems with file counts and hierarchy
- `ix-inventory` — enumerate files or symbols in a path scope
- `ix-stats` — graph-wide statistics and health
- `ix-smells` — architecture smell detection
- `ix-map` — architectural overview with subsystem table
- `ix-ingest` — graph status and refresh trigger
- `ix-decide` — pre-edit policy verdict (ALLOW / REVIEW / BLOCK)
- `ix-health` — CLI and graph availability check

If `$ARGUMENTS` is non-empty, classify the request and recommend exactly one best starting point:

- Architecture, onboarding, "how does X work", system overview:
  → `/ix-understand <target>`

- Symbol deep dive, "what does X do", feature internals, implementation details:
  → `/ix-investigate <target>`

- Pre-edit risk, blast radius, "what breaks if I change X":
  → `/ix-impact <target>`

- Multi-file change, refactor, migration, implementation plan:
  → `/ix-plan <targets or change description>`

- Bug, failure, regression, unexpected behavior, error message:
  → `/ix-debug <symptom>`

- Design quality, complexity, coupling, smells, architecture health:
  → `/ix-architecture <scope>`

- Documentation, onboarding guide, reference docs:
  → `/ix-docs <target>`

- Simple lookup requests (use tools directly, not skills):
  - Where is X defined (exact name) → call `ix-query` with `symbol: "X"`
  - Search for X by text/pattern → call `ix-locate` with `pattern: "X"`
  - Who calls X → call `ix-neighbors` with `symbol: "X"`, `direction: "callers"`
  - What does X call → call `ix-neighbors` with `symbol: "X"`, `direction: "callees"`
  - Full call chain through X → call `ix-trace` with `symbol: "X"`
  - What files are under a path → call `ix-inventory` with `path: "src/..."`, `kind: "file"`
  - Top symbols by dependents → call `ix-rank` with `by: "dependents"`
  - Architecture smells → call `ix-smells`
  - Is the graph ready? → call `ix-health`

Output format:
```
Best start: <one sentence>
Run: <exact slash command or tool call>
Why: <one short sentence>
```

If the request is ambiguous, make the safest routing choice and note what target placeholder to replace.
