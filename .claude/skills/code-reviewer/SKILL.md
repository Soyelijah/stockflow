# Code Reviewer — Guía Profesional de Review

Proceso institucional de code review con ejemplos de código real, clasificación de severidad y templates listos para usar.

---

## 1. Filosofía del Code Review

### Qué revisar (y qué NO)

**SÍ revisar:**
- Bugs de lógica que causarían fallos en producción
- Vulnerabilidades de seguridad
- Problemas de performance significativos (O(n²) donde cabe O(n))
- Violaciones de contratos de API / invariantes del dominio
- Deuda técnica que dificulta futuros cambios
- Tests faltantes para casos críticos
- Manejo de errores incorrecto o ausente

**NO revisar (o con baja prioridad):**
- Preferencias de estilo que el linter ya cubre (el CI lo resuelve)
- Nomenclatura subjetiva sin impacto funcional
- Refactors cosméticos que no cambian el comportamiento
- Discusiones de arquitectura que debieron darse en el design doc

### El contrato social del reviewer

1. **Critica el código, nunca al autor.** "Esta función hace demasiado" no "No sabes diseñar".
2. **Proporciona el fix, no solo el problema.** Si dices que algo está mal, muestra cómo arreglarlo.
3. **Distingue opinión de hecho.** "Preferiría usar X" vs "Usar Y aquí causa un memory leak".
4. **Responde en 24h.** Un PR bloqueado es trabajo bloqueado.
5. **Aprueba cuando está listo.** No acumules rondas de review interminables.

---

## 2. Clasificación de Severidad

| Severidad | Símbolo | Criterio | ¿Bloquea merge? |
|-----------|---------|----------|-----------------|
| **BLOCKER** | 🚫 | Causa bug en producción, vulnerabilidad de seguridad, data loss | SÍ — obligatorio |
| **MAJOR** | ⚠️ | Degrada performance significativamente, viola contratos, dificulta mantenimiento | SÍ — fuertemente recomendado |
| **MINOR** | 💡 | Mejora de legibilidad, DRY violation, alternativa más idiomática | NO — a criterio del autor |
| **NIT** | 🔹 | Typo, formato, naming subjetivo | NO — tomar o dejar |

---

## 3. Checklist Completo por Categoría

### 3.1 Correctness — Lógica y Comportamiento

**R-C01: Verificar condiciones de borde**
```python
# BLOCKER — este código falla con lista vacía
def get_max_price(prices: list[float]) -> float:
    return max(prices)  # ValueError: max() arg is an empty sequence

# BIEN
def get_max_price(prices: list[float]) -> float:
    if not prices:
        raise ValueError("La lista de precios no puede estar vacía")
    return max(prices)
```

**R-C02: Verificar comparaciones de flotantes**
```python
# BLOCKER — nunca comparar flotantes con ==
balance = 0.1 + 0.2
if balance == 0.3:  # Esto es False! 0.1 + 0.2 = 0.30000000000000004
    process_payment()

# BIEN
from decimal import Decimal
balance = Decimal("0.1") + Decimal("0.2")
if balance == Decimal("0.3"):  # True
    process_payment()

# O para casos donde Decimal es excesivo:
import math
if math.isclose(balance, 0.3, rel_tol=1e-9):
    process_payment()
```

**R-C03: Off-by-one en rangos**
```python
# MAJOR — itera hasta n-1 cuando debería hasta n
def sum_first_n(arr: list[int], n: int) -> int:
    total = 0
    for i in range(n - 1):  # Bug: se pierde arr[n-1]
        total += arr[i]
    return total

# BIEN
def sum_first_n(arr: list[int], n: int) -> int:
    return sum(arr[:n])
```

**R-C04: Mutación de parámetros**
```python
# MAJOR — muta el argumento del llamador
def add_default_config(config: dict) -> dict:
    config["timeout"] = 30  # Modifica el dict original!
    config["retries"] = 3
    return config

# BIEN
def add_default_config(config: dict) -> dict:
    return {**config, "timeout": 30, "retries": 3}
```

**R-C05: Race conditions**
```python
# BLOCKER — race condition en operación check-then-act
async def process_order(order_id: int):
    order = await db.get_order(order_id)
    if order.status == "pending":  # Otro proceso puede cambiar esto entre aquí...
        await asyncio.sleep(0.1)   # ...y aquí
        await db.update_order(order_id, status="processing")  # Doble procesamiento!

# BIEN — usar SELECT FOR UPDATE o transacción con lock
async def process_order(order_id: int):
    async with db.transaction():
        order = await db.get_order_for_update(order_id)  # Lock a nivel de fila
        if order.status == "pending":
            await db.update_order(order_id, status="processing")
```

