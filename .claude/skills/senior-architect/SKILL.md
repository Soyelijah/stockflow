# Senior Architect — Guia de Referencia Completa

Esta guia es el documento de referencia que un arquitecto senior consulta en produccion. Cubre desde la metodologia de toma de decisiones hasta patrones de codigo concretos.

---

## 1. Architecture Decision Records (ADR)

Un ADR documenta una decision arquitectonica importante: el contexto, las opciones consideradas, la decision tomada, y sus consecuencias. Son inmutables una vez aprobados — si la decision cambia, se crea un nuevo ADR que supersede al anterior.

### Template ADR Completo

```markdown
# ADR-{numero}: {titulo corto y descriptivo}

**Estado:** Propuesto | En revision | Aprobado | Deprecado | Supersedido por ADR-XXX
**Fecha:** YYYY-MM-DD
**Autores:** @nombre1, @nombre2
**Revisores:** @nombre3, @nombre4
**Tags:** database, security, api-design, performance

## Contexto

Describe el problema o necesidad que motiva esta decision. Incluye:
- Estado actual del sistema
- Limitaciones o pain points concretos
- Drivers de negocio relevantes
- Restricciones tecnicas conocidas

Ejemplo: "El sistema actual usa polling cada 30 segundos para notificar a los clientes sobre
cambios de estado en pedidos. Esto genera ~500k requests/hora innecesarios contra la DB
y causa una latencia promedio de 15 segundos en la notificacion. Con el crecimiento esperado
a 100k usuarios activos, esto no es sostenible."

## Opciones Consideradas

### Opcion A: WebSockets con Redis Pub/Sub
- **Descripcion:** Conexiones persistentes WebSocket, Redis como broker entre instancias
- **Pros:** Latencia sub-segundo, soporte nativo en browsers modernos, bidireccional
- **Contras:** Requiere sticky sessions o session storage compartido, mas complejo de escalar
- **Esfuerzo:** 3 semanas (2 devs)
- **Riesgo:** Medio — nuevo patron para el equipo

### Opcion B: Server-Sent Events (SSE)
- **Descripcion:** Stream unidireccional HTTP/2, sin necesidad de WebSocket
- **Pros:** Simple, funciona con proxies HTTP estandar, reconexion automatica
- **Contras:** Solo server->client, HTTP/1.1 tiene limite de 6 conexiones por dominio
- **Esfuerzo:** 1 semana
- **Riesgo:** Bajo

### Opcion C: Polling optimizado con long-polling
- **Descripcion:** HTTP long-polling con timeout de 30s, solo si hay cambios
- **Pros:** Compatible con infraestructura existente, sin cambios en proxies/LB
- **Contras:** Mayor latencia que opciones anteriores, conexiones ocupadas en el servidor
- **Esfuerzo:** 3 dias
- **Riesgo:** Bajo

## Decision

**Elegimos la Opcion B: Server-Sent Events.**

Razon principal: La comunicacion es unidireccional (servidor -> cliente) en el 95% de
los casos. SSE es mas simple que WebSockets para este caso de uso y funciona sin
cambios en la infraestructura existente (Nginx, load balancers). El limite de conexiones
de HTTP/1.1 no aplica porque usamos HTTP/2 en produccion.

## Consecuencias

### Positivas
- Latencia de notificacion: de 15s a <1s
- Eliminacion de 500k requests/hora de polling
- Implementacion en 1 semana vs 3 semanas de WebSockets
- Sin cambios en infraestructura

### Negativas
- Si en el futuro necesitamos comunicacion bidireccional, deberemos migrar o agregar WebSockets
- Los clientes HTTP/1.1 tendran degraded experience (fallback a polling de 5s)

### Riesgos Identificados
- Conexiones SSE abiertas consumen file descriptors en el servidor — configurar ulimit
- Proxies con timeout agresivo pueden cortar conexiones — implementar heartbeat cada 25s

## Referencias
- [SSE spec MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [ADR-0005: Eleccion de HTTP/2 en produccion](./ADR-0005.md)
- Benchmark realizado: `docs/benchmarks/sse-vs-websocket-2024-01.md`
```

### Proceso de ADR en el equipo

```
1. Dev propone ADR → crea ADR-XXX.md en /docs/adr/ con estado "Propuesto"
2. Review asincronico por arquitectos (2-3 dias)
3. Si controversial → Architecture Review Board (ARB) sincrono
4. Decision → estado "Aprobado" o "Rechazado" con razon
5. Implementacion referencia el numero de ADR en el codigo:
   // ADR-0012: Usamos SSE en lugar de WebSockets para notificaciones
```

---

## 2. Modelo C4 — Metodologia de Documentacion

El modelo C4 describe la arquitectura en 4 niveles de abstraccion. Cada nivel tiene una audiencia diferente.

### Nivel 1 — Context Diagram (para todos, incluyendo no-tecnicos)

Muestra el sistema como una caja negra en su entorno. ¿Quienes son los usuarios? ¿Con que sistemas externos interactua?

```
[Usuario Final] --> [Sistema: TradingBot] --> [Binance API]
                                          --> [PostgreSQL Cloud]
                                          --> [SendGrid: Emails]
[Admin] ---------> [Sistema: TradingBot]
```

Preguntas que responde:
- ¿Que hace el sistema?
- ¿Quien lo usa?
- ¿Con que se integra?

### Nivel 2 — Container Diagram (para devs y architects)

Descompone el sistema en "contenedores" — aplicaciones o datastores desplegables.

```
[Browser] --> [Frontend: React SPA / Vite] --> [Backend API: FastAPI / Python]
                                           |
                                           +--> [WebSocket Server: FastAPI WS]
                                           |
[Backend API] --> [PostgreSQL + TimescaleDB]
              --> [Redis: Cache + Pub/Sub]
              --> [Binance API: External]
              --> [Celery Worker: Background Jobs]
```

