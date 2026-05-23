# Web Application Testing

Comprehensive automated testing suite for local web applications. Supports manual Playwright scripting, automatic E2E test generation, visual regression tracking, performance profiling, accessibility audits, and detailed test reporting.

**Helper Scripts Available**:
- `scripts/with_server.py` - Manages server lifecycle (supports multiple servers)
- `scripts/test_generator.py` - Analyzes app routes/components and generates test suites
- `scripts/coverage_tracker.py` - Reports test coverage across pages/routes/components
- `scripts/visual_regression.py` - Screenshot comparison between runs
- `scripts/performance_profiler.py` - Measures load times, LCP, FID, CLS per page
- `scripts/accessibility_auditor.py` - Runs WCAG a11y checks (contrast, alt text, ARIA)
- `scripts/test_reporter.py` - Generates HTML/JSON test reports with metrics

**Always run scripts with `--help` first** to see usage. These scripts handle complex workflows as black-box utilities rather than requiring context window analysis.

---

## Decision Tree: Choosing Your Approach

```
User task → What type of testing do you need?
    │
    ├─ Manual testing of specific features
    │   └─ Is the server already running?
    │       ├─ No → Use with_server.py to manage server lifecycle
    │       └─ Yes → Write Playwright script directly
    │
    ├─ Automatic E2E test generation
    │   └─ Run: python scripts/test_generator.py --help
    │       → Points to app routes/components
    │       → Generates complete test suites
    │
    ├─ Test coverage analysis
    │   └─ Run: python scripts/coverage_tracker.py --help
    │       → Reports which pages/routes have tests
    │       → Identifies untested components
    │
    ├─ Visual regression testing
    │   └─ Run: python scripts/visual_regression.py --help
    │       → Compares screenshots between runs
    │       → Flags visual regressions
    │
    ├─ Performance profiling
    │   └─ Run: python scripts/performance_profiler.py --help
    │       → Measures LCP, FID, CLS, load times
    │       → Generates performance baseline
    │
    ├─ Accessibility auditing
    │   └─ Run: python scripts/accessibility_auditor.py --help
    │       → WCAG a11y checks
    │       → Contrast verification
    │       → ARIA compliance
    │
    └─ Test reporting
        └─ Run: python scripts/test_reporter.py --help
            → Aggregates test results
            → Generates HTML/JSON reports
```

---

## Automatic E2E Test Generation

### Quick Start

Generate test suites automatically by analyzing your app's routes and components:

```bash
python scripts/test_generator.py \
  --server "npm run dev" --port 5173 \
  --routes-file src/routes.tsx \
  --components-dir src/components \
  --output tests/generated_e2e.py
```

The generator:
1. Parses your routes and identifies pages
2. Discovers components on each page
3. Identifies interactive elements (buttons, forms, links)
4. Generates test cases for:
   - Page navigation and loading
   - Form submission and validation
   - Button click interactions
   - Link navigation
   - Error state handling
   - Console error detection

### Generated Test Structure

```python
# tests/generated_e2e.py (auto-generated)
import pytest
from playwright.sync_api import Page

class TestHomePageE2E:
    def test_page_loads(self, page: Page):
        """Verify home page loads without errors"""
        page.goto('http://localhost:5173/')
        page.wait_for_load_state('networkidle')
        assert page.locator('h1').is_visible()
        # Auto-detected console errors reported as failures

    def test_form_submission(self, page: Page):
        """Verify form inputs and submission"""
        page.goto('http://localhost:5173/')
        page.fill('#email-input', 'test@example.com')
        page.click('button:has-text("Submit")')
        page.wait_for_url('/success')
        assert page.url == 'http://localhost:5173/success'

    def test_navigation(self, page: Page):
        """Verify link navigation"""
        page.goto('http://localhost:5173/')
        page.click('a:has-text("Dashboard")')
        page.wait_for_load_state('networkidle')
        assert '/dashboard' in page.url
```

---

## Coverage Tracking

