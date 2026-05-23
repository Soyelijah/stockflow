# Senior Backend — Guia de Referencia Completa

Referencia practica para ingenieros backend senior. Codigo real, patrones probados en produccion, y checklists accionables.

---

## 1. API Design Patterns — REST con OpenAPI 3.1

### Principios fundamentales de REST

```
Recursos: sustantivos plurales, nunca verbos
  BIEN:  GET  /api/orders
  BIEN:  POST /api/orders
  MAL:   POST /api/create-order
  MAL:   GET  /api/getOrders

Verbos HTTP con semantica correcta:
  GET    → Lectura, idempotente, cacheable
  POST   → Crear, NO idempotente
  PUT    → Reemplazar completo, idempotente
  PATCH  → Modificar parcial, idempotente
  DELETE → Eliminar, idempotente

Codigos de estado correctos:
  200 OK           → GET exitoso, PUT/PATCH exitoso
  201 Created      → POST exitoso (incluir Location header)
  204 No Content   → DELETE exitoso, PUT sin respuesta
  400 Bad Request  → Validacion fallida, malformed JSON
  401 Unauthorized → Token ausente o invalido
  403 Forbidden    → Autenticado pero sin permiso
  404 Not Found    → Recurso no existe
  409 Conflict     → Conflicto de estado (ej: orden ya existe)
  422 Unprocessable → Semanticamente invalido (Pydantic validation)
  429 Too Many Req → Rate limit superado (con Retry-After header)
  500 Internal     → Error no esperado (nunca exponer detalles)
```

### FastAPI — Implementacion completa production-ready

```python
# backend/src/main.py — Aplicacion FastAPI completa

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import structlog
import uvicorn

logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: startup → yield → shutdown"""
    # === STARTUP ===
    logger.info("Starting up Trading Bot API")

    # Inicializar pool de DB
    from src.database import engine
    await engine.begin()  # Verifica conexion

    # Inicializar Redis
    from src.cache import redis_client
    await redis_client.ping()

    # Inicializar Binance client
    from src.services.binance_client import binance_client
    await binance_client.initialize()

    logger.info("All services initialized successfully")
    yield

    # === SHUTDOWN ===
    logger.info("Shutting down gracefully")
    await binance_client.close()
    await redis_client.close()
    await engine.dispose()
    logger.info("Shutdown complete")

app = FastAPI(
    title="Trading Bot API",
    description="Institutional-grade cryptocurrency trading API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/docs/openapi.json",
    redoc_url="/api/docs/redoc",
)

# === MIDDLEWARE (orden importa: se aplica de afuera hacia adentro) ===

# CORS — debe ser el primero
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,  # Nunca ["*"] en produccion con credentials
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-Rate-Limit-Remaining"],
)

# Request ID — correlation para trazabilidad
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    # Inyectar en contexto de structlog para todos los logs del request
    structlog.contextvars.bind_contextvars(request_id=request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    structlog.contextvars.clear_contextvars()
    return response

# Logging de requests
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round(duration_ms, 2),
    )
    return response

# === ERROR HANDLERS ===

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Formatea errores de validacion de Pydantic de forma consistente"""
    errors = []
    for error in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in error["loc"][1:]),
            "message": error["msg"],
            "type": error["type"],
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "validation_error",
            "message": "Request validation failed",
            "details": errors,
        }
    )

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    """Handler para errores de dominio conocidos"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.error_code,
            "message": exc.message,
        }
    )

@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    """Handler de ultimo recurso — nunca exponer detalles en prod"""
    logger.exception("unhandled_error", error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": "An unexpected error occurred"}
    )

# === ROUTES ===
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(orders_router, prefix="/api/orders", tags=["Orders"])
app.include_router(portfolio_router, prefix="/api/portfolio", tags=["Portfolio"])
```

### Errores de dominio estructurados

```python
# src/exceptions.py

from fastapi import status

class AppError(Exception):
    """Base para todos los errores de dominio"""
    def __init__(self, error_code: str, message: str, status_code: int = 400):
        self.error_code = error_code
        self.message = message
        self.status_code = status_code
        super().__init__(message)

class ResourceNotFoundError(AppError):
    def __init__(self, resource: str, id: str):
        super().__init__(
            error_code="resource_not_found",
            message=f"{resource} with id '{id}' not found",
            status_code=status.HTTP_404_NOT_FOUND
        )

class RiskViolationError(AppError):
    def __init__(self, rule: str, details: str):
        super().__init__(
            error_code="risk_violation",
            message=f"Risk rule violated: {rule}. {details}",
            status_code=status.HTTP_409_CONFLICT
        )

class RateLimitError(AppError):
    def __init__(self, retry_after: int):
        super().__init__(
            error_code="rate_limit_exceeded",
            message=f"Rate limit exceeded. Retry after {retry_after} seconds",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
        )
```

### Pagination — Cursor-based (recomendado para produccion)

