# Senior Fullstack — Enterprise Integration Patterns

Complete toolkit for senior fullstack development with modern tools, integration patterns, and production-grade best practices across React, Node.js, GraphQL, PostgreSQL, and deployment infrastructure.

## Quick Start

### Main Capabilities

This skill provides three core capabilities through automated scripts, plus comprehensive integration guidance:

```bash
# Script 1: Fullstack Scaffolder
python scripts/fullstack_scaffolder.py [options]

# Script 2: Project Scaffolder
python scripts/project_scaffolder.py [options]

# Script 3: Code Quality Analyzer
python scripts/code_quality_analyzer.py [options]
```

---

## Core Integration Patterns

### 1. API Contract Synchronization (OpenAPI ↔ GraphQL → Typed Clients)

**Pattern: Single Source of Truth for API Contracts**

All frontend-backend communication is type-safe and synchronized from a canonical schema.

#### OpenAPI + TypeScript Client Generation

```typescript
// Backend: Express with OpenAPI spec (swagger.json)
// Use: @nestjs/swagger or express-jsdoc

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 */
router.get('/users/:id', handler);

// Generate TypeScript client
// npx openapi-generator-cli generate -i swagger.json -g typescript-fetch -o src/api/generated

// Frontend: Auto-generated API client
import { UsersApi, Configuration } from './api/generated';

const api = new UsersApi(
  new Configuration({ basePath: 'http://localhost:3000' })
);

const user = await api.getUsersIdGet({ id: '123' });
// Type: User (inferred from OpenAPI spec)
```

#### GraphQL Schema ↔ TypeScript Codegen

```typescript
// Backend: Define schema
const typeDefs = gql`
  type Query {
    user(id: ID!): User
    users(limit: Int): [User!]!
  }

  type User {
    id: ID!
    email: String!
    profile: Profile!
  }

  type Profile {
    firstName: String!
    role: Role!
  }

  enum Role {
    ADMIN
    USER
    GUEST
  }
`;

// Generate TypeScript types from schema
// npm install -D @graphql-codegen/cli
// npx graphql-codegen init

// graphql.config.yml
schema: 'src/schema.graphql'
documents: 'src/queries/**/*.graphql'
generates:
  src/generated/types.ts:
    plugins:
      - 'typescript'
      - 'typescript-operations'
  src/generated/hooks.ts:
    plugins:
      - 'typescript-react-apollo'

// Frontend: Auto-generated hooks
import { useUserQuery } from './generated/hooks';

export function UserCard({ userId }: { userId: string }) {
  const { data, loading } = useUserQuery({ variables: { id: userId } });

  if (loading) return <Spinner />;
  return <div>{data?.user.profile.firstName}</div>;
}
```

#### tRPC: End-to-End Type Safety

```typescript
// Backend: Define router with procedures
import { z } from 'zod';
import { publicProcedure, router } from './trpc';

export const userRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return await ctx.db.users.findById(input.id);
    }),

  create: publicProcedure
    .input(z.object({ email: z.string().email(), name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.users.create(input);
    }),
});

export const appRouter = router({
  user: userRouter,
});

export type AppRouter = typeof appRouter;

// Frontend: Fully typed client (0 runtime validation overhead)
import { trpc } from '@/utils/trpc';

export function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading } = trpc.user.getById.useQuery({ id: userId });

  // TypeScript knows: data?.id exists, input.id must be UUID
  // No generated code needed — types come from server router

  return <div>{data?.email}</div>;
}
```

**When to use which:**
- **OpenAPI**: REST-only, existing APIs, teams not using TypeScript on backend
- **GraphQL**: Complex nested queries, real-time subscriptions, flexible data needs
- **tRPC**: Full TypeScript stack, monorepo, maximum type safety, server-driven UX

---

### 2. Authentication Flows (JWT + Refresh Tokens + OAuth2)

#### JWT + Refresh Token Pattern (Standard)

