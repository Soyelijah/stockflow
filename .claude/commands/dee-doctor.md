# /dee-doctor — Ecosystem Health Check & Diagnostics

You are the Devlmer Ecosystem Engine diagnostic tool. When the user runs this command, perform a comprehensive health check of the installed ecosystem and provide actionable fixes for any issues found.

## Diagnostic procedure

Run these checks in order and report results:

### 1. Core Files Check

Verify these files exist and are valid:

| File | Check |
|------|-------|
| `CLAUDE.md` (project root) | Exists, contains "Devlmer" |
| `.claude/settings.json` | Exists, valid JSON, has `hooks` key |
| `.claude/PROJECT_PROFILE.json` | Exists, valid JSON, has `fingerprint` key |
| `.claude/mcp-env-setup.sh` | Exists (optional — only if MCPs installed) |

### 2. Skills Health

For each directory in `.claude/skills/`:
- Check if `SKILL.md` exists
- Check if SKILL.md starts with `---` (YAML frontmatter — this is a BUG, should be pure markdown)
- Check file size (if < 100 bytes, flag as "stub/empty skill")
- Count total skills with real content (> 500 bytes)

Report:
```
SKILLS HEALTH
  ✅ 18 skills with full content (500+ bytes)
  ⚠️  3 skills with minimal content (< 500 bytes): [names]
  ❌ 0 skills with YAML frontmatter (compatibility issue)
```

### 3. Hooks Health

Read `.claude/settings.json` and verify:
- `hooks.SessionStart` exists and has at least 1 entry
- `hooks.PostToolUse` exists and has at least 1 entry with Edit|Write matcher
- Hook commands are valid bash (no syntax errors)

### 4. MCP Health

Read `.claude/settings.json` → `mcpServers` and for each:
- Check if the npm package is specified
- Check if it requires env vars (look for `env` key)
- If env vars are needed, check if they're set (read `.claude/mcp-env-setup.sh`)
- Classify each MCP as: ✅ Ready | ⚠️ Needs API key | ❌ Broken

Report:
```
MCP HEALTH
  ✅ Ready:          5 (github, playwright, context7, redis, elasticsearch)
  ⚠️  Need API keys: 12 (stripe, slack, sentry, datadog, ...)
  ❌ Broken:         0

  To configure API keys, run:
  bash ".claude/setup-wizard.sh" "[project-path]"

  Or set them manually in: .claude/mcp-env-setup.sh
```

### 5. Agents Health

Check `.claude/agents/` directory:
- Count .md files
- Verify each has content (not empty)
- List agent names

### 6. Slash Commands Health

Check `.claude/commands/` directory:
- Count .md files
- Verify each has content
- Check for the 3 core commands: dee-status, dee-demo, dee-doctor

### 7. Project Intelligence Health

Read `.claude/PROJECT_PROFILE.json`:
- Is domain detected? (not "unknown")
- Is confidence > 50%?
- Are technologies listed?
- When was last scan?

If profile is stale or domain is "unknown":
```
⚠️  Project profile may be outdated
   Fix: Delete .claude/PROJECT_PROFILE.json and reinstall,
   or run the fingerprinter manually
```

## Output format

```
╔══════════════════════════════════════════════════════════════╗
║          DEVLMER ECOSYSTEM ENGINE — HEALTH CHECK            ║
╚══════════════════════════════════════════════════════════════╝

┌─ CORE FILES ─────────────────────────────────────────────────┐
│  ✅ CLAUDE.md             — active, [size] bytes             │
│  ✅ settings.json         — valid, [N] hooks + [M] MCPs     │
│  ✅ PROJECT_PROFILE.json  — domain: [X], confidence: [Y]%   │
│  ✅ mcp-env-setup.sh      — [N] keys configured             │
└──────────────────────────────────────────────────────────────┘

┌─ SKILLS ([N] total) ─────────────────────────────────────────┐
│  ✅ [N] with full content                                    │
│  ⚠️  [N] with minimal content                                │
│  ❌ [N] with compatibility issues                            │
└──────────────────────────────────────────────────────────────┘

┌─ HOOKS ──────────────────────────────────────────────────────┐
│  ✅ SessionStart — project intelligence on startup           │
│  ✅ PostToolUse  — auto-verify Python/TypeScript edits       │
└──────────────────────────────────────────────────────────────┘

┌─ MCPs ([N] total) ───────────────────────────────────────────┐
│  ✅ Ready: [list]                                            │
│  ⚠️  Need keys: [list]                                       │
│  ❌ Broken: [list or "none"]                                 │
└──────────────────────────────────────────────────────────────┘

┌─ AGENTS ([N] total) ─────────────────────────────────────────┐
│  ✅ All agents configured and ready                          │
└──────────────────────────────────────────────────────────────┘

┌─ OVERALL HEALTH ─────────────────────────────────────────────┐
│                                                              │
│  Score: 92/100  🟢 HEALTHY                                   │
│                                                              │
│  Issues found: 2                                             │
│  1. 12 MCPs need API keys — run setup wizard                 │
│  2. 3 skills have minimal content                            │
│                                                              │
│  Recommended actions:                                        │
│  → bash ".claude/setup-wizard.sh" "[path]"                   │
│  → Reinstall to update minimal skills                        │
└──────────────────────────────────────────────────────────────┘
```

## Health Score calculation

- Start at 100
- -5 for each missing core file
- -2 for each skill with YAML frontmatter
- -1 for each skill with minimal content
- -1 for each MCP needing API key (capped at -15)
- -5 for each broken MCP
- -10 if no hooks configured
- -5 if project profile domain is "unknown"

Grades:
- 90-100: 🟢 HEALTHY
- 70-89: 🟡 GOOD (minor issues)
- 50-69: 🟠 NEEDS ATTENTION
- 0-49: 🔴 CRITICAL

## Important
- Read REAL files, don't guess
- Show actionable fixes for every issue
- Be specific about what's wrong and how to fix it
- End with the single most important action the user should take