```python
# src/schemas/pagination.py
import base64
from datetime import datetime
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class CursorPage(BaseModel, Generic[T]):
    data: list[T]
    next_cursor: str | None
    has_more: bool
    # NO incluir total_count por defecto — COUNT(*) es caro en tablas grandes

def encode_cursor(dt: datetime) -> str:
    """Cursor opaco basado en timestamp"""
    return base64.urlsafe_b64encode(dt.isoformat().encode()).decode()

def decode_cursor(cursor: str) -> datetime:
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode()).decode()
        return datetime.fromisoformat(decoded)
    except Exception:
        raise AppError("invalid_cursor", "Invalid pagination cursor", 400)

# Uso en repository
class OrderRepository:
    async def list_for_user(
        self,
        user_id: UUID,
        limit: int = 20,
        cursor: str | None = None,
        symbol: str | None = None,
    ) -> CursorPage[Order]:
        cursor_dt = decode_cursor(cursor) if cursor else None

        query = (
            select(Order)
            .where(Order.user_id == user_id)
            .where(Order.created_at < cursor_dt if cursor_dt else True)
            .where(Order.symbol == symbol if symbol else True)
            .order_by(Order.created_at.desc())
            .limit(limit + 1)  # Pedimos 1 extra para detectar si hay mas
        )
        result = await self.db.execute(query)
        orders = result.scalars().all()

        has_more = len(orders) > limit
        items = orders[:limit]
        next_cursor = encode_cursor(items[-1].created_at) if has_more else None

        return CursorPage(data=items, next_cursor=next_cursor, has_more=has_more)
```

---

## 2. Authentication — JWT con Refresh Tokens

### Implementacion completa de JWT con refresh token rotation

```python
# src/services/auth_service.py

import secrets
from datetime import datetime, timedelta
from typing import Tuple
from uuid import UUID, uuid4
import jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthService:
    ACCESS_TOKEN_EXPIRE = timedelta(minutes=15)   # Corto: 15 min
    REFRESH_TOKEN_EXPIRE = timedelta(days=30)

    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.secret = settings.JWT_SECRET
        self.algorithm = "HS256"

    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, plain: str, hashed: str) -> bool:
        return pwd_context.verify(plain, hashed)

    def create_access_token(self, user_id: UUID, email: str, role: str) -> str:
        jti = str(uuid4())  # JWT ID — para blacklisting si es necesario
        payload = {
            "sub": str(user_id),
            "email": email,
            "role": role,
            "jti": jti,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + self.ACCESS_TOKEN_EXPIRE,
            "type": "access",
        }
        return jwt.encode(payload, self.secret, algorithm=self.algorithm)

    def create_refresh_token(self) -> Tuple[str, str]:
        """Retorna (token_string, token_hash_para_db)"""
        token = secrets.token_urlsafe(64)  # 512 bits de entropia
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        return token, token_hash

    async def login(self, email: str, password: str) -> dict:
        user = await self._get_user_by_email(email)
        if not user or not self.verify_password(password, user.password_hash):
            # Mismo error para email y password — evitar user enumeration
            raise AppError("invalid_credentials", "Invalid email or password", 401)

        if not user.is_active:
            raise AppError("account_disabled", "Account is disabled", 403)

        # Crear tokens
        access_token = self.create_access_token(user.id, user.email, user.role)
        refresh_token_str, refresh_token_hash = self.create_refresh_token()

        # Guardar refresh token en DB (invalida los anteriores de la "familia")
        await self._save_refresh_token(
            user_id=user.id,
            token_hash=refresh_token_hash,
            family=str(uuid4()),  # Nueva familia para cada login
            expires_at=datetime.utcnow() + self.REFRESH_TOKEN_EXPIRE
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token_str,
            "token_type": "bearer",
            "expires_in": int(self.ACCESS_TOKEN_EXPIRE.total_seconds()),
        }

    async def refresh(self, refresh_token_str: str) -> dict:
        """Refresh token rotation — invalida el usado y emite uno nuevo"""
        token_hash = hashlib.sha256(refresh_token_str.encode()).hexdigest()

        db_token = await self._get_refresh_token(token_hash)

        if not db_token:
            raise AppError("invalid_token", "Invalid refresh token", 401)

        if db_token.is_revoked:
            # ALERTA DE SEGURIDAD: Token reusado — posible robo
            # Invalidar TODA la familia de tokens
            await self._revoke_family(db_token.family)
            raise AppError("token_reuse_detected", "Security violation detected", 401)

        if db_token.expires_at < datetime.utcnow():
            raise AppError("token_expired", "Refresh token expired", 401)

        # Marcar como usado (revocar)
        await self._revoke_token(db_token.id)

        # Emitir nuevos tokens
        user = await self._get_user_by_id(db_token.user_id)
        access_token = self.create_access_token(user.id, user.email, user.role)
        new_refresh_str, new_refresh_hash = self.create_refresh_token()

        # Guardar nuevo refresh token en la MISMA familia
        await self._save_refresh_token(
            user_id=user.id,
            token_hash=new_refresh_hash,
            family=db_token.family,
            expires_at=datetime.utcnow() + self.REFRESH_TOKEN_EXPIRE
        )

        return {
            "access_token": access_token,
            "refresh_token": new_refresh_str,
            "token_type": "bearer",
            "expires_in": int(self.ACCESS_TOKEN_EXPIRE.total_seconds()),
        }

    async def logout(self, refresh_token_str: str):
        """Revocar el refresh token actual"""
        token_hash = hashlib.sha256(refresh_token_str.encode()).hexdigest()
        await self._revoke_token_by_hash(token_hash)

    def verify_access_token(self, token: str) -> dict:
        try:
            payload = jwt.decode(token, self.secret, algorithms=[self.algorithm])
            if payload.get("type") != "access":
                raise AppError("invalid_token", "Invalid token type", 401)
            return payload
        except jwt.ExpiredSignatureError:
            raise AppError("token_expired", "Access token expired", 401)
        except jwt.InvalidTokenError:
            raise AppError("invalid_token", "Invalid token", 401)
```

