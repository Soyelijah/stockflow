# Advanced Git Workflow Skill

Professional git practices for team collaboration. Covers conventional commits, branching strategies, pull request workflows, and automation.

## Conventional Commits

Standardized commit message format enabling automated changelog generation and semantic versioning.

### Commit Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

```
feat:       New feature
fix:        Bug fix
docs:       Documentation only
style:      Code formatting, missing semicolons, etc. (no logic change)
refactor:   Code refactoring without feature change or bug fix
perf:       Performance improvement
test:       Adding or updating tests
chore:      Build process, dependencies, tooling, CI/CD
ci:         CI/CD configuration changes
build:      Build system or external dependencies
```

### Examples

**Simple Feature**
```
feat: add email notification for trade execution

Add EmailService to send notifications when orders complete.
Integrates with SendGrid for reliable delivery.
```

**Bug Fix**
```
fix: prevent race condition in order processing

Use database transaction to ensure atomic order status updates.
Fixes issue where orders could be executed twice.

Fixes #1234
```

**Breaking Change**
```
refactor!: change User API response format

BREAKING CHANGE: The User API now returns camelCase fields instead of snake_case.
Migration guide in docs/api-migration-v2.md

Old format:
{
  "user_id": 1,
  "first_name": "John"
}

New format:
{
  "userId": 1,
  "firstName": "John"
}
```

**With Scope**
```
feat(api): add pagination to user list endpoint

- Implement cursor-based pagination
- Support limit parameter (1-100)
- Include pagination metadata in response

Fixes #456
```

**Refactoring**
```
refactor(auth): extract password validation to separate service

Extract PasswordValidator class to reduce God object.
No behavior changes, all tests passing.

Relates to #789
```

### Full Example with Trailer

```
feat(payment): integrate Stripe payment processing

- Add Stripe SDK dependency
- Create PaymentService for processing charges
- Implement webhook handling for payment events
- Add comprehensive unit tests

The payment service validates PCI compliance requirements
and ensures secure token handling per Stripe documentation.

Implements #1001
Relates to #999
Fixes #1002
```

### Multi-line Commit Template

```bash
# Save as .git/hooks/prepare-commit-msg to auto-template commits

#!/bin/bash
COMMIT_MSG_FILE=$1
COMMIT_SOURCE=$2

# Don't modify merge/squash commits
if [ "$COMMIT_SOURCE" != "" ]; then
  exit 0
fi

# Insert template
cat >> "$COMMIT_MSG_FILE" << 'EOF'

# Type can be:
# feat:     A new feature
# fix:      A bug fix
# docs:     Documentation changes
# style:    Code formatting (no logic changes)
# refactor: Code refactoring
# perf:     Performance improvement
# test:     Test changes
# chore:    Build/dependency updates
# ci:       CI/CD configuration

# Scope: area affected (api, auth, db, etc.)

# Description: imperative, lowercase, no period
# Example: add email notification service

# Body: explain what and why, not how
# - Use bullet points
# - Explain the motivation
# - Reference related issues

# Footer: breaking changes, closes issues
# BREAKING CHANGE: description
# Fixes #1234
# Relates to #5678
EOF
```

## Branch Strategies

### GitFlow Branching Model

Comprehensive branching strategy for larger teams and scheduled releases.

```
main (production) ──────────────────────┬────────────────────
                                        │ release/1.0.0
                                        │
develop (staging) ────┬──────┬────┬──┬──┴───┬──────────
                      │      │    │  │      │
feature/auth ────┬────┘      │    │  │      │
                 │           │    │  │      │
feature/payments ┼───────────┘    │  │      │
                 │                 │  │      │
feature/api-v2 ──┼─────────────────┘  │      │
                 │                    │      │
hotfix/auth-bug ─┼────────────────────┴──────┴──

Branches:
- main: Production-ready code (tagged with versions)
- develop: Integration branch for next release
- feature/*: Feature development (branch from develop)
- release/*: Release preparation (branch from develop)
- hotfix/*: Production fixes (branch from main)

Process:
1. Create feature branch from develop: git checkout -b feature/my-feature develop
2. Work on feature, commit with conventional commits
3. Push to remote: git push -u origin feature/my-feature
4. Create pull request for code review
5. After approval, merge to develop via PR
6. For release: create release branch, bump version, merge to main and develop
7. For hotfix: create hotfix branch from main, fix, merge to main and develop
```