Report which pages, routes, and components have test coverage:

```bash
python scripts/coverage_tracker.py \
  --routes-file src/routes.tsx \
  --test-dir tests/ \
  --output coverage_report.json
```

### Coverage Report Output

```json
{
  "summary": {
    "total_routes": 8,
    "tested_routes": 6,
    "coverage_percent": 75.0
  },
  "routes": [
    {
      "path": "/",
      "name": "Home",
      "tested": true,
      "test_file": "tests/test_home.py"
    },
    {
      "path": "/dashboard",
      "name": "Dashboard",
      "tested": false,
      "reason": "No tests found"
    }
  ],
  "components": [
    {
      "name": "OrderForm",
      "location": "src/components/OrderForm.tsx",
      "tested": true,
      "test_count": 5
    },
    {
      "name": "PriceChart",
      "location": "src/components/PriceChart.tsx",
      "tested": false,
      "reason": "No unit/integration tests detected"
    }
  ]
}
```

---

## Visual Regression Testing

Automatically compare screenshots between test runs to detect visual regressions:

```bash
# First run: capture baseline
python scripts/visual_regression.py \
  --server "npm run dev" --port 5173 \
  --pages "http://localhost:5173/,http://localhost:5173/dashboard,http://localhost:5173/orders" \
  --baseline-dir screenshots/baseline \
  --mode baseline

# Subsequent runs: compare against baseline
python scripts/visual_regression.py \
  --server "npm run dev" --port 5173 \
  --pages "http://localhost:5173/,http://localhost:5173/dashboard,http://localhost:5173/orders" \
  --baseline-dir screenshots/baseline \
  --output-dir screenshots/current \
  --diff-dir screenshots/diffs \
  --mode compare \
  --threshold 0.05
```

### Visual Regression Report

```
Visual Regression Results
========================

Page: http://localhost:5173/
  Status: PASS (similarity: 0.99)

Page: http://localhost:5173/dashboard
  Status: FAIL (similarity: 0.87) [threshold: 0.95]
  Diff: screenshots/diffs/dashboard_diff.png
  Changes: Layout shift in top navigation (12px)

Page: http://localhost:5173/orders
  Status: PASS (similarity: 0.98)

Summary: 2/3 pages passed (66.7%)
```

---

## Performance Testing

Measure Core Web Vitals and load times for each page:

```bash
python scripts/performance_profiler.py \
  --server "npm run dev" --port 5173 \
  --pages "http://localhost:5173/,http://localhost:5173/dashboard,http://localhost:5173/portfolio" \
  --runs 3 \
  --output performance_report.json
```

### Performance Metrics Captured

- **LCP** (Largest Contentful Paint): Time to render largest visible element
- **FID** (First Input Delay): Delay from user input to JS response
- **CLS** (Cumulative Layout Shift): Unexpected layout movement during page lifecycle
- **TTFB** (Time To First Byte): Time to first response byte
- **DCL** (DOM Content Loaded): Time to parse DOM
- **Load**: Time for complete page load

### Performance Report Output

```json
{
  "results": [
    {
      "url": "http://localhost:5173/",
      "page_name": "Home",
      "metrics": {
        "lcp_ms": 1240,
        "fid_ms": 45,
        "cls": 0.15,
        "ttfb_ms": 120,
        "dcl_ms": 980,
        "load_ms": 2340
      },
      "vitals_status": {
        "lcp": "GOOD",
        "fid": "GOOD",
        "cls": "NEEDS_IMPROVEMENT"
      },
      "console_errors": 0,
      "console_warnings": 2
    },
    {
      "url": "http://localhost:5173/dashboard",
      "page_name": "Dashboard",
      "metrics": {
        "lcp_ms": 2150,
        "fid_ms": 120,
        "cls": 0.32,
        "ttfb_ms": 140,
        "dcl_ms": 1450,
        "load_ms": 3800
      },
      "vitals_status": {
        "lcp": "NEEDS_IMPROVEMENT",
        "fid": "NEEDS_IMPROVEMENT",
        "cls": "POOR"
      },
      "console_errors": 1,
      "console_warnings": 5
    }
  ],
  "thresholds": {
    "lcp_ms": 2500,
    "fid_ms": 100,
    "cls": 0.1
  }
}
```

