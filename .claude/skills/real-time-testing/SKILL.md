# Real-Time System Testing Skill

## Overview

Real-time systems present unique testing challenges: asynchronicity, non-determinism, race conditions, and distributed state. This skill provides enterprise-grade strategies for testing WebSockets, event-driven architectures, message queues, and concurrent operations.

---

## WebSocket Testing

### Jest + Socket.IO Testing

```javascript
// __tests__/websocket/socketConnection.test.js
import io from 'socket.io-client';
import { Server } from 'socket.io';
import { createServer } from 'http';

describe('WebSocket Connection', () => {
  let server, serverSocket, clientSocket;

  beforeAll((done) => {
    // Create HTTP server and Socket.IO server
    const httpServer = createServer();
    server = new Server(httpServer, {
      cors: { origin: '*' }
    });

    httpServer.listen(() => {
      const port = httpServer.address().port;

      // Create client connection
      clientSocket = io(`http://localhost:${port}`);
      server.on('connection', (socket) => {
        serverSocket = socket;
      });

      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    server.close();
    clientSocket.disconnect();
  });

  it('should establish connection', (done) => {
    expect(clientSocket.connected).toBe(true);
    done();
  });

  it('should emit and receive messages', (done) => {
    serverSocket.on('message', (data) => {
      expect(data).toEqual({ text: 'Hello Server' });
      done();
    });

    clientSocket.emit('message', { text: 'Hello Server' });
  });

  it('should broadcast to multiple clients', (done) => {
    const client2 = io(`http://localhost:${server.address().port}`);

    server.on('connection', (socket) => {
      socket.on('broadcast', (data) => {
        server.emit('broadcast_received', data);
      });
    });

    client2.on('broadcast_received', (data) => {
      expect(data).toEqual({ from: 'client1' });
      client2.disconnect();
      done();
    });

    clientSocket.emit('broadcast', { from: 'client1' });
  });

  it('should handle disconnection gracefully', (done) => {
    const testClient = io(`http://localhost:${server.address().port}`);

    server.on('connection', (socket) => {
      socket.on('disconnect', () => {
        expect(socket.connected).toBe(false);
        done();
      });
    });

    testClient.disconnect();
  });
});
```

### Manual WebSocket Testing with ws Library

```javascript
// test/websocket/webSocketManual.test.js
import WebSocket from 'ws';

describe('WebSocket Manual Testing', () => {
  let server, wss;

  beforeAll(() => {
    // Create WebSocket server
    const http = require('http');
    server = http.createServer();
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        // Echo back with timestamp
        ws.send(JSON.stringify({
          echo: JSON.parse(data),
          timestamp: Date.now()
        }));
      });
    });

    server.listen(8080);
  });

  afterAll(() => {
    wss.close();
    server.close();
  });

  it('should handle high-frequency messages', async () => {
    const ws = new WebSocket('ws://localhost:8080');
    const messages = [];

    ws.on('message', (data) => {
      messages.push(JSON.parse(data));
    });

    await new Promise(resolve => ws.on('open', resolve));

    // Send 1000 messages rapidly
    for (let i = 0; i < 1000; i++) {
      ws.send(JSON.stringify({ id: i, value: Math.random() }));
    }

    // Wait for all responses
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (messages.length === 1000) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 10);
    });

    expect(messages.length).toBe(1000);
    ws.close();
  });

  it('should reconnect after connection loss', async () => {
    const ws = new WebSocket('ws://localhost:8080');
    let connectionCount = 0;

    ws.on('open', () => {
      connectionCount++;
      if (connectionCount === 1) {
        // Simulate connection drop
        ws.terminate();
      }
    });

    ws.on('close', () => {
      // Reconnect
      const ws2 = new WebSocket('ws://localhost:8080');
      ws2.on('open', () => {
        expect(connectionCount >= 1).toBe(true);
        ws2.close();
      });
    });
  });
});
```

---

## Event-Driven Architecture Testing

### Testing Event Emitters

```javascript
// __tests__/events/eventEmitter.test.js
import EventEmitter from 'events';

