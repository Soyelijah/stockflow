# Productivity-Memory Skill - Persistent Knowledge Management

## Overview

This skill provides frameworks and patterns for maintaining persistent team memory across projects, development cycles, and personnel changes. Enables institutional knowledge preservation and efficient context recovery.

## 1. Knowledge Base Structure

### Core Organization
```
memory/
├── decisions/           # Architecture Decision Records (ADRs)
├── lessons/            # Lessons Learned Database
├── faq/                # Frequently Asked Questions
├── code-snippets/      # Reusable Code Patterns
├── architecture/       # System Architecture Documentation
├── troubleshooting/    # Common Issues and Solutions
├── runbooks/           # Operational Procedures
├── team-standards/     # Team Conventions
└── context-index.md    # Master index and search guide
```

## 2. Architecture Decision Records (ADRs)

### Format Template

```markdown
# ADR-001: Choose React for Frontend Framework

## Status
Accepted | Pending | Rejected | Superseded

## Context
The team needed to select a frontend framework for a new customer-facing dashboard.
Requirements included:
- Real-time data updates
- Complex state management
- Large component library ecosystem
- Strong TypeScript support

## Decision
We choose React because:
1. Robust ecosystem (React Query, Redux, Zustand)
2. Excellent TypeScript integration via @types/react
3. Large community and abundant learning resources
4. Proven at scale (meta, netflix, uber)

## Consequences
**Positive:**
- Fast learning curve for new team members
- Rich UI component library (Material-UI, Chakra)
- Strong performance with proper memoization
- Excellent debugging tools (React DevTools)

**Negative:**
- Learning curve for JSX paradigm
- Managing state complexity (mitigated with Zustand)
- CSS-in-JS tooling can be verbose

## Alternatives Considered
1. Vue.js - More concise syntax, but smaller ecosystem
2. Angular - Heavier, steeper learning curve, enterprise-focused
3. Svelte - Promising, but smaller community and library support

## Related ADRs
- ADR-002: TypeScript for Type Safety
- ADR-003: Zustand for State Management

## Revision History
- 2026-04-01: Initial proposal
- 2026-04-05: Team approval
- 2026-04-07: Implemented and documented
```

### ADR Index
```markdown
# Architecture Decisions Index

| ID | Title | Status | Date | Impact |
|---|---|---|---|---|
| ADR-001 | React Frontend Framework | Accepted | 2026-04-07 | High |
| ADR-002 | TypeScript Type Safety | Accepted | 2026-04-07 | High |
| ADR-003 | PostgreSQL Primary Database | Accepted | 2026-04-01 | High |
| ADR-004 | Microservices vs Monolith | Accepted | 2026-03-20 | Critical |
| ADR-005 | API Versioning Strategy | Accepted | 2026-03-15 | Medium |

**Search by category:**
- [Frontend Decisions](./frontend/index.md)
- [Backend Decisions](./backend/index.md)
- [Database Decisions](./database/index.md)
- [Infrastructure Decisions](./infrastructure/index.md)
```

## 3. Decision Log

### Daily Standup Format

```markdown
# Decision Log - Week of 2026-04-07

## Monday, 2026-04-07

### Daily Standup
- **Participants**: Alice (PM), Bob (Backend), Carol (Frontend)
- **Project**: Customer Dashboard v2.0

### Decisions Made

#### 1. Increase API Rate Limits
- **Issue**: Frontend experiencing throttling at 50 req/min
- **Decision**: Increase to 200 req/min for authenticated users
- **Owner**: Bob (Backend)
- **Timeline**: Implement by EOD 2026-04-07
- **Rationale**: Current limit insufficient for real-time updates
- **Risk**: Increased server load (estimated 15%)
- **Mitigation**: Enable caching layer before going live

#### 2. Delay Mobile Feature
- **Issue**: iOS app dependencies causing 2-week delay
- **Decision**: Move mobile features to v2.1 sprint
- **Owner**: Alice (PM)
- **Impact**: Delays mobile availability by 2 weeks
- **Alternative Rejected**: Using native iOS team (cost-prohibitive)

### Action Items
- [ ] Bob: Implement rate limit increase
- [ ] Carol: Update frontend to handle 200 req/min
- [ ] Alice: Communicate delay to stakeholders

### Follow-up Decisions Needed
- [ ] Caching strategy (Redis vs in-memory)
- [ ] Mobile release date for v2.1
```