### Trunk-Based Development

Faster, simpler strategy suitable for continuous deployment.

```
main ──────┬──────┬──────┬──────────────────
           │      │      │
dev/f1 ────┘      │      │
                  │      │
dev/f2 ───────────┘      │
                         │
dev/f3 ───────────────────┘

Features:
- All development on short-lived branches (< 2 days)
- Frequent merges to main (multiple per day)
- Main always deployable
- Feature flags for incomplete features

Process:
1. Create short-lived feature branch: git checkout -b feature/auth-v2
2. Keep feature small, mergeable within 1-2 days
3. Commit frequently with conventional commits
4. Create PR, get review, merge quickly
5. Deploy immediately after merge (if tests pass)
```

## Pull Request Workflow

### PR Template

```markdown
# Description

Briefly describe the changes in this PR.

## Type of Change

- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update
- [ ] Refactoring (no behavior change)

## Related Issues

Fixes #1234
Relates to #5678

## Changes Made

- Change 1
- Change 2
- Change 3

## Testing

Describe how you tested the changes:
- [ ] Unit tests added/updated
- [ ] Integration tests passed
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guide
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
- [ ] Backwards compatibility maintained

## Screenshots (if applicable)

Include before/after screenshots for UI changes.

## Notes

Any additional context or important information.
```

### PR Best Practices

```bash
# Keep PRs small (< 400 lines)
# Rationale: Easier review, faster approval, less merge conflicts

# Bad: Feature branch with 3000 lines changing 20 files
feature/complete-auth-rewrite

# Good: Multiple PRs, each focused
feature/jwt-token-generation
feature/password-reset
feature/mfa-implementation

# Review checklist:
- [ ] Logical organization (classes/functions responsible for one thing)
- [ ] Appropriate naming (clear intent)
- [ ] Error handling (edge cases covered)
- [ ] Tests (adequate coverage)
- [ ] Documentation (code comments, docstrings)
- [ ] Performance (no obvious bottlenecks)
- [ ] Security (no hardcoded secrets, input validation)
```

## Semantic Versioning

Format: `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

```
MAJOR version: Breaking changes (API changes, incompatible updates)
MINOR version: New features (backwards compatible)
PATCH version: Bug fixes (backwards compatible)

Examples:
1.0.0   Initial release
1.1.0   Add new feature, backwards compatible
1.1.1   Fix bug, backwards compatible
2.0.0   Breaking change (update all clients)

Usage in Git:
git tag -a v1.2.3 -m "Version 1.2.3: Add export feature"
git push origin v1.2.3
```

### Semantic Release Automation

```bash
# Install semantic-release
npm install --save-dev semantic-release @semantic-release/changelog @semantic-release/git

# Configure in package.json
{
  "release": {
    "branches": ["main"],
    "plugins": [
      "@semantic-release/commit-analyzer",
      "@semantic-release/release-notes-generator",
      "@semantic-release/changelog",
      "@semantic-release/npm",
      "@semantic-release/github",
      [
        "@semantic-release/git",
        {
          "assets": ["package.json", "CHANGELOG.md"],
          "message": "chore(release): ${nextRelease.version} [skip ci]"
        }
      ]
    ]
  }
}

# Automatic version bumping:
# - feat commit → minor bump (1.0.0 → 1.1.0)
# - fix commit → patch bump (1.0.0 → 1.0.1)
# - BREAKING CHANGE → major bump (1.0.0 → 2.0.0)
```

## Changelog Generation

### Manual Changelog

```markdown
# Changelog