```typescript
// Backend: Express + Passport
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const TOKEN_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const ACCESS_SECRET = process.env.ACCESS_SECRET;

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // 1. Find user, validate password
  const user = await User.findOne({ email });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // 2. Issue short-lived access token
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email },
    ACCESS_SECRET,
    { expiresIn: TOKEN_EXPIRY, algorithm: 'HS256' }
  );

  // 3. Issue long-lived refresh token, store hash in DB
  const refreshToken = jwt.sign(
    { userId: user.id },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );

  const tokenHash = bcrypt.hashSync(refreshToken, 10);
  await user.updateOne({ refreshTokenHash: tokenHash });

  // 4. Return tokens (access token to memory, refresh token to httpOnly cookie)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return res.json({ accessToken, user });
});

// 5. Refresh endpoint: validate refresh token, issue new access token
app.post('/auth/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !bcrypt.compareSync(refreshToken, user.refreshTokenHash)) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      ACCESS_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    return res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ error: 'Token invalid' });
  }
});

// Middleware: validate access token
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Frontend: Axios interceptor + token refresh
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3000' });

// 1. Attach access token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 2. On 401, refresh and retry request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config } = error;

    if (error.response?.status === 401 && !config._retry) {
      config._retry = true;

      try {
        const { data } = await axios.post('/auth/refresh');
        localStorage.setItem('accessToken', data.accessToken);
        api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
        return api(config);
      } catch (refreshError) {
        // Redirect to login
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// 3. Store access token in memory (cleared on page reload)
let accessToken: string | null = null;

api.interceptors.response.use((response) => {
  if (response.data.accessToken) {
    accessToken = response.data.accessToken;
  }
  return response;
});
```

#### OAuth2 with PKCE (Social Login)

```typescript
// Backend: OAuth2 callback handler
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

app.post('/auth/oauth/authorize', (req, res) => {
  // 1. Generate state + PKCE challenge
  const state = uuid();
  const codeVerifier = uuid();
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // 2. Store in session (or signed cookie)
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000 });
  res.cookie('code_verifier', codeVerifier, { httpOnly: true, maxAge: 600000 });

  // 3. Redirect to provider (Google, GitHub, etc.)
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.append('client_id', process.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', `${process.env.API_URL}/auth/oauth/callback`);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', 'openid email profile');
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('code_challenge', codeChallenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');

  return res.json({ authUrl: authUrl.toString() });
});

app.post('/auth/oauth/callback', async (req, res) => {
  const { code, state } = req.body;
  const storedState = req.cookies.oauth_state;
  const codeVerifier = req.cookies.code_verifier;

  if (state !== storedState) {
    return res.status(400).json({ error: 'State mismatch' });
  }

  // 4. Exchange code for token (with PKCE)
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.API_URL}/auth/oauth/callback`,
    }),
  });

  const { id_token } = await tokenResponse.json();
  const decoded = jwt.decode(id_token); // { sub, email, picture }

  // 5. Find or create user
  let user = await User.findOne({ email: decoded.email });
  if (!user) {
    user = await User.create({
      email: decoded.email,
      name: decoded.name,
      oauthProvider: 'google',
      oauthId: decoded.sub,
    });
  }

  // 6. Issue app tokens
  const accessToken = jwt.sign({ userId: user.id }, ACCESS_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRY,
  });

  res.cookie('refreshToken', refreshToken, { httpOnly: true });
  return res.json({ accessToken, user });
});

// Frontend: Initiate OAuth flow
import { useNavigate } from 'react-router-dom';

export function GoogleLoginButton() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    const { authUrl } = await api.post('/auth/oauth/authorize');
    window.location.href = authUrl;
  };

  return <button onClick={handleLogin}>Sign in with Google</button>;
}

// Frontend: OAuth callback page
export function OAuthCallback() {
  const { code, state } = useSearchParams();

  useEffect(() => {
    (async () => {
      const { accessToken, user } = await api.post('/auth/oauth/callback', {
        code,
        state,
      });
      localStorage.setItem('accessToken', accessToken);
      navigate('/dashboard');
    })();
  }, []);

  return <div>Signing you in...</div>;
}
```

---

### 3. Real-Time Patterns (WebSocket + SSE + Optimistic Updates)

#### WebSocket Connection Manager with Auto-Reconnect

```typescript
// Backend: Express + ws
import WebSocket from 'ws';

interface ClientConnection {
  ws: WebSocket;
  userId: string;
  subscriptions: Set<string>;
}