### Auth Middleware para FastAPI

```python
# src/middleware/auth.py

from fastapi import Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware

EXCLUDED_PATHS = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
    "/api/v1/health",
    "/api/docs",
    "/api/docs/openapi.json",
}

class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, auth_service: AuthService):
        super().__init__(app)
        self.auth_service = auth_service

    async def dispatch(self, request: Request, call_next):
        # Skip auth para paths excluidos y WebSockets
        if request.url.path in EXCLUDED_PATHS or request.url.path.startswith("/ws"):
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"error": "missing_token", "message": "Authorization token required"}
            )

        token = auth_header.split(" ")[1]
        try:
            payload = self.auth_service.verify_access_token(token)
            # Inyectar user info en el estado del request
            request.state.user_id = UUID(payload["sub"])
            request.state.user_role = payload["role"]
            request.state.user_email = payload["email"]
        except AppError as e:
            return JSONResponse(status_code=e.status_code, content={"error": e.error_code, "message": e.message})

        return await call_next(request)

# Dependency para endpoints que necesitan el usuario
def get_current_user(request: Request) -> CurrentUser:
    if not hasattr(request.state, "user_id"):
        raise AppError("unauthorized", "Authentication required", 401)
    return CurrentUser(
        id=request.state.user_id,
        role=request.state.user_role,
        email=request.state.user_email
    )

def require_role(required_role: str):
    def check_role(user: CurrentUser = Depends(get_current_user)):
        if user.role != required_role and user.role != "admin":
            raise AppError("forbidden", "Insufficient permissions", 403)
        return user
    return check_role
```

---

## 3. Database Patterns — Repository + Unit of Work

### Repository Pattern con SQLAlchemy async

```python
# src/repositories/base.py

from typing import Generic, TypeVar, Type
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

ModelT = TypeVar("ModelT")

class BaseRepository(Generic[ModelT]):
    def __init__(self, db: AsyncSession, model: Type[ModelT]):
        self.db = db
        self.model = model

    async def get_by_id(self, id: UUID) -> ModelT | None:
        result = await self.db.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_id_or_raise(self, id: UUID) -> ModelT:
        obj = await self.get_by_id(id)
        if not obj:
            raise ResourceNotFoundError(self.model.__name__, str(id))
        return obj

    async def save(self, obj: ModelT) -> ModelT:
        self.db.add(obj)
        await self.db.flush()  # flush, no commit — el commit lo hace el UoW
        await self.db.refresh(obj)
        return obj

    async def delete(self, id: UUID) -> bool:
        result = await self.db.execute(
            delete(self.model).where(self.model.id == id)
        )
        return result.rowcount > 0

# src/repositories/order_repository.py
class OrderRepository(BaseRepository[Order]):
    def __init__(self, db: AsyncSession):
        super().__init__(db, Order)

    async def list_for_user(
        self,
        user_id: UUID,
        limit: int = 20,
        cursor: datetime | None = None,
        filters: dict | None = None
    ) -> tuple[list[Order], str | None]:
        query = (
            select(Order)
            .where(Order.user_id == user_id)
            .order_by(Order.created_at.desc())
        )

        if cursor:
            query = query.where(Order.created_at < cursor)

        if filters:
            if symbol := filters.get("symbol"):
                query = query.where(Order.symbol == symbol)
            if status := filters.get("status"):
                query = query.where(Order.status == status)

        query = query.limit(limit + 1)
        result = await self.db.execute(query)
        orders = list(result.scalars())

        has_more = len(orders) > limit
        items = orders[:limit]
        next_cursor = encode_cursor(items[-1].created_at) if has_more and items else None

        return items, next_cursor

    async def count_pending_for_user(self, user_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count(Order.id))
            .where(Order.user_id == user_id)
            .where(Order.status == "PENDING")
        )
        return result.scalar_one()
```

### Optimistic Locking — Evitar race conditions

```python
# Modelo con version para optimistic locking
class Position(Base):
    __tablename__ = "positions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    symbol: Mapped[str] = mapped_column(nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    version: Mapped[int] = mapped_column(default=1, nullable=False)  # Version counter

    __table_args__ = (
        Index("ix_positions_user_symbol", "user_id", "symbol", unique=True),
    )

class PositionRepository(BaseRepository[Position]):
    async def update_with_optimistic_lock(
        self,
        position_id: UUID,
        updates: dict,
        expected_version: int
    ) -> Position:
        result = await self.db.execute(
            update(Position)
            .where(Position.id == position_id)
            .where(Position.version == expected_version)  # Solo actualiza si version coincide
            .values(**updates, version=expected_version + 1)
            .returning(Position)
        )
        updated = result.scalar_one_or_none()
        if not updated:
            raise AppError(
                "optimistic_lock_conflict",
                "Position was modified by another process. Please retry.",
                409
            )
        return updated
```

---

## 4. Async Patterns — Queues y Background Jobs

### Redis Streams para message queue