class TradeEventEmitter extends EventEmitter {
  executeTrade(order) {
    this.emit('trade:started', { orderId: order.id });

    setTimeout(() => {
      this.emit('trade:executing', { orderId: order.id, price: order.price });
    }, 100);

    setTimeout(() => {
      this.emit('trade:completed', { orderId: order.id, timestamp: Date.now() });
    }, 200);
  }
}

describe('Trade Event Emitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new TradeEventEmitter();
  });

  it('should emit events in correct order', (done) => {
    const events = [];

    emitter.on('trade:started', (data) => {
      events.push('started');
    });

    emitter.on('trade:executing', (data) => {
      events.push('executing');
    });

    emitter.on('trade:completed', (data) => {
      events.push('completed');
      expect(events).toEqual(['started', 'executing', 'completed']);
      done();
    });

    emitter.executeTrade({ id: 'order123', price: 50000 });
  });

  it('should handle multiple listeners', (done) => {
    const listener1Calls = [];
    const listener2Calls = [];

    emitter.on('trade:completed', (data) => {
      listener1Calls.push(data);
    });

    emitter.on('trade:completed', (data) => {
      listener2Calls.push(data);

      if (listener1Calls.length === 2 && listener2Calls.length === 2) {
        expect(listener1Calls.length).toBe(2);
        expect(listener2Calls.length).toBe(2);
        done();
      }
    });

    emitter.executeTrade({ id: 'order1', price: 50000 });
    emitter.executeTrade({ id: 'order2', price: 51000 });
  });

  it('should allow removing listeners', () => {
    let callCount = 0;
    const handler = () => { callCount++; };

    emitter.on('trade:started', handler);
    emitter.executeTrade({ id: 'order1', price: 50000 });

    expect(callCount).toBe(1);

    emitter.removeListener('trade:started', handler);
    emitter.executeTrade({ id: 'order2', price: 51000 });

    expect(callCount).toBe(1); // Not called again
  });

  it('should handle error events', (done) => {
    emitter.on('error', (error) => {
      expect(error.message).toBe('Trade failed');
      done();
    });

    emitter.emit('error', new Error('Trade failed'));
  });
});
```

---

## Message Queue Testing

### Kafka Testing with Testcontainers

```javascript
// __tests__/kafka/kafkaIntegration.test.js
import { KafkaContainer } from 'testcontainers';
import { Kafka } from 'kafkajs';