**R-C06: Null/None sin manejar**
```typescript
// BLOCKER — TypeScript sin strict null checks puede generar runtime errors
function getUserEmail(userId: string): string {
    const user = users.find(u => u.id === userId);
    return user.email;  // TypeError si user es undefined
}

// BIEN
function getUserEmail(userId: string): string | null {
    const user = users.find(u => u.id === userId);
    return user?.email ?? null;
}
```

### 3.2 Security — OWASP y Patrones Comunes

**R-S01: SQL Injection**
```python
# BLOCKER — SQL injection directa
def get_user(username: str):
    query = f"SELECT * FROM users WHERE username = '{username}'"
    return db.execute(query)
# Si username = "'; DROP TABLE users; --", destruye la tabla

# BIEN — parámetros vinculados
def get_user(username: str):
    return db.execute(
        "SELECT * FROM users WHERE username = :username",
        {"username": username}
    )
```

**R-S02: Exposición de secrets en código**
```python
# BLOCKER — secret hardcodeado
API_KEY = "sk-proj-abc123xyz789..."
JWT_SECRET = "mysupersecretkey"

# BIEN
import os
from functools import lru_cache

@lru_cache(maxsize=1)
def get_settings():
    api_key = os.environ.get("API_KEY")
    if not api_key:
        raise ValueError("API_KEY environment variable is required")
    return {"api_key": api_key}
```

**R-S03: Path traversal**
```python
# BLOCKER — permite leer archivos fuera del directorio permitido
def serve_file(filename: str):
    path = f"/app/uploads/{filename}"
    with open(path) as f:  # filename = "../../etc/passwd" funciona!
        return f.read()

# BIEN
import os
from pathlib import Path

UPLOAD_DIR = Path("/app/uploads").resolve()

def serve_file(filename: str):
    # Eliminar caracteres peligrosos
    safe_name = os.path.basename(filename)
    full_path = (UPLOAD_DIR / safe_name).resolve()
    
    # Verificar que el path resultante está dentro del directorio permitido
    if not str(full_path).startswith(str(UPLOAD_DIR)):
        raise PermissionError("Acceso denegado")
    
    with open(full_path) as f:
        return f.read()
```

**R-S04: Mass assignment / over-posting**
```python
# BLOCKER — permite al usuario modificar campos privilegiados
class UserUpdateRequest(BaseModel):
    class Config:
        extra = "allow"  # Permite cualquier campo, incluyendo is_admin!

# BIEN
class UserUpdateRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    bio: str | None = None
    # is_admin NO está aquí — solo campos que el usuario puede cambiar
    
    model_config = ConfigDict(extra="forbid")  # Rechaza campos desconocidos
```

**R-S05: Timing attack en comparación de tokens**
```python
# MAJOR — comparación naive vulnerable a timing attacks
def verify_token(provided: str, expected: str) -> bool:
    return provided == expected  # Tiempo varía según caracteres que coinciden

# BIEN — comparación en tiempo constante
import hmac
def verify_token(provided: str, expected: str) -> bool:
    return hmac.compare_digest(
        provided.encode("utf-8"),
        expected.encode("utf-8")
    )
```

**R-S06: Log injection**
```python
# MAJOR — el input del usuario puede inyectar líneas falsas en logs
import logging
def process_user_input(user_input: str):
    logging.info(f"Processing: {user_input}")
    # user_input = "\nERROR: Authentication bypassed for admin user"
    # Genera una línea de log falsa que parece crítica

# BIEN
def process_user_input(user_input: str):
    # Sanitizar newlines del input antes de loggear
    safe_input = user_input.replace("\n", "\\n").replace("\r", "\\r")
    logging.info("Processing user input", extra={"input_preview": safe_input[:100]})
```

**R-S07: Exposición de información en errores**
```python
# MAJOR — expone stack trace e información interna al cliente
@app.exception_handler(Exception)
async def global_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "traceback": traceback.format_exc()}
    )

# BIEN
import uuid
import logging

@app.exception_handler(Exception)
async def global_handler(request, exc):
    error_id = str(uuid.uuid4())
    logging.exception(f"Unhandled error {error_id}")  # Stack trace en logs internos
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "error_id": error_id}
    )
```

### 3.3 Performance — Análisis de Complejidad y N+1

