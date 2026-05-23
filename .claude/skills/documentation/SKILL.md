# Documentation Skill

Professional documentation generation across all project types. Covers API docs, code comments, README files, ADRs, runbooks, and onboarding guides.

## README Generation

The README is the first impression of your project. It should answer key questions immediately.

### Essential README Structure

```markdown
# Project Name

Brief one-line description of what the project does.

## Overview

2-3 paragraph explanation of:
- What problem it solves
- Who should use it
- Key differentiators

## Quick Start

Get users running in < 5 minutes:

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Installation

```bash
git clone https://github.com/org/project.git
cd project
npm install
npm run build
```

### Running the Project

```bash
npm run dev
```

Visit http://localhost:5173

## Features

- Bullet list of key features
- What makes this project special
- Unique capabilities

## Architecture

High-level system diagram:

```
┌─────────────┐
│   React     │
│  Frontend   │
└──────┬──────┘
       │ HTTP
┌──────▼──────────┐
│   FastAPI       │
│   Backend       │
└──────┬──────────┘
       │ SQL
┌──────▼──────────┐
│  PostgreSQL     │
│   Database      │
└─────────────────┘
```

## API Documentation

See [API Docs](./docs/api.md) for complete endpoint reference.

## Development

### Project Structure

```
project/
├── backend/              # FastAPI application
│   ├── src/
│   │   ├── main.py      # Entry point
│   │   ├── models/      # Database models
│   │   ├── services/    # Business logic
│   │   └── routes/      # API endpoints
│   └── tests/           # Test suite
├── frontend/            # React application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks
│   │   ├── pages/       # Page components
│   │   └── services/    # API clients
│   └── tests/           # Test suite
└── docs/                # Documentation
```

### Running Tests

```bash
# Backend
cd backend
pytest tests/ -v

# Frontend
cd frontend
npm test
```

### Code Style

```bash
# Python formatting
black src/ tests/

# TypeScript linting
npm run lint
npm run lint:fix
```

## Configuration

Key environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | postgresql://localhost/myapp | PostgreSQL connection |
| REDIS_URL | redis://localhost:6379 | Redis cache |
| DEBUG | false | Enable debug logging |
| SECRET_KEY | (required) | JWT signing key |

Copy `.env.example` to `.env` and configure.

## Deployment

See [Deployment Guide](./docs/deployment.md) for:
- Docker container setup
- Kubernetes deployment
- GitHub Actions CI/CD
- Database migrations

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 5173
lsof -i :5173
kill -9 <PID>
```

### Database Connection Failed

Verify PostgreSQL is running:
```bash
psql -U postgres -c "SELECT version();"
```

## License

MIT License - see [LICENSE](./LICENSE) file

## Support