## 4. Lessons Learned Database

### Template

```markdown
# Lesson Learned: Implement Comprehensive Error Handling Early

## Metadata
- **Date**: 2026-04-05
- **Project**: Payment Service Migration
- **Category**: Best Practices / Error Handling
- **Severity**: High (affected production)
- **Status**: Resolved

## Situation
During payment service migration, we discovered that error messages from the payment provider were not being logged properly. This caused customer payment failures to go undetected for 4 hours.

## Root Cause
The API client wrapper did not implement proper error handling for edge cases:
1. Timeout errors not caught
2. Provider-specific error codes not translated
3. Errors not forwarded to observability platform

## What We Learned
1. **Always implement structured error handling early**
   - Generic try-catch is insufficient for critical services
   - All error paths must be intentional and logged

2. **Logging must be comprehensive**
   - Error context (request ID, user, timestamp)
   - Stack traces should not be truncated
   - Errors should be categorized by severity

3. **Testing edge cases is critical**
   - Simulate provider errors before production
   - Test timeout scenarios explicitly

## Action Taken
```python
# Before: Generic error handling
try:
    result = payment_provider.charge(amount)
except Exception as e:
    logger.error(f"Payment failed: {e}")

# After: Comprehensive error handling
try:
    result = payment_provider.charge(amount)
except PaymentTimeoutError as e:
    logger.error(
        "Payment timeout",
        extra={
            'request_id': request.id,
            'user_id': user.id,
            'amount': amount,
            'error': str(e)
        }
    )
    alert_ops_team(f"Payment timeout for user {user.id}")
    raise PaymentProcessingException("Payment processing delayed")
except PaymentProviderError as e:
    logger.error(
        f"Provider error {e.code}",
        extra={
            'error_code': e.code,
            'request_id': request.id
        }
    )
    raise
```

## Impact
- Reduced MTTR (mean time to recovery) from 4 hours to ~5 minutes
- Prevented 47 duplicate payment attempts
- Improved monitoring coverage by 95%

## Related Lessons
- [Lesson: Observability at Scale](./observability-at-scale.md)
- [Lesson: Production Readiness Checklist](./production-checklist.md)

## Implementation Checklist
- [x] Implement structured error handling
- [x] Add comprehensive logging
- [x] Create error scenarios test suite
- [x] Set up error rate alerting
- [x] Document error codes and handling

## References
- [Our Error Handling Standard](../standards/error-handling.md)
- [Observability Best Practices](../references/observability.md)
```

### Lessons Index

```markdown
# Lessons Learned Index

## By Category

### Error Handling (5 lessons)
1. [Implement comprehensive error handling early](./error-handling-early.md)
2. [Structured logging for debugging](./structured-logging.md)
3. [Circuit breaker patterns for resilience](./circuit-breaker.md)
4. [Graceful degradation strategies](./graceful-degradation.md)
5. [Monitoring and alerting essentials](./monitoring-essentials.md)

### Performance (4 lessons)
1. [Database query optimization](./query-optimization.md)
2. [Caching strategies](./caching-strategies.md)
3. [Load testing before production](./load-testing.md)
4. [Memory leak detection](./memory-leaks.md)

### Team Process (3 lessons)
1. [Code review best practices](./code-review.md)
2. [Incident response procedures](./incident-response.md)
3. [Effective retrospectives](./retrospectives.md)

## By Severity
- **Critical** (5): Issues that caused production incidents
- **High** (8): Issues that could cause production incidents
- **Medium** (12): Issues that impact efficiency
- **Low** (6): Nice-to-know information

## Most Impactful
1. Comprehensive error handling early - Prevented 47 duplicate payments
2. Structured logging - Reduced MTTR by 75%
3. Circuit breaker pattern - Prevented cascading failures
```

## 5. FAQ Management

### FAQ Template

```markdown
# FAQ: API Integration

## Q: How do I authenticate API requests?

### Answer
All API requests require Bearer token authentication in the Authorization header:

```
Authorization: Bearer YOUR_API_TOKEN
```

**Example:**
```bash
curl -H "Authorization: Bearer abc123xyz" \
     https://api.example.com/v1/users
