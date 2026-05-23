# WebSocket Validation & Real-Time Communication Patterns

## Overview

WebSocket provides bidirectional, full-duplex communication channels over a single persistent TCP connection. This skill covers validation patterns, connection lifecycle management, message format validation, authentication, scaling strategies, and production reliability patterns.

**Key Principles:**
- Single persistent connection reduces latency and overhead vs. polling
- Message format validation ensures protocol compatibility
- Connection lifecycle requires careful state management
- Heartbeat/ping-pong mechanisms detect dead connections
- Authentication must occur at WebSocket upgrade, not per-message
- Scaling requires pub/sub coordination and state management
- Rate limiting and backpressure prevent resource exhaustion
- Message ordering guarantees require careful queue design

---

## WebSocket Connection Lifecycle

### Connection States

```
CONNECTING -> OPEN -> CLOSING -> CLOSED
    |          |        ^         ^
    +----------+--------+         |
    (reconnection logic)          |
    (exponential backoff)    (error handling)
```

### Server-Side Connection Handler (FastAPI)

```python
from fastapi import WebSocket, WebSocketDisconnect, status
from typing import Dict, Set
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages active WebSocket connections with state tracking."""

    def __init__(self):
        # Dict[user_id][room_id] = {"websocket": WebSocket, "metadata": {...}}
        self.active_connections: Dict[str, Dict[str, dict]] = {}
        self.lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        room_id: str,
        metadata: dict = None
    ):
        """
        Establish and track a WebSocket connection.

        Lifecycle:
        1. Accept connection
        2. Store reference with metadata
        3. Send welcome message
        4. Begin message loop
        """
        await websocket.accept()

        async with self.lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = {}

            self.active_connections[user_id][room_id] = {
                "websocket": websocket,
                "metadata": metadata or {},
                "connected_at": datetime.utcnow().isoformat(),
                "message_count": 0,
                "last_heartbeat": datetime.utcnow().isoformat(),
            }

        logger.info(f"Client {user_id} connected to {room_id}")

        # Send welcome message
        await websocket.send_json({
            "type": "connection_established",
            "user_id": user_id,
            "room_id": room_id,
            "timestamp": datetime.utcnow().isoformat(),
        })

    async def disconnect(self, user_id: str, room_id: str):
        """Clean up connection state on disconnect."""
        async with self.lock:
            if user_id in self.active_connections:
                if room_id in self.active_connections[user_id]:
                    del self.active_connections[user_id][room_id]

                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]

        logger.info(f"Client {user_id} disconnected from {room_id}")

    async def broadcast_to_room(
        self,
        room_id: str,
        message: dict,
        exclude_user: str = None
    ):
        """Broadcast message to all users in a room."""
        disconnected_users = []

        async with self.lock:
            for user_id, rooms in self.active_connections.items():
                if exclude_user and user_id == exclude_user:
                    continue

                if room_id in rooms:
                    try:
                        await rooms[room_id]["websocket"].send_json(message)
                    except Exception as e:
                        logger.error(f"Error sending to {user_id}: {e}")
                        disconnected_users.append((user_id, room_id))

        # Clean up failed connections
        for user_id, room_id in disconnected_users:
            await self.disconnect(user_id, room_id)

    async def send_to_user(
        self,
        user_id: str,
        room_id: str,
        message: dict
    ) -> bool:
        """Send message to specific user. Returns True if sent."""
        try:
            async with self.lock:
                if (user_id in self.active_connections and
                    room_id in self.active_connections[user_id]):
                    ws = self.active_connections[user_id][room_id]["websocket"]
                    await ws.send_json(message)
                    self.active_connections[user_id][room_id]["message_count"] += 1
                    return True
        except Exception as e:
            logger.error(f"Failed to send to {user_id}: {e}")
            await self.disconnect(user_id, room_id)

        return False

    def get_connection_count(self) -> int:
        """Get total active connections."""
        count = 0
        for user_rooms in self.active_connections.values():
            count += len(user_rooms)
        return count


# Global connection manager
manager = ConnectionManager()

@app.websocket("/ws/market/{symbol}")
async def websocket_market_stream(websocket: WebSocket, symbol: str, user_id: str = None):
    """WebSocket endpoint for market data streaming."""
    await manager.connect(websocket, user_id or "anonymous", symbol)

    try:
        while True:
            # Receive and validate incoming message
            data = await websocket.receive_json()

            # Validate message structure
            if not validate_market_message(data):
                await websocket.send_json({
                    "type": "error",
                    "code": "invalid_message",
                    "message": "Message format invalid"
                })
                continue

            # Process message based on type
            if data.get("type") == "subscribe":
                await manager.broadcast_to_room(symbol, {
                    "type": "user_subscribed",
                    "user_id": user_id,
                    "timestamp": datetime.utcnow().isoformat(),
                })

            elif data.get("type") == "unsubscribe":
                await manager.disconnect(user_id, symbol)
                break

    except WebSocketDisconnect:
        await manager.disconnect(user_id, symbol)
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {e}")
        await manager.disconnect(user_id, symbol)
```