```python
# src/queue/publisher.py

import json
from uuid import uuid4
from datetime import datetime
import redis.asyncio as redis

class EventPublisher:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def publish(self, stream: str, event_type: str, payload: dict) -> str:
        """Publica un evento en un Redis Stream"""
        message = {
            "event_id": str(uuid4()),
            "event_type": event_type,
            "occurred_at": datetime.utcnow().isoformat(),
            "payload": json.dumps(payload),
        }
        # XADD retorna el message ID del stream
        message_id = await self.redis.xadd(stream, message, maxlen=10000)
        return message_id

# src/queue/consumer.py

class EventConsumer:
    def __init__(self, redis_client: redis.Redis, consumer_group: str, consumer_name: str):
        self.redis = redis_client
        self.group = consumer_group
        self.name = consumer_name

    async def create_group(self, stream: str):
        try:
            await self.redis.xgroup_create(stream, self.group, id="$", mkstream=True)
        except redis.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                raise

    async def consume(self, stream: str, batch_size: int = 10):
        """Lee y procesa mensajes del stream"""
        while True:
            try:
                # XREADGROUP: leer mensajes no procesados por este consumer
                messages = await self.redis.xreadgroup(
                    groupname=self.group,
                    consumername=self.name,
                    streams={stream: ">"},  # ">" = solo mensajes nuevos
                    count=batch_size,
                    block=5000,  # Block 5 segundos si no hay mensajes
                )

                if not messages:
                    continue

                for stream_name, batch in messages:
                    for message_id, data in batch:
                        try:
                            await self.process_message(data)
                            # ACK despues de procesamiento exitoso
                            await self.redis.xack(stream, self.group, message_id)
                        except Exception as e:
                            logger.error("message_processing_failed",
                                       message_id=message_id, error=str(e))
                            # El mensaje queda en el PEL (pending entries list)
                            # Un proceso de recovery lo reintentara

            except Exception as e:
                logger.error("consumer_error", error=str(e))
                await asyncio.sleep(5)

    async def process_message(self, data: dict):
        event_type = data[b"event_type"].decode()
        payload = json.loads(data[b"payload"].decode())

        handlers = {
            "order_filled": self.handle_order_filled,
            "position_opened": self.handle_position_opened,
        }

        handler = handlers.get(event_type)
        if handler:
            await handler(payload)
        else:
            logger.warning("unknown_event_type", event_type=event_type)

    async def handle_order_filled(self, payload: dict):
        # Actualizar portfolio, notificar usuario, etc.
        pass
```

### Celery con Redis para background jobs

```python
# src/worker/celery_app.py

from celery import Celery
from celery.utils.log import get_task_logger

celery_app = Celery(
    "trading_bot",
    broker="redis://localhost:6379/1",
    backend="redis://localhost:6379/2",
    include=["src.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Retry settings
    task_acks_late=True,           # ACK despues de ejecutar (no al recibir)
    task_reject_on_worker_lost=True,  # Requeue si el worker muere
    # Timeouts
    task_soft_time_limit=55,       # SoftTimeLimitExceeded a los 55s
    task_time_limit=60,            # Hard kill a los 60s
    # Rate limits
    task_annotations={
        "src.worker.tasks.sync_market_data": {"rate_limit": "10/m"}
    },
    # Retry backoff exponencial por defecto
    task_default_retry_delay=60,
    task_max_retries=3,
)

# src/worker/tasks.py
logger = get_task_logger(__name__)

@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,           # Exponential backoff
    retry_backoff_max=300,        # Max 5 minutos entre reintentos
    retry_jitter=True,            # Evitar thundering herd
)
def sync_portfolio_state(self, user_id: str):
    """Sincroniza el estado del portfolio con el exchange"""
    try:
        with get_db_sync() as db:
            portfolio_service = PortfolioService(db)
            portfolio_service.sync_from_exchange(UUID(user_id))
    except BinanceAPIError as exc:
        logger.error("binance_sync_failed", user_id=user_id, error=str(exc))
        raise self.retry(exc=exc)
    except Exception as exc:
        logger.exception("unexpected_error", user_id=user_id)
        raise

# Scheduled tasks con celery beat
celery_app.conf.beat_schedule = {
    "sync-all-portfolios-every-5min": {
        "task": "src.worker.tasks.sync_all_portfolios",
        "schedule": 300.0,  # cada 5 minutos
    },
    "cleanup-expired-tokens-daily": {
        "task": "src.worker.tasks.cleanup_expired_tokens",
        "schedule": crontab(hour=3, minute=0),  # 3am UTC
    },
}
```

---

## 5. Caching Strategies

### Cache-aside (Lazy Loading) — el patron mas comun