Ejemplo de documentacion en codigo (PlantUML):

```plantuml
@startuml C4_Container
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml

Person(trader, "Trader", "Usuario que opera el bot")
Person(admin, "Admin", "Configura estrategias y risk")

System_Boundary(bot, "Trading Bot System") {
    Container(spa, "SPA Frontend", "React + TypeScript", "Bloomberg-style UI")
    Container(api, "Backend API", "FastAPI + Python", "Business logic, REST endpoints")
    Container(ws, "WebSocket Server", "FastAPI WS", "Real-time market data streaming")
    Container(worker, "Background Worker", "Celery + Redis", "Strategy execution, order management")
    ContainerDb(db, "Primary Database", "PostgreSQL + TimescaleDB", "Trades, OHLCV, users")
    ContainerDb(cache, "Cache + Queue", "Redis", "Sessions, rate limiting, task queue")
}

System_Ext(binance, "Binance API", "Exchange para ordenes y market data")
System_Ext(email, "SendGrid", "Notificaciones de alertas")

Rel(trader, spa, "Usa", "HTTPS")
Rel(admin, spa, "Configura", "HTTPS")
Rel(spa, api, "Llama", "REST/JSON HTTPS")
Rel(spa, ws, "Suscribe", "WSS")
Rel(api, db, "Lee/Escribe", "asyncpg")
Rel(api, cache, "Lee/Escribe", "Redis client")
Rel(api, binance, "Ordenes", "REST HTTPS")
Rel(worker, binance, "Market data", "WebSocket")
Rel(worker, db, "Guarda trades", "asyncpg")
@enduml
```

### Nivel 3 — Component Diagram (para devs del modulo especifico)

Descompone un contenedor en sus componentes internos.

```
Backend API Components:
- AuthRouter: JWT validation, login/logout endpoints
- TradingRouter: Order placement, position management
- PortfolioRouter: Portfolio state, P&L calculation
- RiskService: Pre-trade risk checks (max position, daily loss)
- BinanceClient: Rate-limited HTTP client, retry logic
- OrderRepository: DB operations for orders
- AuthMiddleware: Token validation on every request
```

### Nivel 4 — Code (para el dev implementando)

Diagramas de clases/secuencias para logica compleja. No documentar todo — solo flujos no obvios.

```python
# Diagrama de secuencia: Order Placement Flow
# 1. Router recibe POST /api/orders
# 2. AuthMiddleware valida JWT → user_id
# 3. RiskService.check_pre_trade(user_id, order) → puede lanzar RiskViolationError
# 4. BinanceClient.place_order(symbol, side, qty) → binance_order_id
# 5. OrderRepository.save(order) → db_order_id
# 6. WebSocket.broadcast(user_id, order_event)
# 7. Return 201 Created con order details
```

---

## 3. Scalability Patterns — CQRS, Event Sourcing, Saga

### CQRS (Command Query Responsibility Segregation)

Separa las operaciones de escritura (Commands) de las de lectura (Queries). Permite optimizar cada lado independientemente.

**Cuando usar CQRS:**
- Read/write ratio muy asimetrico (ej: 100:1 reads)
- Modelos de lectura muy diferentes al modelo de dominio
- Necesidad de escalar reads y writes de forma independiente
- Cuando el modelo de escritura requiere logica de dominio compleja

**Cuando NO usar CQRS:**
- CRUD simple sin logica de dominio
- Equipo pequeno sin experiencia en el patron
- Sistemas con bajo trafico donde la complejidad extra no vale

```python
# CQRS Pattern — Implementacion con FastAPI + SQLAlchemy

# === COMMANDS (lado de escritura) ===
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

@dataclass
class PlaceOrderCommand:
    user_id: UUID
    symbol: str
    side: str  # "BUY" | "SELL"
    quantity: float
    order_type: str  # "MARKET" | "LIMIT"
    price: float | None = None

class OrderCommandHandler:
    def __init__(self, db: AsyncSession, binance: BinanceClient, risk: RiskService):
        self.db = db
        self.binance = binance
        self.risk = risk

    async def handle_place_order(self, cmd: PlaceOrderCommand) -> UUID:
        # 1. Validacion de dominio
        await self.risk.validate(cmd.user_id, cmd.symbol, cmd.quantity)

        # 2. Efecto externo
        exchange_order = await self.binance.place_order(
            symbol=cmd.symbol,
            side=cmd.side,
            quantity=cmd.quantity,
            order_type=cmd.order_type,
            price=cmd.price
        )

        # 3. Persistencia del evento
        order = Order(
            id=uuid4(),
            user_id=cmd.user_id,
            symbol=cmd.symbol,
            side=cmd.side,
            quantity=cmd.quantity,
            exchange_order_id=exchange_order["orderId"],
            status="PENDING",
            created_at=datetime.utcnow()
        )
        self.db.add(order)
        await self.db.commit()
        return order.id

# === QUERIES (lado de lectura) ===
# Read model optimizado para la UI — puede ser una vista materializada o tabla desnormalizada

@dataclass
class OrderSummaryDTO:
    id: UUID
    symbol: str
    side: str
    quantity: float
    status: str
    pnl: float | None
    created_at: datetime

class OrderQueryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_orders(
        self,
        user_id: UUID,
        limit: int = 50,
        cursor: datetime | None = None
    ) -> list[OrderSummaryDTO]:
        # Query optimizado con JOIN a trades para P&L
        # Este modelo puede estar en una DB de lectura separada (replica)
        query = """
            SELECT
                o.id, o.symbol, o.side, o.quantity, o.status, o.created_at,
                COALESCE(t.realized_pnl, 0) as pnl
            FROM orders o
            LEFT JOIN trades t ON t.order_id = o.id
            WHERE o.user_id = :user_id
              AND (:cursor IS NULL OR o.created_at < :cursor)
            ORDER BY o.created_at DESC
            LIMIT :limit
        """
        result = await self.db.execute(
            text(query),
            {"user_id": user_id, "limit": limit, "cursor": cursor}
        )
        return [OrderSummaryDTO(**row) for row in result.mappings()]
```