---

## Heartbeat & Ping-Pong Mechanism

### Detecting Dead Connections

WebSocket protocol includes built-in ping-pong frames (RFC 6455), separate from application messages:

```python
import asyncio
from datetime import datetime, timedelta

class HeartbeatManager:
    """Maintains connection health via ping-pong frames."""

    def __init__(self, interval_seconds: int = 30, timeout_seconds: int = 60):
        self.interval = interval_seconds
        self.timeout = timeout_seconds
        self.active_pings: Dict[str, datetime] = {}

    async def start_heartbeat(self, user_id: str, websocket: WebSocket):
        """
        Send periodic ping frames to client.

        Client automatically responds with pong frame (browser native).
        If pong not received within timeout, connection is dead.
        """
        try:
            while True:
                await asyncio.sleep(self.interval)

                try:
                    # Send ping frame (not a regular message)
                    # Browser automatically responds with pong
                    await websocket.send_bytes(b'\x89\x00')  # Ping opcode
                    self.active_pings[user_id] = datetime.utcnow()
                except Exception as e:
                    logger.warning(f"Ping failed for {user_id}: {e}")
                    break
        except asyncio.CancelledError:
            pass

    async def monitor_heartbeat(
        self,
        user_id: str,
        websocket: WebSocket,
        manager: ConnectionManager
    ):
        """Monitor for timeout (no pong response)."""
        try:
            while True:
                await asyncio.sleep(self.timeout // 2)

                if user_id in self.active_pings:
                    last_pong = self.active_pings[user_id]
                    if datetime.utcnow() - last_pong > timedelta(seconds=self.timeout):
                        logger.warning(f"Heartbeat timeout for {user_id}")
                        await websocket.close(code=status.WS_1000_NORMAL_CLOSURE)
                        break
        except asyncio.CancelledError:
            pass

    def record_pong(self, user_id: str):
        """Called when pong frame received (automatic in browsers)."""
        self.active_pings[user_id] = datetime.utcnow()


# Application-level keepalive alternative (for protocols without native ping-pong)
class ApplicationHeartbeat:
    """Alternative heartbeat using regular messages."""

    async def send_heartbeat(self, websocket: WebSocket, user_id: str):
        """Send heartbeat message at regular intervals."""
        try:
            while True:
                await asyncio.sleep(30)  # Send every 30 seconds

                await websocket.send_json({
                    "type": "heartbeat",
                    "timestamp": datetime.utcnow().isoformat(),
                    "server_time": int(time.time() * 1000),
                })
        except asyncio.CancelledError:
            pass
```

### Client-Side Heartbeat (JavaScript)

```javascript
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.isAlive = true;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("Connected");
        this.startHeartbeat();
        resolve();
      };

      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === "heartbeat") {
          // Reset heartbeat timeout on server heartbeat
          this.recordHeartbeat();
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log("Disconnected");
        this.stopHeartbeat();
      };
    });
  }

  startHeartbeat() {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: "heartbeat",
          timestamp: new Date().toISOString(),
        }));
      }
    }, 30000);

    // Timeout if no heartbeat response within 60 seconds
    this.heartbeatTimeout = setTimeout(() => {
      if (this.isAlive === false) {
        console.warn("No heartbeat response, reconnecting...");
        this.reconnect();
        return;
      }

      this.isAlive = false;
      this.heartbeatTimeout = setTimeout(() => {
        this.ws?.close();
      }, 30000);
    }, 60000);
  }

  recordHeartbeat() {
    this.isAlive = true;
    clearTimeout(this.heartbeatTimeout);
    this.startHeartbeat();
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatInterval);
    clearTimeout(this.heartbeatTimeout);
  }
}
```

---

## Connection Retry & Exponential Backoff

### Reconnection Strategy (Client-Side)