```python
# src/cache/strategies.py

import hashlib
import json
from functools import wraps
from typing import Callable
import redis.asyncio as redis

class CacheService:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.default_ttl = 300  # 5 minutos

    async def get(self, key: str) -> dict | None:
        data = await self.redis.get(key)
        return json.loads(data) if data else None

    async def set(self, key: str, value: dict, ttl: int | None = None) -> None:
        await self.redis.setex(
            key,
            ttl or self.default_ttl,
            json.dumps(value, default=str)
        )

    async def invalidate(self, pattern: str) -> int:
        """Invalida todas las keys que coincidan con el pattern"""
        keys = await self.redis.keys(pattern)
        if keys:
            return await self.redis.delete(*keys)
        return 0

    async def get_or_set(
        self,
        key: str,
        fetch_fn: Callable,
        ttl: int | None = None
    ):
        """Cache-aside: busca en cache, si no existe llama fetch_fn"""
        cached = await self.get(key)
        if cached is not None:
            return cached

        # Cache miss — obtener dato real
        value = await fetch_fn()
        if value is not None:
            await self.set(key, value, ttl)
        return value

# Uso en service
class MarketService:
    def __init__(self, cache: CacheService, binance: BinanceClient):
        self.cache = cache
        self.binance = binance

    async def get_ticker(self, symbol: str) -> dict:
        key = f"ticker:{symbol}"
        return await self.cache.get_or_set(
            key=key,
            fetch_fn=lambda: self.binance.get_ticker(symbol),
            ttl=5  # 5 segundos — dato muy volatile
        )

    async def get_user_portfolio(self, user_id: UUID) -> dict:
        key = f"portfolio:{user_id}"
        return await self.cache.get_or_set(
            key=key,
            fetch_fn=lambda: self._fetch_portfolio_from_db(user_id),
            ttl=60  # 1 minuto — se invalida al hacer trades
        )

    async def invalidate_user_portfolio(self, user_id: UUID):
        """Llamar despues de cada trade"""
        await self.cache.invalidate(f"portfolio:{user_id}")
```

### Cache keys con namespacing y versioning

```python
class CacheKeys:
    """Centralizar la definicion de cache keys evita colisiones y facilita invalidacion"""
    VERSION = "v1"

    @staticmethod
    def ticker(symbol: str) -> str:
        return f"{CacheKeys.VERSION}:ticker:{symbol}"

    @staticmethod
    def user_portfolio(user_id: UUID) -> str:
        return f"{CacheKeys.VERSION}:portfolio:{user_id}"

    @staticmethod
    def user_orders(user_id: UUID, page: int = 1) -> str:
        return f"{CacheKeys.VERSION}:orders:{user_id}:page:{page}"

    @staticmethod
    def rate_limit(key: str) -> str:
        return f"{CacheKeys.VERSION}:ratelimit:{key}"
```

---

## 6. Rate Limiting — Token Bucket con Redis

```python
# src/middleware/rate_limiter.py

import time
from starlette.middleware.base import BaseHTTPMiddleware

class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Implementa rate limiting por IP y por usuario autenticado.
    Usa Token Bucket via script Lua en Redis (atomico).
    """

    RATE_LIMITS = {
        # (tokens_por_segundo, capacidad_maxima, burst_permitido)
        "default": (10, 60, 30),          # 10 req/s, burst de 30
        "api/auth": (2, 10, 5),           # Auth endpoints: 2 req/s
        "api/orders": (5, 30, 10),        # Trading: 5 req/s
        "api/market": (50, 300, 100),     # Market data: mas liberal
    }

    TOKEN_BUCKET_LUA = """
    local key = KEYS[1]
    local rate = tonumber(ARGV[1])
    local capacity = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local cost = tonumber(ARGV[4])  -- Cuantos tokens cuesta esta request

    local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
    local tokens = tonumber(bucket[1])
    local last_refill = tonumber(bucket[2])

    if not tokens then
        tokens = capacity
        last_refill = now
    end

    -- Refill tokens basado en tiempo transcurrido
    local elapsed = now - last_refill
    tokens = math.min(capacity, tokens + elapsed * rate)

    local allowed = tokens >= cost
    if allowed then
        tokens = tokens - cost
    end

    -- Guardar estado con TTL automatico
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / rate) + 10)

    -- Retornar: allowed, tokens_remaining, reset_time
    local reset_time = math.ceil((capacity - tokens) / rate)
    return {allowed and 1 or 0, math.floor(tokens), reset_time}
    """

    def __init__(self, app, redis_client):
        super().__init__(app)
        self.redis = redis_client

    async def dispatch(self, request: Request, call_next):
        # Determinar el limite aplicable
        path = request.url.path
        rate, capacity, _ = self.RATE_LIMITS.get("default", (10, 60, 30))

        for prefix, limits in self.RATE_LIMITS.items():
            if prefix != "default" and path.startswith(f"/{prefix}"):
                rate, capacity, _ = limits
                break

        # Key: usuario autenticado > IP
        user_id = getattr(request.state, "user_id", None)
        ip = request.client.host
        bucket_key = f"ratelimit:{user_id or ip}:{path.split('/')[2]}"

        result = await self.redis.eval(
            self.TOKEN_BUCKET_LUA,
            1, bucket_key,
            rate, capacity,
            time.time(),
            1  # Costo de esta request: 1 token
        )

        allowed, tokens_remaining, reset_time = result

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"error": "rate_limit_exceeded", "message": f"Retry after {reset_time}s"},
                headers={
                    "X-RateLimit-Limit": str(capacity),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + reset_time),
                    "Retry-After": str(reset_time),
                }
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(capacity)
        response.headers["X-RateLimit-Remaining"] = str(tokens_remaining)
        return response
```

---

## 7. Testing Pyramid — pytest completo

### Unit Tests — logica de negocio aislada

