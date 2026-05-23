# Productivity-Tasks Skill - Professional Task and Project Management

## Overview

This skill provides frameworks and techniques for breaking down complex work, prioritizing effectively, planning sprints, estimating accurately, tracking dependencies, and maintaining team alignment through clear communication.

## 1. Task Breakdown Strategies

### The Work Decomposition Tree

Complex projects require systematic decomposition from high-level goals to actionable tasks.

```
Epic: Customer Dashboard v2.0 (13 weeks)
│
├─ Feature: Real-time Data Updates (3 weeks)
│  ├─ Task: Design WebSocket architecture (3 days)
│  │  ├─ Subtask: Research current implementation
│  │  ├─ Subtask: Create architecture diagram
│  │  └─ Subtask: Get tech lead approval
│  │
│  ├─ Task: Implement WebSocket server (5 days)
│  │  ├─ Subtask: Set up socket.io integration
│  │  ├─ Subtask: Implement data streaming protocol
│  │  └─ Subtask: Add error handling/reconnection logic
│  │
│  └─ Task: Frontend WebSocket integration (5 days)
│     ├─ Subtask: Create useWebSocket hook
│     ├─ Subtask: Integrate with state management
│     └─ Subtask: Test under various network conditions
│
├─ Feature: User Authentication (2 weeks)
│  ├─ Task: Design OAuth2 flow (3 days)
│  ├─ Task: Implement backend auth service (5 days)
│  └─ Task: Integrate with frontend (4 days)
│
└─ Feature: Analytics & Reporting (4 weeks)
   ├─ Task: Data collection architecture (5 days)
   ├─ Task: Analytics engine (10 days)
   └─ Task: UI for analytics dashboard (5 days)
```

### Task Definition Checklist

Each task should clearly answer:

```markdown
## Task Template

### Title
Clear, action-oriented name (e.g., "Implement login form validation")

### Description
2-3 sentence problem statement and what "done" means

### Acceptance Criteria
- [ ] Criterion 1 (testable, specific)
- [ ] Criterion 2
- [ ] Criterion 3

### Dependencies
- [ ] Task ABC must be complete first
- [ ] Library XYZ must be upgraded

### Resources Needed
- [ ] Design mockups from Designer
- [ ] API documentation from backend team
- [ ] 2x senior engineers (2 days)

### Estimated Effort
- **Optimistic**: 2 days
- **Likely**: 3 days
- **Pessimistic**: 5 days
- **Estimate Used**: 3 days

### Success Metrics
- [ ] Code review approved
- [ ] Tests pass with >80% coverage
- [ ] Performance benchmark < 500ms

### Risk Factors
- Unclear requirements (medium)
- Integration complexity (high)
- Team capacity (low)
```

### Techniques for Breaking Down Work

#### 1. Vertical Slicing (Preferred)
```
❌ WRONG - Horizontal slices (by layer):
Sprint 1: Database tables and migrations
Sprint 2: Backend API endpoints
Sprint 3: Frontend components
Sprint 4: Integration testing
Risk: No working feature for 4 sprints

✅ RIGHT - Vertical slices (end-to-end):
Sprint 1: User login (DB + API + UI)
Sprint 2: User profile (DB + API + UI)
Sprint 3: Admin dashboard (DB + API + UI)
Risk: Complete feature every sprint
```

#### 2. User Story Format
```
As a [user type]
I want [capability]
So that [business value]

Acceptance Criteria:
- [Specific, testable requirement]
- [Another requirement]

Example:
As a customer
I want to view my order history
So that I can track my purchases and reorder items

Acceptance Criteria:
- Show last 12 months of orders
- Display order date, items, total, status
- Allow filtering by date range
- Load in < 1 second
```

#### 3. MoSCoW Breakdown Within Tasks
```
## Task: Payment Processing

### Must Have (Core functionality)
- [ ] Process credit card payments
- [ ] Store transaction records
- [ ] Send confirmation email

### Should Have (Important but not critical)
- [ ] Support multiple currencies
- [ ] Offer payment plan options

### Could Have (Nice to have)
- [ ] Show payment success animation
- [ ] Provide payment tips

### Won't Have (Out of scope this sprint)
- [ ] PayPal integration (next sprint)
- [ ] Cryptocurrency support (future)
```

## 2. Priority Frameworks