const clients = new Map<string, ClientConnection>();

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, req) => {
  const token = extractTokenFromUrl(req.url);
  const userId = verifyToken(token)?.userId;

  if (!userId) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  const connection: ClientConnection = {
    ws,
    userId,
    subscriptions: new Set(),
  };

  clients.set(userId, connection);

  ws.on('message', (raw) => {
    const message = JSON.parse(raw.toString());

    if (message.type === 'subscribe') {
      connection.subscriptions.add(message.channel);
      console.log(`User ${userId} subscribed to ${message.channel}`);
    }

    if (message.type === 'unsubscribe') {
      connection.subscriptions.delete(message.channel);
    }
  });

  ws.on('close', () => {
    clients.delete(userId);
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for user ${userId}:`, err);
  });
});

// Broadcast function
function broadcast(channel: string, data: any) {
  clients.forEach(({ ws, subscriptions }) => {
    if (subscriptions.has(channel)) {
      ws.send(JSON.stringify({ type: 'update', channel, data }));
    }
  });
}

// When order is created: broadcast to all subscribers
app.post('/api/orders', authMiddleware, async (req, res) => {
  const order = await Order.create(req.body);

  // Emit to WebSocket subscribers
  broadcast('orders:new', order);

  return res.json(order);
});

// Frontend: WebSocket hook with auto-reconnect
import { useEffect, useRef, useState } from 'react';

export function useWebSocket(channels: string[]) {
  const ws = useRef<WebSocket | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [connected, setConnected] = useState(false);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const url = `ws://localhost:3000/ws?token=${token}`;

    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setConnected(true);
      reconnectAttempts.current = 0;

      // Subscribe to channels
      channels.forEach((channel) => {
        ws.current?.send(JSON.stringify({ type: 'subscribe', channel }));
      });
    };

    ws.current.onmessage = (event) => {
      const { data: newData } = JSON.parse(event.data);
      setData((prev) => [newData, ...prev]);
    };

    ws.current.onclose = () => {
      setConnected(false);

      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current += 1;

      setTimeout(() => {
        // Recursive call to useEffect dependency
      }, delay);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.current?.close();
    };
  }, [channels]);

  return { data, connected };
}

// Frontend: Use WebSocket hook
export function OrderFeed() {
  const { data: orders, connected } = useWebSocket(['orders:new', 'orders:updates']);

  return (
    <div>
      <span>{connected ? '🟢' : '🔴'} Connected</span>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
```

#### Server-Sent Events (SSE) for One-Way Streams

```typescript
// Backend: SSE endpoint
app.get('/api/events/:userId', authMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = `${req.user.userId}-${Date.now()}`;

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Store connection in memory (use Redis in production)
  const connections = new Set();
  connections.add(res);

  res.on('close', () => {
    connections.delete(res);
  });
});

// Emit function
function emitSSE(userId: string, event: string, data: any) {
  activeConnections.forEach((res) => {
    if (res.user?.id === userId) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  });
}

// Frontend: SSE hook
export function useServerEvents(userId: string) {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const eventSource = new EventSource(
      `/api/events/${userId}?token=${token}`
    );

    eventSource.addEventListener('notification', (e) => {
      setEvents((prev) => [JSON.parse(e.data), ...prev]);
    });

    eventSource.addEventListener('error', () => {
      eventSource.close();
    });

    return () => eventSource.close();
  }, [userId]);

  return events;
}
```

#### Optimistic Updates with Rollback

```typescript
// Frontend: React Query + optimistic update
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (order: Order) => {
      return await api.patch(`/api/orders/${order.id}`, order);
    },

    // Optimistic update: update cache immediately
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });

      const previousData = queryClient.getQueryData(['orders']);

      queryClient.setQueryData(['orders'], (old: Order[]) =>
        old.map((o) => (o.id === newOrder.id ? newOrder : o))
      );

      return { previousData };
    },

    // Rollback on error
    onError: (err, newOrder, context) => {
      queryClient.setQueryData(['orders'], context?.previousData);
    },

    // Re-sync with server on success
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// Usage
export function OrderEditor({ order }: { order: Order }) {
  const updateOrder = useUpdateOrder();
  const [edited, setEdited] = useState(order);

  const handleSave = () => {
    updateOrder.mutate(edited);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
      <input
        value={edited.quantity}
        onChange={(e) => setEdited({ ...edited, quantity: e.target.value })}
      />
      <button disabled={updateOrder.isPending}>Save</button>
    </form>
  );
}
```

---

### 4. Database Integration (ORM Patterns + Migrations + Pooling)

#### Prisma Schema with Relations & Migrations

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?

  // Relations
  orders        Order[]
  profile       Profile?

  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([email])
}

model Profile {
  id            String    @id @default(cuid())
  firstName     String
  lastName      String

  userId        String    @unique
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Order {
  id            String    @id @default(cuid())
  quantity      Int
  price         Decimal   @db.Decimal(10, 2)
  status        OrderStatus @default(PENDING)

  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt     DateTime  @default(now())

  @@index([userId])
  @@index([status])
}

enum OrderStatus {
  PENDING
  FILLED
  CANCELLED
}
```

