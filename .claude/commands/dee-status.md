# /dee-status — Ecosystem Dashboard

You are the Devlmer Ecosystem Engine status reporter. When the user runs this command, generate a comprehensive, visually appealing status dashboard of everything installed in their project.

## What to do

1. **Read the project profile** at `.claude/PROJECT_PROFILE.json` and extract:
   - Project name, domain, confidence, architecture
   - Technologies detected
   - Maturity level

2. **Count installed components** by checking these directories:
   - `.claude/skills/` — count directories with SKILL.md files
   - `.claude/commands/` — count .md files
   - `.claude/agents/` — count .md files
   - `.claude/settings.json` — count mcpServers entries and hooks

3. **Check configuration health**:
   - Does `CLAUDE.md` exist at project root?
   - Does `.claude/settings.json` exist and have valid JSON?
   - Does `.claude/PROJECT_PROFILE.json` exist?
   - Are there any MCPs that need API keys? (check `.claude/mcp-env-setup.sh`)

4. **Present the dashboard** in this format:

```
╔══════════════════════════════════════════════════════════════╗
║          DEVLMER ECOSYSTEM ENGINE v3.1 — STATUS             ║
╚══════════════════════════════════════════════════════════════╝

📊 PROJECT: [name]
   Domain: [domain] ([confidence]%)
   Architecture: [arch]
   Technologies: [list]

┌─ COMPONENTS ─────────────────────────────────────────────────┐
│  Skills:        XX installed    (type / to use)              │
│  Slash Commands: XX available                                │
│  Agents:        XX configured                                │
│  MCPs:          XX servers      (YY need API keys)           │
│  Hooks:         XX active                                    │
└──────────────────────────────────────────────────────────────┘

┌─ TOP SKILLS FOR YOUR PROJECT ────────────────────────────────┐
│  Based on [domain] domain:                                   │
│  • /senior-architect — System design & architecture          │
│  • /code-reviewer — Automated code review                    │
│  • /senior-backend — Backend engineering patterns            │
│  • /senior-security — Security best practices                │
│  (type /[skill-name] to activate any skill)                  │
└──────────────────────────────────────────────────────────────┘

┌─ HEALTH CHECK ───────────────────────────────────────────────┐
│  ✅ CLAUDE.md — active                                       │
│  ✅ settings.json — valid                                    │
│  ✅ PROJECT_PROFILE.json — generated                         │
│  ⚠️  3 MCPs need API keys — run /dee-doctor                  │
└──────────────────────────────────────────────────────────────┘

💡 Quick actions:
   /dee-demo    — See the ecosystem in action
   /dee-doctor  — Diagnose and fix issues
   /[skill]     — Use any installed skill
```

5. **Recommend relevant skills** based on the detected domain. Match domain to skills:
   - `saas` / `web_app` → senior-architect, senior-backend, senior-frontend, code-reviewer, ui-design-system
   - `ai_agent` / `chatbot` → senior-architect, senior-prompt-engineer, senior-security, mcp-builder
   - `mobile` → mobile-design, ui-design-system, ui-ux-pro-max
   - `ecommerce` → senior-backend, senior-security, seo-optimizer, copywriting
   - Any domain → code-reviewer, git-commit-helper, senior-security

## Important
- Make the output colorful and easy to scan
- Show REAL numbers from the actual filesystem, don't guess
- If something is missing or broken, flag it clearly with suggestions to fix
- End with actionable next steps