### Eisenhower Matrix (Importance × Urgency)

```
                 URGENT          NOT URGENT
            ┌───────────────┬─────────────┐
IMPORTANT   │   DO FIRST    │  SCHEDULE   │
            │   (Quadrant I)│  (Quadrant II)
            ├───────────────┼─────────────┤
NOT         │  DELEGATE     │  ELIMINATE  │
IMPORTANT   │ (Quadrant III)│ (Quadrant IV)
            └───────────────┴─────────────┘

Quadrant I: Production incidents, critical bugs
→ Handle immediately, interrupts scheduled work

Quadrant II: Feature development, training, planning
→ Schedule focused time, prevents Quadrant I crisis

Quadrant III: Low-value meetings, some emails
→ Delegate or batch process

Quadrant IV: Time wasters, excessive socializing
→ Eliminate or minimize
```

### MoSCoW Prioritization

```
MOSCOW Scoring:

Must Have (40-60% of capacity)
- Critical to success
- No workaround exists
- Project fails without it
- Examples: Login, payment processing

Should Have (20-30% of capacity)
- Important but not critical
- Workaround exists
- Nice to have soon
- Examples: User preferences, export data

Could Have (10-20% of capacity)
- Desirable but not necessary
- Workaround easy
- Lower impact
- Examples: Dark mode, animations

Won't Have (Document for future)
- Out of scope for current release
- Revisit in future iterations
- Examples: Mobile app, API, integrations

Formula:
- List all requirements
- Assign to Must/Should/Could/Won't
- Move items down if Must exceeds capacity
```

### RICE Scoring (Reach × Impact × Confidence × Effort)

```
RICE = (Reach × Impact × Confidence) / Effort

Where:
- Reach: How many users affected this quarter (1-100+)
- Impact: How significant the change (0.25 = minimal, 1 = medium, 3 = major)
- Confidence: How confident you are (0% = low, 100% = high)
- Effort: How many weeks to complete (1-20 weeks)

Example:
Feature: One-click checkout

Reach: 10,000 users/quarter (use conversion data)
Impact: 3 (major change to purchase flow)
Confidence: 80% (based on similar features)
Effort: 4 weeks

RICE = (10000 × 3 × 0.80) / 4 = 6,000

Scoring Guide:
- 100+: Huge impact, prioritize first
- 50-100: High impact
- 10-50: Medium impact
- <10: Low impact, reconsider or defer
```

### Value vs. Effort Matrix

```
           HIGH EFFORT    LOW EFFORT
        ┌──────────────┬────────────┐
HIGH    │  LONG-TERM   │  QUICK     │
VALUE   │  PLANNING    │  WINS      │
        │ (Schedule)   │(Do First)  │
        ├──────────────┼────────────┤
LOW     │  RECONSIDER  │  AVOID     │
VALUE   │  OR REJECT   │            │
        └──────────────┴────────────┘

Quick Wins: High value, low effort
→ Build momentum and morale
→ Prioritize in every sprint

Long-term: High value, high effort
→ Break into smaller chunks
→ Schedule strategically

Avoid: Low value, high effort
→ Only if forced by constraints
```

## 3. Sprint Planning

### Pre-Sprint: Backlog Refinement

```markdown
## Backlog Refinement Checklist (1 week before sprint)

### Product Owner Tasks
- [ ] Prioritize backlog using RICE/Eisenhower
- [ ] Add missing acceptance criteria
- [ ] Estimate using story points (1, 2, 3, 5, 8, 13)
- [ ] Identify dependencies
- [ ] Ensure technical feasibility

### Technical Lead Tasks
- [ ] Review technical complexity
- [ ] Flag architectural concerns
- [ ] Suggest implementations
- [ ] Validate effort estimates
- [ ] Identify blocked items

### Team Tasks
- [ ] Read and understand stories
- [ ] Add questions/concerns to comments
- [ ] Suggest improvements
- [ ] Validate estimates feel right

### Exit Criteria
- [ ] All backlog items have acceptance criteria
- [ ] Story points assigned to all stories
- [ ] No more than 3 questions per story
- [ ] Team confidence >= 80%
```

### Sprint Planning Meeting

