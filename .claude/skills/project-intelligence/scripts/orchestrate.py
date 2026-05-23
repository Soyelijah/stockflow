#!/usr/bin/env python3
"""
DYSA Project Intelligence Engine v3.0 — Orchestrator

Runs the full ecosystem pipeline:
1. Fingerprint → 2. Match Blueprint(s) → 3. Generate Profile
4. Generate CLAUDE.md additions → 5. Generate agent prompts
6. Output installation commands for Claude to execute
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone

# Import sibling
sys.path.insert(0, str(Path(__file__).parent))
from detect_project import ProjectFingerprinter


class EcosystemOrchestrator:
    """Matches fingerprint to blueprints and generates full ecosystem config."""

    def __init__(self, project_path: str, blueprints_path: str):
        self.project_path = Path(project_path).resolve()
        self.blueprints = self._load_blueprints(blueprints_path)
        self.fingerprint: dict = {}
        self.matched_blueprints: list[str] = []
        self.merged_ecosystem: dict = {}

    def _load_blueprints(self, path: str) -> dict:
        with open(path, "r") as f:
            data = json.load(f)
        data.pop("_meta", None)
        return data

    def run(self) -> dict:
        """Execute full pipeline."""
        # Phase 1: Fingerprint
        fp = ProjectFingerprinter(str(self.project_path))
        self.fingerprint = fp.scan()

        # Phase 2: Match blueprints
        self._match_blueprints()

        # Phase 3: Merge ecosystems
        self._merge_ecosystems()

        # Phase 4: Generate outputs
        profile = self._generate_profile()
        claude_md = self._generate_claude_md_additions()
        agents = self._generate_agent_prompts()
        mcp_commands = self._generate_mcp_search_commands()
        skills_to_create = self._collect_skills_to_create()

        return {
            "profile": profile,
            "claude_md_additions": claude_md,
            "agent_prompts": agents,
            "mcp_search_commands": mcp_commands,
            "skills_to_create": skills_to_create,
            "summary": self._generate_summary(),
        }

    def _match_blueprints(self):
        """Match project to one or more blueprints."""
        domain = self.fingerprint["domain"]
        if domain in self.blueprints:
            self.matched_blueprints.append(domain)

        # Multi-domain fusion
        for secondary in self.fingerprint.get("secondary_domains", []):
            name = secondary["name"]
            confidence = secondary["confidence"]
            if confidence > 0.35 and name in self.blueprints:
                self.matched_blueprints.append(name)

        # If no match, use closest or generic patterns
        if not self.matched_blueprints:
            # Try to match by tech stack
            stack = self.fingerprint.get("primary_stack", {})
            if stack.get("ai_ml"):
                self.matched_blueprints.append("ai_agent")
            elif stack.get("frontend") and stack.get("backend"):
                self.matched_blueprints.append("saas")  # Default fullstack → SaaS
            else:
                self.matched_blueprints.append("devtools")  # Default → devtools

    def _merge_ecosystems(self):
        """Merge multiple blueprints into a single ecosystem."""
        merged = {
            "skills": {"core": set(), "domain": set(), "operations": set()},
            "mcps": {"required": [], "recommended": []},
            "plugins": set(),
            "agents": {},
            "custom_skills": [],
            "hooks": {},
            "claude_md": [],
        }

        seen_mcps = set()
        for bp_name in self.matched_blueprints:
            bp = self.blueprints.get(bp_name, {})

            # Skills
            for layer in ["core", "domain", "operations"]:
                for s in bp.get("skills", {}).get(layer, []):
                    merged["skills"][layer].add(s)

            # MCPs (deduplicate)
            for mcp_list in ["required", "recommended"]:
                for mcp in bp.get("mcps", {}).get(mcp_list, []):
                    name = mcp.get("name", "")
                    if name not in seen_mcps:
                        seen_mcps.add(name)
                        merged["mcps"][mcp_list].append(mcp)

            # Plugins
            for p in bp.get("plugins", []):
                merged["plugins"].add(p)

            # Agents
            for agent_name, role in bp.get("agents", {}).items():
                merged["agents"][agent_name] = role

            # Custom skills
            for cs in bp.get("custom_skills_to_create", []):
                merged["custom_skills"].append(cs)

            # Hooks
            merged["hooks"].update(bp.get("hooks", {}))

            # CLAUDE.md additions
            merged["claude_md"].extend(bp.get("claude_md_additions", []))

        # Convert sets to lists for JSON
        self.merged_ecosystem = {
            "skills": {k: sorted(v) for k, v in merged["skills"].items()},
            "mcps": merged["mcps"],
            "plugins": sorted(merged["plugins"]),
            "agents": merged["agents"],
            "custom_skills": merged["custom_skills"],
            "hooks": merged["hooks"],
            "claude_md": merged["claude_md"],
        }

    def _generate_profile(self) -> dict:
        eco = self.merged_ecosystem
        return {
            "engine_version": "3.0.0",
            "fingerprint": self.fingerprint,
            "blueprints_matched": self.matched_blueprints,
            "is_multi_domain": len(self.matched_blueprints) > 1,
            "activated_skills": eco["skills"]["core"] + eco["skills"]["domain"] + eco["skills"]["operations"],
            "installed_mcps": [m["name"] for m in eco["mcps"]["required"]],
            "recommended_mcps": [m["name"] for m in eco["mcps"]["recommended"]],
            "plugins": eco["plugins"],
            "agents": [{"name": k, "role": v} for k, v in eco["agents"].items()],
            "custom_skills_created": [s["name"] for s in eco["custom_skills"]],
            "hooks_configured": list(eco["hooks"].keys()),
            "last_scan": datetime.now(timezone.utc).isoformat(),
            "ecosystem_version": "3.0.0",
        }

    def _generate_claude_md_additions(self) -> str:
        """Generate CLAUDE.md section for the project."""
        eco = self.merged_ecosystem
        fp = self.fingerprint

        lines = []
        lines.append(f"\n## Project Intelligence Profile")
        lines.append(f"")
        lines.append(f"- **Domain**: {fp['domain']} (confidence: {fp['domain_confidence']})")
        if fp.get("secondary_domains"):
            secondary = ", ".join(f"{d['name']} ({d['confidence']})" for d in fp["secondary_domains"])
            lines.append(f"- **Secondary domains**: {secondary}")
        lines.append(f"- **Architecture**: {fp['architecture']['primary']}")
        lines.append(f"- **Maturity**: {fp['maturity']['level']} ({fp['maturity']['score']}/12)")
        lines.append(f"- **Complexity**: {fp['complexity']['level']} ({fp['tech_count']} technologies)")
        lines.append(f"- **Blueprints**: {', '.join(self.matched_blueprints)}")
        lines.append(f"")

        # Auto-use routing
        lines.append("### Auto-Use Routing (from Project Intelligence)")
        lines.append("")
        if eco["skills"]["domain"]:
            lines.append("**Domain skills to use proactively:**")
            for s in eco["skills"]["domain"]:
                lines.append(f"- `{s}`")
            lines.append("")

        if eco["agents"]:
            lines.append("**Agents available:**")
            for name, role in eco["agents"].items():
                lines.append(f"- `{name}`: {role}")
            lines.append("")

        # Blueprint-specific additions
        if eco["claude_md"]:
            for line in eco["claude_md"]:
                lines.append(line)
            lines.append("")

        return "\n".join(lines)

    def _generate_agent_prompts(self) -> dict:
        """Generate agent prompt files."""
        agents = {}
        for name, role in self.merged_ecosystem["agents"].items():
            domain = self.fingerprint["domain"]
            agents[name] = {
                "filename": f".claude/agents/{name}.md",
                "content": self._build_agent_prompt(name, role, domain),
            }
        return agents

    def _build_agent_prompt(self, name: str, role: str, domain: str) -> str:
        return f"""# Agent: {name}