```python
# tests/unit/test_risk_service.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from decimal import Decimal
from uuid import uuid4

from src.services.risk_service import RiskService
from src.exceptions import RiskViolationError

@pytest.fixture
def mock_portfolio_repo():
    return AsyncMock()

@pytest.fixture
def risk_service(mock_portfolio_repo):
    return RiskService(portfolio_repo=mock_portfolio_repo)

class TestRiskService:
    async def test_blocks_position_exceeding_10_percent(self, risk_service, mock_portfolio_repo):
        """Position > 10% del portfolio debe ser rechazada"""
        user_id = uuid4()
        mock_portfolio_repo.get_total_value.return_value = Decimal("10000.00")
        mock_portfolio_repo.get_position_value.return_value = Decimal("0.00")

        with pytest.raises(RiskViolationError) as exc_info:
            await risk_service.validate_position_size(
                user_id=user_id,
                symbol="BTCUSDT",
                order_value=Decimal("1500.00"),  # 15% del portfolio
            )

        assert exc_info.value.error_code == "risk_violation"
        assert "max_position_size" in str(exc_info.value.message).lower()

    async def test_allows_position_at_exactly_10_percent(self, risk_service, mock_portfolio_repo):
        """Position == 10% debe ser permitida (limite inclusivo)"""
        user_id = uuid4()
        mock_portfolio_repo.get_total_value.return_value = Decimal("10000.00")
        mock_portfolio_repo.get_position_value.return_value = Decimal("0.00")

        # No debe lanzar excepcion
        await risk_service.validate_position_size(
            user_id=user_id,
            symbol="BTCUSDT",
            order_value=Decimal("1000.00"),  # Exactamente 10%
        )

    async def test_considers_existing_position_in_check(self, risk_service, mock_portfolio_repo):
        """Si ya hay una posicion abierta, debe sumarse al calculo"""
        user_id = uuid4()
        mock_portfolio_repo.get_total_value.return_value = Decimal("10000.00")
        mock_portfolio_repo.get_position_value.return_value = Decimal("800.00")  # Posicion actual: 8%

        with pytest.raises(RiskViolationError):
            # 8% existente + 5% nueva = 13% > 10% limite
            await risk_service.validate_position_size(
                user_id=user_id,
                symbol="BTCUSDT",
                order_value=Decimal("500.00"),  # 5%
            )
```

### Integration Tests — con DB real en transaccion

```python
# tests/integration/test_order_repository.py
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, AsyncSessionMaker
from src.repositories.order_repository import OrderRepository

# conftest.py
@pytest.fixture(scope="session")
def engine():
    return create_async_engine(
        "postgresql+asyncpg://test:test@localhost:5432/trading_test",
        echo=False
    )

@pytest.fixture
async def db(engine):
    """Cada test usa su propia transaccion que se revierte al final"""
    async with engine.begin() as conn:
        # Crear schema
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSession(engine) as session:
        async with session.begin():
            yield session
            await session.rollback()  # Siempre rollback — test isolation

@pytest.fixture
def order_repo(db):
    return OrderRepository(db)

class TestOrderRepository:
    async def test_list_returns_orders_for_correct_user(self, order_repo, db):
        user_id = uuid4()
        other_user_id = uuid4()

        # Crear ordenes para el usuario objetivo
        for i in range(3):
            db.add(Order(user_id=user_id, symbol="BTCUSDT", side="BUY", quantity=0.1, status="FILLED"))

        # Crear orden para otro usuario
        db.add(Order(user_id=other_user_id, symbol="ETHUSDT", side="BUY", quantity=1.0, status="FILLED"))
        await db.flush()

        orders, cursor = await order_repo.list_for_user(user_id=user_id, limit=10)

        assert len(orders) == 3
        assert all(o.user_id == user_id for o in orders)

    async def test_pagination_cursor_works_correctly(self, order_repo, db):
        user_id = uuid4()
        # Crear 5 ordenes con timestamps distintos
        for i in range(5):
            order = Order(
                user_id=user_id,
                symbol="BTCUSDT",
                side="BUY",
                quantity=0.1,
                status="FILLED",
                created_at=datetime(2024, 1, i + 1)
            )
            db.add(order)
        await db.flush()

        # Primera pagina: 3 items
        page1, cursor1 = await order_repo.list_for_user(user_id=user_id, limit=3)
        assert len(page1) == 3
        assert cursor1 is not None

        # Segunda pagina usando el cursor
        page2, cursor2 = await order_repo.list_for_user(user_id=user_id, limit=3, cursor=cursor1)
        assert len(page2) == 2
        assert cursor2 is None  # No hay mas paginas
```

### Performance Tests — detectar N+1 queries

```python
# tests/performance/test_n_plus_one.py
import pytest
from sqlalchemy import event

class QueryCounter:
    """Context manager que cuenta las queries ejecutadas"""
    def __init__(self, db):
        self.db = db
        self.count = 0

    def __enter__(self):
        event.listen(self.db.sync_session.bind, "before_cursor_execute", self._count)
        return self

    def __exit__(self, *args):
        event.remove(self.db.sync_session.bind, "before_cursor_execute", self._count)

    def _count(self, *args, **kwargs):
        self.count += 1

async def test_get_orders_with_trades_no_n_plus_one(db, order_repo):
    """Verificar que cargar 20 ordenes con trades usa exactamente 2 queries (no 21)"""
    user_id = uuid4()

    # Crear 20 ordenes con trades
    for i in range(20):
        order = Order(user_id=user_id, ...)
        db.add(order)
        trade = Trade(order=order, ...)
        db.add(trade)
    await db.flush()

    with QueryCounter(db) as counter:
        orders = await order_repo.get_orders_with_trades(user_id, limit=20)

    # Debe usar: 1 query para orders + 1 query para todos los trades (JOIN o IN)
    # NO 1 query por trade (N+1)
    assert counter.count <= 2, f"Expected <= 2 queries, got {counter.count} (N+1 detected!)"
```