### Event Sourcing

En lugar de guardar el estado actual, guardas la secuencia de eventos que llevaron a ese estado. El estado actual se reconstruye reproduciendo los eventos.

**Cuando usar Event Sourcing:**
- Necesitas audit trail completo (regulatorio, trading)
- Time travel / debugging temporal es importante
- Multiples read models del mismo dominio
- Event-driven architecture donde otros sistemas consumen tus eventos

**Cuando NO usar:**
- Queries simples al estado actual
- Equipo sin experiencia — curva de aprendizaje alta
- Datos que cambian con muy alta frecuencia sin necesidad de historial

```python
# Event Sourcing — Implementacion basica

from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4
import json

# === EVENTOS ===
class EventType(str, Enum):
    ORDER_PLACED = "order_placed"
    ORDER_FILLED = "order_filled"
    ORDER_CANCELLED = "order_cancelled"
    POSITION_OPENED = "position_opened"
    POSITION_CLOSED = "position_closed"

@dataclass
class DomainEvent:
    event_id: UUID = field(default_factory=uuid4)
    event_type: EventType = None
    aggregate_id: UUID = None
    occurred_at: datetime = field(default_factory=datetime.utcnow)
    version: int = 1
    payload: dict = field(default_factory=dict)

    def to_json(self) -> str:
        return json.dumps({
            "event_id": str(self.event_id),
            "event_type": self.event_type.value,
            "aggregate_id": str(self.aggregate_id),
            "occurred_at": self.occurred_at.isoformat(),
            "version": self.version,
            "payload": self.payload
        })

# === AGGREGATE (reconstruye estado desde eventos) ===
class PositionAggregate:
    def __init__(self, position_id: UUID):
        self.id = position_id
        self.symbol: str | None = None
        self.quantity: float = 0.0
        self.avg_entry_price: float = 0.0
        self.realized_pnl: float = 0.0
        self.status: str = "CLOSED"
        self._version: int = 0
        self._uncommitted_events: list[DomainEvent] = []

    @classmethod
    def from_events(cls, position_id: UUID, events: list[DomainEvent]) -> "PositionAggregate":
        aggregate = cls(position_id)
        for event in events:
            aggregate._apply(event)
        return aggregate

    def _apply(self, event: DomainEvent):
        """Aplica un evento al estado del aggregate — NUNCA tiene side effects"""
        if event.event_type == EventType.POSITION_OPENED:
            self.symbol = event.payload["symbol"]
            self.quantity = event.payload["quantity"]
            self.avg_entry_price = event.payload["entry_price"]
            self.status = "OPEN"
        elif event.event_type == EventType.ORDER_FILLED:
            # Actualizar average entry con nueva ejecucion
            total_qty = self.quantity + event.payload["quantity"]
            self.avg_entry_price = (
                (self.avg_entry_price * self.quantity + event.payload["price"] * event.payload["quantity"])
                / total_qty
            )
            self.quantity = total_qty
        elif event.event_type == EventType.POSITION_CLOSED:
            exit_price = event.payload["exit_price"]
            self.realized_pnl += (exit_price - self.avg_entry_price) * self.quantity
            self.quantity = 0.0
            self.status = "CLOSED"
        self._version += 1

    def open_position(self, symbol: str, quantity: float, entry_price: float):
        if self.status == "OPEN":
            raise ValueError("Position already open")
        event = DomainEvent(
            event_type=EventType.POSITION_OPENED,
            aggregate_id=self.id,
            payload={"symbol": symbol, "quantity": quantity, "entry_price": entry_price}
        )
        self._apply(event)
        self._uncommitted_events.append(event)

    def close_position(self, exit_price: float):
        if self.status == "CLOSED":
            raise ValueError("Position already closed")
        event = DomainEvent(
            event_type=EventType.POSITION_CLOSED,
            aggregate_id=self.id,
            payload={"exit_price": exit_price, "realized_pnl": self.realized_pnl}
        )
        self._apply(event)
        self._uncommitted_events.append(event)

# === EVENT STORE ===
class EventStore:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def append(self, events: list[DomainEvent]):
        for event in events:
            self.db.add(EventRecord(
                event_id=event.event_id,
                event_type=event.event_type.value,
                aggregate_id=event.aggregate_id,
                occurred_at=event.occurred_at,
                version=event.version,
                payload=event.payload
            ))
        await self.db.commit()

    async def load(self, aggregate_id: UUID) -> list[DomainEvent]:
        result = await self.db.execute(
            select(EventRecord)
            .where(EventRecord.aggregate_id == aggregate_id)
            .order_by(EventRecord.occurred_at)
        )
        return [
            DomainEvent(
                event_id=r.event_id,
                event_type=EventType(r.event_type),
                aggregate_id=r.aggregate_id,
                occurred_at=r.occurred_at,
                version=r.version,
                payload=r.payload
            )
            for r in result.scalars()
        ]
```

### Saga Pattern — Transacciones Distribuidas

El patron Saga coordina transacciones que abarcan multiples servicios. Cada paso tiene una transaccion compensatoria en caso de fallo.

**Tipos de Saga:**
1. **Choreography:** Cada servicio publica eventos y reacciona a eventos de otros. Sin coordinador central.
2. **Orchestration:** Un orquestador central dirige los pasos. Mas facil de depurar, mas acoplamiento.