**R-P01: N+1 queries**
```python
# MAJOR — genera N+1 queries a la base de datos
def get_users_with_orders():
    users = db.query(User).all()  # 1 query
    result = []
    for user in users:
        orders = db.query(Order).filter(Order.user_id == user.id).all()  # N queries!
        result.append({"user": user, "orders": orders})
    return result

# BIEN — JOIN en una sola query
def get_users_with_orders():
    return (
        db.query(User)
        .options(joinedload(User.orders))  # 1 query con JOIN
        .all()
    )
```

**R-P02: Bucle dentro de bucle innecesario**
```python
# MAJOR — O(n²) donde cabe O(n)
def find_duplicates(items: list[str]) -> list[str]:
    duplicates = []
    for i, item in enumerate(items):
        for j, other in enumerate(items):  # O(n²)
            if i != j and item == other and item not in duplicates:
                duplicates.append(item)
    return duplicates

# BIEN — O(n) con Counter
from collections import Counter
def find_duplicates(items: list[str]) -> list[str]:
    counts = Counter(items)
    return [item for item, count in counts.items() if count > 1]
```

**R-P03: Carga de objetos innecesarios de BD**
```python
# MAJOR — trae 10.000 rows para contar
def get_active_user_count() -> int:
    users = db.query(User).filter(User.is_active == True).all()
    return len(users)  # Carga todos los objetos en memoria!

# BIEN — COUNT en base de datos
def get_active_user_count() -> int:
    return db.query(func.count(User.id)).filter(User.is_active == True).scalar()
```

**R-P04: Llamadas a API dentro de bucle**
```python
# MAJOR — N llamadas HTTP secuenciales
async def enrich_users(user_ids: list[str]) -> list[dict]:
    results = []
    for uid in user_ids:
        data = await external_api.get_user(uid)  # N llamadas secuenciales
        results.append(data)
    return results

# BIEN — llamadas concurrentes
async def enrich_users(user_ids: list[str]) -> list[dict]:
    return await asyncio.gather(*[
        external_api.get_user(uid) for uid in user_ids
    ])
```

**R-P05: String concatenation en bucle**
```python
# MINOR — O(n²) en strings por re-creación en cada iteración
def build_report(rows: list[str]) -> str:
    report = ""
    for row in rows:
        report += row + "\n"  # Crea nuevo string en cada iteración
    return report

# BIEN — join es O(n)
def build_report(rows: list[str]) -> str:
    return "\n".join(rows) + "\n"
```

**R-P06: Renderizado innecesario en React**
```typescript
// MAJOR — el componente re-renderiza cada vez que el padre renderiza
function UserCard({ userId }: { userId: string }) {
    const handleClick = () => {  // Nueva función en cada render
        console.log(userId);
    };
    
    const userConfig = {  // Nuevo objeto en cada render
        showAvatar: true,
        size: "large"
    };
    
    return <Card config={userConfig} onClick={handleClick} />;
}

// BIEN
function UserCard({ userId }: { userId: string }) {
    const handleClick = useCallback(() => {
        console.log(userId);
    }, [userId]);
    
    const userConfig = useMemo(() => ({
        showAvatar: true,
        size: "large" as const
    }), []);
    
    return <Card config={userConfig} onClick={handleClick} />;
}
```

### 3.4 Maintainability — SOLID y Patrones

**R-M01: God function (>50 líneas)**
```python
# MAJOR — función que hace todo
def process_order(order_data: dict):
    # Validación (20 líneas)
    if not order_data.get("user_id"):
        raise ValueError(...)
    user = db.get_user(order_data["user_id"])
    if not user.is_active:
        raise ValueError(...)
    # ... más validaciones
    
    # Cálculo de precio (15 líneas)
    subtotal = sum(item["price"] * item["qty"] for item in order_data["items"])
    discount = calculate_discount(user, subtotal)
    tax = calculate_tax(subtotal - discount)
    total = subtotal - discount + tax
    
    # Persistencia (10 líneas)
    order = Order(...)
    db.save(order)
    
    # Notificaciones (10 líneas)
    send_email(user.email, "Orden confirmada", ...)
    send_sms(user.phone, ...)

# BIEN — Single Responsibility
def process_order(order_data: dict):
    validated = validate_order(order_data)
    pricing = calculate_order_pricing(validated)
    order = save_order(validated, pricing)
    notify_order_created(order)
    return order
```

**R-M02: Magic numbers**
```python
# MINOR — números sin contexto
def calculate_timeout(attempts: int) -> float:
    return min(attempts * 2.5, 300)  # ¿Qué es 2.5? ¿Por qué 300?

# BIEN
BACKOFF_MULTIPLIER = 2.5  # segundos por intento fallido
MAX_TIMEOUT_SECONDS = 300  # 5 minutos máximo

def calculate_timeout(attempts: int) -> float:
    return min(attempts * BACKOFF_MULTIPLIER, MAX_TIMEOUT_SECONDS)
```

