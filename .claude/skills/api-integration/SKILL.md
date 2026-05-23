# API Integration Skill

Professional API design and integration patterns. Covers REST, GraphQL, WebSocket, authentication, rate limiting, and testing strategies.

## REST API Design Principles

### 1. Resource-Based URLs

URLs should represent resources, not actions.

```
GOOD (resource-based):
GET    /api/v1/users              # List all users
POST   /api/v1/users              # Create user
GET    /api/v1/users/123          # Get user 123
PUT    /api/v1/users/123          # Update user 123
DELETE /api/v1/users/123          # Delete user 123
GET    /api/v1/users/123/orders   # Get user's orders
POST   /api/v1/orders             # Create order

BAD (action-based):
GET    /api/getUser?id=123
POST   /api/createUser
GET    /api/deleteUser?id=123
GET    /api/getUserOrders?user=123
```

### 2. HTTP Methods & Status Codes

```python
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

app = FastAPI()

class User(BaseModel):
    id: int
    name: str
    email: str

# GET - Retrieve resource
@app.get("/api/v1/users/{user_id}", response_model=User)
async def get_user(user_id: int):
    """Retrieve single user. Returns 200 OK or 404 Not Found."""
    user = await db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# POST - Create resource
@app.post("/api/v1/users", response_model=User, status_code=201)
async def create_user(user: User):
    """Create new user. Returns 201 Created."""
    existing = await db.get_by_email(user.email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists")
    return await db.save_user(user)

# PUT - Full replacement
@app.put("/api/v1/users/{user_id}", response_model=User)
async def update_user(user_id: int, user: User):
    """Replace entire user. Returns 200 OK or 404 Not Found."""
    existing = await db.get_user(user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    return await db.update_user(user_id, user)

# PATCH - Partial update
@app.patch("/api/v1/users/{user_id}", response_model=User)
async def patch_user(user_id: int, update: dict):
    """Update specific fields. Returns 200 OK."""
    existing = await db.get_user(user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    return await db.update_user(user_id, update)

# DELETE - Remove resource
@app.delete("/api/v1/users/{user_id}", status_code=204)
async def delete_user(user_id: int):
    """Delete user. Returns 204 No Content."""
    await db.delete_user(user_id)
    # 204 has no response body
```

**HTTP Status Code Reference**:
- `200 OK`: Successful GET, PUT, PATCH
- `201 Created`: Successful POST
- `204 No Content`: Successful DELETE
- `400 Bad Request`: Invalid input, validation error
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Authenticated but lacks permission
- `404 Not Found`: Resource doesn't exist
- `409 Conflict`: Resource conflict (e.g., duplicate email)
- `422 Unprocessable Entity`: Validation error details
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### 3. API Versioning

```python
# Option 1: URL Path Versioning (Recommended)
@app.get("/api/v1/users/{user_id}")
async def get_user_v1(user_id: int):
    """Old API version - backward compatible."""
    return {"id": user_id, "name": "User"}

@app.get("/api/v2/users/{user_id}")
async def get_user_v2(user_id: int):
    """New API version - enhanced response."""
    return {
        "id": user_id,
        "name": "User",
        "email": "user@example.com",  # New in v2
        "created_at": "2024-04-07"     # New in v2
    }

# Option 2: Header-Based Versioning
@app.get("/api/users/{user_id}")
async def get_user(user_id: int, api_version: str = Header(...)):
    """API version specified in header: X-API-Version: 1.0"""
    if api_version == "1.0":
        return {"id": user_id, "name": "User"}
    elif api_version == "2.0":
        return {"id": user_id, "name": "User", "email": "user@example.com"}

# Option 3: Query Parameter
@app.get("/api/users/{user_id}")
async def get_user(user_id: int, version: str = "1.0"):
    """API version specified in query: ?version=2.0"""
    if version == "1.0":
        return {"id": user_id, "name": "User"}
    elif version == "2.0":
        return {"id": user_id, "name": "User", "email": "user@example.com"}

# Deprecation strategy
@app.get("/api/v1/users/{user_id}")
async def get_user_v1(user_id: int, response: Response):
    """Deprecated: Use /api/v2/users/{user_id} instead."""
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"] = "Sun, 31 Dec 2024 23:59:59 GMT"
    response.headers["Link"] = '</api/v2/users/{user_id}>; rel="successor-version"'
    return {"id": user_id, "name": "User"}
```

### 4. Pagination

