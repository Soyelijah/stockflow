# Security Audit Skill

Professional security auditing for enterprise applications. This skill provides structured vulnerability assessment, dependency analysis, and security posture evaluation.

## OWASP Top 10 (2024) Vulnerability Assessment

### 1. Broken Access Control

**Definition**: Users can act outside their intended permissions by manipulating requests.

**Assessment Checklist**:
- [ ] Verify authorization checks on every protected endpoint (not just frontend)
- [ ] Check for vertical privilege escalation (user accessing admin functions)
- [ ] Check for horizontal privilege escalation (user accessing peer data)
- [ ] Verify session management prevents session fixation attacks
- [ ] Confirm JWT tokens include user ID and role validation
- [ ] Verify password reset flows validate ownership
- [ ] Check for IDOR vulnerabilities (`/api/users/{id}` accessible by any authenticated user)
- [ ] Audit API endpoint access control at route handler level
- [ ] Verify role-based access control (RBAC) is enforced consistently
- [ ] Check for privilege escalation through parameter manipulation

**Remediation Pattern**:
```python
# VULNERABLE: No ownership check
@app.get("/api/users/{user_id}")
async def get_user(user_id: int, current_user: User = Depends(get_current_user)):
    return await db.get_user(user_id)  # Any user can access any user's data

# SECURE: Verify ownership or admin role
@app.get("/api/users/{user_id}")
async def get_user(user_id: int, current_user: User = Depends(get_current_user)):
    if user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return await db.get_user(user_id)
```

### 2. Cryptographic Failures

**Definition**: Sensitive data exposed due to weak encryption, poor key management, or insecure transmission.

**Assessment Checklist**:
- [ ] Verify all sensitive data in transit uses TLS 1.2+ (check HTTPS enforcement)
- [ ] Confirm passwords hashed with bcrypt (salt rounds >= 12) or Argon2
- [ ] Check for hardcoded secrets in source code
- [ ] Verify API keys not logged or exposed in error messages
- [ ] Confirm database encryption at rest (if applicable)
- [ ] Check SSL/TLS certificate validity and expiration
- [ ] Verify no sensitive data in query parameters (use POST body instead)
- [ ] Confirm sensitive data removed from logs and error responses
- [ ] Check for weak hashing algorithms (MD5, SHA1 - REJECT)
- [ ] Verify key rotation policy exists and is implemented

**Remediation Pattern**:
```python
# VULNERABLE: Plain text password comparison
def verify_password(user_password, stored_password):
    return user_password == stored_password  # Never do this

# SECURE: Use bcrypt
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password):
    return pwd_context.hash(password)
```

### 3. Injection (SQL, NoSQL, OS Command)

**Definition**: Untrusted input interpreted as code, allowing arbitrary command execution.

**Assessment Checklist**:
- [ ] Verify all database queries use parameterized statements
- [ ] Check for string concatenation in SQL queries (e.g., f-strings)
- [ ] Audit NoSQL query construction for injection (e.g., MongoDB `$where`)
- [ ] Verify all shell commands use subprocess with list arguments, not string
- [ ] Check for dynamic query construction without escaping
- [ ] Confirm input validation on all user-supplied parameters
- [ ] Verify ORM usage prevents SQL injection (SQLAlchemy safe when used correctly)
- [ ] Check for template injection in rendering engines
- [ ] Audit command injection vectors (exec, eval, system calls)
- [ ] Verify LDAP queries are parameterized if used

**Remediation Pattern - SQL**:
```python
# VULNERABLE: String concatenation
query = f"SELECT * FROM users WHERE username = '{username}'"
result = await db.execute(query)

# SECURE: Parameterized query
from sqlalchemy import text
query = text("SELECT * FROM users WHERE username = :username")
result = await db.execute(query, {"username": username})
```

**Remediation Pattern - Shell Command**:
```python
# VULNERABLE: Shell interpretation
import subprocess
result = subprocess.run(f"ls {directory}", shell=True)

# SECURE: List-based subprocess
import subprocess
result = subprocess.run(["ls", directory], shell=False)
```

### 4. Insecure Design

**Definition**: Missing security controls during architectural design phase.