**R-M03: Condicionales anidados profundos (>3 niveles)**
```python
# MAJOR — arrow code imposible de mantener
def process(user, order, payment):
    if user:
        if user.is_active:
            if order:
                if order.status == "pending":
                    if payment:
                        if payment.is_valid():
                            # lógica real aquí, nivel 7
                            return True
    return False

# BIEN — Early return / Guard clauses
def process(user, order, payment) -> bool:
    if not user or not user.is_active:
        return False
    if not order or order.status != "pending":
        return False
    if not payment or not payment.is_valid():
        return False
    
    # Lógica real aquí, nivel 1
    return True
```

**R-M04: DRY violation (copy-paste)**
```python
# MAJOR — lógica duplicada
def validate_email(email: str) -> bool:
    if not email:
        return False
    if "@" not in email:
        return False
    parts = email.split("@")
    if len(parts) != 2:
        return False
    return True

def validate_admin_email(email: str) -> bool:
    if not email:         # Duplicado
        return False
    if "@" not in email:  # Duplicado
        return False
    parts = email.split("@")
    if len(parts) != 2:   # Duplicado
        return False
    return email.endswith("@empresa.com")  # Solo esto es diferente

# BIEN
def is_valid_email_format(email: str) -> bool:
    if not email or "@" not in email:
        return False
    return len(email.split("@")) == 2

def validate_email(email: str) -> bool:
    return is_valid_email_format(email)

def validate_admin_email(email: str) -> bool:
    return is_valid_email_format(email) and email.endswith("@empresa.com")
```

**R-M05: Dependencias hardcodeadas (violación DIP)**
```python
# MAJOR — el servicio crea su propia dependencia
class OrderService:
    def __init__(self):
        self.db = PostgreSQLDatabase()  # Imposible de testear ni cambiar
        self.email = SendGridEmailService()
    
    def create_order(self, data):
        order = self.db.save(data)
        self.email.send(...)

# BIEN — inyección de dependencias
class OrderService:
    def __init__(self, db: DatabaseProtocol, email: EmailServiceProtocol):
        self.db = db
        self.email = email
    
    def create_order(self, data):
        order = self.db.save(data)
        self.email.send(...)

# En tests:
service = OrderService(db=FakeDatabase(), email=MockEmailService())
```

### 3.5 Error Handling

**R-E01: Bare except / Exception genérica**
```python
# MAJOR — silencia todos los errores, incluyendo bugs reales
try:
    result = process_data(data)
except:  # Captura incluso KeyboardInterrupt, SystemExit
    pass

# BIEN
try:
    result = process_data(data)
except ValueError as e:
    logger.warning(f"Invalid data format: {e}")
    return default_result
except NetworkError as e:
    logger.error(f"Network failure: {e}")
    raise RetryableError("Network unavailable") from e
```

**R-E02: Error swallowing**
```python
# BLOCKER — silencia errores sin registrar ni propagar
def save_user(user: dict):
    try:
        db.insert(user)
    except Exception:
        pass  # El error desaparece silenciosamente

# BIEN
def save_user(user: dict):
    try:
        db.insert(user)
    except IntegrityError as e:
        logger.error(f"Duplicate user: {user.get('email')}", exc_info=True)
        raise UserAlreadyExistsError(f"Email {user['email']} ya registrado") from e
    except DatabaseError as e:
        logger.critical(f"Database error saving user: {e}", exc_info=True)
        raise  # Re-lanzar errores inesperados
```

**R-E03: Mensajes de error sin contexto**
```python
# MINOR — mensaje inútil para debugging
raise ValueError("Error de validación")

# BIEN
raise ValueError(
    f"El campo 'amount' debe ser positivo. "
    f"Valor recibido: {amount} (tipo: {type(amount).__name__})"
)
```

### 3.6 Testability

**R-T01: Funciones impuras difíciles de testear**
```python
# MAJOR — usa datetime.now() directamente, imposible de testear con fechas específicas
def is_subscription_expired(user_id: int) -> bool:
    user = db.get_user(user_id)
    return user.subscription_end < datetime.now()  # datetime.now() no controlable

# BIEN — inyectar la dependencia de tiempo
from datetime import datetime
def is_subscription_expired(
    user_id: int,
    db: DatabaseProtocol,
    now: datetime | None = None
) -> bool:
    if now is None:
        now = datetime.utcnow()
    user = db.get_user(user_id)
    return user.subscription_end < now

# En tests:
def test_expired_subscription():
    past_date = datetime(2020, 1, 1)
    assert is_subscription_expired(user_id=1, db=fake_db, now=datetime(2021, 1, 1))
```