```python
import asyncio
import random
from enum import Enum

class ReconnectStrategy(Enum):
    FIXED = "fixed"
    EXPONENTIAL = "exponential"
    FIBONACCI = "fibonacci"
    RANDOM = "random"


class WebSocketClientAsync:
    """Async WebSocket client with reconnection logic."""

    def __init__(
        self,
        url: str,
        strategy: ReconnectStrategy = ReconnectStrategy.EXPONENTIAL,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        max_retries: int = 10,
    ):
        self.url = url
        self.strategy = strategy
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.max_retries = max_retries
        self.ws = None
        self.retry_count = 0
        self.is_intentional_close = False

    async def connect(self):
        """Connect with automatic retry on failure."""
        while self.retry_count < self.max_retries:
            try:
                self.ws = await asyncio.wait_for(
                    websockets.connect(self.url),
                    timeout=10.0
                )
                self.retry_count = 0
                logger.info(f"Connected to {self.url}")
                return

            except asyncio.TimeoutError:
                logger.error(f"Connection timeout, attempt {self.retry_count + 1}")

            except ConnectionRefusedError:
                logger.error(f"Connection refused, attempt {self.retry_count + 1}")

            except Exception as e:
                logger.error(f"Connection error: {e}")

            # Calculate backoff delay
            delay = self._calculate_backoff()
            logger.info(f"Retrying in {delay:.2f} seconds...")
            await asyncio.sleep(delay)
            self.retry_count += 1

        raise ConnectionError(f"Failed to connect after {self.max_retries} attempts")

    def _calculate_backoff(self) -> float:
        """Calculate next retry delay based on strategy."""
        if self.strategy == ReconnectStrategy.FIXED:
            delay = self.initial_delay

        elif self.strategy == ReconnectStrategy.EXPONENTIAL:
            # 1, 2, 4, 8, 16, 32, 60, 60, ...
            delay = self.initial_delay * (2 ** self.retry_count)

        elif self.strategy == ReconnectStrategy.FIBONACCI:
            # 1, 1, 2, 3, 5, 8, 13, 21, ...
            delay = self._fibonacci(self.retry_count + 1) * self.initial_delay

        elif self.strategy == ReconnectStrategy.RANDOM:
            # Random between initial_delay and (2 ** retry_count) * initial_delay
            max_delay_for_attempt = self.initial_delay * (2 ** self.retry_count)
            delay = random.uniform(self.initial_delay, max_delay_for_attempt)

        else:
            delay = self.initial_delay

        # Add jitter to prevent thundering herd
        jitter = random.uniform(0, delay * 0.1)
        delay += jitter

        # Cap at max_delay
        return min(delay, self.max_delay)

    @staticmethod
    def _fibonacci(n: int) -> int:
        """Calculate nth Fibonacci number."""
        if n <= 1:
            return 1
        a, b = 1, 1
        for _ in range(n - 1):
            a, b = b, a + b
        return a

    async def disconnect(self):
        """Intentional close (no reconnection)."""
        self.is_intentional_close = True
        if self.ws:
            await self.ws.close()

    async def listen(self):
        """Message listening loop with auto-reconnect."""
        while not self.is_intentional_close:
            try:
                await self.connect()

                async for message in self.ws:
                    yield json.loads(message)

            except websockets.exceptions.ConnectionClosed:
                logger.warning("Connection closed, will reconnect...")
                if not self.is_intentional_close and self.retry_count < self.max_retries:
                    await asyncio.sleep(1)
                else:
                    break

            except Exception as e:
                logger.error(f"Error in message loop: {e}")
                await asyncio.sleep(self.initial_delay)


# Usage
client = WebSocketClientAsync(
    "ws://localhost:8000/ws/market/BTCUSDT",
    strategy=ReconnectStrategy.EXPONENTIAL,
    initial_delay=1.0,
    max_delay=60.0,
)

async def main():
    async for message in client.listen():
        print(f"Received: {message}")

asyncio.run(main())
```

---

## Message Format Validation

### JSON Schema Validation