```python
from pydantic import BaseModel
from typing import Generic, TypeVar, List

T = TypeVar('T')

class PaginationParams(BaseModel):
    page: int = 1  # 1-indexed
    limit: int = 20
    offset: int = 0

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.limit

class PaginatedResponse(BaseModel, Generic[T]):
    data: List[T]
    pagination: dict

@app.get("/api/v1/users", response_model=PaginatedResponse)
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """
    List users with pagination.

    - **page**: Page number (1-indexed), default 1
    - **limit**: Items per page, max 100, default 20
    """
    total = await db.count_users()
    users = await db.list_users(skip=(page - 1) * limit, limit=limit)

    return PaginatedResponse(
        data=users,
        pagination={
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
            "has_next": page * limit < total,
            "has_previous": page > 1
        }
    )

# Cursor-based pagination (better for large datasets)
@app.get("/api/v1/users/stream")
async def stream_users(
    cursor: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100)
):
    """
    Stream users using cursor pagination.

    Cursor-based pagination is better for:
    - Real-time data (data may be added/deleted)
    - Large datasets
    - Consistent ordering

    Response includes `next_cursor` for fetching next page.
    """
    if cursor:
        users = await db.list_users_after(cursor, limit=limit + 1)
    else:
        users = await db.list_users(limit=limit + 1)

    has_next = len(users) > limit
    users = users[:limit]

    next_cursor = users[-1].id if has_next and users else None

    return {
        "data": users,
        "pagination": {
            "next_cursor": next_cursor,
            "has_next": has_next
        }
    }
```

### 5. Error Handling

```python
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

app = FastAPI()

# Custom error response model
class ErrorResponse(BaseModel):
    error: dict
    timestamp: str
    request_id: str

# Global error handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request data",
                "details": [
                    {
                        "field": error["loc"][-1],
                        "message": error["msg"],
                        "type": error["type"]
                    }
                    for error in exc.errors()
                ]
            },
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": request.headers.get("X-Request-ID", "unknown")
        }
    )

# Custom exceptions
class APIException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code

@app.exception_handler(APIException)
async def api_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message
            },
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": request.headers.get("X-Request-ID")
        }
    )

# Usage
@app.post("/api/v1/orders")
async def create_order(order: OrderRequest):
    if order.quantity <= 0:
        raise APIException(
            code="INVALID_QUANTITY",
            message="Quantity must be positive",
            status_code=400
        )

    if order.total > 100000:
        raise APIException(
            code="AMOUNT_EXCEEDS_LIMIT",
            message="Order amount exceeds maximum limit",
            status_code=400
        )

    return await db.create_order(order)
```

## GraphQL Integration

### GraphQL Schema Design

```graphql
# Schema definition
type Query {
  user(id: ID!): User
  users(first: Int, after: String): UserConnection!
  orders(filter: OrderFilter): [Order!]!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
  deleteUser(id: ID!): DeleteUserPayload!
}

type User {
  id: ID!
  name: String!
  email: String!
  isActive: Boolean!
  createdAt: DateTime!
  orders: [Order!]!
}

type Order {
  id: ID!
  user: User!
  items: [OrderItem!]!
  total: Float!
  status: OrderStatus!
  createdAt: DateTime!
}

type OrderItem {
  id: ID!
  product: String!
  quantity: Int!
  price: Float!
}

enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  DELIVERED
  CANCELLED
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
}

type UserEdge {
  cursor: String!
  node: User!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}

# Inputs for mutations
input CreateUserInput {
  name: String!
  email: String!
  password: String!
}

input UpdateUserInput {
  name: String
  email: String
  isActive: Boolean
}

input OrderFilter {
  status: OrderStatus
  createdAfter: DateTime
  createdBefore: DateTime
}

scalar DateTime
```

### GraphQL Implementation (Strawberry Python)

```python
import strawberry
from datetime import datetime
from typing import Optional, List

@strawberry.type
class User:
    id: strawberry.ID
    name: str
    email: str
    is_active: bool
    created_at: datetime

    @strawberry.field
    async def orders(self) -> List['Order']:
        return await db.get_user_orders(self.id)

@strawberry.type
class Order:
    id: strawberry.ID
    user: User
    total: float
    status: str
    created_at: datetime

@strawberry.type
class Query:
    @strawberry.field
    async def user(self, id: strawberry.ID) -> Optional[User]:
        """Get user by ID."""
        return await db.get_user(id)

    @strawberry.field
    async def users(
        self,
        first: int = 20,
        after: Optional[str] = None
    ) -> List[User]:
        """Get users with cursor pagination."""
        return await db.list_users(limit=first, cursor=after)

@strawberry.type
class CreateUserPayload:
    user: User
    success: bool

@strawberry.type
class Mutation:
    @strawberry.mutation
    async def create_user(
        self,
        name: str,
        email: str,
        password: str
    ) -> CreateUserPayload:
        """Create new user."""
        user = await db.create_user(name, email, password)
        return CreateUserPayload(user=user, success=True)

schema = strawberry.Schema(query=Query, mutation=Mutation)

# Mount on FastAPI
from strawberry.fastapi import GraphQLRouter
graphql_app = GraphQLRouter(schema)
app.include_router(graphql_app, prefix="/graphql")
```