```python
# Saga Orchestration — Ejemplo: Place Order con multiples pasos

from enum import Enum, auto
from dataclasses import dataclass

class SagaStatus(str, Enum):
    STARTED = "started"
    COMPLETED = "completed"
    COMPENSATING = "compensating"
    FAILED = "failed"

@dataclass
class PlaceOrderSagaState:
    saga_id: UUID
    user_id: UUID
    symbol: str
    quantity: float
    status: SagaStatus = SagaStatus.STARTED
    binance_order_id: str | None = None
    portfolio_reserved: bool = False
    notification_sent: bool = False

class PlaceOrderSaga:
    """
    Pasos:
    1. Reservar fondos en portfolio (T1)
    2. Enviar orden a Binance (T2)
    3. Confirmar orden en DB (T3)
    4. Enviar notificacion (T4)

    Compensaciones:
    1. Liberar reserva de fondos (C1)
    2. Cancelar orden en Binance (C2)
    3. Marcar orden como fallida en DB (C3)
    """

    def __init__(self, portfolio_svc, binance, order_repo, notification_svc):
        self.portfolio = portfolio_svc
        self.binance = binance
        self.orders = order_repo
        self.notifications = notification_svc

    async def execute(self, state: PlaceOrderSagaState) -> bool:
        try:
            # T1: Reservar fondos
            await self.portfolio.reserve_funds(state.user_id, state.quantity)
            state.portfolio_reserved = True

            # T2: Enviar a exchange
            order = await self.binance.place_order(state.symbol, state.quantity)
            state.binance_order_id = order["orderId"]

            # T3: Persistir
            await self.orders.save(state)

            # T4: Notificar (no critico — no tiene compensacion)
            try:
                await self.notifications.send_order_placed(state.user_id, order)
                state.notification_sent = True
            except Exception:
                pass  # Best-effort notification

            state.status = SagaStatus.COMPLETED
            return True

        except Exception as e:
            state.status = SagaStatus.COMPENSATING
            await self._compensate(state)
            state.status = SagaStatus.FAILED
            return False

    async def _compensate(self, state: PlaceOrderSagaState):
        """Ejecuta compensaciones en orden inverso"""
        # C2: Cancelar en Binance si fue enviada
        if state.binance_order_id:
            try:
                await self.binance.cancel_order(state.binance_order_id)
            except Exception:
                # Log y alertar — compensacion manual puede ser necesaria
                pass

        # C1: Liberar reserva si fue reservada
        if state.portfolio_reserved:
            await self.portfolio.release_funds(state.user_id, state.quantity)
```

---

## 4. Database Selection Matrix

### Decision Framework

| Criterio | PostgreSQL | MongoDB | Redis | Cassandra | ClickHouse |
|----------|------------|---------|-------|-----------|------------|
| ACID transactions | Si (full) | Si (limitado, 4.0+) | Si (con Lua) | No | No |
| Schema flexibility | Baja (JSONB ayuda) | Alta | N/A | Media | Baja |
| Read performance | Alta | Alta | Muy alta | Alta | Muy alta (OLAP) |
| Write throughput | Media | Alta | Muy alta | Muy alta | Alta (batch) |
| Query complexity | Muy alta (SQL full) | Media (MQL) | Baja | Baja (CQL) | Alta (SQL) |
| Joins nativos | Si | No (lookup) | No | No | Si |
| Time-series | Con TimescaleDB | Con series | Limitado | Media | Excelente |
| Escalado horizontal | Limitado (Citus) | Si (sharding nativo) | Si (Cluster) | Si (nativo) | Si |
| Consistencia | Fuerte | Eventual/Configurable | Fuerte (single) | Eventual | Eventual |

### Cuando usar cada uno

**PostgreSQL** — el default seguro para la mayoria de casos:
- Datos relacionales con integridad referencial
- Transacciones complejas multi-tabla
- Queries ad-hoc complejas que no conoces de antemano
- Con TimescaleDB: time-series de alta precision (trading, IoT)
- Con pgvector: embeddings y busqueda semantica

```sql
-- PostgreSQL con TimescaleDB para OHLCV (trading)
CREATE TABLE ohlcv (
    time        TIMESTAMPTZ NOT NULL,
    symbol      TEXT NOT NULL,
    open        NUMERIC(20, 8) NOT NULL,
    high        NUMERIC(20, 8) NOT NULL,
    low         NUMERIC(20, 8) NOT NULL,
    close       NUMERIC(20, 8) NOT NULL,
    volume      NUMERIC(30, 8) NOT NULL
);
SELECT create_hypertable('ohlcv', 'time');
CREATE INDEX ON ohlcv (symbol, time DESC);

-- Query eficiente para datos de los ultimos 7 dias
SELECT
    time_bucket('1 hour', time) AS bucket,
    symbol,
    first(open, time) AS open,
    max(high) AS high,
    min(low) AS low,
    last(close, time) AS close,
    sum(volume) AS volume
FROM ohlcv
WHERE symbol = 'BTCUSDT'
  AND time > NOW() - INTERVAL '7 days'
GROUP BY bucket, symbol
ORDER BY bucket DESC;
```

**MongoDB** — cuando el schema es genuinamente variable:
- Datos del tipo documento con estructura variable por registro
- Catálogos de productos con atributos distintos por categoria
- Logs de eventos con payloads heterogeneos
- Prototipado rapido donde el schema evoluciona frecuentemente

**Redis** — para acceso sub-milisegundo:
- Sessions de usuario
- Cache de queries costosas
- Rate limiting (token bucket, sliding window)
- Pub/Sub para eventos en tiempo real
- Leaderboards con Sorted Sets
- Distributed locks (Redlock)