**Assessment Checklist**:
- [ ] Verify threat modeling completed during design
- [ ] Check if security requirements documented in PRD
- [ ] Confirm rate limiting implemented on all endpoints
- [ ] Verify account lockout after failed login attempts (e.g., 5 attempts = 30min lock)
- [ ] Check for weak password policies
- [ ] Verify MFA available for sensitive operations
- [ ] Confirm backup/recovery procedures tested and documented
- [ ] Check for API rate limiting per user and globally
- [ ] Verify sensitive operations (payment, data deletion) require confirmation
- [ ] Confirm least privilege principle applied to service accounts

**Remediation Pattern - Rate Limiting**:
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: LoginRequest):
    # Rate limited to 5 attempts per minute per IP
    return await authenticate(credentials)
```

### 5. Security Misconfiguration

**Definition**: Insecure default settings, incomplete setups, open cloud storage, or misconfigured headers.

**Assessment Checklist**:
- [ ] Verify all default credentials changed (database, admin panels)
- [ ] Check security headers present (CSP, X-Frame-Options, X-Content-Type-Options, HSTS)
- [ ] Confirm debug mode disabled in production
- [ ] Verify unnecessary services disabled
- [ ] Check cloud storage (S3, GCS) not publicly readable
- [ ] Confirm environment variables properly secured (not in git)
- [ ] Verify Docker containers run as non-root
- [ ] Check for exposed admin interfaces (`/admin`, `/api/docs` in production)
- [ ] Confirm framework/dependency versions current
- [ ] Verify logging and monitoring configured

**Remediation Pattern - Security Headers**:
```python
from fastapi.middleware.cors import CORSMiddleware

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response
```

### 6. Vulnerable and Outdated Components

**Definition**: Libraries, frameworks, and dependencies with known vulnerabilities.

**Assessment Checklist**:
- [ ] Run `npm audit` (Node.js) or `pip-audit` (Python) on all dependencies
- [ ] Verify no end-of-life dependencies used
- [ ] Check for deprecated frameworks or libraries
- [ ] Confirm security updates applied within 30 days of release
- [ ] Verify SCA (Software Composition Analysis) tool integrated in CI/CD
- [ ] Check transitive dependencies for vulnerabilities
- [ ] Confirm pinned versions in lock files (package-lock.json, poetry.lock)
- [ ] Verify automated dependency update process
- [ ] Check for known vulnerable patterns in dependencies
- [ ] Audit direct dependencies monthly

**Commands**:
```bash
# Python
pip-audit --desc

# Node.js
npm audit
npm outdated

# Check specific package
npm view <package> versions
```

### 7. Identification and Authentication Failures

**Definition**: Weak authentication, poor session management, or credential exposure.

**Assessment Checklist**:
- [ ] Verify passwords enforced minimum 12 characters with complexity
- [ ] Check for password reuse prevention (last 5 passwords)
- [ ] Confirm multi-factor authentication (MFA) available
- [ ] Verify session timeout after 30 minutes inactivity
- [ ] Check JWT expiration (15-60 minutes for access tokens)
- [ ] Confirm refresh tokens rotated on use
- [ ] Verify "forgot password" requires email verification
- [ ] Check for account enumeration (timing attacks on login endpoint)
- [ ] Confirm brute force protection (account lockout or rate limiting)
- [ ] Verify credential stuffing prevention

**Remediation Pattern - JWT with Rotation**:
```python
from datetime import datetime, timedelta
import jwt

def create_access_token(user_id: int, expires_delta: timedelta = None):
    if expires_delta is None:
        expires_delta = timedelta(minutes=15)

    to_encode = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + expires_delta,
        "iat": datetime.utcnow()
    }

    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
    return encoded_jwt

def create_refresh_token(user_id: int):
    to_encode = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow()
    }
    return jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm="HS256")