## WebSocket Patterns

### Connection Management

```python
from fastapi import WebSocket
from typing import Set

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, Set[WebSocket]] = {}

    async def connect(self, symbol: str, websocket: WebSocket):
        await websocket.accept()
        if symbol not in self.active_connections:
            self.active_connections[symbol] = set()
        self.active_connections[symbol].add(websocket)

    def disconnect(self, symbol: str, websocket: WebSocket):
        self.active_connections[symbol].discard(websocket)
        if not self.active_connections[symbol]:
            del self.active_connections[symbol]

    async def broadcast(self, symbol: str, message: dict):
        """Send message to all subscribers of symbol."""
        if symbol not in self.active_connections:
            return

        disconnected = set()
        for connection in self.active_connections[symbol]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending to client: {e}")
                disconnected.add(connection)

        for connection in disconnected:
            self.disconnect(symbol, connection)

manager = ConnectionManager()

@app.websocket("/ws/market-data")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for market data streaming."""
    try:
        subscription = await websocket.receive_json()
        symbol = subscription.get("symbol")

        await manager.connect(symbol, websocket)

        # Stream data as it arrives
        async for data in stream_market_data(symbol):
            await websocket.send_json({
                "type": "price_update",
                "symbol": symbol,
                "data": data
            })

    except WebSocketDisconnect:
        manager.disconnect(symbol, websocket)
        logger.info(f"Client disconnected from {symbol}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=1011, reason=str(e))
```

## Authentication Patterns

### JWT (JSON Web Tokens)

```python
from datetime import datetime, timedelta
import jwt
from fastapi.security import HTTPBearer, HTTPAuthenticationCredentials
from fastapi import Depends, HTTPException

SECRET_KEY = "your-secret-key-min-32-chars"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

security = HTTPBearer()

def create_access_token(user_id: int) -> str:
    expires = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": str(user_id),
        "exp": expires,
        "type": "access"
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(user_id: int) -> str:
    expires = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": str(user_id),
        "exp": expires,
        "type": "refresh"
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(
    credentials: HTTPAuthenticationCredentials = Depends(security)
) -> int:
    """Extract and validate JWT token."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        user_id = int(payload.get("sub"))
        token_type = payload.get("type")

        if token_type != "access":
            raise HTTPException(
                status_code=401,
                detail="Invalid token type"
            )

        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

@app.post("/api/auth/login")
async def login(email: str, password: str):
    """Login and receive tokens."""
    user = await authenticate_user(email, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "access_token": create_access_token(user.id),
        "refresh_token": create_refresh_token(user.id),
        "token_type": "bearer"
    }

@app.post("/api/auth/refresh")
async def refresh_token(
    credentials: HTTPAuthenticationCredentials = Depends(security)
):
    """Exchange refresh token for new access token."""
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")

        user_id = int(payload.get("sub"))
        return {"access_token": create_access_token(user_id)}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@app.get("/api/users/me")
async def get_current_user_info(user_id: int = Depends(get_current_user)):
    """Get current authenticated user."""
    return await db.get_user(user_id)
```

### OAuth2 Integration

```python
from authlib.integrations.starlette_client import OAuth

oauth = OAuth()

oauth.register(
    name='github',
    client_id='your-github-client-id',
    client_secret='your-github-client-secret',
    server_metadata_url='https://github.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

@app.get("/api/auth/github")
async def login_with_github(request: Request):
    """Redirect to GitHub for OAuth."""
    redirect_uri = request.url_for('oauth_callback')
    return await oauth.github.authorize_redirect(request, redirect_uri)

@app.get("/api/auth/callback")
async def oauth_callback(request: Request):
    """Handle OAuth callback from GitHub."""
    token = await oauth.github.authorize_access_token(request)
    user_info = token.get('userinfo')

    # Create or update user
    user = await db.find_or_create_user(
        email=user_info['email'],
        name=user_info['name']
    )

    return {
        "access_token": create_access_token(user.id),
        "user": {"id": user.id, "email": user.email}
    }
```