```python
from jsonschema import validate, ValidationError, Draft7Validator
import json

class MessageValidator:
    """Validate WebSocket messages against JSON schemas."""

    SCHEMAS = {
        "subscribe": {
            "type": "object",
            "properties": {
                "type": {"enum": ["subscribe"]},
                "symbols": {
                    "type": "array",
                    "items": {"type": "string"},
                    "minItems": 1,
                    "maxItems": 100,
                },
                "interval": {
                    "enum": ["1m", "5m", "15m", "1h", "4h", "1d"],
                },
            },
            "required": ["type", "symbols"],
            "additionalProperties": False,
        },
        "order": {
            "type": "object",
            "properties": {
                "type": {"enum": ["order"]},
                "action": {"enum": ["buy", "sell"]},
                "symbol": {"type": "string"},
                "quantity": {"type": "number", "minimum": 0.001},
                "price": {"type": "number", "minimum": 0},
            },
            "required": ["type", "action", "symbol", "quantity"],
            "additionalProperties": False,
        },
    }

    @classmethod
    def validate_message(cls, message: dict) -> tuple[bool, str]:
        """
        Validate message structure.

        Returns: (is_valid, error_message)
        """
        message_type = message.get("type")

        if not message_type:
            return False, "Message must have 'type' field"

        if message_type not in cls.SCHEMAS:
            return False, f"Unknown message type: {message_type}"

        schema = cls.SCHEMAS[message_type]

        try:
            validate(instance=message, schema=schema)
            return True, ""
        except ValidationError as e:
            return False, f"Validation error: {e.message}"

    @classmethod
    def validate_batch(cls, messages: list) -> dict:
        """Validate multiple messages, return results per index."""
        results = {}
        for i, msg in enumerate(messages):
            is_valid, error = cls.validate_message(msg)
            results[i] = {"valid": is_valid, "error": error}
        return results


# Protobuf alternative (binary format)
import struct

class ProtobufMessageValidator:
    """Validate Protocol Buffer messages."""

    MESSAGE_TYPES = {
        1: "Subscribe",
        2: "Unsubscribe",
        3: "Order",
        4: "Heartbeat",
    }

    @staticmethod
    def encode_subscribe(symbols: list, interval: str = "1m") -> bytes:
        """Encode subscribe message as protobuf."""
        # Simplified: normally use generated protobuf code
        message_type = 1
        encoded_symbols = ",".join(symbols).encode()
        encoded_interval = interval.encode()

        # Format: [type:1][symbol_len:2][symbols][interval_len:2][interval]
        return (
            struct.pack(">B", message_type) +
            struct.pack(">H", len(encoded_symbols)) +
            encoded_symbols +
            struct.pack(">H", len(encoded_interval)) +
            encoded_interval
        )

    @staticmethod
    def decode_message(data: bytes) -> dict:
        """Decode binary protobuf message."""
        if len(data) < 1:
            raise ValueError("Message too short")

        message_type = data[0]

        if message_type == 1:  # Subscribe
            symbol_len = struct.unpack(">H", data[1:3])[0]
            symbols = data[3:3+symbol_len].decode().split(",")
            interval_len = struct.unpack(">H", data[3+symbol_len:5+symbol_len])[0]
            interval = data[5+symbol_len:5+symbol_len+interval_len].decode()

            return {
                "type": "subscribe",
                "symbols": symbols,
                "interval": interval,
            }

        raise ValueError(f"Unknown message type: {message_type}")
```

---

## Authentication & Authorization

### WebSocket Upgrade Authentication

```python
from fastapi import WebSocket, HTTPException
from fastapi.security import HTTPBearer
import jwt
from datetime import datetime, timedelta

security = HTTPBearer()

async def get_websocket_user(websocket: WebSocket) -> dict:
    """
    Extract and validate user from WebSocket connection.

    Authentication occurs at UPGRADE, not per-message.
    This reduces per-message overhead.
    """
    # Get token from query parameters or headers
    token = websocket.query_params.get("token")

    if not token:
        # Try Authorization header
        auth_header = websocket.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(status_code=401, detail="No token provided")

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
        )
        user_id = payload.get("sub")
        scopes = payload.get("scopes", [])
        exp = datetime.fromtimestamp(payload.get("exp"))

        if datetime.utcnow() > exp:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            raise HTTPException(status_code=401, detail="Token expired")

        return {
            "user_id": user_id,
            "scopes": scopes,
            "token_exp": exp,
        }

    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(status_code=401, detail="Invalid token")


# Permission check per message
async def check_permission(user: dict, action: str, resource: str) -> bool:
    """Verify user has permission for action."""
    required_scopes = {
        ("subscribe", "market_data"): ["read:market"],
        ("order", "trading"): ["write:orders"],
        ("admin", "settings"): ["admin"],
    }

    required = required_scopes.get((action, resource), [])
    return any(scope in user.get("scopes", []) for scope in required)


@app.websocket("/ws/market/{symbol}")
async def websocket_market(websocket: WebSocket, symbol: str):
    """Authenticated WebSocket endpoint."""
    try:
        user = await get_websocket_user(websocket)
    except HTTPException:
        return

    await manager.connect(websocket, user["user_id"], symbol)

    try:
        while True:
            data = await websocket.receive_json()

            # Check permission per message
            if data.get("type") == "order":
                has_perm = await check_permission(user, "order", "trading")
                if not has_perm:
                    await websocket.send_json({
                        "type": "error",
                        "code": "permission_denied",
                        "message": "Permission denied for order placement",
                    })
                    continue

    except WebSocketDisconnect:
        await manager.disconnect(user["user_id"], symbol)
```

---

## Room/Channel Management

### Channel Subscription Model