```

### 8. Software and Data Integrity Failures

**Definition**: Updates, deployments, or sensitive operations performed without proper verification.

**Assessment Checklist**:
- [ ] Verify CI/CD pipeline requires code review before merge
- [ ] Check for signed commits enforced in main branch
- [ ] Confirm automated testing passes before deployment
- [ ] Verify deployments include rollback capability
- [ ] Check for signed container images if using Docker
- [ ] Confirm database migrations tested before production
- [ ] Verify API version consistency during updates
- [ ] Check for dependency verification (checksum validation)
- [ ] Confirm audit logs for critical operations
- [ ] Verify staging environment mirrors production

### 9. Logging and Monitoring Failures

**Definition**: Insufficient logging, monitoring, or incident response procedures.

**Assessment Checklist**:
- [ ] Verify security events logged (login failures, permission denials)
- [ ] Check logs not accessible to attackers (proper permissions)
- [ ] Confirm no sensitive data in logs (passwords, tokens)
- [ ] Verify logs retained for minimum 90 days
- [ ] Check for centralized logging system
- [ ] Confirm monitoring alerts for suspicious activity
- [ ] Verify incident response plan documented
- [ ] Check for failed login attempt logging
- [ ] Confirm privileged action audit trails
- [ ] Verify log integrity (tamper detection)

**Remediation Pattern - Structured Logging**:
```python
import structlog
from datetime import datetime

logger = structlog.get_logger()

# Log security event
logger.info(
    "authentication_failed",
    event="auth_failure",
    username=username,
    ip_address=request.client.host,
    timestamp=datetime.utcnow().isoformat(),
    reason="invalid_password"
)

# NOT: logger.info(f"User {username} failed login with password {password}")
```

### 10. Server-Side Request Forgery (SSRF)

**Definition**: Application fetches remote resources based on user-supplied input without validation.

**Assessment Checklist**:
- [ ] Verify all external URL requests validated
- [ ] Check for localhost/127.0.0.1 access prevention
- [ ] Confirm private IP ranges blocked (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- [ ] Verify metadata service endpoints protected (AWS 169.254.169.254)
- [ ] Check for open redirects in URL handling
- [ ] Confirm DNS resolution limitations (no DNS rebinding)
- [ ] Verify timeouts on external requests (5 second max)
- [ ] Check for URL scheme validation (HTTPS only)
- [ ] Confirm proxy restrictions
- [ ] Verify webhook URL validation

**Remediation Pattern**:
```python
from urllib.parse import urlparse
import ipaddress

def is_safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)

        # Only allow HTTPS
        if parsed.scheme != "https":
            return False

        # Resolve hostname to IP
        hostname = parsed.hostname
        ip = ipaddress.ip_address(socket.gethostbyname(hostname))

        # Block private IPs and localhost
        if ip.is_private or ip.is_loopback:
            return False

        return True
    except:
        return False

# Usage
@app.post("/api/fetch-url")
async def fetch_url(request: FetchRequest):
    if not is_safe_url(request.url):
        raise HTTPException(status_code=400, detail="Invalid URL")
    return await http_client.get(request.url)
```

## Dependency Vulnerability Scanning

### Automated Scanning Tools

```bash
# Python: pip-audit
pip-audit

# Python: Safety
safety check

# Node.js: npm audit
npm audit

# Node.js: Snyk
npm install -g snyk
snyk test

# JavaScript dependencies
npm audit --audit-level=high

# General SBOM generation
cyclonedx-npm --output-file sbom.json
```

### Interpreting Vulnerability Reports

**CVSS Score Severity**:
- **Critical (9.0-10.0)**: Immediate patching required
- **High (7.0-8.9)**: Patch within 30 days
- **Medium (4.0-6.9)**: Patch within 90 days
- **Low (0.1-3.9)**: Monitor and plan patching

## Secret Detection

### Sensitive Information Patterns to Scan

```python
import re

patterns = {
    "aws_key": r"AKIA[0-9A-Z]{16}",
    "private_key": r"-----BEGIN (RSA|OPENSSH|DSA|EC) PRIVATE KEY-----",
    "api_key": r"api[_-]?key[_-]?[a-zA-Z0-9]{20,}",
    "jwt": r"eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.",
    "slack_token": r"xox[baprs]-[0-9a-zA-Z]{10,48}",
    "github_token": r"ghp_[0-9a-zA-Z]{36}",
    "password": r"password\s*=\s*['\"][^'\"]{8,}['\"]",
    "database_url": r"(postgresql|mysql|mongodb)://[^@]+:[^@]+@",
}

def scan_for_secrets(content: str) -> list:
    found_secrets = []
    for secret_type, pattern in patterns.items():
        matches = re.finditer(pattern, content)
        for match in matches:
            found_secrets.append({
                "type": secret_type,
                "match": match.group(),
                "line": content[:match.start()].count('\n') + 1
            })
    return found_secrets