---

## 8. NestJS — Implementacion Completa

```typescript
// src/orders/orders.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { Order } from './entities/order.entity';
import { RiskModule } from '../risk/risk.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    RiskModule,
    CacheModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService],
})
export class OrdersModule {}

// src/orders/entities/order.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, ManyToOne } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'enum', enum: ['BUY', 'SELL'] })
  side: 'BUY' | 'SELL';

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  quantity: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'FILLED', 'CANCELLED', 'REJECTED'],
    default: 'PENDING',
  })
  status: string;

  @Column({ nullable: true })
  exchangeOrderId: string;

  @CreateDateColumn()
  createdAt: Date;
}

// src/orders/orders.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List orders with cursor pagination' })
  @ApiResponse({ status: 200, description: 'Returns paginated orders' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListOrdersDto) {
    return this.ordersService.listForUser(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Place a new order' })
  @ApiResponse({ status: 201, description: 'Order placed successfully' })
  @ApiResponse({ status: 409, description: 'Risk violation or conflict' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.placeOrder(user.id, dto);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.getOrderForUser(user.id, id);
  }
}

// src/orders/dto/create-order.dto.ts
import { IsString, IsEnum, IsNumber, IsPositive, IsOptional, Max, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: 'BTCUSDT' })
  @IsString()
  @Matches(/^[A-Z]{2,10}USDT$/, { message: 'Symbol must be a valid USDT pair' })
  symbol: string;

  @ApiProperty({ enum: ['BUY', 'SELL'] })
  @IsEnum(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @ApiProperty({ example: 0.001, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  @Max(100)
  quantity: number;

  @ApiProperty({ enum: ['MARKET', 'LIMIT'], default: 'MARKET' })
  @IsEnum(['MARKET', 'LIMIT'])
  @IsOptional()
  orderType: 'MARKET' | 'LIMIT' = 'MARKET';

  @ApiProperty({ required: false })
  @IsNumber({ maxDecimalPlaces: 8 })
  @IsPositive()
  @IsOptional()
  price?: number;
}

// src/orders/orders.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RiskService } from '../risk/risk.service';
import { BinanceService } from '../binance/binance.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepo: OrdersRepository,
    private readonly riskService: RiskService,
    private readonly binance: BinanceService,
    private readonly cache: CacheService,
    private readonly dataSource: DataSource,
  ) {}

  async placeOrder(userId: string, dto: CreateOrderDto): Promise<Order> {
    // Validacion de riesgo antes de la transaccion
    await this.riskService.validateOrder(userId, dto);

    // Usar QueryRunner para transaccion manual
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Enviar al exchange
      const exchangeOrder = await this.binance.placeOrder({
        symbol: dto.symbol,
        side: dto.side,
        type: dto.orderType,
        quantity: dto.quantity,
        price: dto.price,
      });

      // Persistir en DB
      const order = queryRunner.manager.create(Order, {
        userId,
        symbol: dto.symbol,
        side: dto.side,
        quantity: String(dto.quantity),
        status: 'PENDING',
        exchangeOrderId: exchangeOrder.orderId,
      });
      await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();

      // Invalidar cache de portfolio
      await this.cache.invalidate(`portfolio:${userId}`);

      return order;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      // Si ya fue enviado al exchange pero fallo la DB, necesitamos cancelar
      // Esto es un saga — ver senior-architect para el patron completo
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

---

## 9. Connection Pooling y Query Optimization

```python
# src/database.py — configuracion optima del pool

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

engine = create_async_engine(
    settings.DATABASE_URL,
    # Pool sizing: (num_cores * 2) + num_spindles
    # Para 4 cores con SSD: (4 * 2) + 1 = 9 → redondear a 10-20
    pool_size=20,
    max_overflow=40,        # Extra conexiones bajo alta carga
    pool_timeout=30,        # Tiempo max esperando conexion del pool
    pool_recycle=3600,      # Reciclar conexiones cada hora (evitar timeout de DB)
    pool_pre_ping=True,     # Verificar conexion antes de usar (detecta connections muertas)
    echo=settings.DEBUG,    # Log de SQL en desarrollo
    connect_args={
        "statement_timeout": "30000",     # 30s timeout por statement
        "lock_timeout": "10000",           # 10s timeout para locks
        "connect_timeout": 10,
    }
)

AsyncSessionMaker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False  # Importante para async: no expire al hacer commit
)

# Dependency injection
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionMaker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
```

### Query Optimization — Detectar queries lentas

```sql
-- PostgreSQL: queries lentas (>100ms) en los ultimos 5 minutos
SELECT
    query,
    calls,
    mean_exec_time::int as avg_ms,
    max_exec_time::int as max_ms,
    total_exec_time::int / 1000 as total_sec,
    rows
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Indices que no se usan (candidatos para eliminar)
SELECT
    schemaname, tablename, indexname,
    idx_scan as scans,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan < 10
ORDER BY pg_relation_size(indexrelid) DESC;

-- Tablas con muchos sequential scans (candidatos para nuevos indices)
SELECT
    relname as table,
    seq_scan as seq_scans,
    idx_scan as idx_scans,
    n_live_tup as rows