```python
# Redis para rate limiting — Token Bucket
import redis.asyncio as redis
import time

class TokenBucketRateLimiter:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def is_allowed(
        self,
        key: str,
        rate: float,      # tokens por segundo
        capacity: float   # capacidad maxima del bucket
    ) -> bool:
        lua_script = """
        local key = KEYS[1]
        local rate = tonumber(ARGV[1])
        local capacity = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])

        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or capacity
        local last_refill = tonumber(bucket[2]) or now

        -- Calcular tokens ganados desde ultimo refill
        local elapsed = now - last_refill
        tokens = math.min(capacity, tokens + elapsed * rate)

        if tokens >= 1 then
            tokens = tokens - 1
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
            redis.call('EXPIRE', key, math.ceil(capacity / rate) * 2)
            return 1
        else
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
            return 0
        end
        """
        result = await self.redis.eval(
            lua_script,
            1,
            key,
            str(rate),
            str(capacity),
            str(time.time())
        )
        return bool(result)
```

**Cassandra** — escrituras masivas distribuidas globalmente:
- IoT con millones de escrituras por segundo
- Time-series de muy alto volumen con TTL automatico
- Datos geograficamente distribuidos con multi-datacenter
- Nunca necesitas queries relacionales complejas

**ClickHouse** — analytics OLAP:
- Dashboards de Business Intelligence
- Logs de acceso/eventos para analisis
- Queries sobre billones de filas con agregaciones
- Never para transacciones OLTP

---

## 5. API Design — REST vs GraphQL vs gRPC

### Cuando usar REST

- APIs publicas consumidas por terceros (estandar de facto)
- CRUD simple sobre recursos
- Cacheabilidad HTTP importante (CDN, browser cache)
- Equipo familiarizado con HTTP, sin herramientas adicionales

```python
# REST bien disenado — OpenAPI 3.1 + FastAPI
from fastapi import FastAPI, Query, Path, HTTPException
from pydantic import BaseModel, Field
from typing import Annotated
from uuid import UUID

app = FastAPI(
    title="Trading Bot API",
    version="1.0.0",
    openapi_url="/api/docs/openapi.json"
)

# Naming: nouns, plural, no verbs
# /api/orders      GET (list), POST (create)
# /api/orders/{id} GET (get one), PATCH (update), DELETE (cancel)

class OrderResponse(BaseModel):
    id: UUID
    symbol: str
    side: str
    quantity: float
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}

class CreateOrderRequest(BaseModel):
    symbol: str = Field(..., pattern=r'^[A-Z]{2,10}USDT$', examples=["BTCUSDT"])
    side: Literal["BUY", "SELL"]
    quantity: float = Field(..., gt=0, le=100)
    order_type: Literal["MARKET", "LIMIT"] = "MARKET"
    price: float | None = Field(None, gt=0)

# Cursor-based pagination — preferida sobre offset para grandes datasets
class PaginatedOrders(BaseModel):
    data: list[OrderResponse]
    next_cursor: str | None  # opaque cursor, base64 encoded timestamp
    has_more: bool
    total: int | None = None  # Solo incluir si el count es barato

@app.get("/api/orders", response_model=PaginatedOrders)
async def list_orders(
    cursor: Annotated[str | None, Query(description="Pagination cursor")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    symbol: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
    current_user: User = Depends(get_current_user),
    service: OrderService = Depends(get_order_service)
):
    """List orders with cursor-based pagination."""
    orders, next_cursor = await service.list_user_orders(
        user_id=current_user.id,
        cursor=cursor,
        limit=limit,
        filters={"symbol": symbol, "status": status}
    )
    return PaginatedOrders(
        data=orders,
        next_cursor=next_cursor,
        has_more=next_cursor is not None
    )

# Versionado de API — URL prefix (mas explicito)
# /api/v1/orders  — version actual
# /api/v2/orders  — nueva version con breaking changes
# Mantener v1 deprecada por al menos 6 meses con header: Deprecation: 2025-06-01
```

### Cuando usar GraphQL

- Frontend necesita datos muy especificos de multiples recursos (evitar over/under fetching)
- Multiples clientes con necesidades muy distintas (mobile vs web)
- API interna donde el contrato evoluciona frecuentemente
- Equipos frontend con autonomia para definir sus queries

```typescript
// GraphQL — Schema first con codegen
// schema.graphql
type Query {
  portfolio(userId: ID!): Portfolio!
  orders(
    userId: ID!
    first: Int = 20
    after: String
    filter: OrderFilter
  ): OrderConnection!
}

type OrderConnection {
  edges: [OrderEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type OrderEdge {
  node: Order!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type Order {
  id: ID!
  symbol: String!
  side: OrderSide!
  quantity: Float!
  status: OrderStatus!
  trade: Trade  # Resolver separado — N+1 solved with DataLoader
  createdAt: DateTime!
}

enum OrderSide { BUY SELL }
enum OrderStatus { PENDING FILLED CANCELLED REJECTED }
```

**PROBLEMAS comunes de GraphQL y como evitarlos:**

```python
# N+1 Problem — MALO
@strawberry.type
class Order:
    @strawberry.field
    async def trade(self) -> Trade | None:
        # Esto ejecuta 1 query por cada orden — N+1!
        return await TradeRepository.get_by_order_id(self.id)

# BUENO — usar DataLoader (batching)
from strawberry.dataloader import DataLoader

async def load_trades_batch(order_ids: list[UUID]) -> list[Trade | None]:
    trades = await TradeRepository.get_by_order_ids(order_ids)
    trade_map = {t.order_id: t for t in trades}
    return [trade_map.get(oid) for oid in order_ids]

trade_loader = DataLoader(load_fn=load_trades_batch)

@strawberry.type
class Order:
    @strawberry.field
    async def trade(self, info: strawberry.types.Info) -> Trade | None:
        return await info.context.trade_loader.load(self.id)
```

### Cuando usar gRPC