```python
from typing import Set
from dataclasses import dataclass, field

@dataclass
class Room:
    """Represents a WebSocket room/channel."""
    room_id: str
    users: Dict[str, WebSocket] = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)

    def add_user(self, user_id: str, websocket: WebSocket):
        self.users[user_id] = websocket

    def remove_user(self, user_id: str):
        if user_id in self.users:
            del self.users[user_id]

    def has_users(self) -> bool:
        return len(self.users) > 0


class RoomManager:
    """Manages WebSocket rooms with subscription model."""

    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self.user_rooms: Dict[str, Set[str]] = {}  # user_id -> room_ids
        self.lock = asyncio.Lock()

    async def create_room(
        self,
        room_id: str,
        metadata: dict = None
    ) -> Room:
        """Create or get existing room."""
        async with self.lock:
            if room_id not in self.rooms:
                self.rooms[room_id] = Room(
                    room_id=room_id,
                    metadata=metadata or {}
                )
            return self.rooms[room_id]

    async def subscribe_user(
        self,
        user_id: str,
        room_id: str,
        websocket: WebSocket
    ):
        """Subscribe user to room."""
        async with self.lock:
            room = await self.create_room(room_id)
            room.add_user(user_id, websocket)

            if user_id not in self.user_rooms:
                self.user_rooms[user_id] = set()
            self.user_rooms[user_id].add(room_id)

            logger.info(f"User {user_id} subscribed to room {room_id}")

    async def unsubscribe_user(self, user_id: str, room_id: str):
        """Unsubscribe user from room."""
        async with self.lock:
            if room_id in self.rooms:
                self.rooms[room_id].remove_user(user_id)

                # Delete empty room
                if not self.rooms[room_id].has_users():
                    del self.rooms[room_id]

            if user_id in self.user_rooms:
                self.user_rooms[user_id].discard(room_id)

    async def broadcast_to_room(
        self,
        room_id: str,
        message: dict,
        exclude_user: str = None
    ):
        """Broadcast to all users in room."""
        async with self.lock:
            if room_id not in self.rooms:
                return

            room = self.rooms[room_id]
            failed_users = []

            for user_id, ws in room.users.items():
                if exclude_user and user_id == exclude_user:
                    continue

                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.error(f"Broadcast failed to {user_id}: {e}")
                    failed_users.append(user_id)

        # Clean up failed connections
        for user_id in failed_users:
            await self.unsubscribe_user(user_id, room_id)

    async def get_room_users(self, room_id: str) -> list:
        """Get all users in a room."""
        async with self.lock:
            if room_id in self.rooms:
                return list(self.rooms[room_id].users.keys())
        return []


room_manager = RoomManager()

@app.websocket("/ws/room/{room_id}")
async def websocket_room(websocket: WebSocket, room_id: str, user_id: str):
    await websocket.accept()

    await room_manager.subscribe_user(user_id, room_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "message":
                # Echo to room
                await room_manager.broadcast_to_room(room_id, {
                    "type": "message",
                    "user_id": user_id,
                    "content": data.get("content"),
                    "timestamp": datetime.utcnow().isoformat(),
                })

            elif data.get("type") == "leave":
                await room_manager.unsubscribe_user(user_id, room_id)
                break

    except WebSocketDisconnect:
        await room_manager.unsubscribe_user(user_id, room_id)
```

---

## Scaling with Redis Pub/Sub

### Distributed Message Broadcasting

```python
import aioredis

class DistributedConnectionManager:
    """
    Scales WebSocket connections across multiple server instances.

    Each server:
    1. Maintains local connections
    2. Subscribes to Redis pub/sub channels
    3. Broadcasts local messages to Redis
    4. Delivers Redis messages to local connections
    """

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self.redis_pub = None
        self.redis_sub = None
        self.local_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def init_redis(self):
        """Initialize Redis clients."""
        self.redis_pub = await aioredis.from_url(self.redis_url)
        self.redis_sub = await aioredis.from_url(self.redis_url)

    async def subscribe_to_channels(self, channels: list):
        """Subscribe to Redis pub/sub channels."""
        pubsub = self.redis_sub.pubsub()
        await pubsub.subscribe(*channels)

        # Listen for Redis messages
        async for message in pubsub.listen():
            if message["type"] == "message":
                channel = message["channel"].decode()
                data = json.loads(message["data"])

                # Deliver to local connections
                await self._deliver_to_local(channel, data)

    async def _deliver_to_local(self, channel: str, message: dict):
        """Deliver Redis message to local connections."""
        async with self.lock:
            if channel in self.local_connections:
                failed_users = []

                for user_id, ws in self.local_connections[channel].items():
                    try:
                        await ws.send_json(message)
                    except Exception as e:
                        logger.error(f"Delivery failed to {user_id}: {e}")
                        failed_users.append(user_id)

                # Clean up failed connections
                for user_id in failed_users:
                    del self.local_connections[channel][user_id]

    async def broadcast_to_channel(self, channel: str, message: dict):
        """
        Broadcast to all users in channel (across all servers).

        Publishes to Redis so all servers deliver to their local connections.
        """
        await self.redis_pub.publish(
            channel,
            json.dumps(message)
        )

    async def connect_user(self, user_id: str, channel: str, ws: WebSocket):
        """Register local connection."""
        async with self.lock:
            if channel not in self.local_connections:
                self.local_connections[channel] = {}
            self.local_connections[channel][user_id] = ws

    async def disconnect_user(self, user_id: str, channel: str):
        """Unregister local connection."""
        async with self.lock:
            if channel in self.local_connections:
                if user_id in self.local_connections[channel]:
                    del self.local_connections[channel][user_id]


# Usage with FastAPI lifespan
distributed_manager = DistributedConnectionManager("redis://localhost:6379")

@app.on_event("startup")
async def startup():
    await distributed_manager.init_redis()
    asyncio.create_task(distributed_manager.subscribe_to_channels([
        "market_data",
        "user_notifications",
        "orders",
    ]))

@app.websocket("/ws/market/{symbol}")
async def websocket_market(websocket: WebSocket, symbol: str, user_id: str):
    await websocket.accept()
    await distributed_manager.connect_user(user_id, f"market_{symbol}", websocket)

    try:
        while True:
            data = await websocket.receive_json()

            # Broadcast to all servers via Redis
            await distributed_manager.broadcast_to_channel(
                f"market_{symbol}",
                {
                    "type": "update",
                    "user_id": user_id,
                    "data": data,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
    except WebSocketDisconnect:
        await distributed_manager.disconnect_user(user_id, f"market_{symbol}")
```