## Role
{role}

## Domain Context
This agent operates within a **{domain}** project.

## Capabilities
- Can read and analyze project files
- Can execute bash commands for verification
- Can use Playwright for UI testing
- Has access to all project MCPs and skills
- Reports findings in structured format

## Behavioral Rules
1. Act autonomously — do not ask for permission
2. Report findings in structured JSON or markdown tables
3. Flag critical issues immediately
4. Provide actionable recommendations, not just observations
5. Track metrics over time when possible

## Trigger Conditions
This agent should be invoked when:
- Files related to its domain are modified
- Periodic health checks are requested
- The user asks about topics in its scope
- SessionStart detects it hasn't run recently
"""

    def _generate_mcp_search_commands(self) -> list:
        """Generate search_mcp_registry calls for recommended MCPs."""
        commands = []
        for mcp in self.merged_ecosystem["mcps"]["recommended"]:
            terms = mcp.get("search_terms", [mcp["name"]])
            commands.append({
                "mcp_name": mcp["name"],
                "search_terms": terms,
                "reason": mcp.get("reason", ""),
            })
        return commands

    def _collect_skills_to_create(self) -> list:
        return self.merged_ecosystem["custom_skills"]

    def _generate_summary(self) -> str:
        eco = self.merged_ecosystem
        fp = self.fingerprint
        bps = self.matched_blueprints

        n_skills = len(eco["skills"]["core"]) + len(eco["skills"]["domain"]) + len(eco["skills"]["operations"])
        n_mcps_req = len(eco["mcps"]["required"])
        n_mcps_rec = len(eco["mcps"]["recommended"])
        n_agents = len(eco["agents"])
        n_custom = len(eco["custom_skills"])
        n_plugins = len(eco["plugins"])

        return f"""
