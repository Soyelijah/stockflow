# PostToolUse Hook

This hook executes after tool execution completes.

## Responsibilities
- Verify tool execution success
- Update project profile
- Log outcomes to audit trail
- Trigger auto-verify workflows (code-review, security-audit, etc.)

## Implementation
Triggered automatically by Claude Code after tool calls