### API Key Authentication

```python
from fastapi.security import APIKeySecurity

api_key_security = APIKeySecurity(name="X-API-Key")

async def verify_api_key(key: str = Depends(api_key_security)) -> str:
    """Verify API key is valid."""
    api_key = await db.get_api_key(key)
    if not api_key or not api_key.is_active:
        raise HTTPException(
            status_code=401,
            detail="Invalid or inactive API key"
        )
    return api_key.user_id

@app.get("/api/v1/data")
async def get_data(user_id: str = Depends(verify_api_key)):
    """Endpoint protected by API key."""
    return await db.get_user_data(user_id)
```

## Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests",
                "retry_after": int(exc.detail.split("called ")[1].split(" times in")[0])
            }
        }
    )

# Rate limit: 100 requests per minute per IP
@app.get("/api/v1/users")
@limiter.limit("100/minute")
async def list_users(request: Request):
    return await db.list_users()

# Higher limit for authenticated users
@app.get("/api/v1/market-data")
@limiter.limit("1000/minute")
async def get_market_data(
    request: Request,
    user_id: int = Depends(get_current_user)
):
    return await market_service.get_data()

# Burst protection
@app.post("/api/v1/orders")
@limiter.limit("10/minute")
async def create_order(request: Request, order: OrderRequest):
    """Create order with strict rate limit."""
    return await order_service.create(order)
```

## Request/Response Validation

```python
from pydantic import BaseModel, Field, validator, field_validator
from typing import Optional

class OrderRequest(BaseModel):
    symbol: str = Field(..., description="Trading pair (e.g., BTCUSDT)")
    quantity: float = Field(..., gt=0, description="Order quantity")
    price: float = Field(..., gt=0, description="Order price")
    side: str = Field(..., regex="^(BUY|SELL)$")
    order_type: str = Field(default="LIMIT", regex="^(LIMIT|MARKET)$")

    @field_validator("symbol")
    @classmethod
    def validate_symbol(cls, v):
        if not v:
            raise ValueError("Symbol cannot be empty")
        if not v.endswith("USDT"):
            raise ValueError("Only USDT pairs supported")
        return v.upper()

    @field_validator("price")
    @classmethod
    def validate_price_precision(cls, v):
        # Max 8 decimal places
        if len(str(v).split(".")[-1]) > 8:
            raise ValueError("Price precision exceeds 8 decimals")
        return v

class OrderResponse(BaseModel):
    order_id: str
    symbol: str
    quantity: float
    price: float
    side: str
    status: str
    created_at: datetime
    total_value: float

@app.post("/api/v1/orders", response_model=OrderResponse)
async def create_order(
    request: Request,
    order: OrderRequest,
    user_id: int = Depends(get_current_user)
):
    """
    Create trading order with validation.

    Request validation:
    - Symbol must be uppercase USDT pair
    - Quantity must be positive
    - Price must be positive with max 8 decimals
    - Side must be BUY or SELL
    """
    result = await order_service.create(user_id, order)
    return result
```

## API Testing Strategies

### Integration Test with httpx

```python
import httpx
import pytest

@pytest.fixture
async def client():
    async with httpx.AsyncClient(
        app=app,
        base_url="http://test",
        headers={"X-API-Key": "test-key"}
    ) as ac:
        yield ac

class TestUserAPI:
    @pytest.mark.asyncio
    async def test_create_user_success(self, client):
        response = await client.post("/api/v1/users", json={
            "name": "John",
            "email": "john@example.com"
        })

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "John"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_user_duplicate_email(self, client):
        # First user
        await client.post("/api/v1/users", json={
            "name": "John",
            "email": "john@example.com"
        })

        # Duplicate attempt
        response = await client.post("/api/v1/users", json={
            "name": "Jane",
            "email": "john@example.com"
        })

        assert response.status_code == 409
        assert response.json()["error"]["code"] == "DUPLICATE_EMAIL"

    @pytest.mark.asyncio
    async def test_list_users_with_pagination(self, client):
        response = await client.get("/api/v1/users?page=1&limit=10")

        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data
```

---

**Last Updated**: 2026-04-07
**API Design Standards**: REST v1.1, GraphQL v2.0
**Authentication**: JWT + OAuth2 + API Keys