```

### Secret Detection Tools

```bash
# TruffleHog: Scan entire git history
trufflehog filesystem . --json

# GitGuardian: Commercial solution
ggshield scan path .

# git-secrets: Pre-commit hook
git secrets --install
git secrets --add 'AKIA[0-9A-Z]{16}'

# detect-secrets: Generate baseline
detect-secrets scan > .secrets.baseline
detect-secrets audit .secrets.baseline
```

## Static Application Security Testing (SAST)

### Code Pattern Vulnerabilities

**XSS (Cross-Site Scripting)**:
```python
# VULNERABLE: User input rendered without escaping
@app.get("/user/{name}")
async def greet(name: str):
    return HTMLResponse(f"<h1>Hello {name}</h1>")  # XSS if name contains <script>

# SECURE: Use template escaping
from jinja2 import Environment, select_autoescape
env = Environment(autoescape=select_autoescape(['html', 'xml']))
template = env.from_string("<h1>Hello {{ name }}</h1>")
return template.render(name=name)  # Auto-escaped
```

**CSRF (Cross-Site Request Forgery)**:
```python
# VULNERABLE: No CSRF token validation
@app.post("/api/transfer")
async def transfer_money(transfer: TransferRequest):
    # Any website can submit this form to user's browser
    return await process_transfer(transfer)

# SECURE: CSRF token validation
from starlette.middleware.csrf import CSRFMiddleware
app.add_middleware(CSRFMiddleware, secret_key="your-secret")

@app.post("/api/transfer")
async def transfer_money(request: Request, transfer: TransferRequest):
    # CSRF token automatically validated by middleware
    return await process_transfer(transfer)
```

**Command Injection**:
```python
# VULNERABLE
os.system(f"convert {image_path} -resize 200x200 {output_path}")

# SECURE
subprocess.run([
    "convert",
    image_path,
    "-resize", "200x200",
    output_path
], check=True)
```

### SAST Tools

```bash
# Python: Bandit
bandit -r src/

# Python: Semgrep
semgrep --config=p/security-audit src/

# Node.js: ESLint with security plugin
npm install eslint-plugin-security
# Add to eslintrc: "extends": ["plugin:security/recommended"]

# Java: SpotBugs
spotbugs -h4 -output report.html app.jar

# General: SonarQube
sonar-scanner -Dsonar.projectKey=myapp
```

## Security Headers Audit

### Essential Headers Checklist

```python
def audit_security_headers(response_headers: dict) -> dict:
    findings = {}

    # X-Frame-Options: Prevent clickjacking
    if "X-Frame-Options" not in response_headers:
        findings["X-Frame-Options"] = "MISSING - Set to 'DENY' or 'SAMEORIGIN'"
    elif response_headers.get("X-Frame-Options") not in ["DENY", "SAMEORIGIN"]:
        findings["X-Frame-Options"] = f"WEAK - Current: {response_headers.get('X-Frame-Options')}"

    # X-Content-Type-Options: Prevent MIME sniffing
    if response_headers.get("X-Content-Type-Options") != "nosniff":
        findings["X-Content-Type-Options"] = "MISSING or WEAK"

    # Content-Security-Policy: Prevent inline script execution
    if "Content-Security-Policy" not in response_headers:
        findings["Content-Security-Policy"] = "MISSING - Recommend: default-src 'self'"

    # Strict-Transport-Security: Enforce HTTPS
    if "Strict-Transport-Security" not in response_headers:
        findings["Strict-Transport-Security"] = "MISSING - Set max-age=31536000"

    # X-XSS-Protection: Legacy XSS protection
    if "X-XSS-Protection" not in response_headers:
        findings["X-XSS-Protection"] = "MISSING - Set to '1; mode=block'"

    # Referrer-Policy: Control referrer information
    if "Referrer-Policy" not in response_headers:
        findings["Referrer-Policy"] = "MISSING - Recommend: strict-no-referrer"

    # Permissions-Policy: Control browser features
    if "Permissions-Policy" not in response_headers:
        findings["Permissions-Policy"] = "MISSING - Consider restricting: camera, microphone, geolocation"

    return findings
