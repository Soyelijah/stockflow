#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  DYSA Project Intelligence Engine v3.1 — Installer          ║
# ║  Installs the engine into any project's .claude/ directory   ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="$(dirname "$SCRIPT_DIR")"
TARGET_DIR="${1:-.}"
TARGET_CLAUDE="$TARGET_DIR/.claude"
TARGET_SKILL="$TARGET_CLAUDE/skills/project-intelligence"

echo "🧠 DYSA Project Intelligence Engine v3.1 — Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Source: $ENGINE_DIR"
echo "📁 Target: $TARGET_DIR"
echo ""

# Create directories
mkdir -p "$TARGET_SKILL/scripts"
mkdir -p "$TARGET_SKILL/blueprints"
mkdir -p "$TARGET_SKILL/templates"
mkdir -p "$TARGET_CLAUDE/agents"

# Copy engine files
cp "$ENGINE_DIR/SKILL.md" "$TARGET_SKILL/SKILL.md"
cp "$ENGINE_DIR/scripts/detect_project.py" "$TARGET_SKILL/scripts/detect_project.py"
cp "$ENGINE_DIR/scripts/orchestrate.py" "$TARGET_SKILL/scripts/orchestrate.py"
cp "$ENGINE_DIR/blueprints/ecosystems.json" "$TARGET_SKILL/blueprints/ecosystems.json"
cp "$SCRIPT_DIR/install.sh" "$TARGET_SKILL/scripts/install.sh"
chmod +x "$TARGET_SKILL/scripts/install.sh"

echo "✅ Engine files installed"

# Run detection
echo ""
echo "🔍 Scanning project..."
FINGERPRINT=$(python3 "$TARGET_SKILL/scripts/detect_project.py" "$TARGET_DIR" 2>/dev/null)

if [ $? -eq 0 ]; then
    DOMAIN=$(echo "$FINGERPRINT" | python3 -c "import json,sys; print(json.load(sys.stdin)['domain'])" 2>/dev/null)
    MATURITY=$(echo "$FINGERPRINT" | python3 -c "import json,sys; print(json.load(sys.stdin)['maturity']['level'])" 2>/dev/null)
    TECH_COUNT=$(echo "$FINGERPRINT" | python3 -c "import json,sys; print(json.load(sys.stdin)['tech_count'])" 2>/dev/null)

    echo "✅ Domain: $DOMAIN"
    echo "✅ Maturity: $MATURITY"
    echo "✅ Technologies: $TECH_COUNT detected"

    # Run orchestrator
    echo ""
    echo "🚀 Generating ecosystem..."
    python3 "$TARGET_SKILL/scripts/orchestrate.py" "$TARGET_DIR" --summary 2>/dev/null

    # Save profile
    python3 "$TARGET_SKILL/scripts/orchestrate.py" "$TARGET_DIR" --profile > "$TARGET_CLAUDE/PROJECT_PROFILE.json" 2>/dev/null
    echo ""
    echo "✅ Profile saved to $TARGET_CLAUDE/PROJECT_PROFILE.json"
else
    echo "⚠️  Could not scan project (Python 3 required)"
fi

echo ""
echo "🎉 Installation complete!"
echo "   Next: Open this project in Claude Code/Cowork to activate the ecosystem"