```bash
# Generate migration and apply
npx prisma migrate dev --name "add_orders"

# Generate client
npx prisma generate
```

#### SQLAlchemy with Connection Pooling (Python)

```python
# backend/src/database.py
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)
from sqlalchemy.pool import NullPool, QueuePool
import os

DATABASE_URL = os.getenv('DATABASE_URL')

# Connection pooling
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    poolclass=QueuePool,  # Use QueuePool for async
    pool_size=20,  # Min connections
    max_overflow=40,  # Max overflow connections
    pool_recycle=3600,  # Recycle connections every hour
    pool_pre_ping=True,  # Test connection before using
)

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_session():
    async with async_session() as session:
        yield session

# Alembic migrations
# alembic/env.py
from sqlalchemy import pool
from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

async def run_migrations():
    config = context.config
    engine = create_async_engine(config.get_section(config.config_ini_section)['sqlalchemy.url'])

    async with engine.begin() as connection:
        await connection.run_sync(context.configure)
        await connection.run_sync(context.run_migrations)
```

#### Drizzle ORM (TypeScript Alternative)

```typescript
// src/db/schema.ts
import { pgTable, text, integer, decimal, timestamp, serial } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  quantity: integer('quantity').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`),
});

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));

// src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const queryClient = postgres(process.env.DATABASE_URL);
export const db = drizzle(queryClient);

// Usage
const result = await db
  .select()
  .from(users)
  .where(eq(users.email, 'user@example.com'))
  .limit(1);
```

---

### 5. API Design & Contract Patterns

#### RESTful API Best Practices

```typescript
// Structure: /api/v1/{resource}/{id}/{sub-resource}

// GET — Retrieve
GET /api/v1/users                           // List all
GET /api/v1/users/123                       // Get one
GET /api/v1/users/123/orders                // Get related

// POST — Create
POST /api/v1/users                          // Create new

// PUT / PATCH — Update
PUT /api/v1/users/123                       // Replace entirely
PATCH /api/v1/users/123                     // Partial update

// DELETE — Remove
DELETE /api/v1/users/123

// Response envelope (consistent across all endpoints)
{
  "data": { /* resource */ },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  },
  "errors": null
}

// Error response
{
  "data": null,
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Email is invalid",
      "path": "body.email"
    }
  ]
}

// Pagination
GET /api/v1/users?page=1&limit=20&sort=-createdAt