**R-T02: Funciones que hacen demasiado para testear**
```typescript
// MAJOR — mezcla lógica de negocio con I/O, difícil de testear
async function processAndSaveReport(userId: string): Promise<void> {
    const data = await fetchUserData(userId);  // I/O
    const filtered = data.filter(d => d.active);  // Lógica pura
    const aggregated = filtered.reduce((acc, d) => acc + d.value, 0);  // Lógica pura
    await saveToDatabase({ userId, total: aggregated });  // I/O
    await sendEmailNotification(userId, aggregated);  // I/O
}

// BIEN — separar lógica pura (testeable) de efectos secundarios (mockeable)
export function aggregateActiveData(data: DataItem[]): number {
    return data.filter(d => d.active).reduce((acc, d) => acc + d.value, 0);
}

async function processAndSaveReport(
    userId: string,
    deps: { fetch: typeof fetchUserData, save: typeof saveToDatabase, notify: typeof sendEmailNotification }
): Promise<void> {
    const data = await deps.fetch(userId);
    const total = aggregateActiveData(data);  // Pura, testeable independientemente
    await deps.save({ userId, total });
    await deps.notify(userId, total);
}
```

---

## 4. Language-Specific Patterns

### 4.1 Python — Patrones específicos

**Python-1: Usar type hints completos**
```python
# MINOR — sin type hints
def calculate_discount(user, order):
    ...

# BIEN
from typing import Optional
def calculate_discount(user: User, order: Order) -> Optional[Decimal]:
    ...
```

**Python-2: Dataclasses vs dicts**
```python
# MINOR — dict sin estructura
def create_user_config() -> dict:
    return {"timeout": 30, "retries": 3, "debug": False}

# BIEN — dataclass con types
from dataclasses import dataclass, field

@dataclass(frozen=True)  # Inmutable por defecto
class UserConfig:
    timeout: int = 30
    retries: int = 3
    debug: bool = False
```

**Python-3: Context managers para recursos**
```python
# MAJOR — recurso que puede no cerrarse si hay excepción
file = open("data.csv")
data = file.read()
file.close()  # No se ejecuta si read() lanza excepción

# BIEN
with open("data.csv") as file:
    data = file.read()  # Siempre se cierra
```

**Python-4: Generators vs listas en procesamiento grande**
```python
# MAJOR — carga todo en memoria
def get_all_transactions() -> list[dict]:
    return [process(t) for t in db.query_all_transactions()]  # OOM si hay millones

# BIEN — generator
def get_all_transactions():
    for transaction in db.query_all_transactions():
        yield process(transaction)  # Procesa de a uno
```

**Python-5: Avoid mutable default arguments**
```python
# BLOCKER — bug clásico de Python
def add_item(item: str, items: list = []) -> list:
    items.append(item)  # La lista [] persiste entre llamadas!
    return items

# BIEN
def add_item(item: str, items: list | None = None) -> list:
    if items is None:
        items = []
    items.append(item)
    return items
```

### 4.2 TypeScript — Patrones específicos

**TS-1: Evitar `any` — usar `unknown`**
```typescript
// MAJOR — any elimina toda protección de tipos
function parseResponse(data: any) {
    return data.user.name;  // Runtime error si estructura es diferente
}

// BIEN
function parseResponse(data: unknown): string {
    if (!isUserResponse(data)) {
        throw new Error("Invalid response structure");
    }
    return data.user.name;
}

function isUserResponse(data: unknown): data is { user: { name: string } } {
    return typeof data === "object" && data !== null &&
           "user" in data && typeof (data as any).user?.name === "string";
}
```

**TS-2: Discriminated unions para state management**
```typescript
// MINOR — estado como booleanos separados, inconsistente
interface FetchState {
    loading: boolean;
    error: string | null;
    data: User | null;
}
// Permite estados imposibles: loading=true y data=User al mismo tiempo

// BIEN — estado como union discriminada
type FetchState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; error: string }
    | { status: "success"; data: User };
// Cada estado es exclusivo y completo
```

**TS-3: Strict null checks obligatorios**
```typescript
// BLOCKER sin strict: null reference que TypeScript no detecta
// tsconfig.json debe tener:
{
    "compilerOptions": {
        "strict": true,  // Incluye strictNullChecks
        "noUncheckedIndexedAccess": true  // arr[0] es T | undefined, no T
    }
}
```