- Comunicacion interna entre microservicios (no expuesta al browser)
- Necesitas streaming bidireccional (market data en tiempo real)
- Performance critica y payload pequeno (binary Protobuf vs JSON)
- Contratos fuertes con generacion de codigo en multiples lenguajes

```protobuf
// trading.proto
syntax = "proto3";
package trading;

service TradingService {
  rpc PlaceOrder (PlaceOrderRequest) returns (PlaceOrderResponse);
  rpc StreamMarketData (MarketDataRequest) returns (stream MarketDataUpdate);
  rpc GetPortfolio (GetPortfolioRequest) returns (Portfolio);
}

message PlaceOrderRequest {
  string user_id = 1;
  string symbol = 2;
  string side = 3;  // "BUY" | "SELL"
  double quantity = 4;
  string order_type = 5;
  optional double price = 6;
}

message MarketDataUpdate {
  string symbol = 1;
  double price = 2;
  double volume_24h = 3;
  double change_24h = 4;
  int64 timestamp = 5;
}
```

---

## 6. Microservices vs Monolith — Decision Framework

### El Monolith Modular — el mejor punto de partida

**Un monolito bien estructurado es mejor que microservicios prematuros.** La regla: descomponer solo cuando hay un problema real que los microservicios resuelven.

```
Arbol de decision:

¿Equipo > 50 engineers?
├── NO → Monolith modular (casi siempre la respuesta correcta)
└── SI → ¿Dominios claramente separados con ownership independiente?
    ├── NO → Modular monolith con limites claros
    └── SI → ¿Cuentas con infraestructura madura (observability, CI/CD per service)?
        ├── NO → Preparar infra primero, luego descomponer gradualmente
        └── SI → Microservicios para los dominios que lo justifican
```

**Senales de que NECESITAS microservicios:**
- Equipos independientes que se bloquean entre si al deployar
- Partes del sistema tienen requisitos de escala radicalmente distintos (10x diferencia)
- Necesitas stacks tecnologicos distintos por dominio (ej: ML en Python, API en Go)
- Ciclos de release independientes son un requisito de negocio

**Senales de que NO necesitas microservicios:**
- "Los microservicios se ven cool" (anti-patron clasico)
- Startup pre-product/market fit
- Equipo < 20 engineers
- Transacciones que abarcan muchos dominios frecuentemente

### Strangler Fig Pattern — Migracion gradual de monolito a microservicios

```python
# Paso 1: Extraer un modulo a un servicio separado
# Antes: Todo en monolith
# app/orders/service.py → directamente importado

# Paso 2: Crear interfaz/puerto en el monolito
from abc import ABC, abstractmethod

class OrderServicePort(ABC):
    @abstractmethod
    async def place_order(self, cmd: PlaceOrderCommand) -> UUID: ...
    @abstractmethod
    async def get_order(self, order_id: UUID) -> Order | None: ...

# Paso 3: Implementacion local (durante la transicion)
class LocalOrderService(OrderServicePort):
    async def place_order(self, cmd: PlaceOrderCommand) -> UUID:
        # Logica original del monolito
        ...

# Paso 4: Implementacion HTTP que apunta al nuevo microservicio
class RemoteOrderService(OrderServicePort):
    def __init__(self, base_url: str, client: httpx.AsyncClient):
        self.base_url = base_url
        self.client = client

    async def place_order(self, cmd: PlaceOrderCommand) -> UUID:
        response = await self.client.post(
            f"{self.base_url}/orders",
            json=asdict(cmd),
            headers={"X-Internal-Token": settings.INTERNAL_TOKEN}
        )
        response.raise_for_status()
        return UUID(response.json()["id"])

# Paso 5: Feature flag para cambiar entre implementaciones
def get_order_service() -> OrderServicePort:
    if settings.USE_MICROSERVICE_ORDERS:
        return RemoteOrderService(settings.ORDER_SERVICE_URL, http_client)
    return LocalOrderService(db=get_db())
```

---

## 7. Security by Design — STRIDE Threat Modeling

STRIDE es un acronimo para categorias de amenazas:
- **S**poofing — suplantacion de identidad
- **T**ampering — modificacion de datos
- **R**epudiation — negar haber realizado una accion
- **I**nformation Disclosure — exposicion de datos sensibles
- **D**enial of Service — interrupcion del servicio
- **E**levation of Privilege — ganar acceso no autorizado

### Template de Analisis STRIDE por Componente

```markdown
## Threat Model: Order Placement Flow

### Data Flow:
Browser → [HTTPS] → API Gateway → [Internal] → OrderService → [asyncpg] → PostgreSQL

### Componente: API Gateway

| Amenaza | Categoria STRIDE | Probabilidad | Impacto | Mitigacion |
|---------|-----------------|--------------|---------|------------|
| JWT robado usado por atacante | Spoofing | Media | Alto | Short expiry (15min) + refresh tokens + JTI blacklist |
| Modificar orden en transito | Tampering | Baja | Alto | HTTPS con TLS 1.3, certificate pinning en mobile |
| Usuario niega haber colocado orden | Repudiation | Media | Alto | Audit log con timestamp, user_id, IP, user_agent |
| Datos de ordenes expuestos | Info Disclosure | Media | Alto | No loggear montos, solo IDs; campos sensibles encriptados |
| DDoS en endpoints de orden | Denial of Service | Alta | Alto | Rate limiting (10 req/s por user), CAPTCHA en anomalias |
| User comun accede a admin endpoints | Elevation of Privilege | Baja | Critico | RBAC estricto, separar JWT claims por rol |

### Mitigaciones implementadas:
- [ ] JWT con exp de 15 minutos
- [ ] Refresh token rotation con familia tracking
- [ ] Rate limiting: 100 req/min global, 10 req/s por user
- [ ] Audit log inmutable en tabla separada
- [ ] HTTPS con HSTS preloaded
- [ ] RBAC en todos los endpoints
```