{
  "data": [ { /* user */ }, ... ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

#### GraphQL Schema Design (Federation)

```graphql
# Subgraph 1: Users service
type Query {
  user(id: ID!): User
  users(first: Int, after: String): UserConnection!
}

type User @key(fields: "id") {
  id: ID!
  email: String!
  name: String!
  orders(first: Int): OrderConnection!
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
}

# Subgraph 2: Orders service
type Query {
  order(id: ID!): Order
  orders(userId: ID!, first: Int): OrderConnection!
}

type Order @key(fields: "id") {
  id: ID!
  quantity: Int!
  user: User!    # Reference to User type from users service
}

extend type User @key(fields: "id") {
  id: ID! @external
  orders: [Order!]!
}

# Federation gateway combines subgraphs
type Query {
  user(id: ID!): User
  order(id: ID!): Order
}
```

---

### 6. Error Handling (Global Error Boundaries + Middleware)

#### Frontend: Global Error Boundary + Error Contexts

```typescript
// src/components/ErrorBoundary.tsx
import React, { ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to monitoring service (Sentry, LogRocket)
    console.error('React Error:', error, info);

    // Report to backend
    fetch('/api/errors', {
      method: 'POST',
      body: JSON.stringify({
        type: 'react_error',
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
      }),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.href = '/'}>
            Go Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// src/contexts/ErrorContext.tsx
import { createContext, useState, ReactNode } from 'react';

interface AppError {
  id: string;
  code: string;
  message: string;
  status?: number;
  details?: Record<string, any>;
}

export const ErrorContext = createContext<{
  errors: AppError[];
  addError: (error: AppError) => void;
  clearError: (id: string) => void;
}>({ errors: [], addError: () => {}, clearError: () => {} });

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<AppError[]>([]);

  const addError = (error: AppError) => {
    setErrors((prev) => [...prev, error]);

    // Auto-clear after 5 seconds
    setTimeout(() => clearError(error.id), 5000);
  };

  const clearError = (id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <ErrorContext.Provider value={{ errors, addError, clearError }}>
      {children}
    </ErrorContext.Provider>
  );
}

// src/hooks/useError.ts
import { useContext } from 'react';
import { ErrorContext } from '@/contexts/ErrorContext';
import { v4 as uuid } from 'uuid';

export function useError() {
  const { addError } = useContext(ErrorContext);

  return (error: Omit<AppError, 'id'>) => {
    addError({ ...error, id: uuid() });
  };
}

// src/components/ErrorToast.tsx
import { useContext } from 'react';
import { ErrorContext } from '@/contexts/ErrorContext';

export function ErrorToast() {
  const { errors, clearError } = useContext(ErrorContext);

  return (
    <div className="fixed bottom-4 right-4 space-y-2">
      {errors.map((error) => (
        <div key={error.id} className="bg-red-500 text-white p-4 rounded">
          <p>{error.message}</p>
          <button onClick={() => clearError(error.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}
```

#### Backend: Global Error Handler + Structured Logging

```typescript
// Backend: Express error middleware
import { Request, Response, NextFunction } from 'express';
import logger from './logger'; // structlog or winston

interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, any>;
}

// Custom error class
export class ValidationError extends Error {
  statusCode = 400;
  code = 'VALIDATION_ERROR';

  constructor(message: string, public details: Record<string, any> = {}) {
    super(message);
  }
}

export class AuthenticationError extends Error {
  statusCode = 401;
  code = 'AUTHENTICATION_ERROR';
}

export class AuthorizationError extends Error {
  statusCode = 403;
  code = 'AUTHORIZATION_ERROR';
}

// Global error handler (register LAST in middleware)
app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const id = uuid();

  // Structured logging
  logger.error('request_error', {
    errorId: id,
    code,
    message: err.message,
    statusCode,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    details: err.details,
  });

  // Don't leak internal errors to client
  const isClientError = statusCode >= 400 && statusCode < 500;

  return res.status(statusCode).json({
    data: null,
    errors: [
      {
        id,
        code,
        message: isClientError ? err.message : 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.details : undefined,
      },
    ],
  });
});

// Usage
app.post('/api/orders', async (req, res, next) => {
  try {
    // Validate input
    if (!req.body.quantity || req.body.quantity <= 0) {
      throw new ValidationError('Quantity must be positive', {
        field: 'quantity',
        received: req.body.quantity,
      });
    }

    const order = await Order.create(req.body);
    res.json({ data: order });
  } catch (err) {
    next(err); // Pass to error handler
  }
});
```

---

### 7. Deployment Pipelines (Docker + CI/CD)

#### Multi-Stage Docker Build

```dockerfile
# Dockerfile (frontend)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --production
EXPOSE 3000
CMD ["npm", "start"]

# Dockerfile (backend)
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8000
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0"]
```

#### Docker Compose with Services

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: trading_bot
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/trading_bot
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis

  web:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  postgres_data:
```

#### GitHub Actions CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Frontend tests
        run: |
          cd frontend
          npm ci
          npm run test
          npm run build

      - name: Backend tests
        run: |
          cd backend
          pip install -r requirements.txt
          pytest tests/ -v

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production
        run: |
          # Deploy frontend to Vercel/Netlify
          npx vercel deploy --prod

          # Deploy backend to Railway/Fly.io
          fly deploy
```

---

### 8. Testing Pyramid (Unit → Integration → E2E)

#### Unit Tests (Jest + Vitest)

```typescript
// Frontend: __tests__/OrderCard.test.tsx
import { render, screen } from '@testing-library/react';
import { OrderCard } from '@/components/OrderCard';

describe('OrderCard', () => {
  it('displays order quantity', () => {
    const order = { id: '1', quantity: 100, price: 50 };
    render(<OrderCard order={order} />);

    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it('formats price with 2 decimals', () => {
    const order = { id: '1', quantity: 1, price: 50.5 };
    render(<OrderCard order={order} />);

    expect(screen.getByText('$50.50')).toBeInTheDocument();
  });
});

// Backend: tests/test_order_service.py
import pytest
from src.services.order_service import OrderService
from src.models import Order

@pytest.fixture
async def order_service():
    return OrderService()

@pytest.mark.asyncio
async def test_create_order(order_service):
    order = await order_service.create(
        user_id='user123',
        quantity=100,
        price=50.0
    )

    assert order.id is not None
    assert order.quantity == 100
    assert order.price == 50.0

@pytest.mark.asyncio
async def test_order_validation(order_service):
    with pytest.raises(ValidationError):
        await order_service.create(
            user_id='user123',
            quantity=0,  # Invalid
            price=50.0
        )
```

#### Integration Tests (DB + API)

```typescript
// Backend: tests/integration/test_orders_api.py
import pytest
from httpx import AsyncClient
from src.main import app
from src.models import User, Order

@pytest.mark.asyncio
async def test_create_order_endpoint(client: AsyncClient, user: User):
    response = await client.post(
        '/api/orders',
        json={'quantity': 100, 'price': 50.0},
        headers={'Authorization': f'Bearer {user.token}'}
    )

    assert response.status_code == 201
    data = response.json()
    assert data['data']['quantity'] == 100

    # Verify in database
    order = await Order.get(data['data']['id'])
    assert order is not None

@pytest.mark.asyncio
async def test_list_user_orders(client: AsyncClient, user: User):
    # Create orders
    await Order.create(user_id=user.id, quantity=100, price=50.0)
    await Order.create(user_id=user.id, quantity=50, price=25.0)

    response = await client.get(
        '/api/orders',
        headers={'Authorization': f'Bearer {user.token}'}
    )

    assert response.status_code == 200
    assert len(response.json()['data']) == 2
```

#### E2E Tests (Playwright)

```typescript
// e2e/orders.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Orders Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
  });

  test('should create and view order', async ({ page }) => {
    // Navigate to orders page
    await page.goto('http://localhost:3000/orders');
    await page.click('button:has-text("Create Order")');

    // Fill form
    await page.fill('input[name="quantity"]', '100');
    await page.fill('input[name="price"]', '50.00');
    await page.click('button:has-text("Submit")');

    // Verify order appears
    await expect(page.locator('text=100')).toBeVisible();
    await expect(page.locator('text=$5,000.00')).toBeVisible();
  });

  test('should update order status via WebSocket', async ({ page }) => {
    // Create order
    await page.goto('http://localhost:3000/orders');
    await page.click('button:has-text("Create Order")');
    await page.fill('input[name="quantity"]', '100');
    await page.fill('input[name="price"]', '50.00');
    await page.click('button:has-text("Submit")');

    // Status should update via WebSocket
    await expect(page.locator('text=FILLED')).toBeVisible({ timeout: 5000 });
  });
});
```

---

### 9. Monorepo Architecture (Turborepo / Nx)

#### Turborepo Setup

```json
// turbo.json
{
  "version": "1",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}

// packages/shared-types/package.json
{
  "name": "@app/shared-types",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./user": "./src/user.ts"
  }
}

// packages/api/package.json
{
  "dependencies": {
    "@app/shared-types": "workspace:*"
  }
}

// packages/web/package.json
{
  "dependencies": {
    "@app/shared-types": "workspace:*"
  }
}
```

#### Shared Types Across Stack

```typescript
// packages/shared-types/src/index.ts
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Order {
  id: string;
  userId: string;
  quantity: number;
  price: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  createdAt: Date;
}

// Backend uses types
import { User, Order } from '@app/shared-types';

app.get('/users/:id', async (req, res) => {
  const user: User = await db.users.findById(req.params.id);
  res.json(user);
});

// Frontend uses same types
import { User, Order } from '@app/shared-types';

function UserProfile({ user }: { user: User }) {
  return <div>{user.name}</div>;
}
```

---

## Core Scaffolder Scripts (Existing)

### 1. Fullstack Scaffolder
```bash
python scripts/fullstack_scaffolder.py <project-path> [options]
```
Creates complete monorepo with React frontend, Node.js backend, PostgreSQL, and Docker setup.

### 2. Project Scaffolder
```bash
python scripts/project_scaffolder.py <target-path> [--verbose]
```
Analyzes project structure and generates optimization recommendations.

### 3. Code Quality Analyzer
```bash
python scripts/code_quality_analyzer.py [arguments] [options]
```
Comprehensive code analysis with metrics and best practices validation.

---

## Reference Documentation

### Tech Stack Guide
Detailed patterns and practices in `references/tech_stack_guide.md`

### Architecture Patterns
Complete workflow documentation in `references/architecture_patterns.md`

### Development Workflows
Technical reference guide in `references/development_workflows.md`

---

## Best Practices Summary

### Authentication & Security
- Use JWT + refresh tokens for stateless auth
- Implement PKCE for OAuth2 flows
- Store refresh tokens in httpOnly cookies
- Validate all inputs server-side
- Rate limit auth endpoints (5 attempts/15min)

### Real-Time
- WebSocket for bidirectional (chat, collaborative editing)
- SSE for one-way streams (notifications, events)
- Optimistic updates with rollback on error
- Auto-reconnect with exponential backoff

### Database
- Use connection pooling (QueuePool for async, thread-safe)
- Run migrations in CI/CD pipeline
- Seed test data in pre-commit hooks
- Index on foreign keys and frequently queried columns
- Archive old data to TimescaleDB hypertables

### API Design
- REST: Collection → Resource → Sub-resource
- GraphQL: Federated subgraphs for microservices
- tRPC: Full type safety for monorepos
- Consistent error response envelope
- Pagination with cursor-based tokens

### Error Handling
- Global error boundary on frontend
- Error middleware on backend
- Structured logging (not console.log)
- Report errors to monitoring (Sentry, DataDog)
- 4xx errors don't trigger alerts; 5xx do

### Testing
- Unit: Business logic, utilities (80% coverage)
- Integration: API contracts, DB interactions
- E2E: Critical user journeys (login, checkout)
- Load test critical paths before launch

### Deployment
- Multi-stage Docker builds
- Environment-specific configs (.env files)
- CI/CD validates tests + linting before merge
- Blue-green or canary deployments for zero-downtime
- Monitor error rates, latency, resource usage

---

## Common Commands

```bash
# Development
npm run dev && python -m uvicorn src.main:app --reload

# Testing
npm run test && pytest tests/ -v
npm run test:e2e  # Playwright

# Deployment
docker-compose up -d
npm run build && npm run start
pytest tests/ && python -m pytest tests/e2e

# Code quality
npm run lint && npm run type-check
black src/ && ruff check src/
```

---

## Troubleshooting

### WebSocket Connection Fails
- Check token in query string is valid
- Verify `ws://` not `http://` in browser
- Check firewall allows WebSocket upgrade
- Enable CORS headers for WebSocket upgrade

### Type Mismatch Between Frontend & Backend
- Regenerate types from schema: `npm run codegen`
- Verify API response matches generated interface
- Check for optional fields not being handled

### Database Connection Pool Exhausted
- Check for unclosed connections in error handlers
- Increase `pool_size` and `max_overflow`
- Monitor active connections: `SELECT count(*) FROM pg_stat_activity;`

### OAuth Callback Missing State
- Verify PKCE flow: state must match on callback
- Check cookie expiry (default 10 minutes)
- Clear browser cookies for development

---

## Resources

- Pattern Reference: `references/tech_stack_guide.md`
- Workflow Guide: `references/architecture_patterns.md`
- Technical Guide: `references/development_workflows.md`
- Tool Scripts: `scripts/` directory