---

## Rate Limiting & Backpressure

### Per-Connection Rate Limiting

```python
from collections import deque
from time import time

class RateLimiter:
    """Token bucket rate limiter per connection."""

    def __init__(self, rate: int, window: float = 1.0):
        """
        rate: max messages per window
        window: time window in seconds (default 1 second)
        """
        self.rate = rate
        self.window = window
        self.tokens = deque()

    def is_allowed(self) -> bool:
        """Check if message is allowed under rate limit."""
        now = time()

        # Remove expired tokens
        while self.tokens and self.tokens[0] < now - self.window:
            self.tokens.popleft()

        # Allow if under limit
        if len(self.tokens) < self.rate:
            self.tokens.append(now)
            return True

        return False


class BackpressureManager:
    """Manage client backpressure (buffer management)."""

    def __init__(self, max_queue_size: int = 1000):
        self.max_queue_size = max_queue_size
        self.queues: Dict[str, asyncio.Queue] = {}

    async def enqueue_message(
        self,
        user_id: str,
        message: dict
    ) -> bool:
        """
        Enqueue message for processing.

        Returns False if queue is full (backpressure).
        """
        if user_id not in self.queues:
            self.queues[user_id] = asyncio.Queue(maxsize=self.max_queue_size)

        try:
            # Non-blocking put
            self.queues[user_id].put_nowait(message)
            return True
        except asyncio.QueueFull:
            logger.warning(f"Queue full for {user_id}, applying backpressure")
            return False

    async def get_message(self, user_id: str) -> dict:
        """Get next message from queue."""
        if user_id not in self.queues:
            self.queues[user_id] = asyncio.Queue()

        return await self.queues[user_id].get()


@app.websocket("/ws/market/{symbol}")
async def websocket_market(websocket: WebSocket, symbol: str, user_id: str):
    await websocket.accept()

    rate_limiter = RateLimiter(rate=100, window=1.0)  # 100 messages/sec
    backpressure = BackpressureManager(max_queue_size=500)

    try:
        while True:
            data = await websocket.receive_json()

            # Check rate limit
            if not rate_limiter.is_allowed():
                await websocket.send_json({
                    "type": "error",
                    "code": "rate_limit_exceeded",
                    "message": "Too many messages, please slow down",
                    "retry_after": 1,
                })
                continue

            # Check backpressure
            if not await backpressure.enqueue_message(user_id, data):
                await websocket.send_json({
                    "type": "error",
                    "code": "backpressure",
                    "message": "Server overloaded, please retry",
                })
                continue

            # Process message
            message = await backpressure.get_message(user_id)
            await process_market_message(symbol, user_id, message)

    except WebSocketDisconnect:
        pass
```

---

## Message Ordering & Delivery Guarantees

### Ordered Delivery Pattern

