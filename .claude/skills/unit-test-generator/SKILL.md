# Unit Test Generator

Skill especializado en generación de tests completos, realistas y mantenibles. Cubre Python/pytest, TypeScript/Vitest + Testing Library, y NestJS/Jest.

---

## Filosofia de Testing

### Qué testear (y qué NO)

**Testear:**
- Comportamiento observable desde afuera (inputs → outputs)
- Contratos de API (qué acepta, qué devuelve, qué status codes)
- Reglas de negocio críticas
- Casos límite y edge cases (null, vacío, valores extremos)
- Flujos de error y manejo de excepciones
- Autenticación y autorización

**NO testear:**
- Implementación interna (nombres de variables, orden de llamadas internas)
- Librerías de terceros (ya tienen sus propios tests)
- Getters/setters triviales sin lógica
- Código generado automáticamente
- Detalles de UI que cambian frecuentemente sin lógica de negocio

### Principio Fundamental

```
Un test que pasa cuando el código está roto, o falla cuando el código está correcto,
es PEOR que no tener test.
```

Escribe tests que:
1. **Fallen por las razones correctas** — si el comportamiento cambia, el test falla
2. **Sean legibles** — otro dev debe entender qué está testeando
3. **Sean independientes** — no dependan del orden de ejecución ni de otros tests
4. **Sean rápidos** — un suite lento no se ejecuta

---

## Testing Pyramid

```
         /\
        /  \
       / E2E \ ← Pocos, lentos, caros. Testean flujos completos
      /--------\
     /Integration\ ← Moderados. Testean módulos con dependencias reales
    /------------\
   /  Unit Tests  \ ← Muchos, rápidos, baratos. Testean unidades aisladas
  /________________\
```

**Distribución recomendada:**
- 70% Unit tests
- 20% Integration tests
- 10% E2E tests

**Coverage objetivo:** 80% como mínimo. 100% es contraproducente — enfocarse en cobertura de comportamiento, no de líneas.

---

## Python / pytest

### Setup inicial

```bash
# Instalación
pip install pytest pytest-asyncio pytest-mock pytest-cov httpx

# Estructura de proyecto
tests/
├── conftest.py          # Fixtures globales y configuración
├── factories/           # Fábricas de datos de test
│   ├── __init__.py
│   └── user_factory.py
├── unit/
│   ├── __init__.py
│   ├── test_auth_service.py
│   └── test_risk_service.py
├── integration/
│   ├── __init__.py
│   └── test_auth_endpoints.py
└── e2e/
    └── test_trading_flow.py
```

### pytest.ini / pyproject.toml

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
addopts = "-v --tb=short --cov=src --cov-report=term-missing --cov-fail-under=80"

[tool.coverage.run]
omit = [
    "tests/*",
    "src/migrations/*",
    "src/main.py",     # entry point, tested via integration
]
```

### conftest.py — Fixtures Globales

```python
# tests/conftest.py
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from src.main import app
from src.database.connection import get_db
from src.config.settings import get_settings


# ─── Database Fixtures ────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """In-memory SQLite engine for tests (or test PostgreSQL)."""
    settings = get_settings()
    engine = create_async_engine(
        settings.DATABASE_URL_TEST,
        echo=False,
    )
    # Create all tables
    async with engine.begin() as conn:
        from src.models import Base
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Isolated database session per test with rollback."""
    async_session = async_sessionmaker(test_engine, expire_on_commit=False)
    
    async with test_engine.begin() as connection:
        await connection.begin_nested()
        async with async_sessionmaker(
            connection, expire_on_commit=False
        )() as session:
            yield session
            await session.rollback()


# ─── HTTP Client Fixtures ─────────────────────────────────────────────────────

@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Test HTTP client with database override."""
    
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()


# ─── Auth Fixtures ────────────────────────────────────────────────────────────

@pytest.fixture
def mock_user():
    """Default test user."""
    return {
        "id": "test-user-123",
        "email": "test@example.com",
        "username": "testuser",
        "is_active": True,
        "role": "user",
    }


@pytest.fixture
def admin_user():
    """Admin test user."""
    return {
        "id": "admin-user-456",
        "email": "admin@example.com",
        "username": "adminuser",
        "is_active": True,
        "role": "admin",
    }