FROM pg_stat_user_tables
WHERE seq_scan > 1000
ORDER BY seq_scan DESC;
```

```python
# src/repositories/base.py — EXPLAIN ANALYZE en desarrollo

import os
from sqlalchemy import text

async def explain_query(db: AsyncSession, query) -> str:
    """Solo en desarrollo — muestra el plan de ejecucion"""
    if os.getenv("ENV") != "development":
        return ""

    compiled = query.compile(dialect=db.bind.dialect)
    explain_sql = f"EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) {compiled}"
    result = await db.execute(text(explain_sql), compiled.params)
    return "\n".join(row[0] for row in result)
```

---

## 10. Backend Code Review Checklist (50+ puntos)

### API Design
- [ ] Los endpoints usan sustantivos plurales, no verbos
- [ ] Los codigos HTTP son semanticamente correctos (201 para creacion, 204 para delete)
- [ ] Los errores de validacion retornan 422 con campo y mensaje especifico
- [ ] Todos los endpoints de lista tienen paginacion (no devuelven arrays sin limite)
- [ ] Los endpoints GET son idempotentes y cacheables
- [ ] Hay versionado en la URL para APIs publicas (/v1/)
- [ ] El OpenAPI/Swagger esta actualizado con ejemplos reales
- [ ] Los campos de respuesta no tienen informacion sensible (passwords, tokens internos)

### Autenticacion y Autorizacion
- [ ] Todos los endpoints protegidos validan el JWT
- [ ] Los tokens de acceso tienen expiry <= 15 minutos
- [ ] Los refresh tokens tienen rotation implementada
- [ ] El middleware excluye correctamente los endpoints publicos
- [ ] Los errores de auth son identicos para email vs password incorrecto (evitar enumeration)
- [ ] Los endpoints de admin verifican el rol explicitamente
- [ ] Los usuarios solo pueden ver/modificar sus propios recursos (IDOR checks)

### Database
- [ ] Las queries usan el ORM o parameterized queries — cero string concatenation
- [ ] Los indices existen para todos los campos usados en WHERE y JOIN frecuentes
- [ ] Se hizo EXPLAIN ANALYZE en queries nuevas con datos > 10k rows
- [ ] Las transacciones estan en el nivel correcto (no en el middleware HTTP)
- [ ] Hay rollback en el except para todas las transacciones manuales
- [ ] Los modelos nuevos tienen migraciones versionadas (no autoincrement sin migration)
- [ ] No hay N+1 queries (verificado con QueryCounter o logs)
- [ ] Las relaciones con muchos registros usan lazy loading o IN queries, no eager load masivo

### Performance
- [ ] Los endpoints criticos tienen rate limiting
- [ ] El cache esta implementado para queries costosas (TTL apropiado)
- [ ] Los background jobs pesados estan en workers separados (Celery/etc.)
- [ ] El connection pool esta configurado apropiadamente para el servidor
- [ ] Los timeouts estan definidos en clientes externos (Binance, HTTP, DB)
- [ ] Las responses grandes usan streaming si el payload > 1MB

### Seguridad
- [ ] Los secrets vienen de variables de entorno, no hardcoded
- [ ] Los logs no contienen passwords, tokens, tarjetas, PIIs
- [ ] Los archivos subidos son validados (extension, content-type, tamano)
- [ ] Los errores de produccion no exponen stack traces
- [ ] Las dependencias nuevas fueron auditadas (pip-audit / npm audit)
- [ ] Los headers de seguridad estan configurados (CORS, HSTS via nginx)
- [ ] Los UUIDs son usados como IDs publicos (no IDs secuenciales que revelan volumen)

### Confiabilidad
- [ ] Los clientes externos tienen retry con exponential backoff
- [ ] Los circuit breakers estan en servicios externos criticos
- [ ] Las operaciones criticas son idempotentes (pueden repetirse sin doble efecto)
- [ ] Hay dead letter queue para jobs fallidos
- [ ] Los health checks cubren DB, Redis, y servicios externos criticos
- [ ] Los errores son logueados con correlation_id y contexto suficiente para debuggear

### Testing
- [ ] Cobertura de la logica de negocio nueva > 80%
- [ ] Los happy paths Y los sad paths estan testeados
- [ ] Los tests de integracion usan rollback (no quedan datos en la DB de test)
- [ ] Los mocks son especificos — no mockear todo (integration > unit donde importa)
- [ ] Los tests son deterministas (sin sleep, sin dependencia de tiempo real)
- [ ] El N+1 esta verificado con QueryCounter o similar

### Observabilidad
- [ ] Los logs son estructurados (JSON) con level, message, y contexto
- [ ] El correlation_id esta en todos los logs del request
- [ ] Las metricas criticas se incrementan en el lugar correcto (counters, histogramas)
- [ ] Los errores inesperados logean el stack trace completo
- [ ] Las queries lentas (>500ms) tienen un log WARNING

### Codigo
- [ ] Las funciones tienen una sola responsabilidad
- [ ] Los nombres de variables y funciones son descriptivos (no `data`, `result`, `tmp`)
- [ ] No hay codigo comentado — se elimina o se documenta el por que
- [ ] Los type hints estan en todas las funciones publicas (Python) o tipado en TS
- [ ] La logica de negocio esta en Services, no en Controllers/Routes
- [ ] No hay imports circulares
- [ ] Las constantes magicas tienen nombres explicativos