All notable changes to this project documented here.

## [1.2.0] - 2024-04-07

### Added
- Email notifications for trade execution
- Pagination support for user list endpoint
- Health check endpoint for container orchestration

### Fixed
- Race condition in order processing
- Incorrect P&L calculation for partial fills
- WebSocket connection not reconnecting on network error

### Changed
- Updated Python dependencies for security
- Improved error message clarity
- Refactored PaymentService for better testability

### Deprecated
- JWT authentication via X-Authorization header (use Authorization header instead)
- REST endpoint /api/orders (use /api/v2/orders)

### Removed
- Legacy XML API endpoints

### Security
- Fixed XSS vulnerability in message display
- Updated bcrypt to min 12 rounds
- Added rate limiting to all public endpoints

## [1.1.0] - 2024-03-15

### Added
- Initial GraphQL API
- Market data streaming via WebSocket
- User authentication with JWT

## [1.0.0] - 2024-02-01

### Added
- Initial release
- REST API for order management
- PostgreSQL database integration
- Redis caching
```

### Auto-Generated Changelog (conventional-changelog)

```bash
# Install
npm install --save-dev conventional-changelog-cli

# Generate changelog (in addition to CHANGELOG.md)
conventional-changelog -p angular -i CHANGELOG.md -s

# Configuration (.changelogrc)
{
  "feat": {
    "title": "Features",
    "semver": "minor"
  },
  "fix": {
    "title": "Bug Fixes",
    "semver": "patch"
  },
  "refactor": {
    "title": "Refactoring",
    "semver": "patch",
    "hidden": true
  }
}
```

## Git Hooks

### Pre-commit Hook

Prevent committing code with issues.

```bash
#!/bin/bash
# .git/hooks/pre-commit

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "Running pre-commit checks..."

# Get staged files
STAGED_FILES=$(git diff --cached --name-only)

# Check for secrets
echo -n "Checking for secrets... "
if git diff --cached | grep -E "password|secret|token|key" > /dev/null; then
    echo -e "${RED}FAILED${NC}"
    echo "Secrets detected in staged files!"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# Python linting
PYTHON_FILES=$(echo "$STAGED_FILES" | grep '.py$' || true)
if [ -n "$PYTHON_FILES" ]; then
    echo -n "Checking Python formatting... "
    black --check $PYTHON_FILES 2>/dev/null || {
        echo -e "${RED}FAILED${NC}"
        echo "Run: black $PYTHON_FILES"
        exit 1
    }
    echo -e "${GREEN}OK${NC}"

    echo -n "Checking Python linting... "
    ruff check $PYTHON_FILES 2>/dev/null || {
        echo -e "${RED}FAILED${NC}"
        echo "Run: ruff check $PYTHON_FILES"
        exit 1
    }
    echo -e "${GREEN}OK${NC}"
fi

# TypeScript linting
TS_FILES=$(echo "$STAGED_FILES" | grep -E '\.ts$|\.tsx$' || true)
if [ -n "$TS_FILES" ]; then
    echo -n "Checking TypeScript linting... "
    cd frontend && npm run lint $TS_FILES || {
        echo -e "${RED}FAILED${NC}"
        exit 1
    }
    cd ..
    echo -e "${GREEN}OK${NC}"
fi

echo -e "${GREEN}All pre-commit checks passed!${NC}"
```

### Pre-push Hook

Verify tests pass before pushing.

```bash
#!/bin/bash
# .git/hooks/pre-push

set -e

echo "Running pre-push checks..."

# Check if pushing to main/master
if [[ $(git rev-parse --abbrev-ref HEAD) == "main" || $(git rev-parse --abbrev-ref HEAD) == "master" ]]; then
    echo "Pushing to main branch. Running full test suite..."
    cd backend
    pytest tests/ -v || exit 1
    cd ../frontend
    npm test -- --coverage || exit 1
    cd ..