```markdown
## Sprint Planning: Q2 Sprint 3
**Duration**: 4 hours (for 2-week sprint)
**Participants**: Full team

### Part 1: Goal Setting (30 minutes)
- Product Owner presents sprint goal
- Team discusses capacity and constraints
- Goal statement finalized

**Sprint Goal Example**:
"Implement user authentication and profile management
so customers can create accounts and manage settings"

### Part 2: Story Selection (90 minutes)
- Discuss top priority stories
- Team members volunteer for work
- Adjust estimate if needed
- Add to sprint

**Capacity Check**:
```
Team Capacity (2 weeks):
- Developer 1: 10 points (part-time on support)
- Developer 2: 13 points
- Developer 3: 13 points
- Designer: 5 points (part-time)

Total Capacity: 41 story points

Selected Stories:
- User login (8 points)
- User profile (5 points)
- Password reset (3 points)
- Profile edit form (5 points)
- Email verification (5 points)
- API documentation (3 points)
- Bug fixes (3 points)

Total: 32 points ✓ (Under capacity for safety buffer)
```

### Part 3: Task Breakdown (90 minutes)
- For each story, break into implementation tasks
- Assign owners
- Identify blockers
- Set acceptance criteria

**Example Story Breakdown**:
```
Story: User Login (8 points)

Tasks:
1. [ ] Design login flow (1 day) - Designer
   - Mockups, user journey, error states

2. [ ] Implement backend authentication (3 days) - Backend Dev
   - JWT token generation
   - Password hashing
   - Session management
   - Error handling

3. [ ] Create login form UI (2 days) - Frontend Dev
   - Form component with validation
   - Error message display
   - Loading state

4. [ ] API integration (1 day) - Frontend Dev
   - Connect form to backend
   - Handle auth errors
   - Store token locally

5. [ ] Testing (1 day) - QA
   - Functional testing
   - Security testing
   - Edge cases (invalid credentials, etc)

6. [ ] Code review & deployment (0.5 days)
```

### Part 4: Risk Identification (30 minutes)
- Identify blockers for each story
- Determine dependencies
- Flag external risks
- Create mitigation plan

**Risk Register**:
```
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Design delay | Medium | High | Start with admin input |
| API spec unclear | Medium | High | Engineering review by EOD |
| Database migration | Low | Critical | Run on staging first |
```

### Part 5: Commitment (30 minutes)
- Team reviews selected work
- Team commits to sprint goal
- Define done criteria
- Agree on daily standup time

**Definition of Done**:
- [ ] Code passes automated tests
- [ ] Code review approved
- [ ] No new linting errors
- [ ] Acceptance criteria met
- [ ] Documented (comments, API docs)
- [ ] QA tested and approved
```

## 4. Time Estimation Techniques

### Planning Poker (Team Estimation)

```
1. Read story aloud
2. Each person secretly estimates (1,2,3,5,8,13,21 points)
3. Reveal estimates simultaneously
4. Discuss outliers
5. Re-estimate if needed
6. Accept estimate or continue discussion

Why Planning Poker Works:
- Removes anchoring bias
- Forces individual thinking
- Makes assumptions visible
- Builds team consensus
- Faster than sequential estimation
```

### Three-Point Estimation

```
For complex tasks, estimate three scenarios:

Optimistic (O): Best case, everything goes right - 2 days
Likely (L): Most probable scenario - 3 days
Pessimistic (P): Something goes wrong - 5 days

Expected Duration = (O + 4L + P) / 6
= (2 + 4*3 + 5) / 6 = 3.5 days

Example:
- Optimistic: 1 day (skip all complications)
- Likely: 3 days (normal challenges)
- Pessimistic: 8 days (everything goes wrong)

Expected = (1 + 4*3 + 8) / 6 = 3.5 days

This gives more realistic estimates than single-point estimates.
```

### Bottom-Up vs. Top-Down Estimation

```
TOP-DOWN (Macro Planning)
┌─────────────────────────────┐
│ Project: 16 weeks           │
├─────────────────┬───────────┤
│ Feature A       │ 4 weeks   │
├────────┬────────┼────────┬──┤
│ Task A1 │ Task A2 │ Task A3 │
│ 2 wks   │ 1 wk    │ 1 wk    │
└────────┴────────┴────────┴──┘

Issue: May miss details
Use for: Project timeline, capacity planning

BOTTOM-UP (Detailed Estimation)
Task 1: Design authentication (3 days)
  - Subtask 1a: Research OAuth2 (1 day)
  - Subtask 1b: Design flow (1 day)
  - Subtask 1c: Document (0.5 days)

Task 2: Implement backend (5 days)
  - Subtask 2a: Models & migrations (2 days)
  - Subtask 2b: Authentication routes (2 days)
  - Subtask 2c: Error handling (1 day)

...sum to detailed estimate

Use for: Sprint planning, detailed execution
```