---

## Accessibility Testing

Run WCAG a11y checks on all pages:

```bash
python scripts/accessibility_auditor.py \
  --server "npm run dev" --port 5173 \
  --pages "http://localhost:5173/,http://localhost:5173/dashboard" \
  --rules wcag2aa \
  --output a11y_report.json
```

### Accessibility Checks Include

- **Color Contrast**: WCAG AA/AAA compliance (4.5:1 for text, 3:1 for large text)
- **Alt Text**: Images must have alt attributes
- **ARIA Labels**: Form inputs and buttons must have accessible labels
- **Heading Structure**: Proper h1-h6 hierarchy (no skipped levels)
- **Link Text**: Links must have descriptive text (not "click here")
- **Form Labels**: Inputs must have associated labels
- **Button Accessibility**: Buttons must have text/aria-label
- **Keyboard Navigation**: All interactive elements must be focusable

### Accessibility Report Output

```json
{
  "summary": {
    "total_pages": 2,
    "pages_with_issues": 1,
    "total_issues": 7,
    "critical_issues": 2,
    "warnings": 5
  },
  "results": [
    {
      "url": "http://localhost:5173/",
      "page_name": "Home",
      "status": "PASS",
      "issues": []
    },
    {
      "url": "http://localhost:5173/dashboard",
      "page_name": "Dashboard",
      "status": "FAIL",
      "issues": [
        {
          "severity": "critical",
          "rule": "image-alt",
          "element": "<img class='chart-thumbnail'>",
          "message": "Images must have alt text",
          "selector": ".chart-container > img:nth-child(1)",
          "wcag_criteria": "WCAG 1.1.1"
        },
        {
          "severity": "critical",
          "rule": "form-label",
          "element": "<input id='trade-qty'>",
          "message": "Form input missing associated label",
          "selector": "#trade-qty",
          "wcag_criteria": "WCAG 1.3.1"
        },
        {
          "severity": "warning",
          "rule": "color-contrast",
          "element": "<button class='secondary'>",
          "message": "Text contrast ratio 3.2:1, needs 4.5:1 (WCAG AA)",
          "selector": ".secondary-button",
          "wcag_criteria": "WCAG 1.4.3",
          "actual_ratio": 3.2,
          "required_ratio": 4.5
        }
      ]
    }
  ]
}
```

---

## Test Reporting

Generate comprehensive HTML/JSON test reports with metrics:

```bash
# Run tests and generate report
pytest tests/ --tb=short
python scripts/test_reporter.py \
  --test-dir tests/ \
  --junit-xml test-results.xml \
  --coverage-xml coverage.xml \
  --output test_report.html \
  --format html \
  --include-performance \
  --include-a11y \
  --include-coverage
```

### HTML Report Features

- **Test Summary**: Pass/fail counts, duration, pass rate
- **Test Details**: Individual test results with durations
- **Coverage Matrix**: Which routes/components are tested
- **Performance Baseline**: LCP/FID/CLS trends
- **Accessibility Summary**: a11y issues by page
- **Failure Screenshots**: Captured on test failure
- **Console Errors**: Logged during tests
- **Timeline**: Test execution waterfall chart

### HTML Report Structure