describe('Kafka Message Queue', () => {
  let container, kafka, producer, consumer;

  beforeAll(async () => {
    // Start Kafka container
    container = await new KafkaContainer().start();

    const brokerAddress = container.getBootstrapServers();
    kafka = new Kafka({
      clientId: 'test-app',
      brokers: [brokerAddress]
    });

    producer = kafka.producer();
    await producer.connect();
  });

  afterAll(async () => {
    await producer.disconnect();
    await container.stop();
  });

  it('should produce and consume messages', async () => {
    const topic = 'test-topic';
    const messages = [];

    // Create topic and consumer
    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({
      topics: [{ name: topic, numPartitions: 1 }]
    });
    await admin.disconnect();

    consumer = kafka.consumer({ groupId: 'test-group' });
    await consumer.connect();
    await consumer.subscribe({ topic });

    // Start consuming
    const consumerPromise = consumer.run({
      eachMessage: async ({ message }) => {
        messages.push(message.value.toString());
      }
    });

    // Wait for subscription
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Produce messages
    await producer.send({
      topic,
      messages: [
        { value: 'message1' },
        { value: 'message2' },
        { value: 'message3' }
      ]
    });

    // Wait for consumption
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (messages.length === 3) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });

    expect(messages).toContain('message1');
    expect(messages).toContain('message2');
    expect(messages).toContain('message3');

    await consumer.disconnect();
  });

  it('should handle message ordering', async () => {
    const topic = 'order-topic';
    const receivedMessages = [];
    const partition = 0;

    // Setup
    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({
      topics: [{ name: topic, numPartitions: 1 }]
    });
    await admin.disconnect();

    consumer = kafka.consumer({ groupId: 'order-test-group' });
    await consumer.connect();
    await consumer.subscribe({ topic });

    const consumerPromise = consumer.run({
      eachMessage: async ({ message }) => {
        receivedMessages.push(parseInt(message.value.toString()));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send ordered messages
    for (let i = 0; i < 100; i++) {
      await producer.send({
        topic,
        messages: [{ value: String(i), partition }]
      });
    }

    // Wait for all messages
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (receivedMessages.length === 100) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 10000);
    });

    // Verify ordering
    for (let i = 0; i < receivedMessages.length; i++) {
      expect(receivedMessages[i]).toBe(i);
    }

    await consumer.disconnect();
  });

  it('should handle consumer group rebalancing', async () => {
    const topic = 'rebalance-topic';

    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({
      topics: [{ name: topic, numPartitions: 3 }]
    });
    await admin.disconnect();

    const group = 'rebalance-group';
    const consumers = [];
    const messages = [[], [], []];

    // Start 3 consumers
    for (let i = 0; i < 3; i++) {
      const c = kafka.consumer({ groupId: group });
      await c.connect();
      await c.subscribe({ topic });

      const index = i;
      await c.run({
        eachMessage: async ({ message }) => {
          messages[index].push(message.value.toString());
        }
      });

      consumers.push(c);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send messages
    await producer.send({
      topic,
      messages: Array.from({ length: 30 }, (_, i) => ({
        value: String(i)
      }))
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify messages distributed
    const totalMessages = messages.reduce((sum, m) => sum + m.length, 0);
    expect(totalMessages).toBeGreaterThanOrEqual(30);

    // Cleanup
    for (const c of consumers) {
      await c.disconnect();
    }
  });
});
```

### RabbitMQ Testing

```javascript
// __tests__/rabbitmq/rabbitmqIntegration.test.js
import amqp from 'amqplib';

describe('RabbitMQ Message Queue', () => {
  let connection, channel;

  beforeAll(async () => {
    connection = await amqp.connect('amqp://guest:guest@localhost');
    channel = await connection.createChannel();
  });

  afterAll(async () => {
    await channel.close();
    await connection.close();
  });

  it('should publish and consume messages', async () => {
    const queue = 'test-queue';
    const messages = [];

    // Declare queue
    await channel.assertQueue(queue, { durable: false });

    // Consume messages
    const consumerTag = await channel.consume(queue, (msg) => {
      if (msg) {
        messages.push(msg.content.toString());
        channel.ack(msg);
      }
    });

    // Publish messages
    await channel.sendToQueue(queue, Buffer.from('Hello'));
    await channel.sendToQueue(queue, Buffer.from('World'));

    // Wait for messages
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (messages.length === 2) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 1000);
    });

    expect(messages).toEqual(['Hello', 'World']);

    await channel.cancel(consumerTag);
  });

  it('should handle dead letter queues', async () => {
    const mainQueue = 'dlq-main';
    const dlQueue = 'dlq-dead-letter';

    // Declare dead letter queue
    await channel.assertQueue(dlQueue, { durable: false });

    // Declare main queue with DLX
    await channel.assertQueue(mainQueue, {
      durable: false,
      arguments: {
        'x-dead-letter-exchange': 'dlx',
        'x-message-ttl': 1000 // 1 second expiry
      }
    });

    await channel.assertExchange('dlx', 'direct', { durable: false });
    await channel.bindQueue(dlQueue, 'dlx', mainQueue);

    const dlMessages = [];

    // Consume dead letter queue
    await channel.consume(dlQueue, (msg) => {
      if (msg) {
        dlMessages.push(msg.content.toString());
        channel.ack(msg);
      }
    });

    // Send message that will expire
    await channel.sendToQueue(mainQueue, Buffer.from('Will expire'));

    // Wait for message to move to DLQ
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(dlMessages.length).toBeGreaterThan(0);
  });
});
```

---

## Server-Sent Events (SSE) Testing

```javascript
// __tests__/sse/sseStreaming.test.js
import express from 'express';
import { createServer } from 'http';