---

## 8. Performance Budgets y SLOs/SLAs

### Definicion de SLOs (Service Level Objectives)

```yaml
# slos.yaml — documento de referencia para el equipo
service: trading-bot-api
version: "1.0"
updated: "2025-01-01"

slos:
  # Disponibilidad
  availability:
    target: 99.9%  # 8.7 horas downtime/año
    window: 30d
    measurement: "successful_requests / total_requests"
    alert_at: 99.5%  # Alerta antes de violar SLO

  # Latencia de endpoint critico
  order_placement_latency:
    target_p50: 200ms   # 50% de requests < 200ms
    target_p95: 500ms   # 95% de requests < 500ms
    target_p99: 1000ms  # 99% de requests < 1s
    window: 5m
    alert_at_p95: 800ms

  # Market data WebSocket
  websocket_latency:
    target: 50ms   # Latencia precio actual -> cliente
    alert_at: 200ms

  # Throughput
  order_throughput:
    target: 100rps  # Requests per second sostenibles
    alert_below: 50rps  # Si cae, investigar

error_budget:
  # Con 99.9% SLO en 30 dias:
  # Total minutos: 30 * 24 * 60 = 43,200
  # Error budget: 0.1% = 43.2 minutos de downtime
  monthly_minutes: 43.2
  consumption_policy: |
    - >50% consumido en <15 dias: freeze de deployments no-criticos
    - >75% consumido: postmortem requerido
    - 100% consumido: executive review + RCA detallado
```

### Performance Budget para Frontend

```typescript
// performance-budget.ts — incluir en CI
export const PERFORMANCE_BUDGET = {
  // Core Web Vitals
  LCP: 2500,    // Largest Contentful Paint < 2.5s
  FID: 100,     // First Input Delay < 100ms
  CLS: 0.1,     // Cumulative Layout Shift < 0.1
  TTFB: 800,    // Time to First Byte < 800ms
  FCP: 1800,    // First Contentful Paint < 1.8s

  // Bundle sizes (gzipped)
  jsMainBundle: 150_000,    // 150KB max
  cssMainBundle: 30_000,    // 30KB max
  totalInitialLoad: 300_000, // 300KB total inicial

  // API response times (desde frontend)
  apiP95: 500,     // 95th percentile < 500ms
  wsLatency: 100,  // WebSocket message latency < 100ms
};

// Lighthouse CI config
// .lighthouserc.js
module.exports = {
  ci: {
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'interactive': ['error', { maxNumericValue: 3500 }],
      },
    },
  },
};
```

---

## 9. Infrastructure Patterns

### Blue-Green Deployment

```yaml
# docker-compose.blue-green.yml
# Dos entornos identicos — en cualquier momento uno es "live" y otro "idle"

version: '3.8'
services:
  # Blue (actualmente live)
  api-blue:
    image: trading-api:v1.2.0
    env_file: .env.production
    deploy:
      replicas: 3

  # Green (nuevo release, en staging)
  api-green:
    image: trading-api:v1.3.0
    env_file: .env.production
    deploy:
      replicas: 3

  # Nginx como router — cambiar upstream para el switch
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/blue-green.conf:/etc/nginx/conf.d/default.conf
```

```nginx
# nginx/blue-green.conf
upstream active_backend {
    # Cambiar entre 'blue' y 'green' para el switch
    server api-blue:8000;
    # server api-green:8000;
}

server {
    listen 80;
    location /api {
        proxy_pass http://active_backend;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Canary Deployment

```nginx
# Canary: 10% del trafico al nuevo release
upstream backend_stable {
    server api-v1:8000 weight=9;  # 90%
    server api-v2:8000 weight=1;  # 10% canary
}
```

### Multi-Region Architecture

```python
# Configuracion para multi-region con failover automatico

REGION_CONFIG = {
    "primary": {
        "region": "us-east-1",
        "db_url": "postgresql://primary-db.us-east-1/trading",
        "redis_url": "redis://primary-redis.us-east-1:6379",
    },
    "secondary": {
        "region": "eu-west-1",
        "db_url": "postgresql://replica-db.eu-west-1/trading",  # Read replica
        "redis_url": "redis://secondary-redis.eu-west-1:6379",
    }
}

# Health check con failover automatico
class MultiRegionClient:
    def __init__(self):
        self.primary = self._connect(REGION_CONFIG["primary"])
        self.secondary = self._connect(REGION_CONFIG["secondary"])
        self.active = self.primary

    async def health_check(self):
        while True:
            try:
                await self.active.ping()
            except Exception:
                # Failover a la otra region
                self.active = self.secondary if self.active is self.primary else self.primary
                await asyncio.sleep(5)
            await asyncio.sleep(30)
