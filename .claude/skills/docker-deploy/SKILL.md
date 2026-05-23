# Docker & Deployment Skill

Professional containerization and deployment strategies. Covers Docker best practices, orchestration, CI/CD pipelines, and Kubernetes fundamentals.

## Dockerfile Best Practices

### Multi-Stage Build (Optimized)

Reduces final image size by separating build and runtime stages.

```dockerfile
# Stage 1: Build
FROM python:3.11-slim as builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Runtime (minimal base image)
FROM python:3.11-slim

# Create non-root user (security best practice)
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy only Python dependencies from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser src/ ./src/

# Set environment variables
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/v1/health')"

# Run as non-root
USER appuser

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Layer Caching Optimization

```dockerfile
# BAD: All changes invalidate cache from this point
FROM python:3.11
COPY . /app
RUN pip install -r requirements.txt

# GOOD: Separate dependency installation from code
FROM python:3.11
WORKDIR /app

# Install dependencies (cached if requirements.txt unchanged)
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy source code (can invalidate often)
COPY src/ ./src/

# Benefits:
# - If only code changes: pip install cached, skipped
# - If only requirements change: pip install re-runs, code copy cached
# - Smaller layersre-downloaded on registry push
```

### Security Hardening

```dockerfile
FROM python:3.11-slim

# Don't run as root
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Minimal packages (no unnecessary tools)
RUN apt-get update && apt-get install -y \
    curl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Don't store secrets in layers
RUN pip install --no-cache-dir -r requirements.txt

# Use specific versions (not latest)
# WRONG: FROM python:latest
# CORRECT: FROM python:3.11-slim

# Mark as read-only where possible
RUN chmod -R 555 /app

# Define explicit entry point
ENTRYPOINT ["python", "-m", "uvicorn"]
CMD ["src.main:app"]
```

### Production-Ready Template

```dockerfile
# Build stage
FROM python:3.11-slim as builder

WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.11-slim

# Security: non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy runtime dependencies
COPY --from=builder /root/.local /home/appuser/.local

# Copy application
COPY --chown=appuser:appuser src/ ./src/
COPY --chown=appuser:appuser config/ ./config/

# Environment
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LOG_LEVEL=INFO

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/v1/health')" || exit 1

# Expose port
EXPOSE 8000

# Run as unprivileged user
USER appuser

# Start application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Docker Compose Orchestration

### Development Setup

```yaml
version: '3.9'

services:
  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: trading_bot_backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/trading_bot
      REDIS_URL: redis://redis:6379
      DEBUG: "true"
      LOG_LEVEL: DEBUG
    volumes:
      - ./backend/src:/app/src  # Live code reload
      - ./backend/tests:/app/tests
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
    networks:
      - trading-network

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    container_name: trading_bot_frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
    depends_on:
      - backend
    environment:
      VITE_API_URL: http://localhost:8000/api
    command: npm run dev
    networks:
      - trading-network

  # PostgreSQL Database
  postgres:
    image: timescale/timescaledb:latest-pg14
    container_name: trading_bot_postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: trading_bot
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - trading-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: trading_bot_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - trading-network

  # PgAdmin for database management
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: trading_bot_pgadmin
    ports:
      - "5050:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    depends_on:
      - postgres
    networks:
      - trading-network

volumes:
  postgres_data:
  redis_data:

networks:
  trading-network:
    driver: bridge
```

### Production Setup

```yaml
version: '3.9'

services:
  backend:
    image: registry.example.com/trading-bot:latest
    container_name: trading_bot_prod
    restart: always
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      DEBUG: "false"
      LOG_LEVEL: INFO
      SECRET_KEY: ${SECRET_KEY}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    networks:
      - prod-network

  postgres:
    image: timescale/timescaledb:latest-pg14
    container_name: trading_bot_postgres_prod
    restart: always
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: trading_bot
    volumes:
      - /mnt/data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - prod-network

  redis:
    image: redis:7-alpine
    container_name: trading_bot_redis_prod
    restart: always
    volumes:
      - /mnt/data/redis:/data
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - prod-network

networks:
  prod-network:
    driver: bridge
```

### Commands

```bash
# Development
docker-compose up -d              # Start services
docker-compose logs -f backend    # View logs
docker-compose down               # Stop services
docker-compose down -v            # Stop and remove volumes

# Production
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs backend
```

## Container Registry (Docker Hub / Private Registry)