```

### Related
- [Authentication Documentation](../docs/authentication.md)
- [Token Management](../docs/token-management.md)

---

## Q: What's the rate limit policy?

### Answer
Rate limits are per-user, not per-IP:
- **Authenticated users**: 200 requests/minute
- **Burst limit**: 1000 requests/hour
- **Response header**: `X-RateLimit-Remaining`

When rate limited, you'll receive HTTP 429 with retry-after header.

### Mitigation Strategies
1. Batch requests (combine 10 requests into 1)
2. Implement exponential backoff
3. Use webhooks instead of polling
4. Contact support for higher limits

### Related
- [Rate Limiting Documentation](../docs/rate-limiting.md)
- [Webhook Setup](../docs/webhooks.md)

---

## Q: How do I handle API errors?

### Answer
All errors follow a consistent format:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "User-facing error message",
    "details": {
      "field": "email",
      "reason": "must be valid email"
    }
  }
}
```

**Error Codes:**
- `INVALID_REQUEST` (400): Malformed request
- `UNAUTHORIZED` (401): Missing/invalid auth
- `FORBIDDEN` (403): Access denied
- `NOT_FOUND` (404): Resource doesn't exist
- `CONFLICT` (409): Resource conflict
- `SERVER_ERROR` (500): Internal error

### Handling Strategies
```python
def handle_api_error(response):
    if response.status_code == 429:
        # Rate limited - wait and retry
        wait_time = int(response.headers['Retry-After'])
        time.sleep(wait_time)
        return retry()
    elif response.status_code >= 500:
        # Server error - retry with backoff
        return retry_with_backoff()
    elif response.status_code == 401:
        # Invalid token - refresh and retry
        refresh_token()
        return retry()
    else:
        # Client error - log and fail
        raise APIException(response.json()['error'])
```

### Related
- [Error Handling Guide](../docs/errors.md)
- [Troubleshooting Common Issues](../troubleshooting/common-issues.md)
```

## 6. Code Snippet Library

### Organization

```
code-snippets/
├── python/
│   ├── async-patterns.md
│   ├── error-handling.md
│   ├── database-queries.md
│   └── testing.md
├── javascript/
│   ├── async-await.md
│   ├── react-hooks.md
│   ├── error-handling.md
│   └── testing.md
├── sql/
│   ├── common-queries.md
│   └── performance-optimization.md
└── INDEX.md
```

### Snippet Template

```markdown
# Async Request with Retry

## Language: Python
## Category: Error Handling
## Tags: async, retry, resilience, http

## Problem
Need to make HTTP requests with automatic retry on failure, exponential backoff, and timeout handling.

## Solution

```python
import asyncio
import aiohttp
from typing import Optional

class RetryableHttpClient:
    def __init__(self, max_retries=3, base_delay=1):
        self.max_retries = max_retries
        self.base_delay = base_delay

    async def get(self, url: str, timeout: int = 10) -> dict:
        for attempt in range(self.max_retries):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        url,
                        timeout=aiohttp.ClientTimeout(total=timeout)
                    ) as response:
                        return await response.json()

            except asyncio.TimeoutError:
                if attempt == self.max_retries - 1:
                    raise
                delay = self.base_delay * (2 ** attempt)
                await asyncio.sleep(delay)

            except aiohttp.ClientError as e:
                if attempt == self.max_retries - 1:
                    raise
                delay = self.base_delay * (2 ** attempt)
                await asyncio.sleep(delay)

# Usage
client = RetryableHttpClient(max_retries=3, base_delay=1)
data = await client.get('https://api.example.com/data')
```

## Key Points
1. Exponential backoff: 1s, 2s, 4s delays
2. Timeout handling prevents hanging requests
3. Retries only on specific error conditions
4. Last attempt raises exception (fail-fast)

## Related Snippets
- [Sync Request with Retry](./sync-request-retry.md)
- [Timeout Management](./timeout-management.md)

## Testing
```python
@pytest.mark.asyncio
async def test_retries_on_timeout():
    client = RetryableHttpClient(max_retries=2, base_delay=0.1)
    with pytest.raises(asyncio.TimeoutError):
        await client.get('http://example.com/slow')
```

## Performance Notes
- Exponential backoff prevents thundering herd
- Timeout of 10s prevents hanging indefinitely
- Suitable for external API calls