describe('Server-Sent Events', () => {
  let server, app;

  beforeAll(() => {
    app = express();

    app.get('/events', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let count = 0;
      const interval = setInterval(() => {
        count++;
        res.write(`data: ${JSON.stringify({ count, timestamp: Date.now() })}\n\n`);

        if (count >= 5) {
          clearInterval(interval);
          res.end();
        }
      }, 100);
    });

    server = createServer(app);
    server.listen(3001);
  });

  afterAll(() => {
    server.close();
  });

  it('should receive server sent events', async () => {
    const events = [];

    const response = await fetch('http://localhost:3001/events');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let complete = false;

    while (!complete) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.replace('data: ', ''));
          events.push(data);
        }
      }

      if (events.length >= 5) {
        complete = true;
      }
    }

    expect(events.length).toBe(5);
    expect(events[0].count).toBe(1);
    expect(events[4].count).toBe(5);
  });
});
```

---

## Concurrency and Race Condition Testing

### Testing Concurrent Operations

```javascript
// __tests__/concurrency/raceConditions.test.js
class BankAccount {
  constructor(initialBalance = 0) {
    this.balance = initialBalance;
    this.lock = Promise.resolve();
  }

  async withdraw(amount) {
    // Wait for lock
    await this.lock;

    // Simulated async operation
    await new Promise(resolve => setTimeout(resolve, 10));

    if (this.balance >= amount) {
      this.balance -= amount;
      return true;
    }
    return false;
  }

  async deposit(amount) {
    await this.lock;
    await new Promise(resolve => setTimeout(resolve, 10));
    this.balance += amount;
  }
}

describe('Concurrency Testing', () => {
  it('should prevent race conditions with locking', async () => {
    const account = new BankAccount(1000);

    // Attempt concurrent withdrawals
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(account.withdraw(10));
    }

    const results = await Promise.all(promises);
    const successfulWithdrawals = results.filter(r => r).length;

    // Should only allow 100 withdrawals (1000 / 10)
    expect(successfulWithdrawals).toBe(100);
    expect(account.balance).toBe(0);
  });

  it('should handle concurrent reads correctly', async () => {
    const account = new BankAccount(5000);

    // Read balance concurrently
    const reads = [];
    for (let i = 0; i < 1000; i++) {
      reads.push(
        new Promise(resolve => {
          setTimeout(() => resolve(account.balance), Math.random() * 10);
        })
      );
    }

    const balances = await Promise.all(reads);

    // All reads should return same value
    expect(new Set(balances).size).toBe(1);
    expect(balances[0]).toBe(5000);
  });

  it('should detect lost updates without locking', async () => {
    class UnsafeCounter {
      constructor() {
        this.count = 0;
      }

      async increment() {
        const current = this.count;
        await new Promise(resolve => setTimeout(resolve, 1));
        this.count = current + 1;
      }
    }

    const counter = new UnsafeCounter();
    const increments = [];

    for (let i = 0; i < 100; i++) {
      increments.push(counter.increment());
    }

    await Promise.all(increments);

    // Should be 100, but will be less due to race condition
    expect(counter.count).toBeLessThan(100);
  });
});
```

### Timeout and Deadlock Detection

```javascript
// __tests__/concurrency/deadlockDetection.test.js
class DeadlockDetector {
  constructor(timeoutMs = 5000) {
    this.timeoutMs = timeoutMs;
  }

  async detectDeadlock(operation) {
    return Promise.race([
      operation(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Operation deadlocked or timed out')),
          this.timeoutMs
        )
      )
    ]);
  }
}

