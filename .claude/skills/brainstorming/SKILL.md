# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each section whether it looks right so far.

## The Process

**Understanding the idea:**
- Check out the current project state first (files, docs, recent commits)
- Ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: purpose, constraints, success criteria

**Exploring approaches:**
- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**
- Once you believe you understand what you're building, present the design
- Break it into sections of 200-300 words
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

## After the Design

**Documentation:**
- Write the validated design to `docs/plans/YYYY-MM-DD-<topic>-design.md`
- Use elements-of-style:writing-clearly-and-concisely skill if available
- Commit the design document to git

**Implementation (if continuing):**
- Ask: "Ready to set up for implementation?"
- Use superpowers:using-git-worktrees to create isolated workspace
- Use superpowers:writing-plans to create detailed implementation plan

## Understanding the Requirement

When exploring ideas, systematically investigate these dimensions:

**User Intent & Value**
- What problem does this solve?
- Who is the primary user?
- What's the measurable success metric?
- What happens if we don't build this?

**Scope & Constraints**
- What's in scope? What's explicitly out?
- Do we have time/resource constraints?
- Are there technical limitations?
- Are there compliance/security requirements?

**Alternatives & Trade-offs**
- What's the simplest solution?
- What's the most extensible solution?
- What's the fastest to ship solution?
- What are the pros/cons of each?

**Validation & Testing**
- How will we know if it works?
- What edge cases matter?
- Who will we test with?
- What metrics do we measure?

## Design Template

When presenting the design, include these sections:

```markdown
# Feature Design: [Name]

## Overview
- Problem statement
- Success criteria
- Key assumptions

## Architecture
- System diagram or flow
- Key components
- Data models
- Integration points

## Implementation Strategy
- Phased approach (MVP → V1 → V2)
- Dependencies
- Risk mitigation
- Testing plan

## User Experience
- User flows/wireframes
- Key interactions
- Edge cases handled
- Accessibility considerations

## Success Metrics
- KPIs to track
- Baseline vs. goal
- Measurement method
```

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling (recommend primary option)
- **Incremental validation** - Present design in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense
- **Think like a product manager** - Focus on outcomes, not features
- **Document decisions** - Record the "why" not just the "what"