**TS-4: Generics en vez de overloads repetitivos**
```typescript
// MINOR — duplicación
function getFirstNumber(arr: number[]): number | undefined { return arr[0]; }
function getFirstString(arr: string[]): string | undefined { return arr[0]; }

// BIEN
function getFirst<T>(arr: T[]): T | undefined { return arr[0]; }
```

### 4.3 SQL — Patrones específicos

**SQL-1: SELECT * en código de aplicación**
```sql
-- MAJOR — trae columnas innecesarias, rompe si cambia el schema
SELECT * FROM users WHERE id = $1;

-- BIEN — columnas explícitas
SELECT id, email, name, created_at FROM users WHERE id = $1;
```

**SQL-2: Índices faltantes en filtros frecuentes**
```sql
-- MAJOR — full table scan en tabla de millones de rows
SELECT * FROM orders WHERE user_id = $1 AND status = 'pending';
-- Verificar: EXPLAIN ANALYZE SELECT...
-- Si muestra Seq Scan en tabla grande → índice necesario

-- Crear índice compuesto:
CREATE INDEX CONCURRENTLY idx_orders_user_status
ON orders (user_id, status)
WHERE status IN ('pending', 'processing');  -- Partial index, más eficiente
```

**SQL-3: N+1 en ORM**
```python
# MAJOR — SQLAlchemy lazy loading = N+1 queries
orders = db.query(Order).all()
for order in orders:
    print(order.user.name)  # Query adicional por cada order!

# BIEN
orders = db.query(Order).options(joinedload(Order.user)).all()
```

**SQL-4: Transacciones sin rollback explícito**
```python
# MAJOR — si la segunda operación falla, la primera ya se commitió
db.execute("UPDATE accounts SET balance = balance - 100 WHERE id = 1")
db.execute("UPDATE accounts SET balance = balance + 100 WHERE id = 2")
db.commit()

# BIEN
try:
    with db.begin():
        db.execute("UPDATE accounts SET balance = balance - 100 WHERE id = 1")
        db.execute("UPDATE accounts SET balance = balance + 100 WHERE id = 2")
        # Commit automático al salir del with, rollback si hay excepción
except Exception:
    db.rollback()
    raise
```

---

## 5. PR Review Workflow

### 5.1 Proceso completo de review en 6 pasos

```
PASO 1 — CONTEXTO (5 min)
- Lee la descripción del PR
- Entiende el problema que resuelve
- Identifica los archivos de mayor riesgo

PASO 2 — ARQUITECTURA (10 min)
- ¿El cambio encaja en la arquitectura existente?
- ¿Introduce nuevas dependencias? ¿Son necesarias?
- ¿Afecta contratos de API o interfaces públicas?

PASO 3 — LÓGICA (20 min)
- Revisa cada función/método por correctness
- Verifica edge cases y null handling
- Comprueba manejo de errores

PASO 4 — SEGURIDAD (10 min)
- Input validation presente en todos los endpoints
- No hay secrets hardcodeados
- Permisos verificados correctamente

PASO 5 — TESTS (10 min)
- ¿Los tests cubren el happy path?
- ¿Los tests cubren al menos 2 edge cases?
- ¿Los tests son mantenibles y legibles?

PASO 6 — FEEDBACK (10 min)
- Clasifica todos los comentarios por severidad
- Agrupa comentarios similares
- Da un veredicto claro: APPROVE / REQUEST CHANGES / COMMENT
```

### 5.2 Decisión de veredicto

```
APPROVE: Todos los BLOCKERS resueltos, MAJORs son opcionales o resueltos
REQUEST CHANGES: Hay al menos 1 BLOCKER o 3+ MAJORs
COMMENT: Solo tienes observaciones, no necesita cambios para mergear
```

---

## 6. Templates de Comentarios de Review

### 6.1 BLOCKER — Bug de lógica
```markdown
🚫 **BLOCKER — Logic Error**

Esta función falla cuando `{condición_de_borde}` porque `{razón}`.

**Reproducir:**
```python
result = function_name({valores_que_causan_el_bug})
# Lanza: {error_message}
# Esperado: {comportamiento_correcto}
```

**Fix:**
```python
{código_corregido}
```
```