describe('Deadlock Detection', () => {
  it('should detect infinite waits', async () => {
    const detector = new DeadlockDetector(500);

    const operation = async () => {
      // Infinite wait
      await new Promise(() => {});
    };

    await expect(detector.detectDeadlock(operation))
      .rejects
      .toThrow('deadlocked');
  });

  it('should allow normal operations to complete', async () => {
    const detector = new DeadlockDetector(1000);

    const operation = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'success';
    };

    const result = await detector.detectDeadlock(operation);
    expect(result).toBe('success');
  });
});
```

---

## Load Testing for Real-Time Systems

### Sustained Load Testing

```javascript
// test/load/realTimeLoadTest.js
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class RealTimeLoadTester {
  constructor(url, options = {}) {
    this.url = url;
    this.clientCount = options.clientCount || 100;
    this.messageRate = options.messageRate || 10; // msg/sec per client
    this.duration = options.duration || 60000; // ms
    this.metrics = {
      messagesReceived: 0,
      messagesSent: 0,
      latencies: [],
      errors: 0,
      disconnections: 0
    };
  }

  async run() {
    const clients = [];
    const startTime = performance.now();

    // Create clients
    for (let i = 0; i < this.clientCount; i++) {
      const client = this.createClient();
      clients.push(client);
    }

    // Let clients connect
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run load test
    const messageInterval = 1000 / this.messageRate;
    let messageCount = 0;

    const loadInterval = setInterval(() => {
      for (const client of clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          const timestamp = performance.now();
          client.ws.send(JSON.stringify({
            id: messageCount++,
            timestamp
          }));
          this.metrics.messagesSent++;
        }
      }
    }, messageInterval);

    // Run for specified duration
    await new Promise(resolve => {
      setTimeout(() => {
        clearInterval(loadInterval);
        resolve();
      }, this.duration);
    });

    const endTime = performance.now();

    // Close clients
    for (const client of clients) {
      client.ws.close();
    }

    const elapsed = endTime - startTime;

    return {
      ...this.metrics,
      durationMs: elapsed,
      averageLatency: this.metrics.latencies.length > 0
        ? this.metrics.latencies.reduce((a, b) => a + b) / this.metrics.latencies.length
        : 0,
      p95Latency: this.calculatePercentile(this.metrics.latencies, 0.95),
      p99Latency: this.calculatePercentile(this.metrics.latencies, 0.99),
      messagesPerSecond: (this.metrics.messagesSent / elapsed) * 1000
    };
  }

  createClient() {
    const ws = new WebSocket(this.url);
    const client = { ws };

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        const latency = performance.now() - msg.timestamp;
        this.metrics.latencies.push(latency);
        this.metrics.messagesReceived++;
      } catch (e) {
        this.metrics.errors++;
      }
    });

    ws.on('error', () => {
      this.metrics.errors++;
    });

    ws.on('close', () => {
      this.metrics.disconnections++;
    });

    return client;
  }

  calculatePercentile(arr, percentile) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index];
  }
}

// Usage
async function runLoadTest() {
  const tester = new RealTimeLoadTester('ws://localhost:8080', {
    clientCount: 1000,
    messageRate: 5,
    duration: 300000 // 5 minutes
  });

  const results = await tester.run();
  console.log('Load Test Results:', results);
}
```

---

## Latency Measurement

### Precise Latency Tracking

```javascript
// test/performance/latencyMeasurement.js
class LatencyMeasurer {
  constructor() {
    this.measurements = [];
  }

  async measureRoundTrip(operation) {
    const startNanoTime = process.hrtime.bigint();
    await operation();
    const endNanoTime = process.hrtime.bigint();

    const latencyMs = Number(endNanoTime - startNanoTime) / 1000000;
    this.measurements.push(latencyMs);

    return latencyMs;
  }

  getStatistics() {
    const sorted = [...this.measurements].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      min: Math.min(...sorted),
      max: Math.max(...sorted),
      mean: sum / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: this.calculateStdDev(sorted, sum / sorted.length)
    };
  }

  calculateStdDev(arr, mean) {
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return Math.sqrt(variance);
  }
}

// Test usage
describe('Message Latency', () => {
  it('should measure WebSocket round-trip latency', async () => {
    const measurer = new LatencyMeasurer();

    for (let i = 0; i < 1000; i++) {
      await measurer.measureRoundTrip(async () => {
        // Simulate message send and receive
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
      });
    }

    const stats = measurer.getStatistics();
    expect(stats.p95).toBeLessThan(100); // P95 should be < 100ms
  });
});
```

---

## Order-of-Events Verification

### Event Sequence Validation

```javascript
// __tests__/events/eventOrdering.test.js
class EventSequenceValidator {
  constructor(expectedSequence) {
    this.expectedSequence = expectedSequence;
    this.actualSequence = [];
    this.violations = [];
  }