```bash
# Build image
docker build -t trading-bot:1.0.0 .

# Tag for registry
docker tag trading-bot:1.0.0 registry.example.com/trading-bot:1.0.0
docker tag trading-bot:1.0.0 registry.example.com/trading-bot:latest

# Push to registry
docker login registry.example.com
docker push registry.example.com/trading-bot:1.0.0
docker push registry.example.com/trading-bot:latest

# Pull from registry
docker pull registry.example.com/trading-bot:latest

# Private registry with authentication
docker run -e REGISTRY_AUTH=htpasswd \
  -e REGISTRY_AUTH_HTPASSWD_REALM="Registry Realm" \
  -e REGISTRY_AUTH_HTPASSWD_PATH=/auth/htpasswd \
  registry:2
```

## Health Checks

```dockerfile
# Dockerfile health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1
```

```python
# Backend health check endpoint
from fastapi import FastAPI
from datetime import datetime

app = FastAPI()

@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint for container orchestration."""
    try:
        # Check database
        db_status = await db.execute("SELECT 1")

        # Check Redis
        redis_status = await redis.ping()

        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": {
                "database": "ok" if db_status else "error",
                "redis": "ok" if redis_status else "error"
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }, 503
```

## CI/CD Pipelines

### GitHub Actions Workflow

```yaml
name: Build and Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: timescale/timescaledb:latest-pg14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Run linting
        run: |
          black --check src/
          ruff check src/

      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
        run: pytest tests/ -v --cov=src/

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'

    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to registry
        uses: docker/login-action@v2
        with:
          registry: registry.example.com
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: |
            registry.example.com/trading-bot:latest
            registry.example.com/trading-bot:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Deploy to production
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
        run: |
          mkdir -p ~/.ssh
          echo "$DEPLOY_KEY" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh -o StrictHostKeyChecking=no deploy@$DEPLOY_HOST \
            "cd /app && docker-compose pull && docker-compose up -d"
```

## Kubernetes Deployment

### Basic Kubernetes Configuration

```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trading-bot-backend
  labels:
    app: trading-bot
spec:
  replicas: 3
  selector:
    matchLabels:
      app: trading-bot
  template:
    metadata:
      labels:
        app: trading-bot
    spec:
      containers:
      - name: backend
        image: registry.example.com/trading-bot:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: trading-bot-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: trading-bot-secrets
              key: redis-url
        livenessProbe:
          httpGet:
            path: /api/v1/health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/v1/health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
# backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: trading-bot-service
spec:
  selector:
    app: trading-bot
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: LoadBalancer

---
# backend-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: trading-bot-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.example.com
    secretName: trading-bot-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: trading-bot-service
            port:
              number: 80

---
# Secret configuration
apiVersion: v1
kind: Secret
metadata:
  name: trading-bot-secrets
type: Opaque
stringData:
  database-url: "postgresql://user:password@postgres:5432/trading_bot"
  redis-url: "redis://redis:6379"
```

### Kubernetes Commands

```bash
# Apply configurations
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml
kubectl apply -f backend-ingress.yaml

# Check status
kubectl get pods
kubectl get services
kubectl get ingress

# View logs
kubectl logs deployment/trading-bot-backend
kubectl logs -f pod/trading-bot-backend-abc123xyz

# Scale deployment
kubectl scale deployment trading-bot-backend --replicas=5

# Update deployment
kubectl set image deployment/trading-bot-backend \
  backend=registry.example.com/trading-bot:v1.1.0

# Rollback deployment
kubectl rollout undo deployment/trading-bot-backend
kubectl rollout history deployment/trading-bot-backend
```

## Environment Configuration

```bash
# .env.example (never commit secrets)
DATABASE_URL=postgresql://user:password@localhost:5432/trading_bot
REDIS_URL=redis://localhost:6379
DEBUG=false
LOG_LEVEL=INFO
SECRET_KEY=your-secret-key-here

# Docker with environment variables
docker build --build-arg LOG_LEVEL=DEBUG -t app:1.0.0 .
docker run -e DATABASE_URL=postgresql://localhost/mydb app:1.0.0
```

## Security Best Practices

1. **Never store secrets in images**
   ```dockerfile
   # BAD
   ENV API_KEY=sk-1234567890

   # GOOD
   # Use secrets management: Docker Secrets, Kubernetes Secrets, or vault
   ```

2. **Run as non-root user**
   ```dockerfile
   RUN useradd -m -u 1000 appuser
   USER appuser
   ```

3. **Use minimal base images**
   ```dockerfile
   FROM python:3.11-slim     # Better
   FROM python:3.11          # Larger
   FROM python:3.11-alpine   # For smaller apps
   ```

4. **Keep dependencies current**
   ```bash
   docker run -it --rm -v $PWD:/workspace \
     aquasec/trivy image --severity HIGH,CRITICAL myapp:latest
   ```

---

**Last Updated**: 2026-04-07
**Docker Version**: 24.0+
**Kubernetes Version**: 1.27+
**CI/CD Standards**: GitHub Actions, GitLab CI