### Adjusting Estimates Over Time

```
# Estimate Accuracy Calibration

Initial estimate: 8 days
Actual spent: 6 days
Remaining: 1 day
Variance: -1.25 days per day

This person tends to underestimate by 10-15%.
Next estimate adjustment: +12%

# By Experience Level
Junior dev: Add 30-50% contingency
Mid-level dev: Add 10-20% contingency
Senior dev: Add 5-10% contingency

# By Complexity
Clear, straightforward: 1x estimate
Some unknowns: 1.3x estimate
High complexity, unknowns: 1.5x estimate
Experimental/research: 2x estimate
```

## 5. Kanban Workflow

### Board Setup

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│   BACKLOG    │   TO DO      │   IN PROGRESS│    DONE      │
├──────────────┼──────────────┼──────────────┼──────────────┤
│              │              │              │              │
│ Task: API    │ Task: Login  │ Task: Auth   │ Task: Setup  │
│ docs         │ form (5pts)  │ backend      │ CI/CD        │
│              │              │ (8 pts)      │              │
│              │              │ [Dev A]      │              │
│              │              │              │              │
│ Task:        │ Task:        │              │ Task: Email  │
│ Dashboard    │ Password     │ Task: Docs   │ validation   │
│ UI (13pts)   │ reset        │ (3pts)       │              │
│              │              │ [Dev B]      │              │
│              │              │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┘

WIP Limits (Work In Progress):
- TO DO: No limit (backlog)
- IN PROGRESS: 6 items max (focus)
- DONE: No limit (archive when sprint ends)

Rationale: Limit WIP to prevent context switching
```

### Kanban Metrics

```
1. Lead Time (Calendar days)
   = Date item completes - Date item created
   Goal: Minimize, typically 5-10 days

2. Cycle Time (Working days in progress)
   = Date item completes - Date item started
   Goal: Minimize, typically 2-5 days

3. Throughput
   = Items completed per week
   Goal: Maximize and stabilize
   Example: Completing 8 items/week

4. Burndown (Optional in Kanban)
   Show: Remaining story points over time
   Useful for: Tracking sprint progress

# Kanban Improvement Practices
- Identify bottlenecks (which stage slows progress)
- Implement quick wins (parallelize, automate)
- Focus on stabilizing delivery
- Use metrics to drive improvements
```

## 6. Dependency Tracking

### Dependency Graph

```
                 ┌──────────────────┐
                 │  Database Setup  │ (Critical Path)
                 └────────┬─────────┘
                          │ MUST COMPLETE FIRST
              ┌───────────┴──────────────┐
              ▼                          ▼
        ┌─────────────┐         ┌──────────────┐
        │ API Models  │         │ API Routes   │
        └────┬────────┘         └──────┬───────┘
             │                         │
             │ 2-3 days wait ────────  │
             │                         │
             └──────────┬──────────────┘
                        ▼
                ┌───────────────┐
                │ Frontend Test │
                │ Integration   │
                └───────────────┘

Critical Path: DB Setup → API Models → API Routes → Frontend Test
Duration: 10 days (longest chain)