@pytest.fixture
async def auth_headers(client: AsyncClient, mock_user: dict) -> dict:
    """Get auth headers by logging in."""
    response = await client.post("/api/auth/login", json={
        "email": mock_user["email"],
        "password": "testpassword123",
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_auth_token():
    """Static JWT for unit tests (no real auth)."""
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"
```

### Factories — Generadores de Datos

```python
# tests/factories/user_factory.py
from dataclasses import dataclass, field
from typing import Optional
import uuid


@dataclass
class UserFactory:
    """Factory para crear usuarios de test."""
    
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    email: str = field(default_factory=lambda: f"user_{uuid.uuid4().hex[:8]}@test.com")
    username: str = field(default_factory=lambda: f"user_{uuid.uuid4().hex[:8]}")
    password_hash: str = "$2b$12$test_hash_value"
    is_active: bool = True
    role: str = "user"
    
    @classmethod
    def create(cls, **overrides) -> "UserFactory":
        """Create user with optional overrides."""
        return cls(**overrides)
    
    @classmethod
    def create_admin(cls, **overrides) -> "UserFactory":
        return cls(role="admin", **overrides)
    
    @classmethod
    def create_inactive(cls, **overrides) -> "UserFactory":
        return cls(is_active=False, **overrides)
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "is_active": self.is_active,
            "role": self.role,
        }


# tests/factories/order_factory.py
from decimal import Decimal
import uuid


class OrderFactory:
    """Factory para órdenes de trading."""
    
    @staticmethod
    def create_market_buy(
        symbol: str = "BTCUSDT",
        quantity: Decimal = Decimal("0.01"),
        user_id: str = None,
    ) -> dict:
        return {
            "id": str(uuid.uuid4()),
            "symbol": symbol,
            "side": "BUY",
            "type": "MARKET",
            "quantity": str(quantity),
            "status": "PENDING",
            "user_id": user_id or str(uuid.uuid4()),
        }
    
    @staticmethod
    def create_limit_sell(
        symbol: str = "BTCUSDT",
        quantity: Decimal = Decimal("0.01"),
        price: Decimal = Decimal("50000"),
    ) -> dict:
        return {
            "id": str(uuid.uuid4()),
            "symbol": symbol,
            "side": "SELL",
            "type": "LIMIT",
            "quantity": str(quantity),
            "price": str(price),
            "status": "PENDING",
        }
```

### Tests de Endpoint FastAPI — Ejemplo Completo

```python
# tests/integration/test_auth_endpoints.py
"""
Tests para /api/auth/* endpoints.
Cubre: registro, login, refresh, logout, validación.
"""
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from tests.factories.user_factory import UserFactory


class TestRegisterEndpoint:
    """POST /api/auth/register"""
    
    async def test_register_happy_path(self, client: AsyncClient):
        """Usuario nuevo puede registrarse con datos válidos."""
        payload = {
            "email": "newuser@test.com",
            "username": "newuser",
            "password": "SecurePass123!",
        }
        
        response = await client.post("/api/auth/register", json=payload)
        
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == payload["email"]
        assert data["username"] == payload["username"]
        assert "password" not in data  # nunca exponer password
        assert "id" in data
    
    async def test_register_duplicate_email_returns_409(self, client: AsyncClient):
        """Registrar con email duplicado retorna 409 Conflict."""
        payload = {
            "email": "existing@test.com",
            "username": "newuser1",
            "password": "SecurePass123!",
        }
        
        # Primer registro
        await client.post("/api/auth/register", json=payload)
        
        # Segundo registro con mismo email
        payload["username"] = "differentuser"
        response = await client.post("/api/auth/register", json=payload)
        
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()
    
    @pytest.mark.parametrize("invalid_payload,expected_status,error_field", [
        ({"email": "notanemail", "username": "u", "password": "Pass123!"}, 422, "email"),
        ({"email": "valid@test.com", "username": "", "password": "Pass123!"}, 422, "username"),
        ({"email": "valid@test.com", "username": "user", "password": "weak"}, 422, "password"),
        ({}, 422, None),  # Missing all fields
    ])
    async def test_register_invalid_payload(
        self, client: AsyncClient, invalid_payload: dict,
        expected_status: int, error_field: str
    ):
        """Payloads inválidos retornan 422 Unprocessable Entity."""
        response = await client.post("/api/auth/register", json=invalid_payload)
        assert response.status_code == expected_status


class TestLoginEndpoint:
    """POST /api/auth/login"""
    
    async def test_login_returns_jwt_tokens(self, client: AsyncClient, mock_user: dict):
        """Login exitoso retorna access_token y refresh_token."""
        response = await client.post("/api/auth/login", json={
            "email": mock_user["email"],
            "password": "testpassword123",
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
    
    async def test_login_wrong_password_returns_401(self, client: AsyncClient, mock_user: dict):
        """Contraseña incorrecta retorna 401."""
        response = await client.post("/api/auth/login", json={
            "email": mock_user["email"],
            "password": "wrongpassword",
        })
        
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid credentials"
    
    async def test_login_nonexistent_user_returns_401(self, client: AsyncClient):
        """Usuario inexistente retorna 401 (no 404, para no revelar info)."""
        response = await client.post("/api/auth/login", json={
            "email": "ghost@test.com",
            "password": "somepassword",
        })
        
        assert response.status_code == 401
    
    async def test_login_inactive_user_returns_403(self, client: AsyncClient):
        """Usuario inactivo no puede hacer login."""
        response = await client.post("/api/auth/login", json={
            "email": "inactive@test.com",
            "password": "testpassword123",
        })
        
        assert response.status_code == 403


class TestProtectedEndpoints:
    """Tests para endpoints que requieren autenticación."""
    
    async def test_access_protected_without_token_returns_401(self, client: AsyncClient):
        """Sin token, los endpoints protegidos retornan 401."""
        response = await client.get("/api/portfolio/summary")
        assert response.status_code == 401
    
    async def test_access_protected_with_invalid_token_returns_401(self, client: AsyncClient):
        """Token inválido retorna 401."""
        response = await client.get(
            "/api/portfolio/summary",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert response.status_code == 401
    
    async def test_access_protected_with_valid_token(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Token válido permite acceso a endpoints protegidos."""
        response = await client.get("/api/portfolio/summary", headers=auth_headers)
        assert response.status_code == 200
```

### Tests de Servicios con Mocks

```python
# tests/unit/test_auth_service.py
"""
Tests unitarios para AuthService.
Mockeamos el repositorio para aislar la lógica de negocio.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta

from src.services.auth_service import AuthService
from src.schemas.auth import LoginRequest, RegisterRequest
from src.exceptions import InvalidCredentialsError, UserAlreadyExistsError


@pytest.fixture
def mock_user_repository():
    """Mock del UserRepository."""
    repo = AsyncMock()
    repo.find_by_email = AsyncMock(return_value=None)
    repo.find_by_id = AsyncMock(return_value=None)
    repo.create = AsyncMock()
    repo.update = AsyncMock()
    return repo


@pytest.fixture
def auth_service(mock_user_repository):
    """AuthService con dependencias mockeadas."""
    return AuthService(
        user_repository=mock_user_repository,
        secret_key="test-secret-key",
        algorithm="HS256",
        access_token_expire_minutes=30,
    )


class TestAuthServiceLogin:
    """Tests para AuthService.login()"""
    
    async def test_login_returns_tokens_for_valid_credentials(
        self, auth_service: AuthService, mock_user_repository: AsyncMock
    ):
        """Login con credenciales válidas retorna access y refresh token."""
        # Arrange
        from tests.factories.user_factory import UserFactory
        user = UserFactory.create()
        
        mock_user_repository.find_by_email.return_value = user
        
        with patch("src.services.auth_service.verify_password", return_value=True):
            # Act
            result = await auth_service.login(
                LoginRequest(email=user.email, password="validpassword")
            )
        
        # Assert
        assert result.access_token is not None
        assert result.refresh_token is not None
        assert result.token_type == "bearer"
    
    async def test_login_raises_for_wrong_password(
        self, auth_service: AuthService, mock_user_repository: AsyncMock
    ):
        """Login con contraseña incorrecta lanza InvalidCredentialsError."""
        from tests.factories.user_factory import UserFactory
        user = UserFactory.create()
        mock_user_repository.find_by_email.return_value = user
        
        with patch("src.services.auth_service.verify_password", return_value=False):
            with pytest.raises(InvalidCredentialsError):
                await auth_service.login(
                    LoginRequest(email=user.email, password="wrongpassword")
                )
    
    async def test_login_raises_for_nonexistent_user(
        self, auth_service: AuthService, mock_user_repository: AsyncMock
    ):
        """Login con usuario inexistente lanza InvalidCredentialsError (no UserNotFound)."""
        mock_user_repository.find_by_email.return_value = None
        
        with pytest.raises(InvalidCredentialsError):
            await auth_service.login(
                LoginRequest(email="ghost@test.com", password="anypassword")
            )
    
    async def test_login_calls_find_by_email_once(
        self, auth_service: AuthService, mock_user_repository: AsyncMock
    ):
        """Login consulta el repositorio exactamente una vez."""
        mock_user_repository.find_by_email.return_value = None
        
        try:
            await auth_service.login(
                LoginRequest(email="ghost@test.com", password="any")
            )
        except InvalidCredentialsError:
            pass
        
        mock_user_repository.find_by_email.assert_called_once_with("ghost@test.com")


class TestAuthServiceRegister:
    """Tests para AuthService.register()"""
    
    @pytest.mark.parametrize("email", [
        "user@example.com",
        "user+tag@example.co.uk",
        "user.name@subdomain.example.com",
    ])
    async def test_register_accepts_valid_emails(
        self, auth_service: AuthService, mock_user_repository: AsyncMock, email: str
    ):
        """Register acepta emails válidos en múltiples formatos."""
        mock_user_repository.find_by_email.return_value = None
        
        result = await auth_service.register(
            RegisterRequest(email=email, username="validuser", password="SecurePass123!")
        )
        
        assert result.email == email
    
    async def test_register_raises_for_existing_email(
        self, auth_service: AuthService, mock_user_repository: AsyncMock
    ):
        """Register con email existente lanza UserAlreadyExistsError."""
        from tests.factories.user_factory import UserFactory
        existing_user = UserFactory.create(email="existing@test.com")
        mock_user_repository.find_by_email.return_value = existing_user
        
        with pytest.raises(UserAlreadyExistsError):
            await auth_service.register(
                RegisterRequest(
                    email="existing@test.com",
                    username="newusername",
                    password="SecurePass123!",
                )
            )
    
    async def test_register_hashes_password(
        self, auth_service: AuthService, mock_user_repository: AsyncMock
    ):
        """Register nunca guarda la contraseña en texto plano."""
        mock_user_repository.find_by_email.return_value = None
        
        plain_password = "MyPlainPassword123!"
        await auth_service.register(
            RegisterRequest(
                email="new@test.com",
                username="newuser",
                password=plain_password,
            )
        )
        
        # Verificar que lo guardado en el repo no es la contraseña plana
        call_args = mock_user_repository.create.call_args
        saved_user = call_args[0][0]
        assert saved_user.password_hash != plain_password
        assert len(saved_user.password_hash) > 20  # Es un hash
```

### pytest-asyncio y configuración async

```python
# Modo 1: Decorador por test
@pytest.mark.asyncio
async def test_something():
    result = await some_async_function()
    assert result == expected

# Modo 2: asyncio_mode = "auto" en pytest.ini (recomendado)
# Todos los tests async se ejecutan automáticamente sin decorador

# Modo 3: Fixture async
@pytest.fixture
async def my_fixture():
    client = await create_client()
    yield client
    await client.close()
```

---

## TypeScript / Vitest + Testing Library

### Setup inicial

```bash
# Instalación para proyecto Vite/React
npm install -D vitest @vitest/ui jsdom
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm install -D msw  # Mock Service Worker para API mocking

# vitest.config.ts
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

### Setup global de tests

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { server } from './mocks/server';

// Limpiar DOM entre tests
afterEach(() => {
  cleanup();
});

// MSW server lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock global de localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock de window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

### MSW — Mock Service Worker para APIs

```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // GET /api/portfolio/summary
  http.get('/api/portfolio/summary', () => {
    return HttpResponse.json({
      totalValue: 10333.50,
      totalPnl: 233.50,
      totalPnlPercent: 2.31,
      positions: [],
    });
  }),
  
  // POST /api/auth/login
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    
    if (body.email === 'test@example.com' && body.password === 'validpassword') {
      return HttpResponse.json({
        access_token: 'mock-jwt-token-12345',
        refresh_token: 'mock-refresh-token-67890',
        token_type: 'bearer',
      });
    }
    
    return HttpResponse.json(
      { detail: 'Invalid credentials' },
      { status: 401 }
    );
  }),
  
  // Error handler para simular fallos de red
  http.get('/api/orders', () => {
    return HttpResponse.error();
  }),
];

// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Testing React Components — Ejemplo Completo

```typescript
// src/components/__tests__/LoginForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';
import { AuthContext } from '@/contexts/AuthContext';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

// Helper para renderizar con contexto
function renderLoginForm(authContextValue = {}) {
  const defaultContext = {
    login: vi.fn(),
    logout: vi.fn(),
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    ...authContextValue,
  };
  
  return {
    ...render(
      <AuthContext.Provider value={defaultContext}>
        <LoginForm />
      </AuthContext.Provider>
    ),
    mockLogin: defaultContext.login,
  };
}

describe('LoginForm', () => {
  const user = userEvent.setup();
  
  describe('Rendering', () => {
    it('renders email and password inputs', () => {
      renderLoginForm();
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });
    
    it('shows loading state while submitting', async () => {
      const { mockLogin } = renderLoginForm();
      mockLogin.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );
      
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      
      expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
    });
  });
  
  describe('Form validation', () => {
    it('shows error for invalid email format', async () => {
      renderLoginForm();
      
      await user.type(screen.getByLabelText(/email/i), 'notanemail');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      
      expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
    });
    
    it('shows error for empty password', async () => {
      renderLoginForm();
      
      await user.type(screen.getByLabelText(/email/i), 'valid@test.com');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      
      expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    });
  });
  
  describe('Successful login', () => {
    it('calls login with email and password', async () => {
      const { mockLogin } = renderLoginForm();
      
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'validpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'validpassword',
        });
      });
    });
  });
  
  describe('Failed login', () => {
    it('shows error message on invalid credentials', async () => {
      // Override handler para este test específico
      server.use(
        http.post('/api/auth/login', () => {
          return HttpResponse.json(
            { detail: 'Invalid credentials' },
            { status: 401 }
          );
        })
      );
      
      const { mockLogin } = renderLoginForm();
      mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
      
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      
      expect(
        await screen.findByText(/invalid credentials/i)
      ).toBeInTheDocument();
    });
  });
});
```

### Testing Custom Hooks

```typescript
// src/hooks/__tests__/usePortfolio.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren } from 'react';
import { usePortfolio } from '../usePortfolio';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('usePortfolio', () => {
  it('returns portfolio data on success', async () => {
    const { result } = renderHook(() => usePortfolio(), {
      wrapper: createWrapper(),
    });
    
    // Estado inicial: loading
    expect(result.current.isLoading).toBe(true);
    
    // Esperar a que cargue
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    expect(result.current.data?.totalValue).toBe(10333.50);
  });
  
  it('returns error state on API failure', async () => {
    // El handler de MSW ya está configurado para devolver error en /api/orders
    const { result } = renderHook(() => usePortfolio(), {
      wrapper: createWrapper(),
    });
    
    await waitFor(() => expect(result.current.isError).toBe(true));
    
    expect(result.current.error).toBeTruthy();
  });
});
```

### Snapshot Testing — Cuándo Sí y Cuándo No

```typescript
// ✅ SÍ usar snapshots para: componentes estáticos/puramente visuales
it('renders correctly', () => {
  const { container } = render(<Badge variant="success">Active</Badge>);
  expect(container.firstChild).toMatchSnapshot();
});