else
    echo "Pushing to feature branch. Running quick tests..."
    cd backend
    pytest tests/ -q || exit 1
    cd ../frontend
    npm test -- --passWithNoTests || exit 1
    cd ..
fi

echo "All checks passed!"
```

### Install Hooks

```bash
# Make hook executable
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push

# Or use husky for easier management
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run lint"
npx husky add .husky/pre-push "npm test"
```

## Commit Best Practices

### Commit Often

```bash
# Good: Logical, atomic commits
git commit -m "feat: add email service"
git commit -m "test: add email service tests"
git commit -m "docs: document email configuration"

# Bad: Large, mixed commits
git commit -m "major refactor and new features" # Can't be reverted individually
```

### Interactive Rebase for Cleanup

```bash
# Before PR: clean up messy commit history
git rebase -i main

# In interactive rebase:
# pick    - keep commit
# reword  - keep commit, change message
# squash  - combine with previous commit
# fixup   - combine without keeping message
# drop    - remove commit

# Example workflow:
pick a1b2c3 feat: add email service
squash b4c5d6 fix: correct service initialization
squash c6d7e8 fix: handle errors in email sending
reword d7e8f9 test: add comprehensive tests
# Result: 2 clean commits instead of 5

git rebase -i main  # Start interactive rebase
# Edit, save, quit (:wq in vim)
# Resolve any conflicts
git rebase --continue
```

### Cherry-pick for Selective Application

```bash
# Apply specific commit from another branch
git cherry-pick a1b2c3

# Useful for:
# - Applying hotfix to multiple branches
# - Backporting features
# - Selective release of changes

# Example: hotfix on main needs to go to develop
git checkout develop
git cherry-pick <commit-hash>
```

## Rebase vs Merge

### Merge Strategy (Default)

```bash
# Creates merge commit
git merge feature/auth --no-ff

# Result: feature branch history preserved
main:     A---B-------M(merge commit)
               \     /
feature:        C---D

# Pros:
# - Preserves feature branch history
# - Explicit merge points
# - Safe for shared branches

# Cons:
# - More complex history
# - Harder to follow linear progress
```

### Rebase Strategy (Cleaner)

```bash
# Replays feature commits on top of main
git checkout feature/auth
git rebase main
git checkout main
git merge feature/auth --ff-only

# Result: Linear history
main:     A---B---C---D
               (feature commits replayed)

# Pros:
# - Linear, readable history
# - Easy to understand sequence of changes
# - Easier to revert/fix individual commits

# Cons:
# - Rewrites history (avoid on shared branches)
# - Can be confusing for beginners
```

### Interactive Rebase for History Cleanup

```bash
# Before merging to main, clean up commits
git checkout feature/auth
git rebase -i main

# Squash multiple commits, reorder, remove debugging commits
# Then fast-forward merge to main

# Result: Clean feature history in main
```

## Best Practices Checklist

```markdown
# Before Committing
- [ ] Only staging intended changes (not debugging code)
- [ ] All tests passing locally
- [ ] Code follows project style guide
- [ ] No console.log, debugging comments left
- [ ] No hardcoded secrets, credentials, URLs

# Commit Message
- [ ] Type specified (feat, fix, docs, etc.)
- [ ] Message in imperative form ("add feature" not "added feature")
- [ ] First line <= 50 characters
- [ ] Explains what changed and why
- [ ] Related issue/PR references included

# Before Pushing
- [ ] Commit history clean (no "oops" commits)
- [ ] All tests passing
- [ ] Rebased on latest main
- [ ] No merge conflicts

# Pull Request
- [ ] Filled out PR template completely
- [ ] Description explains the "why"
- [ ] All CI checks passing
- [ ] Requested appropriate reviewers
- [ ] Self-review completed first
```

---

**Last Updated**: 2026-04-07
**Git Standards**: Conventional Commits v1.0.0
**Semantic Versioning**: v2.0.0
**Best Practices**: GitHub Flow + Trunk-Based Development