  recordEvent(eventName) {
    this.actualSequence.push({
      name: eventName,
      timestamp: Date.now()
    });
  }

  validate() {
    const expectedNames = this.expectedSequence.map(e => e.name);
    const actualNames = this.actualSequence.map(e => e.name);

    // Check if actual matches expected
    let expectedIndex = 0;

    for (let i = 0; i < actualNames.length; i++) {
      if (actualNames[i] === expectedNames[expectedIndex]) {
        expectedIndex++;
      }
    }

    if (expectedIndex !== expectedNames.length) {
      this.violations.push({
        type: 'SEQUENCE_VIOLATED',
        expected: expectedNames,
        actual: actualNames
      });
    }

    // Check timing constraints
    for (let i = 0; i < this.expectedSequence.length - 1; i++) {
      const current = this.expectedSequence[i];
      const next = this.expectedSequence[i + 1];

      const currentTime = this.actualSequence
        .find(e => e.name === current.name)?.timestamp;
      const nextTime = this.actualSequence
        .find(e => e.name === next.name)?.timestamp;

      if (currentTime && nextTime && current.maxDelay) {
        const delay = nextTime - currentTime;
        if (delay > current.maxDelay) {
          this.violations.push({
            type: 'TIMING_VIOLATED',
            from: current.name,
            to: next.name,
            expectedDelay: current.maxDelay,
            actualDelay: delay
          });
        }
      }
    }

    return {
      isValid: this.violations.length === 0,
      violations: this.violations
    };
  }
}

describe('Event Ordering', () => {
  it('should maintain correct event sequence', async () => {
    const expectedSequence = [
      { name: 'user:login', maxDelay: 1000 },
      { name: 'auth:verified', maxDelay: 500 },
      { name: 'data:loaded', maxDelay: 2000 },
      { name: 'ui:rendered', maxDelay: 1000 }
    ];

    const validator = new EventSequenceValidator(expectedSequence);

    // Simulate events
    validator.recordEvent('user:login');
    await new Promise(resolve => setTimeout(resolve, 100));

    validator.recordEvent('auth:verified');
    await new Promise(resolve => setTimeout(resolve, 800));

    validator.recordEvent('data:loaded');
    await new Promise(resolve => setTimeout(resolve, 500));

    validator.recordEvent('ui:rendered');

    const result = validator.validate();
    expect(result.isValid).toBe(true);
  });

  it('should detect out-of-order events', async () => {
    const expectedSequence = [
      { name: 'request:start' },
      { name: 'processing:begin' },
      { name: 'processing:end' },
      { name: 'response:sent' }
    ];

    const validator = new EventSequenceValidator(expectedSequence);

    // Emit in wrong order
    validator.recordEvent('response:sent');
    validator.recordEvent('request:start');
    validator.recordEvent('processing:begin');
    validator.recordEvent('processing:end');

    const result = validator.validate();
    expect(result.isValid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
```

---

## Best Practices Summary

1. **Always Test Negative Cases**: Network failures, timeouts, dropped connections
2. **Use Real Infrastructure**: Don't mock everything—test with actual message queues
3. **Measure P99 Latency**: Average latency hides tail latency problems
4. **Test Ordering**: In distributed systems, event order matters
5. **Simulate Network Conditions**: Test with network delays and packet loss
6. **Load Test Before Launch**: Find bottlenecks under realistic load
7. **Monitor Resource Usage**: Memory, CPU, file descriptors under load
8. **Test Graceful Degradation**: How does your system behave under stress?
9. **Verify State Consistency**: In concurrent systems, data can become inconsistent
10. **Automate Regression Testing**: Real-time issues are subtle and easily reintroduced

---

## Resources

- Socket.IO Testing: https://socket.io/docs/v4/testing/
- KafkaJS Documentation: https://kafka.js.org/
- TestContainers: https://www.testcontainers.org/
- Load Testing Tools: Apache JMeter, k6, Locust
- Node.js Performance Hooks: https://nodejs.org/api/perf_hooks.html