// ❌ NO usar snapshots para: componentes con estado, datos dinámicos, fechas
// Snapshot de toda una página = mantenimiento horrible
// En cambio, usar assertions específicas:
it('shows user name', () => {
  render(<UserCard name="Pierre" />);
  expect(screen.getByText('Pierre')).toBeInTheDocument();
});
```

---

## NestJS / Jest

### Setup de TestingModule

```typescript
// src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();
    
    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });
  
  describe('login', () => {
    it('should return access token for valid credentials', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        passwordHash: '$2b$10$hashedpassword',
      };
      
      usersService.findByEmail.mockResolvedValue(mockUser as any);
      jest.spyOn(service as any, 'verifyPassword').mockResolvedValue(true);
      
      const result = await service.login({
        email: 'test@test.com',
        password: 'validpass',
      });
      
      expect(result.access_token).toBe('mock-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: '1', email: 'test@test.com' })
      );
    });
  });
});
```

### E2E Tests con Supertest

```typescript
// test/auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  describe('POST /auth/login', () => {
    it('returns 200 with tokens for valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'validpass' })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body.token_type).toBe('bearer');
        });
    });
    
    it('returns 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'wrongpass' })
        .expect(401);
    });
  });
});
```

---

## Generacion Automatica de Tests para un Endpoint

Dado un endpoint nuevo, generar estos tests en este orden:

### Checklist de tests a generar

```
Para CADA endpoint nuevo:

[ ] 1. Happy path (200/201) con datos válidos
[ ] 2. Auth: sin token → 401
[ ] 3. Auth: token inválido → 401
[ ] 4. Auth: token expirado → 401
[ ] 5. Auth: permisos insuficientes (rol incorrecto) → 403
[ ] 6. Validación: payload vacío → 422
[ ] 7. Validación: campos requeridos faltantes → 422
[ ] 8. Validación: tipos incorrectos → 422
[ ] 9. Validación: valores fuera de rango → 422 o 400
[ ] 10. Resource not found → 404
[ ] 11. Conflicto/duplicado → 409
[ ] 12. Rate limiting (si aplica) → 429
[ ] 13. Edge case: valores límite (min/max, strings vacíos, arrays vacíos)
[ ] 14. Edge case: datos especiales (unicode, XSS, SQL injection — debe fallar gracefully)
[ ] 15. Respuesta contiene campos esperados (no más, no menos)
[ ] 16. Response time acceptable (< 200ms para ops simples)
```

---

## Test Naming Conventions

```python
# Python — BDD style con describe/it implícito
class TestAuthServiceLogin:          # Clase = módulo o método
    def test_login_returns_tokens_for_valid_credentials(self): ...
    def test_login_raises_for_wrong_password(self): ...
    def test_login_raises_for_nonexistent_user(self): ...
    def test_login_calls_repository_once(self): ...
    #   ^ verbo_descripcion_condicion_resultado