### 6.2 BLOCKER — Seguridad
```markdown
🚫 **BLOCKER — Security: {tipo_de_vulnerabilidad}**

La línea {N} es vulnerable a {ataque} porque {razón}.

**Vector de ataque:**
```
{ejemplo_de_input_malicioso}
```

**Impacto potencial:** {descripción del daño}

**Fix obligatorio:**
```{language}
{código_seguro}
```

Referencias: OWASP {link_específico}
```

### 6.3 MAJOR — Performance
```markdown
⚠️ **MAJOR — Performance: N+1 Query**

Este bucle genera {N} queries adicionales donde N = número de {entidad}.
Con 1000 {entidad}s → 1001 queries = ~{tiempo_estimado}ms extra.

**Solución:** Usar `joinedload` o un JOIN explícito:
```python
{código_optimizado}
```
```

### 6.4 MINOR — Sugerencia
```markdown
💡 **MINOR — Suggestion**

Podrías usar `{alternativa}` aquí para ser más idiomático:

```python
# Actual
{código_actual}

# Alternativa (equivalente, más Pythónico)
{código_sugerido}
```

No es obligatorio cambiar, queda a tu criterio.
```

### 6.5 NIT — Detalle menor
```markdown
🔹 **NIT**

Typo: `{typo}` → `{corrección}`
(o: Naming: sugiero `{nuevo_nombre}` para mayor claridad)
```

### 6.6 Comentario positivo (importante incluirlos)
```markdown
✅ Buen manejo del caso {X} aquí. El uso de {patrón/técnica} es exactamente correcto.
```

---

## 7. Automated Review Protocol

Antes del review manual, verifica automáticamente:

### 7.1 Python
```bash
# Type checking
mypy src/ --strict

# Linting
ruff check src/
flake8 src/ --max-line-length 88

# Security scan (SAST)
bandit -r src/ -ll  # Solo HIGH y MEDIUM severity

# Dependencias vulnerables
pip-audit

# Complejidad ciclomática
radon cc src/ -n B  # Funciones con complejidad > B
```

### 7.2 TypeScript
```bash
# Type checking estricto
npx tsc --noEmit --strict

# Linting
npx eslint src/ --ext .ts,.tsx

# Security
npm audit --audit-level=moderate

# Bundle size (para frontends)
npx bundlesize

# Tests con coverage
npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
```

### 7.3 SQL
```bash
# Verificar que las queries usan índices
EXPLAIN ANALYZE {query};
# Buscar: Seq Scan en tablas > 10k rows

# pg_stat_statements para queries lentas en producción
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

---

## 8. Architecture Review

Cuando el PR toca más de 3 archivos o introduce nuevos módulos:

### 8.1 Preguntas de arquitectura
```
1. ¿Este cambio respeta los límites de responsabilidad de cada módulo?
2. ¿Las dependencias van en la dirección correcta? (dominio → infraestructura, no al revés)
3. ¿Se introducen dependencias circulares?
4. ¿El contrato de la API pública cambia? ¿Es backward compatible?
5. ¿La base de datos necesita nuevos índices para las queries generadas?
6. ¿El cambio es thread-safe en el contexto async del proyecto?
7. ¿Se considera el caso de rollback si la feature falla en producción?
```

### 8.2 Detectar violaciones de capas
```python
# BLOCKER — la capa de presentación accede directamente a la BD
# routes/orders.py
@app.get("/orders/{id}")
async def get_order(id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == id).first()  # DB access en route!
    return order

# BIEN — route llama a service, service accede a repositorio
@app.get("/orders/{id}")
async def get_order(id: int, service: OrderService = Depends()):
    return await service.get_order(id)
```

---

## 9. Test Coverage Review

### 9.1 Qué testear (prioridad)

| Prioridad | Qué testear |
|-----------|-------------|
| P1 - Crítico | Lógica de negocio core, cálculos financieros, seguridad |
| P2 - Alto | Edge cases de las funciones P1, manejo de errores |
| P3 - Medio | Integración entre servicios, flujos completos |
| P4 - Bajo | UI, formateo, código trivial |

### 9.2 Checklist de tests

```
□ Happy path — el flujo principal funciona
□ Null/empty inputs — qué pasa con inputs vacíos o None
□ Boundary values — límites inferior y superior
□ Error cases — excepciones se lanzan/manejan correctamente
□ Concurrencia — si aplica, prueba con múltiples coroutines
□ Datos reales — fixtures basadas en datos reales de producción anonimizados
```

### 9.3 Tests mal escritos (anti-patterns)

```python
# MAJOR — test que no testea nada real
def test_create_user():
    user = create_user("john@example.com", "password")
    assert user is not None  # Esto siempre pasa si no hay excepción