Non-critical: Email notifications can start anytime (5 day duration)
Can be delayed up to 5 days without affecting overall timeline
```

### Blocker Escalation Process

```
WHEN BLOCKED:
1. Owner identifies blocker immediately
   (Don't wait, report same day)

2. Document in Asana/Jira:
   - What's blocked: "Feature X implementation"
   - Root cause: "API spec not finalized"
   - Impact: "3 developers waiting"
   - Proposed solution: "Use temporary mock API"

3. Escalation (if unresolved within 4 hours):
   - Slack message to tech lead
   - Flag in standup meeting
   - Tag relevant decision maker

4. Temporary Workaround:
   - Propose interim solution
   - Continue with other work
   - Don't block entire team

5. Resolution:
   - Document decision
   - Communicate to team
   - Unblock dependent tasks

Example Blocker:
```
**Blocked**: Password reset email service not accessible

**Root Cause**: Email provider API down for maintenance

**Impact**: 2 devs cannot test email flow, 1 QA blocked

**Proposed Solution**:
- Use mock email service for testing (30 min to implement)
- Re-test with real service once provider recovers

**Status**: Mock service created, testing resumed
Expected resolution: Provider back online in 2 hours
```

## 7. Status Reporting and Communication

### Weekly Status Report Template

```markdown
# Weekly Status Report - Week of 2026-04-07

## Sprint Progress
- **Sprint**: Q2 Sprint 3
- **Goal**: Complete user authentication features
- **Progress**: 68% complete (8 of 12 stories done)
- **Trajectory**: On track to complete by Friday

## Completed This Week
- ✅ Login form implementation (5 pts)
- ✅ Password reset flow (3 pts)
- ✅ Email verification system (5 pts)
- 🔄 Profile management (in progress, 90% done)

## On Track
- User profile editing (2 days remaining)
- API documentation (2 days remaining)
- QA testing (starts Friday)

## At Risk (Flagged)
- Database migration script
  - **Issue**: Complexity higher than estimated
  - **Impact**: Could delay deployment by 1-2 days
  - **Mitigation**: Senior DBA assigned, pair programming
  - **Owner**: DevOps Lead
  - **Status**: Under control

## Blocked (0 blockers)
- None currently

## Metrics
| Metric | This Week | Last Week | Trend |
|--------|-----------|-----------|-------|
| Velocity | 32 pts | 28 pts | ↑ +14% |
| Bug count | 2 new | 4 new | ↑ improving |
| Test coverage | 78% | 75% | ↑ +3% |
| Deployment frequency | 5x | 3x | ↑ better |

## Next Week
- Complete profile management feature
- Begin QA phase for auth features
- Start planning for next sprint

## Team Notes
- Great collaboration on auth implementation
- Need better API documentation process (will address next sprint)
- Performance testing scheduled for Thursday

## Requests for Org
- Product manager sign-off on profile UI (needed by Wednesday)
```

### Daily Standup Format (15 minutes max)

```
AGENDA:
1. Team name out loud (build cohesion)
2. Each person answers 3 questions:

What did I accomplish yesterday?
- Completed login form validation
- Merged PR for password reset
- Fixed 2 bugs in email service

What am I working on today?
- Implementing profile edit UI
- Code review on auth routes
- Pair programming on email tests

Do I have blockers?
- Need API spec update (expected today)
- All other dependencies clear

3. Identify patterns:
- Are multiple people blocked on same thing?
- Any help needed?
- Any celebrations/wins to recognize?

Red Flags:
- Person working on same task 3+ days (might need help)
- No progress updates for several days (check in)
- No clear next steps (needs clarification)
```

## 8. Kanban Ceremonies

### Daily Standup (15 min)
- Update board status
- Identify blockers
- Rebalance workload

### Weekly Review (30 min)
- Demo completed work
- Celebrate wins
- Gather feedback

### Weekly Planning (30 min)
- Reprioritize backlog
- Add new items
- Update estimates

### Retrospective (Monthly, 1 hour)
- What went well?
- What could improve?
- What will we do differently?

## Best Practices

1. **Break Work into Manageable Chunks**: Tasks should take 1-3 days
2. **Estimate Realistically**: Include overhead (code review, testing, deployment)
3. **Track Dependencies Explicitly**: Document what blocks what
4. **Communicate Blockers Immediately**: Don't wait for standup
5. **Measure and Adjust**: Track velocity, adjust estimates over time
6. **Celebrate Completion**: Recognition matters for morale
7. **Continuous Improvement**: Use retrospectives to improve process
8. **Transparent Status**: Regular updates prevent surprises

## Common Pitfalls

❌ **Underestimating consistently**
→ Add historical variance to estimates
→ Use 3-point estimation for complex work

❌ **Starting too many tasks**
→ Enforce WIP limits
→ Focus on completing before starting new

❌ **Not tracking dependencies**
→ Causes surprises and cascading delays
→ Maintain explicit dependency graph

❌ **Ignoring blockers**
→ Small delays compound quickly
→ Escalate immediately and creatively solve

❌ **Skipping code review, testing**
→ Creates technical debt
→ Budget time explicitly in estimates