# TypeScript — BDD explícito
describe('AuthService', () => {
  describe('login()', () => {
    it('returns tokens when credentials are valid', () => {});
    it('throws InvalidCredentialsError when password is wrong', () => {});
    it('throws InvalidCredentialsError when user does not exist', () => {});
  });
});
```

**Regla de oro:** El nombre del test debe describir el comportamiento completo sin leer el código.
- Mal: `test_login()`
- Bien: `test_login_with_valid_credentials_returns_jwt_access_and_refresh_tokens()`

---

## Comandos Utiles

```bash
# Python
PYTHONPATH=. pytest tests/ -v                          # Todos los tests
PYTHONPATH=. pytest tests/unit/ -v                     # Solo unit tests
PYTHONPATH=. pytest tests/ -k "test_login"            # Filtrar por nombre
PYTHONPATH=. pytest tests/ --cov=src --cov-report=html # Con coverage HTML
PYTHONPATH=. pytest tests/ -x                          # Parar en primer fallo
PYTHONPATH=. pytest tests/ --lf                        # Solo los que fallaron antes

# TypeScript/Vitest
npm run test                    # Todos los tests
npm run test -- --coverage     # Con coverage
npm run test -- --watch        # Watch mode
npm run test -- LoginForm      # Filtrar por archivo
npx vitest ui                  # UI mode interactivo
```

---

## Anti-patrones a Evitar

```python
# ❌ MAL: Test que verifica implementación interna
def test_login_calls_bcrypt():
    assert bcrypt.checkpw.called  # ¿Qué pasa si cambio a argon2?

# ✅ BIEN: Test que verifica comportamiento
def test_login_rejects_wrong_password():
    with pytest.raises(InvalidCredentialsError):
        await service.login(LoginRequest(email="u@t.com", password="wrong"))

# ❌ MAL: Tests que dependen entre sí
def test_create_user():
    global user_id
    result = create_user(...)
    user_id = result.id  # Estado global = tests frágiles

# ✅ BIEN: Tests independientes con fixtures
async def test_get_user(db_session, mock_user):
    user = await UserRepository(db_session).create(mock_user)
    result = await UserRepository(db_session).find_by_id(user.id)
    assert result.email == mock_user["email"]

# ❌ MAL: Assert con mensajes genéricos
assert result  # ¿Qué falló exactamente?

# ✅ BIEN: Assert descriptivo
assert result.status_code == 201, f"Expected 201, got {result.status_code}: {result.json()}"
```
