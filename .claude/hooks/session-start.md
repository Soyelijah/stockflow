# SessionStart Hook

This hook executes at the start of each Claude Code session.

## Responsibilities
- Run project fingerprinter (detect_project.py)
- Generate PROJECT_PROFILE.json
- Load context from memory/ directory
- Initialize orchestration state

## Implementation
Triggered automatically by Claude Code when opening .claude/hooks/session-start.md