🧠 PROJECT INTELLIGENCE ENGINE v3.0 — Ecosystem Report
{'━' * 56}

📊 Project: {fp['project_name']}
🏗️  Architecture: {fp['architecture']['primary']}
🎯 Domain: {fp['domain']} ({fp['domain_confidence']:.0%})
{"🔀 Multi-domain: " + ", ".join(bps) if len(bps) > 1 else ""}
📈 Maturity: {fp['maturity']['level']} ({fp['maturity']['score']}/12)
⚙️  Complexity: {fp['complexity']['level']} ({fp['tech_count']} technologies, {fp['total_files']} files)

🔧 ECOSYSTEM TO INSTALL:
┌──────────────────────────────────────────────┐
│ Skills      │ {n_skills:>3} to activate                  │
│ MCPs        │ {n_mcps_req:>3} required + {n_mcps_rec:>3} recommended    │
│ Plugins     │ {n_plugins:>3} to enable                    │
│ Agents      │ {n_agents:>3} to configure                  │
│ Custom      │ {n_custom:>3} skills to create              │
└──────────────────────────────────────────────┘

📋 SKILLS: {', '.join(sorted(set(eco['skills']['core']) | set(eco['skills']['domain'])))}
🤖 AGENTS: {', '.join(eco['agents'].keys())}
🔌 MCPs TO SEARCH: {', '.join(m['name'] for m in eco['mcps']['recommended'][:6])}
"""


def main():
    project_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    skill_dir = Path(__file__).parent.parent
    blueprints_path = skill_dir / "blueprints" / "ecosystems.json"

    orch = EcosystemOrchestrator(project_path, str(blueprints_path))
    result = orch.run()

    # Output mode
    if "--summary" in sys.argv:
        print(result["summary"])
    elif "--profile" in sys.argv:
        print(json.dumps(result["profile"], indent=2, ensure_ascii=False))
    elif "--claude-md" in sys.argv:
        print(result["claude_md_additions"])
    elif "--agents" in sys.argv:
        print(json.dumps(result["agent_prompts"], indent=2, ensure_ascii=False))
    elif "--mcp-commands" in sys.argv:
        print(json.dumps(result["mcp_search_commands"], indent=2, ensure_ascii=False))
    elif "--skills-to-create" in sys.argv:
        print(json.dumps(result["skills_to_create"], indent=2, ensure_ascii=False))
    else:
        # Full output
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