```python
from enum import Enum

class DeliveryGuarantee(Enum):
    AT_MOST_ONCE = "at_most_once"      # Fire and forget
    AT_LEAST_ONCE = "at_least_once"    # Resend until ACK
    EXACTLY_ONCE = "exactly_once"      # Exactly once (hardest)


class OrderedMessageQueue:
    """
    Ensures messages are delivered to client in order.

    Each client gets a sequence number, client ACKs to confirm delivery.
    Server tracks unacknowledged messages for retry.
    """

    def __init__(self, user_id: str, guarantee: DeliveryGuarantee):
        self.user_id = user_id
        self.guarantee = guarantee
        self.sequence = 0
        self.pending_acks: Dict[int, dict] = {}  # seq_num -> message
        self.websocket = None

    async def send_message(self, message: dict) -> int:
        """
        Send message with sequence number.

        Returns: sequence number
        """
        self.sequence += 1
        seq_num = self.sequence

        # Add metadata
        message_with_seq = {
            **message,
            "_seq": seq_num,
            "_timestamp": datetime.utcnow().isoformat(),
        }

        if self.guarantee != DeliveryGuarantee.AT_MOST_ONCE:
            # Track for retry
            self.pending_acks[seq_num] = message_with_seq

        try:
            await self.websocket.send_json(message_with_seq)
        except Exception as e:
            logger.error(f"Send failed: {e}")
            if self.guarantee != DeliveryGuarantee.AT_MOST_ONCE:
                # Will retry on reconnect
                pass

        return seq_num

    async def handle_ack(self, seq_num: int):
        """Client ACKed receipt of message."""
        if seq_num in self.pending_acks:
            del self.pending_acks[seq_num]

    async def retry_pending(self):
        """Retry all unacknowledged messages."""
        for seq_num in sorted(self.pending_acks.keys()):
            message = self.pending_acks[seq_num]
            try:
                await self.websocket.send_json(message)
            except Exception as e:
                logger.error(f"Retry failed for seq {seq_num}: {e}")


# Client-side ordering
class OrderedWebSocketClient:
    """Client-side message ordering with ACK."""

    def __init__(self, url: str):
        self.url = url
        self.ws = None
        self.received_sequences = set()
        self.message_buffer = {}  # seq -> message
        self.next_expected = 0

    async def connect(self):
        self.ws = await websockets.connect(self.url)

    async def receive_ordered(self):
        """
        Receive messages in order.

        Buffers out-of-order messages until gaps filled.
        """
        async for raw_message in self.ws:
            message = json.loads(raw_message)
            seq = message.get("_seq")

            if seq is None:
                # No sequence, deliver immediately
                yield message
                continue

            # Send ACK
            await self.ws.send(json.dumps({
                "type": "ack",
                "_seq": seq,
            }))

            # Buffer out-of-order
            if seq > self.next_expected:
                self.message_buffer[seq] = message
                continue

            if seq == self.next_expected:
                # Deliver in-order message
                yield message
                self.next_expected += 1

                # Flush buffered messages
                while self.next_expected in self.message_buffer:
                    buffered = self.message_buffer.pop(self.next_expected)
                    yield buffered
                    self.next_expected += 1


# Usage
@app.websocket("/ws/orders/{user_id}")
async def websocket_orders(websocket: WebSocket, user_id: str):
    await websocket.accept()

    order_queue = OrderedMessageQueue(
        user_id,
        guarantee=DeliveryGuarantee.EXACTLY_ONCE
    )
    order_queue.websocket = websocket

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "ack":
                # Client acknowledged
                await order_queue.handle_ack(data.get("_seq"))

            elif data.get("type") == "order":
                # Process order and send confirmation
                order_id = await process_order(user_id, data)
                await order_queue.send_message({
                    "type": "order_confirmed",
                    "order_id": order_id,
                    "status": "confirmed",
                })

    except WebSocketDisconnect:
        # Client reconnecting will get pending messages
        pass
```

---

## Load Testing & Benchmarking

### WebSocket Load Test with Locust

```python
from locust import HttpUser, task, between, events
import websocket
import json
import time
import threading

class WebSocketUser(HttpUser):
    """WebSocket load test user."""

    wait_time = between(1, 3)

    def on_start(self):
        """Initialize connection."""
        self.ws = None
        self.connect_time = None
        self.receive_count = 0
        self.send_count = 0

    def connect_websocket(self):
        """Establish WebSocket connection."""
        try:
            self.connect_time = time.time()
            self.ws = websocket.WebSocketApp(
                f"ws://localhost:8000/ws/market/BTCUSDT?user_id=user_{int(time.time())}",
                on_message=self.on_message,
                on_error=self.on_error,
                on_close=self.on_close,
            )

            wst = threading.Thread(target=self.ws.run_forever)
            wst.daemon = True
            wst.start()

            # Wait for connection
            time.sleep(0.5)

        except Exception as e:
            print(f"Connection error: {e}")

    def on_message(self, ws, message):
        """Receive message."""
        self.receive_count += 1

    def on_error(self, ws, error):
        """Handle error."""
        print(f"WebSocket error: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        """Handle close."""
        print("WebSocket closed")

    @task(1)
    def send_message(self):
        """Send message to server."""
        if self.ws and self.ws.keep_running:
            self.ws.send(json.dumps({
                "type": "subscribe",
                "symbols": ["BTCUSDT"],
            }))
            self.send_count += 1


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Print test results."""
    print(f"\n=== WebSocket Load Test Results ===")
    print(f"Total users: {environment.stats.num_clients}")
    print(f"Requests: {len(environment.stats.requests)}")

    for request_type, stats in environment.stats.requests.items():
        print(f"\n{request_type}:")
        print(f"  Min: {stats.min_response_time:.2f}ms")
        print(f"  Max: {stats.max_response_time:.2f}ms")
        print(f"  Avg: {stats.avg_response_time:.2f}ms")
        print(f"  Median: {stats.median_response_time:.2f}ms")


# Run with: locust -f load_test.py --host=http://localhost:8000
```