```html
<!DOCTYPE html>
<html>
<head><title>Test Report - 2024-04-04</title></head>
<body>
  <div class="summary">
    <h1>Test Execution Report</h1>
    <div class="metrics">
      <div class="metric">
        <label>Tests Run</label>
        <value>48</value>
      </div>
      <div class="metric">
        <label>Passed</label>
        <value class="pass">45</value>
      </div>
      <div class="metric">
        <label>Failed</label>
        <value class="fail">3</value>
      </div>
      <div class="metric">
        <label>Pass Rate</label>
        <value>93.8%</value>
      </div>
      <div class="metric">
        <label>Duration</label>
        <value>8m 23s</value>
      </div>
    </div>
  </div>

  <div class="coverage-section">
    <h2>Coverage</h2>
    <table>
      <tr><th>Route</th><th>Component</th><th>Tests</th><th>Status</th></tr>
      <tr><td>/</td><td>HomePage</td><td>8</td><td class="covered">Covered</td></tr>
      <tr><td>/dashboard</td><td>DashboardPage</td><td>12</td><td class="covered">Covered</td></tr>
    </table>
  </div>

  <div class="performance-section">
    <h2>Performance Baselines</h2>
    <table>
      <tr><th>Page</th><th>LCP</th><th>FID</th><th>CLS</th></tr>
      <tr><td>/</td><td>1.24s (GOOD)</td><td>45ms (GOOD)</td><td>0.15 (NEEDS WORK)</td></tr>
    </table>
  </div>

  <div class="a11y-section">
    <h2>Accessibility</h2>
    <table>
      <tr><th>Page</th><th>Issues</th><th>Critical</th><th>Status</th></tr>
      <tr><td>/dashboard</td><td>7</td><td>2</td><td class="fail">FAIL</td></tr>
    </table>
  </div>

  <div class="failures-section">
    <h2>Failures</h2>
    <div class="failure">
      <h3>test_order_placement_fails_without_price</h3>
      <p>AssertionError: expected to see error message</p>
      <img src="screenshot_failure.png" />
    </div>
  </div>
</body>
</html>
```

### JSON Report Format

```json
{
  "timestamp": "2024-04-04T10:30:00Z",
  "summary": {
    "total_tests": 48,
    "passed": 45,
    "failed": 3,
    "pass_rate": 93.8,
    "duration_seconds": 503
  },
  "coverage": {
    "routes": { "covered": 7, "total": 8 },
    "components": { "covered": 12, "total": 15 }
  },
  "performance": {
    "pages": [
      {
        "url": "/",
        "lcp_ms": 1240,
        "vitals_status": "GOOD"
      }
    ]
  },
  "a11y": {
    "pages_with_issues": 1,
    "total_issues": 7
  },
  "failures": [
    {
      "test_name": "test_order_placement",
      "error": "AssertionError",
      "message": "expected to see error message",
      "duration_seconds": 4.2
    }
  ]
}
```

---

## Manual Testing: Using with_server.py

For manual testing of specific features, use the server helper:

**Single server:**
```bash
python scripts/with_server.py --server "npm run dev" --port 5173 -- python your_test.py
```

**Multiple servers (e.g., backend + frontend):**
```bash
python scripts/with_server.py \
  --server "cd backend && python server.py" --port 3000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python your_test.py
```

### Manual Test Script Template

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Navigate and wait for JS execution
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')

    # Capture screenshot for inspection
    page.screenshot(path='/tmp/inspect.png', full_page=True)

    # Inspect console for errors
    console_errors = []
    page.on('console', lambda msg: (
        console_errors.append(msg.text)
        if msg.type == 'error' else None
    ))

    # Execute actions
    page.click('button:has-text("Start Trading")')
    page.wait_for_selector('.trading-panel')

    # Verify results
    assert page.locator('.trading-panel').is_visible()
    assert len(console_errors) == 0, f"Console errors: {console_errors}"

    browser.close()
```

---

## Reconnaissance-Then-Action Pattern

1. **Inspect rendered DOM**:
   ```python
   page.screenshot(path='/tmp/inspect.png', full_page=True)
   content = page.content()
   buttons = page.locator('button').all()
   ```

2. **Identify selectors** from inspection results

3. **Execute actions** using discovered selectors

---

## Console Error Detection

Automatically flag console errors as test failures:

```python
from playwright.sync_api import sync_playwright

console_errors = []