- Issues: [GitHub Issues](https://github.com/org/project/issues)
- Discussions: [GitHub Discussions](https://github.com/org/project/discussions)
- Email: support@example.com

## Maintainers

- @john-doe - Backend architecture
- @jane-smith - Frontend design
```

## OpenAPI/Swagger Documentation

### FastAPI Auto-Generated Docs

FastAPI automatically generates OpenAPI docs. Enhance with detailed docstrings:

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(
    title="User Service API",
    description="User management and authentication",
    version="1.0.0"
)

class User(BaseModel):
    """User account representation."""
    id: int
    name: str
    email: str
    is_active: bool

@app.get(
    "/api/users/{user_id}",
    response_model=User,
    tags=["Users"],
    summary="Get user by ID",
    description="Retrieve a single user by their unique identifier."
)
async def get_user(
    user_id: int = Path(..., gt=0, description="User ID (positive integer)")
) -> User:
    """
    Get user details.

    - **user_id**: User's unique identifier
    - Returns: User object if found
    - Raises: 404 if user not found

    Example:
        ```
        GET /api/users/123
        ```
    """
    user = await db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post(
    "/api/users",
    response_model=User,
    status_code=201,
    tags=["Users"],
    summary="Create new user"
)
async def create_user(user: User) -> User:
    """
    Create a new user account.

    - **name**: User's full name (required)
    - **email**: User's email address (required, unique)
    - Returns: Created user object with ID

    Example request:
        ```json
        {
            "name": "John Doe",
            "email": "john@example.com",
            "is_active": true
        }
        ```
    """
    existing = await db.get_by_email(user.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists")
    return await db.save_user(user)

# Access docs at:
# Swagger UI: http://localhost:8000/api/docs
# ReDoc: http://localhost:8000/api/redoc
# OpenAPI JSON: http://localhost:8000/api/openapi.json
```

### Manual OpenAPI Specification

For non-FastAPI projects, create `openapi.yaml`:

```yaml
openapi: 3.0.0
info:
  title: User Service API
  version: 1.0.0
  description: User management and authentication
servers:
  - url: https://api.example.com
paths:
  /api/users:
    post:
      summary: Create user
      tags:
        - Users
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                  example: "John Doe"
                email:
                  type: string
                  format: email
                  example: "john@example.com"
              required:
                - name
                - email
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '409':
          description: Email already exists
        '422':
          description: Invalid request data

  /api/users/{userId}:
    get:
      summary: Get user by ID
      tags:
        - Users
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: integer
          description: User's unique identifier
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
          example: 1
        name:
          type: string
          example: "John Doe"
        email:
          type: string
          format: email
          example: "john@example.com"
        isActive:
          type: boolean
          example: true
      required:
        - id
        - name
        - email
```

## Code Comments and Docstrings

### Python Docstrings (Google Style)

```python
def calculate_order_total(items: list[OrderItem], customer: Customer) -> float:
    """
    Calculate total cost for order including tax, shipping, and discounts.

    Applies customer loyalty discounts and applies state sales tax.
    Shipping cost determined by order total.

    Args:
        items: List of items ordered. Must not be empty.
        customer: Customer object with discount eligibility info.

    Returns:
        Total order cost in USD as float.

    Raises:
        ValueError: If items list is empty or customer is None.
        TaxCalculationError: If tax lookup fails.

    Example:
        >>> items = [OrderItem("apple", 1.99, 2)]
        >>> customer = Customer("john", is_member=True)
        >>> total = calculate_order_total(items, customer)
        >>> total
        4.54
    """
    if not items:
        raise ValueError("Order must contain at least one item")
    if not customer:
        raise ValueError("Customer is required")

    # Calculate subtotal
    subtotal = sum(item.price * item.quantity for item in items)

    # Apply customer discount (10% for members)
    discount = subtotal * 0.1 if customer.is_member else 0
    subtotal_after_discount = subtotal - discount

    # Calculate tax based on state
    tax = subtotal_after_discount * get_tax_rate(customer.state)

    # Calculate shipping
    shipping = calculate_shipping(subtotal_after_discount)

    return subtotal_after_discount + tax + shipping
```

### JavaScript/TypeScript JSDoc

```typescript
/**
 * Calculate total cost for order including tax, shipping, and discounts.
 *
 * Applies customer loyalty discounts and applies state sales tax.
 * Shipping cost determined by order total.
 *
 * @param {OrderItem[]} items - List of items ordered. Must not be empty.
 * @param {Customer} customer - Customer object with discount eligibility.
 * @returns {number} Total order cost in USD.
 * @throws {Error} If items is empty or customer is null.
 * @throws {Error} If tax lookup fails.
 *
 * @example
 * const items = [{ name: 'apple', price: 1.99, quantity: 2 }];
 * const customer = { name: 'john', isMember: true };
 * const total = calculateOrderTotal(items, customer);
 * // Returns: 4.54
 */
function calculateOrderTotal(
  items: OrderItem[],
  customer: Customer
): number {
  if (items.length === 0) {
    throw new Error("Order must contain at least one item");
  }
  if (!customer) {
    throw new Error("Customer is required");
  }

  // Calculate subtotal
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Apply customer discount (10% for members)
  const discount = customer.isMember ? subtotal * 0.1 : 0;
  const subtotalAfterDiscount = subtotal - discount;

  // Calculate tax
  const tax = subtotalAfterDiscount * getTaxRate(customer.state);

  // Calculate shipping
  const shipping = calculateShipping(subtotalAfterDiscount);

  return subtotalAfterDiscount + tax + shipping;
}
```

## Architecture Decision Records (ADRs)

Document major technical decisions for future reference.

### ADR Template

```markdown
# ADR-001: Use PostgreSQL for Primary Database

Date: 2024-04-07
Status: Accepted
Context: Need to select primary data store for user and transaction data

## Problem Statement
The system requires a reliable, relational data store to manage:
- User accounts with relationships to orders
- Financial transactions with audit trails
- Complex queries for reporting

## Considered Alternatives

1. **NoSQL (MongoDB)**
   - Pros: Flexible schema, good horizontal scaling
   - Cons: Less suitable for transactional consistency, complex joins

2. **MySQL**
   - Pros: Wide adoption, MySQL compatible
   - Cons: Performance concerns at scale, less advanced features

3. **PostgreSQL**
   - Pros: Strong ACID compliance, advanced features (JSON, arrays), great performance
   - Cons: Requires vertical scaling more than horizontal

## Decision
Use PostgreSQL 14+ as primary database with TimescaleDB extension for time-series data.

## Rationale
- Financial transactions require ACID compliance and PostgreSQL provides that
- Complex reporting queries benefit from PostgreSQL's advanced features
- JSONB support provides flexibility without sacrificing relational structure
- TimescaleDB extension handles time-series data (OHLCV candles, trades)

## Consequences

### Positive
- Mature, stable technology with excellent community support
- Superior query optimizer for complex analytics queries
- Built-in full-text search capabilities
- Easy backup and disaster recovery

### Negative
- Requires more careful capacity planning for extreme scale
- Licensing discussions if using advanced features (not needed for us)
- Requires understanding of relational concepts

## Implementation Details

```bash
# Docker compose entry
services:
  postgres:
    image: timescale/timescaledb:latest-pg14
    environment:
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
```

## Related Decisions
- ADR-002: Use SQLAlchemy ORM for database access
- ADR-003: Implement TimescaleDB hypertables for trading data

## References
- [PostgreSQL Official Docs](https://www.postgresql.org/docs/)
- [TimescaleDB Docs](https://docs.timescale.com/)
- [ACID Transactions](https://en.wikipedia.org/wiki/ACID)
```

## Runbook Template

Step-by-step guides for operational tasks.

```markdown
# Runbook: Deploy to Production

**Purpose**: Release code to production environment
**Owner**: DevOps team
**Last Updated**: 2024-04-07
**Estimated Duration**: 30 minutes

## Pre-Deployment Checklist

- [ ] All tests passing in CI/CD
- [ ] Code reviewed and approved (2+ reviewers)
- [ ] Database migrations tested on staging
- [ ] Rollback plan documented
- [ ] On-call engineer notified
- [ ] Deployment window scheduled (off-peak hours)

## Deployment Steps

### 1. Prepare Release

```bash
# Create release branch
git checkout -b release/v1.2.3

# Update version numbers
npm version minor

# Build and test
npm run build
npm test

# Tag release
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

### 2. Run Database Migrations

```bash
# Connect to production database
psql -h prod-db.example.com -U postgres -d trading_bot

# Review pending migrations
\d schema_version;

# Apply migrations (in transaction, can rollback if needed)
BEGIN;
  -- Migrations apply here
COMMIT;
```

### 3. Deploy Application

```bash
# SSH to production server
ssh deploy@prod-api.example.com

# Pull latest code
cd /app
git fetch origin
git checkout v1.2.3

# Install dependencies
npm install --production

# Start new version
pm2 restart trading-api
pm2 logs trading-api

# Verify startup logs for errors
tail -f logs/application.log
```

### 4. Health Checks

```bash
# Check API health endpoint
curl -s https://api.example.com/api/v1/health | jq .

# Expected response:
# {
#   "status": "healthy",
#   "version": "1.2.3",
#   "database": "connected",
#   "redis": "connected"
# }

# Monitor key metrics
curl https://metrics.example.com/api/metrics?query=request_rate

# Expected: Request rate stable at baseline +/- 10%
```

### 5. Smoke Tests

Run critical user flows:
- [ ] User login works
- [ ] Market data updates streaming in
- [ ] Orders place successfully
- [ ] Portfolio calculations accurate

## Rollback Procedure (If Issues)

```bash
# Stop current version
pm2 stop trading-api

# Checkout previous version
git checkout v1.2.2

# Restart service
npm install --production
pm2 start trading-api

# Verify health
curl https://api.example.com/api/v1/health

# Notify stakeholders
# Post in #deployments: "v1.2.3 rolled back due to [reason]"
```

## Post-Deployment

- [ ] Monitor error rates for 1 hour
- [ ] Check database replication lag
- [ ] Verify all scheduled jobs running
- [ ] Update status page if needed
- [ ] Post deployment summary in #deployments

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs trading-api

# Common issues:
# - Database connection string wrong
# - Redis unavailable
# - Missing environment variables
```

### High Error Rate

```bash
# Check recent changes
git log --oneline -5

# Review error logs
journalctl -u trading-api -n 100

# Rollback if error rate > 5x baseline
```

## Escalation

Contact on-call engineer:
- Slack: @trading-api-oncall
- PagerDuty: [Create incident](https://example.pagerduty.com)
- Phone: [Emergency number]
```

## Onboarding Guide

Welcome new team members to the project.

```markdown
# New Developer Onboarding Guide

Welcome to the Trading Bot project! This guide gets you productive in one day.

## Day 1: Environment Setup (2 hours)

### 1. Clone Repository

```bash
git clone https://github.com/company/trading-bot.git
cd trading-bot
```

### 2. Install Dependencies

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
nvm use 18
npm install
```

### 3. Setup Database

```bash
# Start Docker services
docker-compose up -d postgres redis

# Initialize database
cd backend
python init_database.py

# Verify
psql postgresql://localhost/trading_bot -c "SELECT COUNT(*) FROM users;"
```

### 4. Start Development Servers

Terminal 1 - Backend:
```bash
cd backend
uvicorn src.main:app --reload --port 8000
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

Visit http://localhost:5173

## Day 1: Codebase Tour (2 hours)

### Backend Architecture

```
backend/
├── src/
│   ├── main.py          # FastAPI app setup
│   ├── models/          # SQLAlchemy models (User, Order, Trade)
│   ├── services/        # Business logic (PaymentService, TradingEngine)
│   ├── routes/          # API endpoints (/api/users, /api/orders)
│   ├── schemas/         # Pydantic request/response models
│   └── config/          # Configuration and settings
├── tests/               # Test suite
└── requirements.txt     # Python dependencies
```

**Key Services**:
- `PaymentService`: Handles payment processing
- `TradingEngine`: Manages trading logic and orders
- `BinanceClient`: Cryptocurrency exchange API

### Frontend Architecture

```
frontend/
├── src/
│   ├── components/      # React UI components
│   ├── pages/           # Page-level components
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API clients and utilities
│   ├── store/           # Zustand state management
│   ├── contexts/        # React context providers
│   └── types/           # TypeScript type definitions
└── tests/               # Component and unit tests
```

**Key Components**:
- `Dashboard`: Main trading interface
- `OrderForm`: Place new orders
- `PortfolioView`: View holdings and P&L

## Day 2: First Contribution (4 hours)

### Task: Add Email Notification Feature

1. **Read Issue**
   - Issue: [#123 - Add email alerts for trade execution](https://github.com/company/trading-bot/issues/123)
   - Take ownership by commenting: "I'll work on this"

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/email-alerts
   ```

3. **Implement Backend Service**
   - Create `NotificationService` in `backend/src/services/`
   - Send email via SMTP when trade completes
   - Write unit tests in `backend/tests/test_notification_service.py`

4. **Update API Endpoint**
   - Modify `backend/src/routes/orders.py`
   - Call notification service after order execution
   - Test with API client

5. **Update Frontend**
   - Add "Enable email alerts" checkbox to OrderForm
   - Store setting in database
   - Write component test

6. **Create Pull Request**
   - Reference issue: "Closes #123"
   - Write description of changes
   - Include before/after screenshots
   - Run: `npm run lint && npm test && pytest tests/ -v`

7. **Code Review**
   - Respond to reviewer feedback
   - Make requested changes
   - Merge when approved

## Resources

- **Slack**: #trading-bot channel
- **Docs**: [Developer Guide](./docs/developer-guide.md)
- **API Docs**: http://localhost:8000/api/docs
- **Database Schema**: [docs/database.md](./docs/database.md)
- **Architecture**: [ADRs](./docs/adr/)

## Common Issues & Solutions

### "Module not found" errors
```bash
# Ensure venv activated
source venv/bin/activate
# Reinstall dependencies
pip install -r requirements.txt
```

### Port 5173 already in use
```bash
lsof -i :5173
kill -9 <PID>
npm run dev
```

### Database connection failed
```bash
# Check Docker services running
docker ps | grep postgres

# Restart if needed
docker-compose restart postgres
```

## Next Steps

- Read [Code Style Guide](./docs/code-style.md)
- Review [Testing Guide](./docs/testing.md)
- Attend architecture sync (Thursdays 2pm)
- Pair with team member on next task

## Questions?

- Ask in #trading-bot Slack
- Ping your onboarding buddy
- Schedule 1:1 with engineering lead
```

## Technical Specification Template

```markdown
# Technical Specification: Real-Time Market Data Streaming

**Document ID**: TS-2024-001
**Version**: 1.2
**Status**: Approved
**Author**: Engineering Team
**Last Updated**: 2024-04-07

## 1. Overview

This system streams real-time cryptocurrency market data (price, volume, trades) to connected clients via WebSocket.

## 2. Requirements

### Functional Requirements
- FR-1: System shall accept WebSocket connections from authenticated clients
- FR-2: System shall stream OHLCV data at 1-second intervals
- FR-3: System shall forward individual trade events in real-time
- FR-4: System shall support subscribing to multiple trading pairs

### Non-Functional Requirements
- NFR-1: Latency < 100ms from data source to client
- NFR-2: Support 10,000 concurrent connections
- NFR-3: 99.9% uptime availability
- NFR-4: Fallback to REST API if WebSocket unavailable

## 3. System Architecture

```
┌──────────────────────┐
│   Binance API        │
│  (Market Data)       │
└──────────┬───────────┘
           │
┌──────────▼───────────────┐
│  WebSocket Manager        │
│  (Connection handling)    │
└──────────┬───────────────┘
           │
┌──────────▼────────────────────┐
│  Data Transformer             │
│  (Parse & format data)        │
└──────────┬────────────────────┘
           │
┌──────────▼────────────────────┐
│  Connected Clients            │
│  (Frontend applications)      │
└───────────────────────────────┘
```

## 4. Data Models

```python
class OHLCVData(BaseModel):
    """One-minute candlestick data."""
    symbol: str  # e.g., "BTCUSDT"
    timestamp: int  # Unix timestamp
    open: float
    high: float
    low: float
    close: float
    volume: float

class Trade(BaseModel):
    """Individual trade event."""
    symbol: str
    timestamp: int
    price: float
    quantity: float
    side: str  # "BUY" or "SELL"
    trade_id: int
```

## 5. API Specification

### WebSocket Endpoint

```
wss://api.example.com/ws/market-data
```

#### Connection Message

```json
{
  "action": "subscribe",
  "channels": ["BTCUSDT", "ETHUSDT"],
  "types": ["ohlcv", "trades"]
}
```

#### Data Message (OHLCV)

```json
{
  "type": "ohlcv",
  "symbol": "BTCUSDT",
  "data": {
    "timestamp": 1712505600,
    "open": 42000.50,
    "high": 42500.00,
    "low": 41800.00,
    "close": 42300.25,
    "volume": 250.5
  }
}
```

#### Error Message

```json
{
  "type": "error",
  "code": "INVALID_SYMBOL",
  "message": "Symbol XXXUSDT not found"
}
```

## 6. Implementation Plan

### Phase 1: Core WebSocket (Week 1)
- [ ] Implement WebSocket server
- [ ] Authentication integration
- [ ] Subscribe/unsubscribe handling

### Phase 2: Data Streaming (Week 2)
- [ ] Integrate Binance API
- [ ] OHLCV data formatting
- [ ] Trade event streaming

### Phase 3: Testing & Optimization (Week 3)
- [ ] Load testing (10K concurrent)
- [ ] Performance optimization
- [ ] Error handling & recovery

## 7. Testing Strategy

- **Unit Tests**: WebSocket message parsing, data transformation
- **Integration Tests**: Full data flow from Binance to client
- **Load Tests**: 10K concurrent connections, measure latency
- **E2E Tests**: Client subscription → data delivery

## 8. Success Criteria

- [ ] < 100ms latency in production
- [ ] Support 10K concurrent connections
- [ ] 99.9% uptime over 30 days
- [ ] All tests passing with > 80% coverage
```

---

**Last Updated**: 2026-04-07
**Documentation Standards Version**: 2.1
**Supported Formats**: Markdown, OpenAPI, ADR, RST