# BIEN
def test_create_user_returns_correct_data():
    user = create_user("john@example.com", "password123")
    assert user.email == "john@example.com"
    assert user.id is not None
    assert user.created_at is not None
    # Verificar que la password NO está en texto plano
    assert user.password_hash != "password123"
    assert len(user.password_hash) > 50  # Está hasheada

def test_create_user_rejects_duplicate_email():
    create_user("john@example.com", "pass1")
    with pytest.raises(UserAlreadyExistsError):
        create_user("john@example.com", "pass2")

def test_create_user_rejects_invalid_email():
    with pytest.raises(ValidationError):
        create_user("not-an-email", "pass")
```

---

## 50+ Reglas Adicionales de Review Rápido

### Correctness
- R-C07: Verificar que los locks se liberan siempre (usar context managers)
- R-C08: Verificar overflow en operaciones aritméticas con enteros grandes
- R-C09: Verificar orden de operaciones en cálculos financieros (usar Decimal)
- R-C10: Verificar que los índices de arrays no están fuera de rango
- R-C11: Verificar que los regex están compilados (re.compile) si se usan en bucles
- R-C12: Verificar encoding correcto en strings (UTF-8 por defecto)

### Security
- R-S08: Verificar que las cookies tienen Secure, HttpOnly, SameSite=Strict
- R-S09: Verificar que los JWTs tienen expiración (exp claim)
- R-S10: Verificar que los tokens de reset de password expiran en < 24h
- R-S11: Verificar que los file uploads validan tipo MIME, no solo extensión
- R-S12: Verificar que los rate limits están en endpoints de auth
- R-S13: Verificar que los admin endpoints verifican rol, no solo autenticación
- R-S14: Verificar que no hay CORS con `*` en producción
- R-S15: Verificar que las respuestas de error no incluyen stack traces

### Performance
- R-P07: Verificar que las imágenes en frontend están optimizadas (WebP, lazy loading)
- R-P08: Verificar que los endpoints de lista tienen paginación
- R-P09: Verificar que los cálculos pesados no están en el thread principal
- R-P10: Verificar que hay caché en datos que no cambian frecuentemente
- R-P11: Verificar que las conexiones de BD se retornan al pool (usar context managers)

### Maintainability
- R-M06: Verificar que los nombres de variables son descriptivos (no x, y, tmp)
- R-M07: Verificar que las funciones tienen docstrings si son parte de API pública
- R-M08: Verificar que los TODO tienen un issue/ticket asociado
- R-M09: Verificar que el código comentado (dead code) está eliminado
- R-M10: Verificar que las constantes están centralizadas, no esparcidas

### TypeScript Específico
- R-TS05: Verificar que los enums no-const son necesarios (preferir union types)
- R-TS06: Verificar que los interfaces tienen nombres descriptivos sin "I" prefix
- R-TS07: Verificar que los generics tienen nombres descriptivos (T → TUser, no T)
- R-TS08: Verificar que los hooks no violan las reglas de hooks (condicionales, loops)
- R-TS09: Verificar que useEffect tiene dependency array correcto

### React Específico
- R-R01: Verificar que los keys en listas no son índices del array
- R-R02: Verificar que los estados derivados no están en useState (usar useMemo)
- R-R03: Verificar que los efectos secundarios están en useEffect, no en render
- R-R04: Verificar que los componentes grandes están memoizados (React.memo)
- R-R05: Verificar que los formularios usan controlled components

### API Design
- R-A01: Verificar que los endpoints siguen REST semánticamente
- R-A02: Verificar que los status codes son correctos (201 para POST, 204 para DELETE)
- R-A03: Verificar que los errores tienen un schema de error consistente
- R-A04: Verificar que la paginación usa cursor, no offset, en datasets grandes
- R-A05: Verificar que los endpoints idempotentes permiten re-envío seguro

---

## Resumen Ejecutivo para PR Review Rápido (< 5 min)

```
CHECKLIST RÁPIDO:
□ ¿El PR tiene descripción y link a ticket?
□ ¿Los tests existen y pasan?
□ ¿Hay secrets hardcodeados? (busca: api_key, password, secret, token = "...)
□ ¿Hay inputs de usuario sin validar?
□ ¿Hay bucles con queries a BD?
□ ¿El manejo de errores es específico (no bare except)?
□ ¿Los nombres son descriptivos?
□ ¿El PR tiene scope razonable (< 400 líneas cambiadas)?

Si todo es ✓ → APPROVE con nota
Si hay dudas → REQUEST CHANGES con comentarios clasificados
```