def handle_console(msg):
    if msg.type in ['error', 'exception']:
        console_errors.append({
            'type': msg.type,
            'text': msg.text,
            'location': msg.location
        })

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on('console', handle_console)

    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')

    # Test fails if any console errors detected
    assert len(console_errors) == 0, f"Console errors found: {console_errors}"

    browser.close()
```

---

## Common Pitfalls

❌ **Don't** inspect the DOM before waiting for `networkidle` on dynamic apps
✅ **Do** wait for `page.wait_for_load_state('networkidle')` before inspection

❌ **Don't** ignore console errors and warnings
✅ **Do** capture them and validate they're expected

❌ **Don't** generate tests without reviewing for accuracy
✅ **Do** review auto-generated tests and customize for your app's logic

❌ **Don't** run visual regression without a baseline
✅ **Do** capture baseline first, then compare runs

---

## Best Practices

- **Use bundled scripts as black boxes** - Invoke scripts via `--help` first, then call directly without reading source
- **Combine strategies** - Use automatic generation for coverage, then add manual tests for business logic
- **Track baselines** - Commit baseline screenshots and performance metrics to git
- **Monitor trends** - Generate reports regularly to track performance and a11y regressions
- **Fail on errors** - Treat console errors and a11y issues as test failures
- **Use descriptive selectors** - Prefer `text=`, `role=`, CSS selectors, or IDs over brittle XPath
- **Add appropriate waits** - Use `page.wait_for_selector()` or `page.wait_for_timeout()` strategically
- **Close browsers properly** - Always close browser instances to prevent resource leaks

---

## Reference Files

- **examples/** - Examples showing common patterns:
  - `element_discovery.py` - Discovering buttons, links, and inputs on a page
  - `static_html_automation.py` - Using file:// URLs for local HTML
  - `console_logging.py` - Capturing console logs during automation
  - `performance_baseline.py` - Measuring Core Web Vitals
  - `accessibility_scan.py` - Running a11y checks on a page
  - `visual_regression_baseline.py` - Capturing baseline screenshots
  - `e2e_workflow.py` - Complete end-to-end testing workflow

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Web Application Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install frontend dependencies
        run: cd frontend && npm ci

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install Python dependencies
        run: pip install -r requirements.txt

      - name: Generate E2E tests
        run: python scripts/test_generator.py \
          --server "npm run dev" --port 5173 \
          --routes-file frontend/src/routes.tsx \
          --output tests/generated_e2e.py

      - name: Run E2E tests
        run: pytest tests/ -v --junit-xml=test-results.xml

      - name: Generate test report
        run: python scripts/test_reporter.py \
          --junit-xml test-results.xml \
          --output test_report.html

      - name: Run performance audit
        run: python scripts/performance_profiler.py \
          --server "npm run dev" --port 5173 \
          --pages "http://localhost:5173/" \
          --output performance.json

      - name: Run accessibility audit
        run: python scripts/accessibility_auditor.py \
          --server "npm run dev" --port 5173 \
          --pages "http://localhost:5173/" \
          --output a11y.json

      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: |
            test_report.html
            performance.json
            a11y.json
```

---

## Troubleshooting

**Tests fail with "Connection refused"**
- Verify server is running: `python scripts/with_server.py --help`
- Check port is correct: default 5173 for frontend, 3000 for backend

**Screenshots are blank**
- Ensure `page.wait_for_load_state('networkidle')` is called before capture
- Try `page.wait_for_timeout(2000)` as fallback

**Auto-generated tests are too generic**
- Review and customize for your app's specific business logic
- Add assertions for error states and edge cases
- Manually write tests for complex workflows

**Visual regression threshold too strict**
- Adjust `--threshold` parameter (default 0.05 = 5% difference)
- Regenerate baseline if UI changes intentionally

**A11y issues overwhelming**
- Prioritize critical issues (WCAG failures)
- Address warnings in next sprint
- Use `--rules wcag2a` for stricter standards