### Async Load Test with aiohttp

```python
import aiohttp
import asyncio
import websockets
import time

async def websocket_load_test(
    num_users: int,
    duration: int,
    url: str
):
    """
    Stress test WebSocket server.

    Args:
        num_users: Number of concurrent connections
        duration: Test duration in seconds
        url: WebSocket URL
    """
    start_time = time.time()
    metrics = {
        "connected": 0,
        "failed": 0,
        "messages_sent": 0,
        "messages_received": 0,
        "errors": 0,
    }

    async def client_task(client_id: int):
        try:
            async with websockets.connect(
                f"{url}?user_id=load_test_{client_id}"
            ) as ws:
                metrics["connected"] += 1

                # Send subscribe message
                await ws.send(json.dumps({
                    "type": "subscribe",
                    "symbols": ["BTCUSDT"],
                }))
                metrics["messages_sent"] += 1

                # Receive messages until test duration
                while time.time() - start_time < duration:
                    try:
                        message = await asyncio.wait_for(ws.recv(), timeout=5.0)
                        metrics["messages_received"] += 1
                    except asyncio.TimeoutError:
                        pass

        except Exception as e:
            metrics["failed"] += 1
            metrics["errors"] += 1
            print(f"Client {client_id} error: {e}")

    # Launch all clients
    tasks = [client_task(i) for i in range(num_users)]
    await asyncio.gather(*tasks, return_exceptions=True)

    # Print results
    elapsed = time.time() - start_time
    print(f"\n=== Load Test Results ===")
    print(f"Duration: {elapsed:.2f}s")
    print(f"Users connected: {metrics['connected']}/{num_users}")
    print(f"Users failed: {metrics['failed']}")
    print(f"Messages sent: {metrics['messages_sent']}")
    print(f"Messages received: {metrics['messages_received']}")
    print(f"Throughput: {metrics['messages_received']/elapsed:.0f} msg/s")
    print(f"Errors: {metrics['errors']}")


# Run test
asyncio.run(websocket_load_test(
    num_users=1000,
    duration=60,
    url="ws://localhost:8000/ws/market/BTCUSDT"
))
```

---

## Production Checklist

### Deployment & Monitoring

- [ ] **Connection Limits**: Configure OS limits (`ulimit -n`), connection pool sizes
- [ ] **Memory Leaks**: Monitor per-connection memory, implement connection cleanup
- [ ] **Graceful Shutdown**: Wait for all connections to close before shutdown
- [ ] **Metrics**: Track active connections, messages/sec, error rates, latency
- [ ] **Logging**: Log connection lifecycle, errors, rate limit violations
- [ ] **Timeout Configuration**: Set read timeout, write timeout, idle timeout
- [ ] **TLS/SSL**: Use WSS (WebSocket Secure) in production
- [ ] **Load Balancing**: Ensure sticky sessions or use Redis pub/sub for scaling
- [ ] **Monitoring**: Alert on connection failures, message lag, queue depth
- [ ] **Documentation**: Document message formats, error codes, reconnection strategy

### Security Checklist

- [ ] **Token Expiration**: Validate token expiry at connection upgrade
- [ ] **XSS Prevention**: Sanitize all incoming messages
- [ ] **Rate Limiting**: Implement per-connection message rate limits
- [ ] **Injection Attacks**: Validate message structure and content types
- [ ] **DoS Protection**: Implement connection limits and backpressure
- [ ] **Message Validation**: Enforce strict schema validation
- [ ] **Authentication**: Require authentication before connection upgrade
- [ ] **Encryption**: Use WSS, encrypt sensitive data in messages

---

## Summary

WebSocket validation requires careful attention to:

1. **Connection Lifecycle**: Proper state management and cleanup
2. **Heartbeat Mechanisms**: Detect dead connections early
3. **Message Validation**: Enforce schema compliance
4. **Authentication**: Secure at upgrade, not per-message
5. **Scaling**: Use Redis pub/sub for multi-server deployments
6. **Rate Limiting**: Protect against resource exhaustion
7. **Message Ordering**: Handle delivery guarantees appropriately
8. **Load Testing**: Verify performance under stress
9. **Monitoring**: Track metrics for production reliability
10. **Error Handling**: Graceful degradation and reconnection

Production WebSocket systems require comprehensive testing, monitoring, and careful architectural choices based on latency, throughput, and reliability requirements.