```

### Header Implementation Template

```python
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)

    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"

    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # XSS Protection
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Force HTTPS
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self'; "
        "connect-src 'self' https:; "
        "frame-ancestors 'none'"
    )

    # Referrer Policy
    response.headers["Referrer-Policy"] = "strict-no-referrer"

    # Permissions Policy
    response.headers["Permissions-Policy"] = (
        "camera=(), "
        "microphone=(), "
        "geolocation=(), "
        "payment=()"
    )

    return response
```

## Authentication Flow Review

### OAuth 2.0 Security Checklist

- [ ] Authorization code flow used (not implicit flow)
- [ ] PKCE (Proof Key for Code Exchange) implemented for mobile/SPAs
- [ ] State parameter validated to prevent CSRF
- [ ] Redirect URI whitelist enforced
- [ ] Refresh tokens rotated on use
- [ ] Access tokens short-lived (15-60 minutes)
- [ ] Scope limitation enforced (principle of least privilege)
- [ ] Token endpoint uses HTTPS only
- [ ] Authorization header used for token transmission (not URL parameter)

### JWT Security Checklist

- [ ] Algorithm explicitly specified (not "none")
- [ ] Asymmetric algorithm used (RS256 preferred, not HS256 with shared secret)
- [ ] Expiration (exp) claim present and validated
- [ ] Issued-at (iat) claim present
- [ ] Subject (sub) identifies the user
- [ ] No sensitive data in JWT payload (logged when decoded)
- [ ] Signature verification performed on every request
- [ ] Key rotation plan implemented

### Session Management Checklist

- [ ] Session timeout 30 minutes of inactivity
- [ ] Secure flag set on session cookies
- [ ] HttpOnly flag prevents JavaScript access
- [ ] SameSite=Strict prevents CSRF
- [ ] Session ID regenerated on login (prevents fixation)
- [ ] Session invalidation on logout
- [ ] Concurrent session limits enforced
- [ ] IP address/User-Agent binding (optional, can cause issues for mobile users)

## Audit Checklist Template

```markdown
# Security Audit Report

## Executive Summary
- Total findings: X
- Critical: X | High: X | Medium: X | Low: X

## Authentication & Authorization
- [ ] Access control properly enforced
- [ ] Authentication flow secure
- [ ] MFA available/enforced
- [ ] Session management secure
- [ ] Password policies strong

## Data Protection
- [ ] Encryption in transit (TLS 1.2+)
- [ ] Encryption at rest implemented
- [ ] Sensitive data not logged
- [ ] API keys not exposed
- [ ] Database connection secured

## Input Validation & Injection Prevention
- [ ] All inputs validated
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] CSRF tokens implemented
- [ ] Command injection protection

## Dependencies & Components
- [ ] No critical/high CVEs
- [ ] Dependencies current
- [ ] Lock files committed
- [ ] SCA tool integrated in CI/CD

## Security Headers & Configuration
- [ ] All security headers present
- [ ] Debug mode disabled in production
- [ ] Default credentials changed
- [ ] CORS properly configured
- [ ] Rate limiting implemented

## Logging & Monitoring
- [ ] Security events logged
- [ ] Sensitive data not logged
- [ ] Logs retained 90+ days
- [ ] Alerts configured
- [ ] Incident response plan

## Remediation Actions (Priority Order)
1. [Critical findings]
2. [High findings]
3. [Medium findings]
4. [Low findings]
```

## Integration with CI/CD

```yaml
# GitHub Actions example
name: Security Audit

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'

      - name: Run Semgrep SAST
        uses: returntocorp/semgrep-action@v1

      - name: Dependency audit (Python)
        run: pip-audit

      - name: Dependency audit (Node)
        run: npm audit

      - name: Secret detection
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
```

## Reporting Security Issues

When conducting security audits, document findings with:
1. **Vulnerability Type**: OWASP category
2. **Severity**: Critical/High/Medium/Low
3. **Location**: File path, line number, endpoint
4. **Description**: What was found and why it's problematic
5. **Proof of Concept**: How to reproduce (without enabling real attacks)
6. **Remediation**: Specific fix with code example
7. **Verification Steps**: How to verify the fix
8. **References**: CVE, OWASP link, security research

---

**Last Updated**: 2026-04-07
**Auditor**: Security Audit Skill v1.0
**Scope**: Web applications, APIs, authentication systems
