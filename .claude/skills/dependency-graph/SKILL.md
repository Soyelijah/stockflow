# Dependency Graph Analysis & Management

## Table of Contents
1. [Dependency Tree Visualization](#dependency-tree-visualization)
2. [Circular Dependency Detection](#circular-dependency-detection)
3. [Version Conflict Resolution](#version-conflict-resolution)
4. [Security Vulnerability Scanning](#security-vulnerability-scanning)
5. [License Compliance Checking](#license-compliance-checking)
6. [Bundle Size Impact Analysis](#bundle-size-impact-analysis)
7. [Dependency Update Strategies](#dependency-update-strategies)
8. [Monorepo Dependency Management](#monorepo-dependency-management)
9. [Lock File Best Practices](#lock-file-best-practices)
10. [Common Pitfalls](#common-pitfalls)

## Dependency Tree Visualization

### NPM/Node.js Ecosystem

#### Basic Tree Output
```bash
# View dependency tree with depth
npm list --depth=3

# View only production dependencies
npm list --prod

# View only development dependencies
npm list --dev

# JSON format for parsing
npm list --json > dependencies.json

# Check specific package version
npm list react
```

#### Advanced Tree Analysis

```bash
# Interactive dependency explorer
npm ls --all

# Find duplicate versions across tree
npm ls | grep deduped

# Calculate total package size
npm list --json | jq '.dependencies | keys | length'
```

#### Tree Output Example
```
app@1.0.0
├── react@18.2.0
│   └── react-dom@18.2.0
├── express@4.18.2
│   ├── body-parser@1.20.2
│   │   └── bytes@3.1.2
│   └── cookie@0.5.0
└── lodash@4.17.21
```

### Python Ecosystem

#### Pip Dependency Tree
```bash
# Install tool
pip install pipdeptree

# View full tree
pipdeptree

# Export to JSON for analysis
pipdeptree --json > dependencies.json

# Find dependencies of specific package
pipdeptree -p django

# Reverse dependencies (what depends on this?)
pipdeptree -r -p django

# Warnings about broken dependencies
pipdeptree --warn fail
```

#### Poetry Dependency Graph
```bash
# Show dependency tree
poetry show --tree

# Show tree for specific package
poetry show --tree fastapi

# With version information
poetry show --tree --with dev
```

#### Python Tree Output
```
Django==4.2.0
├── asgiref [required: >=3.6.0,<4.0.0]
│   └── typing-extensions [required: >=4.0.0]
├── sqlparse [required: >=0.2.2]
└── tzdata [required: ; sys_platform == "win32"]
```

### Golang Ecosystem

```bash
# View dependency graph
go mod graph

# Visualize as text tree
go mod graph | head -20

# Export for visualization tools
go mod graph > deps.txt

# Check for unused dependencies
go mod tidy

# Analyze direct vs transitive dependencies
go list -m all
```

## Circular Dependency Detection

### JavaScript/TypeScript Circular Dependencies

#### Manual Detection Pattern
```typescript
// src/models/User.ts
import { Post } from './Post';

export class User {
  posts: Post[];
}

// src/models/Post.ts
import { User } from './User';  // CIRCULAR!

export class Post {
  author: User;
}
```

#### Automated Detection with ESLint

```json
{
  "devDependencies": {
    "eslint": "^8.0.0",
    "eslint-plugin-import": "^2.26.0"
  }
}
```

```javascript
// .eslintrc.js
module.exports = {
  plugins: ['import'],
  rules: {
    'import/no-cycle': ['error', { maxDepth: '∞' }]
  }
};
```

#### Madge Tool for Visualization
```bash
# Install madge
npm install --save-dev madge

# Find circular dependencies
npx madge --circular src/

# Generate graph visualization
npx madge --image dependencies.svg src/

# Find specific paths
npx madge --find-duplicates src/
```

### Circular Dependency Resolution

#### Pattern 1: Extract Common Module
```typescript
// BAD: src/models/User.ts
import { Post } from './Post';

export class User {
  posts: Post[];
}

// BAD: src/models/Post.ts
import { User } from './User';

export class Post {
  author: User;
}

// GOOD: src/models/types.ts
export interface IUser {
  id: string;
  name: string;
}

export interface IPost {
  id: string;
  authorId: string;
}

// GOOD: src/models/User.ts
import type { IPost } from './types';

export class User {
  posts: IPost[];
}

// GOOD: src/models/Post.ts
import type { IUser } from './types';

export class Post {
  author: IUser;
}
```

#### Pattern 2: Dependency Injection
```typescript
// Service A depends on Service B's result
export class OrderService {
  constructor(
    private inventoryService: InventoryService
  ) {}

  async createOrder(items: Item[]): Promise<Order> {
    const available = await this.inventoryService.checkAvailability(items);
    // ...
  }
}

// Service B no longer needs to import A
export class InventoryService {
  async checkAvailability(items: Item[]): Promise<boolean> {
    // Pure logic, no dependency on OrderService
  }
}
```

#### Pattern 3: Facade/Mediator Pattern
```typescript
// Mediator handles both services
export class OrderMediator {
  constructor(
    private orderService: OrderService,
    private inventoryService: InventoryService
  ) {}

  async placeOrder(items: Item[]): Promise<Order> {
    const available = await this.inventoryService.checkAvailability(items);
    if (!available) throw new Error('Out of stock');
    return this.orderService.create(items);
  }
}

// Services are now decoupled
export class OrderService {
  async create(items: Item[]): Promise<Order> {
    // No dependency on InventoryService
  }
}

export class InventoryService {
  async checkAvailability(items: Item[]): Promise<boolean> {
    // No dependency on OrderService
  }
}
```

### Python Circular Dependencies

#### Detection
```python
# tools/check_circular.py
import ast
import sys
from pathlib import Path
from collections import defaultdict

def extract_imports(file_path):
    """Extract all imports from Python file"""
    with open(file_path) as f:
        tree = ast.parse(f.read())

    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                imports.add(node.module.split('.')[0])
    return imports

def find_circular_imports(root_dir):
    """Find all circular import patterns"""
    graph = defaultdict(set)

    for py_file in Path(root_dir).rglob('*.py'):
        module = py_file.stem
        imports = extract_imports(py_file)
        for imp in imports:
            graph[module].add(imp)

    # Detect cycles using DFS
    visited = set()
    rec_stack = set()
    cycles = []

    def dfs(node, path):
        visited.add(node)
        rec_stack.add(node)

        for neighbor in graph[node]:
            if neighbor not in visited:
                dfs(neighbor, path + [neighbor])
            elif neighbor in rec_stack:
                cycle_start = path.index(neighbor) if neighbor in path else 0
                cycles.append(path[cycle_start:] + [neighbor])

        rec_stack.remove(node)

    for node in graph:
        if node not in visited:
            dfs(node, [node])

    return cycles

if __name__ == '__main__':
    cycles = find_circular_imports('src')
    if cycles:
        print("Circular dependencies detected:")
        for cycle in cycles:
            print(f"  {' -> '.join(cycle)}")
        sys.exit(1)
```

## Version Conflict Resolution

### Semantic Versioning Rules
```
MAJOR.MINOR.PATCH (e.g., 2.3.1)

MAJOR: Breaking API changes
MINOR: New features (backward compatible)
PATCH: Bug fixes

Pre-release: 2.0.0-alpha.1, 2.0.0-beta.1
Metadata: 2.0.0+build.123
```

### NPM Version Specifiers
```json
{
  "dependencies": {
    "react": "18.2.0",           // Exact version
    "express": "^4.18.0",        // Caret: up to next major (4.x.x)
    "lodash": "~4.17.0",         // Tilde: up to next minor (4.17.x)
    "typescript": ">=4.5.0",     // Range: any version 4.5.0 or higher
    "axios": "4.18.x",           // Major.minor.x version
    "vue": "*",                  // Any version
    "next": "^13.0 || ^12.0"     // OR: 13.x or 12.x
  }
}
```

### Resolving Conflicts

#### Strategy 1: Use npm dedupe
```bash
# Automatically deduplicate versions
npm dedupe

# Force specific resolution
npm install react@18.2.0 --save
```

#### Strategy 2: Explicit Resolutions (npm v8.3+)
```json
{
  "dependencies": {
    "app": {
      "react": "18.2.0"
    },
    "nested-package": {
      "react": "18.1.0"
    }
  },
  "overrides": {
    "react": "18.2.0"
  }
}
```

#### Strategy 3: Yarn Workspaces
```json
{
  "name": "monorepo",
  "private": true,
  "workspaces": {
    "packages": ["packages/*"],
    "nohoist": ["**/node_modules/react"]
  },
  "resolutions": {
    "react": "18.2.0"
  }
}
```

#### Strategy 4: pnpm Peer Dependency Handling
```yaml
# .npmrc
strict-peer-dependencies=true
shamefully-hoist=false
auto-install-peers=true
```

### Python Version Conflicts

#### Poetry Dependency Resolution
```toml
[tool.poetry.dependencies]
python = "^3.9"
django = "^4.2"
djangorestframework = "^3.14"
celery = {version = "^5.3", python = ">=3.8"}

[tool.poetry.group.dev.dependencies]
pytest = "^7.0"
pytest-django = "^4.5"
```

#### pip-tools for Deterministic Installs
```bash
# Create requirements.in (human-readable)
# install django>=4.2,<5.0
# install psycopg2-binary

# Compile to requirements.txt with pinned versions
pip-compile requirements.in -o requirements.txt

# View compiled dependencies
cat requirements.txt
```

## Security Vulnerability Scanning

### NPM Audit

```bash
# Scan for vulnerabilities
npm audit

# JSON output for CI/CD
npm audit --json > audit.json

# Fix automatically (where possible)
npm audit fix

# Fix only prod dependencies
npm audit fix --only=prod

# Show detailed info on specific advisory
npm audit --audit-level=moderate
```

#### NPM Audit Output
```
high  Prototype Pollution in minimist
      https://nvd.nist.gov/vuln/detail/CVE-2021-44906
      No fix available
      node_modules/minimist
        yargs 11.0.0 - 15.4.1
        Depends on minimist
```

### Pip Audit

```bash
# Install pip-audit
pip install pip-audit

# Full vulnerability scan
pip-audit

# Show vulnerable dependencies only
pip-audit --desc

# Generate JSON report
pip-audit --format json > audit.json

# Fix automatically
pip-audit --fix

# Ignore specific vulnerabilities
pip-audit --ignore-vuln PYPA-2023-123
```

### Snyk Integration

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Monitor ongoing vulnerabilities
snyk monitor

# Generate detailed HTML report
snyk test --json | snyk-to-html -o report.html
```

### Trivy for Container Images

```bash
# Install Trivy
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s

# Scan image for vulnerabilities
trivy image myapp:latest

# Scan filesystem
trivy fs ./src/

# JSON output
trivy image --format json myapp:latest > scan.json
```

### CI/CD Integration

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: NPM Audit
        run: npm audit --audit-level=moderate
        continue-on-error: true

      - name: Pip Audit
        run: |
          pip install pip-audit
          pip-audit --desc
        continue-on-error: true

      - name: Snyk Test
        run: |
          npm install -g snyk
          snyk auth ${{ secrets.SNYK_TOKEN }}
          snyk test
        continue-on-error: true

      - name: Trivy Scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload to SARIF
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

## License Compliance Checking

### License Detection Tools

#### License-report (NPM)
```bash
# Install
npm install --save-dev license-report

# Generate report
npm run license-report

# Output example: MIT, Apache-2.0, BSD-3-Clause
```

#### SPDX License List Validation
```json
{
  "scripts": {
    "check:licenses": "license-report --only=prod"
  }
}
```

#### Python License Compliance

```bash
# Install pip-licenses
pip install pip-licenses

# Show all licenses
pip-licenses

# JSON format
pip-licenses --format=json > licenses.json

# Check against whitelist
pip-licenses --format=json | jq '.[] | select(.License != "MIT" and .License != "Apache-2.0")'
```

### REUSE Specification Compliance

```bash
# Install REUSE tool
pip install reuse

# Check compliance
reuse lint

# Fix headers
reuse addheader --copyright "Company Inc." --license "Apache-2.0" src/file.py
```

### License Whitelist Strategy

```javascript
// package.json license whitelist
{
  "licenseWhitelist": {
    "Apache-2.0": true,
    "MIT": true,
    "BSD-2-Clause": true,
    "BSD-3-Clause": true,
    "ISC": true,
    "Unlicense": true,
    "0BSD": true
  },
  "scripts": {
    "validate:licenses": "node scripts/validate-licenses.js"
  }
}
```

```javascript
// scripts/validate-licenses.js
const packageJson = require('../package.json');
const childProcess = require('child_process');

const output = childProcess.execSync('npm ls --json').toString();
const deps = JSON.parse(output).dependencies;
const whitelist = packageJson.licenseWhitelist;

for (const [pkg, info] of Object.entries(deps)) {
  const license = info.licenses || 'UNKNOWN';
  if (!whitelist[license]) {
    console.error(`❌ ${pkg}: ${license} not whitelisted`);
    process.exit(1);
  }
}

console.log('✓ All licenses compliant');
```

## Bundle Size Impact Analysis

### Webpack Bundle Analysis

```bash
# Install analyzer
npm install --save-dev webpack-bundle-analyzer

# Generate report
webpack-bundle-analyzer dist/stats.json
```

#### webpack.config.js Configuration
```javascript
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  mode: 'production',
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'json',
      reportFilename: 'stats.json',
      openAnalyzer: false,
      generateStatsFile: true
    })
  ]
};
```

### Vite Bundle Analysis

```bash
# Install Rollup analyzer plugin
npm install --save-dev rollup-plugin-visualizer
```

```javascript
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      brotliSize: true,
    })
  ]
};
```

### Package Impact Measurement

```bash
# Before adding package
npm ls --depth=0 | tail -1

# Measure package size impact
npm list package-name

# Show gzipped size
npm view package-name dist.unpackedSize

# Compare versions
npm view lodash@4 dist.unpackedSize
npm view lodash@3 dist.unpackedSize
```

### Bundle Budget Enforcement

```javascript
// webpack.config.js
const webpackBundleSizeAnalyzer = require('webpack-bundle-size-analyzer').webpackBundleSizeAnalyzer;

module.exports = {
  performance: {
    maxEntrypointSize: 250000,
    maxAssetSize: 250000,
    hints: 'error'
  },
  plugins: [
    new webpackBundleSizeAnalyzer((report) => {
      console.log(report);
    })
  ]
};
```

## Dependency Update Strategies

### Automated Dependency Updates

#### Dependabot Configuration
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "03:00"
    open-pull-requests-limit: 10
    pull-request-branch-name:
      separator: "/"
    reviewers:
      - "team-lead"
    labels:
      - "dependencies"
    allow:
      - dependency-type: "direct"
      - dependency-type: "indirect"
    ignore:
      - dependency-name: "deprecated-package"
    commit-message:
      prefix: "chore(deps):"
    rebase-strategy: "auto"
```

#### Renovate Configuration
```json
// renovate.json
{
  "extends": ["config:base"],
  "schedule": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "schedule": ["before 3am on Monday"]
    },
    {
      "matchUpdateTypes": ["major"],
      "schedule": ["before 3am on the first day of the month"]
    }
  ],
  "automerge": true,
  "automergeType": "pr",
  "automergeStrategy": "squash",
  "requiredStatusChecks": ["build", "test"],
  "groupName": "non-major dependencies",
  "groupSlug": "non-major",
  "packageRules": [
    {
      "groupName": "TypeScript",
      "matchDatasources": ["npm"],
      "matchPackageNames": ["typescript"],
      "schedule": ["before 3am on Monday"]
    }
  ]
}
```

### Manual Update Workflow

```bash
# Check for outdated packages
npm outdated

# Output example:
# Package    Current  Wanted  Latest
# lodash     4.17.20  4.17.21  4.17.21
# react      17.0.0   17.0.2   18.0.0

# Update all minor/patch versions safely
npm update

# Update specific package to latest
npm install react@latest --save

# See what would change
npm upgrade --dry-run
```

### Testing Updates

```bash
# Create feature branch for updates
git checkout -b chore/dependency-updates

# Update dependencies
npm update
npm audit fix

# Run full test suite
npm test

# Run type checking
npm run typecheck

# Test build
npm run build

# Create pull request for review
git commit -am "chore(deps): update dependencies"
git push origin chore/dependency-updates
```

## Monorepo Dependency Management

### Nx Monorepo

```json
// workspace.json
{
  "version": 2,
  "projects": {
    "api": "apps/api",
    "web": "apps/web",
    "shared-ui": "libs/shared/ui",
    "shared-utils": "libs/shared/utils"
  }
}
```

```bash
# View dependency graph
nx dep-graph

# Export graph for visualization
nx dep-graph --file=graph.json

# Check which projects depend on a library
nx affected --base=main --type=lib
```

### pnpm Workspace

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
```

```bash
# Install dependencies across workspace
pnpm install

# Add dependency to specific package
pnpm --filter @org/shared-utils add lodash

# Remove from specific package
pnpm --filter @org/api remove express

# Link local packages
pnpm --filter @org/web add @org/shared-utils
```

### Yarn Workspaces

```json
// package.json
{
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "resolutions": {
    "lodash": "^4.17.21"
  }
}
```

```bash
# Install all workspace dependencies
yarn install

# Add to specific workspace
yarn workspace @org/api add express

# Run script across workspaces
yarn workspaces run build
```

## Lock File Best Practices

### Package Lock File Management

#### Committing Lock Files
```bash
# Always commit lock files to version control
git add package-lock.json yarn.lock pnpm-lock.yaml
git commit -m "chore: update lock files"
```

#### Lock File Regeneration
```bash
# Remove old lock file
rm package-lock.json

# Regenerate with current package.json
npm install

# Verify lock file matches package.json
npm ci
```

#### CI/CD Lock File Handling
```yaml
# .github/workflows/build.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'

      # npm ci uses lock file, doesn't update
      - run: npm ci

      # Verify lock file hasn't changed
      - run: |
          npm audit
          if [ -n "$(git status --porcelain)" ]; then
            echo "Lock file changed, failing build"
            exit 1
          fi
```

### Shrinkwrap for Production

```bash
# Create shrinkwrap file (immutable lock)
npm shrinkwrap

# Production installation uses shrinkwrap
npm ci

# Update shrinkwrap
npm shrinkwrap --dev
```

## Common Pitfalls

### Pitfall 1: Ignoring Transitive Dependencies

**Problem**: Only monitoring direct dependencies, missing vulnerabilities in transitive ones.

```bash
# Bad: Only checking direct deps
npm list --depth=0

# Good: Check all dependencies
npm list
npm audit --json | jq '.vulnerabilities'
```

### Pitfall 2: Not Using Exact Versions in Production

**Problem**: Using caret (^) ranges leads to version inconsistencies.

```json
// Bad: Production lock files might differ
{
  "dependencies": {
    "react": "^18.0.0"
  }
}

// Good: Lock files ensure reproducible installs
// Use npm ci in CI/CD, npm install for development
```

### Pitfall 3: Circular Dependency Cycles

**Problem**: Circular imports cause runtime errors or increased bundle size.

```typescript
// Bad: A imports B, B imports A
// models/user.ts
import { Post } from './post';
export class User { posts: Post[]; }

// models/post.ts
import { User } from './user';  // CIRCULAR!
export class Post { author: User; }

// Good: Extract types
// models/types.ts
export interface IUser { id: string; }
export interface IPost { id: string; }
```

### Pitfall 4: Missing License Compliance

**Problem**: Using GPL dependencies in proprietary code creates legal issues.

```bash
# Bad: No license validation
npm install any-package

# Good: Check licenses before installing
npm view any-package license
pip-licenses | grep GPL
```

### Pitfall 5: Not Pinning Critical Dependencies

**Problem**: Auto-upgrading breaks production.

```toml
# Bad: Wide open versions
[dependencies]
critical-lib = "*"

# Good: Pin major versions
[dependencies]
critical-lib = ">=1.0,<2.0"
```

### Pitfall 6: Ignoring Deprecated Packages

**Problem**: Using deprecated packages leads to security issues and missing updates.

```bash
# Bad: npm doesn't warn by default
npm list | grep deprecated

# Good: Check npm registry
npm view deprecated-package deprecated

# Good: Use npm outdated to see warnings
npm outdated
```

### Pitfall 7: Not Monitoring Bundle Size Impact

**Problem**: Dependencies accumulate, bundle bloats silently.

```bash
# Bad: No bundle size tracking
npm install any-utility-lib

# Good: Measure before and after
npm list --depth=0
webpack-bundle-analyzer dist/stats.json
```

---

## Tools Quick Reference

| Tool | Purpose | Command |
|------|---------|---------|
| npm audit | Vulnerability scan | `npm audit` |
| pip-audit | Python vulnerabilities | `pip-audit` |
| snyk | Advanced security testing | `snyk test` |
| npm ls | Dependency tree | `npm list` |
| pipdeptree | Python tree | `pipdeptree` |
| madge | Circular dependencies | `madge --circular src/` |
| webpack-bundle-analyzer | Bundle analysis | `webpack-bundle-analyzer dist/stats.json` |
| license-report | License compliance | `npm run license-report` |
| pip-licenses | Python licenses | `pip-licenses` |
| Dependabot | Automated updates | GitHub integration |
| Renovate | Advanced updates | `renovate.json` config |