## Alternatives
- [requests-retry](https://pypi.org/project/requests-retry/)
- [tenacity library](https://tenacity.readthedocs.io/)
```

## 7. Meeting Notes Integration

### Template

```markdown
# Team Meeting: Q2 Planning Session

## Date: 2026-04-07
## Duration: 90 minutes
## Participants: Alice (PM), Bob (Tech Lead), Carol (DevOps), Dave (QA)
## Facilitator: Alice

## Agenda
1. Q2 Feature Priorities (30 min)
2. Infrastructure Roadmap (20 min)
3. Team Hiring Plan (20 min)
4. Process Improvements (20 min)

## Decisions Made

### Feature Priorities for Q2
- **Approved**: Payment processing v2 (2 week sprint)
- **Approved**: Mobile app foundation (3 week sprint)
- **Deferred**: Analytics dashboard (to Q3)
- **Decision Owner**: Alice

### Infrastructure Upgrades
- **Approved**: Kubernetes migration (4 week project)
- **Approved**: Database scaling (2 week project)
- **Owner**: Carol
- **Risk**: 1 week production freeze during K8s cutover

### Hiring Plan
- **Approved**: Hire 2 senior backend engineers
- **Approved**: Hire 1 DevOps engineer
- **Timeline**: Complete by end of May
- **Owner**: Alice

## Action Items

| Task | Owner | Due | Status |
|------|-------|-----|--------|
| Create detailed project plans | Bob | 2026-04-10 | [ ] |
| Draft K8s migration plan | Carol | 2026-04-12 | [ ] |
| Post job descriptions | Alice | 2026-04-08 | [ ] |
| Schedule interview rounds | Alice | 2026-04-15 | [ ] |

## Metrics & Targets

| Metric | Current | Q2 Target |
|--------|---------|-----------|
| API Response Time | 450ms | 250ms |
| Deployment Frequency | 2x/week | 5x/week |
| Test Coverage | 65% | 80% |
| Mean Time to Recovery | 45min | 15min |

## Follow-ups Needed

1. **Infrastructure Planning**: Carol to present detailed K8s timeline
2. **Resource Allocation**: Discuss developer capacity during migration
3. **Risk Mitigation**: Create contingency plan for K8s cutover

## Links & References
- [Q2 Engineering Roadmap](../roadmaps/q2-2026.md)
- [Current Infrastructure Docs](../infrastructure/current-state.md)
- [Hiring Criteria](../team/hiring-criteria.md)

## Next Meeting
- **Date**: 2026-04-14
- **Topic**: Detailed project planning review
- **Duration**: 60 minutes
```

## 8. Team Standards Reference

### Template

```markdown
# Standard: Error Handling in Python Services

## Category: Code Quality
## Status: Active
## Last Updated: 2026-04-05
## Owner: Technical Standards Committee

## Principle
All errors must be:
1. Caught at appropriate levels
2. Logged with full context
3. Propagated with semantic meaning
4. Monitored for alerting

## Rules

### 1. Never Catch Generic Exceptions
```python
# ❌ BAD: Catches everything
try:
    process_data()
except Exception:
    pass

# ✅ GOOD: Specific exceptions
try:
    process_data()
except DataValidationError:
    logger.warning("Invalid data format")
except DataProcessingError:
    logger.error("Processing failed")
```

### 2. Always Include Context
```python
# ❌ BAD: No context
except PaymentError as e:
    logger.error(f"Payment failed: {e}")

# ✅ GOOD: Full context
except PaymentError as e:
    logger.error(
        "Payment processing failed",
        extra={
            'user_id': user.id,
            'amount': amount,
            'error_code': e.code,
            'request_id': request.id,
            'timestamp': datetime.now().isoformat()
        }
    )
```

### 3. Define Custom Exceptions Hierarchy
```python
# Define at module/package level
class ServiceException(Exception):
    """Base exception for service"""
    pass

class ValidationError(ServiceException):
    """Data validation failed"""
    pass

class ExternalServiceError(ServiceException):
    """Third-party service error"""
    pass

class DatabaseError(ServiceException):
    """Database operation failed"""
    pass
```

## Enforcement
- Code review checklist includes error handling review
- Linting rules configured to flag bare except clauses
- Monitoring alerts on unlogged errors

## Related Standards
- [Logging Standard](./logging-standard.md)
- [Exception Hierarchy Guide](./exceptions-guide.md)
- [Observability Standard](./observability-standard.md)

## Review Schedule
- Quarterly review by tech standards committee
- Annual comprehensive audit
```

## 9. Context Index and Search

### Master Index Template

```markdown
# Knowledge Base Master Index

## Quick Navigation

### By Role
- **[Backend Developer Guide](./roles/backend-developer.md)**
  - [Error Handling](./standards/error-handling.md)
  - [Database Patterns](./snippets/database-patterns.md)
  - [API Design](./standards/api-design.md)

- **[Frontend Developer Guide](./roles/frontend-developer.md)**
  - [Component Patterns](./snippets/react-patterns.md)
  - [Performance Tips](./standards/frontend-performance.md)
  - [Testing Guide](./testing/frontend-testing.md)

- **[DevOps/Infrastructure Guide](./roles/devops-guide.md)**
  - [Kubernetes Runbook](./runbooks/kubernetes.md)
  - [Database Administration](./runbooks/database-admin.md)
  - [Incident Response](./runbooks/incident-response.md)

### By Topic

#### Architecture (15 items)
- [ADR Index](./decisions/index.md) - All architecture decisions
- [System Diagrams](./architecture/system-overview.md)
- [Microservices Guide](./architecture/microservices.md)
- [Data Flow Documentation](./architecture/data-flow.md)

#### Development (22 items)
- [Code Snippets Library](./code-snippets/index.md)
- [Development Environment Setup](./dev/setup.md)
- [Testing Standards](./testing/standards.md)
- [Git Workflow](./dev/git-workflow.md)

#### Operations (18 items)
- [Runbooks Index](./runbooks/index.md)
- [Incident Response](./runbooks/incident-response.md)
- [Database Backups](./runbooks/database-backups.md)
- [Monitoring Setup](./operations/monitoring.md)

### By Urgency

#### Critical (5 items)
🔴 Affects production immediately:
- [Production Incident Response](./runbooks/incident-response.md)
- [Database Recovery Procedure](./runbooks/db-recovery.md)
- [Rollback Procedures](./runbooks/rollback.md)
- [Security Breach Response](./security/breach-response.md)
- [Service Degradation Playbook](./runbooks/degradation.md)

#### High Priority (8 items)
🟠 Should know before coding:
- [API Design Standard](./standards/api-design.md)
- [Error Handling Guide](./standards/error-handling.md)
- [Security Best Practices](./security/best-practices.md)
- [Code Review Guidelines](./standards/code-review.md)

### Search

**Find by keyword:**
- Database → [Query Optimization](./snippets/database-patterns.md), [ADR-003](./decisions/adr-003.md)
- Testing → [Test Standards](./testing/standards.md), [Examples](./snippets/testing-patterns.md)
- Error → [Error Handling](./standards/error-handling.md), [Lessons](./lessons/error-handling-early.md)
- Performance → [Caching](./lessons/caching-strategies.md), [Load Testing](./lessons/load-testing.md)

## How to Use This KB

1. **First Time Here?** Start with the [Getting Started Guide](./getting-started.md)
2. **Looking for How-Tos?** Check [Code Snippets](./code-snippets/index.md)
3. **Need to Understand Architecture?** Read [ADRs](./decisions/index.md)
4. **Learning from Past Mistakes?** Review [Lessons Learned](./lessons/index.md)
5. **Need to Operate Services?** Use [Runbooks](./runbooks/index.md)

## Contributing

To add to the knowledge base:
1. Use appropriate templates from [./templates/](./templates/)
2. Add links to [master index](./INDEX.md)
3. Tag content with relevant metadata
4. Submit PR for review

See [Contribution Guide](./CONTRIBUTING.md) for details.
```

## Best Practices

1. **Keep It Current**: Review and update decisions quarterly
2. **Link Everything**: Create cross-references between related documents
3. **Version Control**: Store in Git with clear history
4. **Search Optimization**: Use consistent tagging and naming
5. **Accessibility**: Markdown format for platform independence
6. **Ownership**: Assign owners to keep content maintained
7. **Review Process**: Require approval for architecture decisions
8. **Automation**: Generate indexes from metadata

## Implementation Tools

- **Git-based Storage**: GitHub/GitLab for version control
- **Search**: GitLab Wiki or MkDocs with full-text search
- **Automation**: GitHub Actions to validate and index
- **Templates**: Consistent structure across all documents
- **CI/CD**: Validate markdown syntax automatically

## Resources

- [Markdown Guide](https://www.markdownguide.org/)
- [Architecture Decision Records](https://adr.github.io/)
- [Lessons Learned Best Practices](https://www.pmi.org/)
- [Knowledge Management Systems](https://en.wikipedia.org/wiki/Knowledge_management)