```

---

## 10. Architecture Review Checklist

Usar antes de aprobar cualquier feature con cambios arquitectonicos significativos.

### Escalabilidad y Performance
- [ ] Se identificaron los cuellos de botella potenciales bajo carga 10x
- [ ] Las queries de DB tienen indices apropiados (verificado con EXPLAIN ANALYZE)
- [ ] Se implemento paginacion en todos los endpoints de lista
- [ ] El caching esta correctamente configurado con TTLs definidos
- [ ] Los endpoints criticos tienen rate limiting
- [ ] Se midio el impacto en el connection pool de la DB
- [ ] Los WebSockets tienen limites de conexiones y heartbeat
- [ ] Los background jobs tienen timeouts y dead letter queues

### Seguridad
- [ ] Todos los endpoints nuevos requieren autenticacion (si corresponde)
- [ ] Los datos del usuario no aparecen en logs
- [ ] Las queries usan parameterized queries o ORM (no string concatenation)
- [ ] Los secretos no estan hardcoded — usan variables de entorno
- [ ] Los archivos subidos son validados (tipo, tamano, contenido)
- [ ] Los errores no exponen stack traces en produccion
- [ ] Se aplico STRIDE en flujos nuevos criticos
- [ ] Las dependencias nuevas no tienen vulnerabilidades conocidas (npm audit, pip-audit)

### Confiabilidad
- [ ] Los circuit breakers estan en clientes externos (Binance, payment, etc.)
- [ ] Los reintentos tienen exponential backoff y jitter
- [ ] Las operaciones criticas son idempotentes
- [ ] Existe logica de rollback o compensacion para fallos parciales
- [ ] Los health checks cubren dependencias criticas
- [ ] Las migraciones de DB son reversibles

### Observabilidad
- [ ] Los logs son estructurados (JSON) con correlation_id
- [ ] Las metricas criticas estan siendo trackeadas (counters, histogramas)
- [ ] Los alerts estan configurados para los nuevos SLOs
- [ ] Los traces distribuidos cubren el flujo completo
- [ ] El dashboard de monitoreo refleja las nuevas metricas

### Mantenibilidad
- [ ] Existe un ADR para decisiones arquitectonicas no obvias
- [ ] El codigo nuevo tiene cobertura de tests > 80%
- [ ] Las interfaces entre modulos estan bien definidas
- [ ] No hay dependencias ciclicas entre modulos
- [ ] La configuracion no esta hardcoded (usa settings/env)
- [ ] El schema de la DB tiene migraciones versionadas
- [ ] Los breaking changes en la API tienen versionado

### Documentacion
- [ ] El CLAUDE.md/README actualiza las instrucciones de setup si cambio algo
- [ ] Los nuevos endpoints estan en el OpenAPI/Swagger
- [ ] Los nuevos ADRs estan en /docs/adr/
- [ ] Los cambios en el diagrama C4 estan reflejados

---

## 11. Anti-Patterns Comunes y Como Evitarlos

### Anti-pattern: God Object / God Service

```python
# MAL: Un servicio que hace todo
class OrderService:
    def place_order(self): ...
    def send_email(self): ...           # No! Usar EmailService
    def calculate_portfolio_risk(self): ...  # No! Usar RiskService
    def update_user_balance(self): ...  # No! Usar PortfolioService
    def generate_report(self): ...      # No! Usar ReportService

# BIEN: Single Responsibility
class OrderService:
    def __init__(self, risk: RiskService, portfolio: PortfolioService, exchange: ExchangeClient):
        ...
    def place_order(self, cmd: PlaceOrderCommand) -> Order: ...
    def cancel_order(self, order_id: UUID) -> bool: ...
    def get_order(self, order_id: UUID) -> Order | None: ...
```

### Anti-pattern: Shared Database entre servicios

```
# MAL: Dos servicios leen/escriben la misma tabla
OrderService ──writes──> orders table
ReportService ──reads──> orders table (acoplamiento implicito!)

# BIEN: Cada servicio tiene su store, comunica por eventos
OrderService ──publishes──> OrderPlaced event
ReportService ──subscribes──> OrderPlaced event
            ──maintains──> orders_denormalized (su propia vista)
```

### Anti-pattern: Leaky Abstractions en la API

```python
# MAL: Exponer detalles de implementacion de la DB
GET /api/users?table=users&column=email&value=foo@bar.com

# BIEN: Abstraccion limpia que oculta el storage
GET /api/users?email=foo@bar.com
```

### Anti-pattern: Distribuited Monolith

```
# El peor mundo posible: multiples servicios pero fuertemente acoplados
ServiceA ──sync HTTP──> ServiceB ──sync HTTP──> ServiceC

# Si C cae, A falla. Si hay deploy de B, A necesita esperar.
# Esto no es microservicios, es un monolito distribuido.

# BIEN: Desacoplamiento asincrono donde es posible
ServiceA ──publish event──> MessageBus
ServiceB ──subscribe + process──> own DB
ServiceC ──subscribe + process──> own DB
```

### Anti-pattern: Primitive Obsession en APIs

```python
# MAL: Tipos primitivos sin significado
def transfer_funds(from_id: str, to_id: str, amount: float, currency: str): ...

# BIEN: Value Objects que expresan el dominio
@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str  # ISO 4217

    def __post_init__(self):
        if self.amount < 0:
            raise ValueError("Amount cannot be negative")
        if self.currency not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Unsupported currency: {self.currency}")

@dataclass(frozen=True)
class AccountId:
    value: UUID

def transfer_funds(source: AccountId, destination: AccountId, amount: Money): ...
```

---

## 12. Guia Rapida de Decision — Cheat Sheet

```
¿Nueva feature compleja (>3 archivos)?
  → Crear ADR primero
  → Mapear en C4 nivel Container/Component
  → Identificar amenazas con STRIDE

¿Nueva base de datos o servicio externo?
  → Ver Database Selection Matrix
  → Agregar circuit breaker
  → Configurar health check
  → Definir SLO de latencia

¿Nueva API publica?
  → REST con OpenAPI 3.1
  → Cursor pagination
  → Versioning desde el inicio (/v1/)
  → Rate limiting obligatorio

¿Comunicacion entre microservicios internos?
  → gRPC si necesitas streaming o performance critica
  → HTTP+JSON si es simple y ya tienes la infra

¿El monolito esta lento?
  → Primero: EXPLAIN ANALYZE en queries lentas
  → Segundo: Indices y connection pooling
  → Tercero: Caching con Redis
  → Cuarto (raramente): Extraccion a microservicio

¿Necesitas consistencia entre multiples operaciones?
  → Si es una DB: usa transacciones ACID
  → Si es multi-servicio: Saga pattern con compensaciones
  → Documenta en ADR
```
