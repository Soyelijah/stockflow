# Performance Optimization Skill

Enterprise-grade performance optimization across frontend, backend, database, and infrastructure layers.

## Frontend Performance Optimization

### Bundle Analysis and Code Splitting

Modern frontend applications require aggressive code splitting to maintain performance:

```typescript
// webpack.config.js or Vite config example
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'bundle-analysis.html'
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['recharts', 'd3'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-select'],

          // Route-based chunks
          'route-dashboard': ['./src/pages/Dashboard.tsx'],
          'route-trading': ['./src/pages/Trading.tsx'],
          'route-settings': ['./src/pages/Settings.tsx'],

          // Feature-based chunks
          'feature-auth': ['./src/features/auth'],
          'feature-orders': ['./src/features/orders'],
          'feature-notifications': ['./src/features/notifications']
        }
      }
    }
  }
};

// Lazy load routes
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Trading = lazy(() => import('./pages/Trading'));
const Settings = lazy(() => import('./pages/Settings'));

export const routes = [
  { path: '/', element: <Suspense fallback={<Loader />}><Dashboard /></Suspense> },
  { path: '/trading', element: <Suspense fallback={<Loader />}><Trading /></Suspense> },
  { path: '/settings', element: <Suspense fallback={<Loader />}><Settings /></Suspense> }
];
```

### Core Web Vitals Optimization

#### Largest Contentful Paint (LCP) < 2.5s

```typescript
// Optimize LCP by prioritizing above-fold content

// Good: Server-render critical content, preload hero image
export function HomePage() {
  return (
    <>
      <link rel="preload" as="image" href="/hero.webp" />
      <link rel="preconnect" href="https://api.example.com" />

      <Hero src="/hero.webp" alt="Homepage hero" />
      <Suspense fallback={<SkeletonLoader />}>
        <Section />
      </Suspense>
    </>
  );
}

// Image optimization with srcset
const OptimizedImage: React.FC<{
  src: string;
  alt: string;
  width: number;
  height: number;
}> = ({ src, alt, width, height }) => {
  const baseUrl = src.replace(/\.[^.]+$/, '');

  return (
    <img
      src={`${baseUrl}-800.webp`}
      srcSet={`
        ${baseUrl}-320.webp 320w,
        ${baseUrl}-640.webp 640w,
        ${baseUrl}-800.webp 800w,
        ${baseUrl}-1200.webp 1200w
      `}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
    />
  );
};
```

#### First Input Delay (FID) / Interaction to Next Paint (INP) < 100ms

```typescript
// Reduce JavaScript execution time with task scheduling

// Bad: Long main thread blocking
function expensiveCalculation() {
  const results = [];
  for (let i = 0; i < 1000000; i++) {
    results.push(heavyCompute(i));
  }
  return results;
}

// Good: Break into chunks using scheduler
import { unstable_scheduleCallback } from 'scheduler';

function expensiveCalculationOptimized() {
  const results: any[] = [];
  const chunkSize = 1000;

  return new Promise((resolve) => {
    const process = () => {
      const start = results.length;
      const end = Math.min(start + chunkSize, 1000000);

      for (let i = start; i < end; i++) {
        results.push(heavyCompute(i));
      }

      if (end < 1000000) {
        unstable_scheduleCallback(() => process());
      } else {
        resolve(results);
      }
    };

    unstable_scheduleCallback(() => process());
  });
}

// Use Web Workers for heavy computation
// worker.js
self.onmessage = (event) => {
  const { data } = event;
  const result = heavyCompute(data);
  self.postMessage(result);
};

// main.tsx
const worker = new Worker('worker.js');
worker.postMessage(largeDataset);
worker.onmessage = (event) => {
  setComputedResult(event.data);
};
```

#### Cumulative Layout Shift (CLS) < 0.1

```typescript
// Prevent layout shifts with proper sizing

// Bad: Image without dimensions
function ImageGallery() {
  return (
    <div className="flex gap-4">
      {images.map(img => (
        <img key={img.id} src={img.url} alt={img.alt} />
      ))}
    </div>
  );
}

// Good: Images have defined aspect ratio
function ImageGalleryOptimized() {
  return (
    <div className="flex gap-4">
      {images.map(img => (
        <div key={img.id} className="aspect-square overflow-hidden rounded-lg">
          <img
            src={img.url}
            alt={img.alt}
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}

// Use container queries to prevent shifts
const MetricCard = () => (
  <div className="@container bg-slate-900/50 border border-slate-700/50 rounded-lg p-6">
    <h3 className="text-lg font-semibold text-white">Revenue</h3>
    {/* Fixed height prevents shift when value loads */}
    <div className="h-12 mt-2">
      <p className="text-3xl font-bold text-blue-400">$1.2M</p>
    </div>
  </div>
);

// Skeleton loaders prevent shifts
const SkeletonCard = () => (
  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
    <div className="h-6 w-24 bg-slate-700/50 rounded animate-pulse mb-4"></div>
    <div className="h-12 w-32 bg-slate-700/50 rounded animate-pulse"></div>
  </div>
);
```

### Image Optimization

```typescript
// Comprehensive image optimization strategy

interface ImageOptimizationConfig {
  width: number;
  height: number;
  formats: ('webp' | 'avif' | 'jpg' | 'png')[];
  sizes: number[];
  quality: number; // 75-85 recommended
}

class ImageOptimizer {
  static generateSrcSet(
    imagePath: string,
    config: ImageOptimizationConfig
  ): string {
    return config.sizes
      .map(size => {
        const resized = imagePath.replace(
          /^(.+?)(\.[^.]+)$/,
          `$1-${size}w$2`
        );
        return `${resized} ${size}w`;
      })
      .join(', ');
  }

  static generateResponsiveImage(
    imagePath: string,
    config: ImageOptimizationConfig
  ) {
    return {
      src: imagePath,
      srcSet: this.generateSrcSet(imagePath, config),
      sizes: `(max-width: 640px) 100vw, (max-width: 1024px) 80vw, ${config.width}px`,
      width: config.width,
      height: config.height
    };
  }
}

// Usage with Next.js Image or similar
<picture>
  <source
    srcSet={imagePath.replace(/\.[^.]+$/, '.avif')}
    type="image/avif"
  />
  <source
    srcSet={imagePath.replace(/\.[^.]+$/, '.webp')}
    type="image/webp"
  />
  <img
    src={imagePath}
    alt="Description"
    {...ImageOptimizer.generateResponsiveImage(imagePath, {
      width: 1200,
      height: 600,
      formats: ['avif', 'webp', 'jpg'],
      sizes: [320, 640, 800, 1024, 1200],
      quality: 80
    })}
  />
</picture>
```

### Memory Leak Prevention

```typescript
// Detect and prevent memory leaks

const useCleanup = (effect: () => void | (() => void), deps?: any[]) => {
  useEffect(() => {
    const cleanup = effect();

    return () => {
      cleanup?.();
    };
  }, deps);
};

// Common patterns to avoid
function ComponentWithLeak() {
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Bad: Timer continues after unmount
    timerRef.current = setInterval(() => {
      console.log('Ticking...');
    }, 1000);
  }, []);

  return <div>Timer running</div>;
}

// Good: Cleanup timer
function ComponentOptimized() {
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    timerRef.current = setInterval(() => {
      console.log('Ticking...');
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return <div>Timer running</div>;
}

// WebSocket cleanup
function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket>();

  useEffect(() => {
    wsRef.current = new WebSocket(url);

    wsRef.current.onmessage = (event) => {
      // Handle message
    };

    return () => {
      wsRef.current?.close();
    };
  }, [url]);

  return wsRef.current;
}
```

## Backend Performance Optimization

### API Response Optimization

```typescript
// FastAPI endpoint optimization

from fastapi import FastAPI, Query, Header
from sqlalchemy.orm import selectinload
from functools import lru_cache
import time

app = FastAPI()

# 1. Query optimization with selectinload
@app.get("/api/portfolios/{portfolio_id}")
async def get_portfolio(
    portfolio_id: int,
    db: Session = Depends(get_db)
) -> dict:
    # Bad: N+1 queries
    # portfolio = db.query(Portfolio).filter(...).first()
    # positions = [position for position in portfolio.positions]  # Extra query per position

    # Good: Eager load relations
    portfolio = db.query(Portfolio)\
        .options(
            selectinload(Portfolio.positions),
            selectinload(Portfolio.orders)
        )\
        .filter(Portfolio.id == portfolio_id)\
        .first()

    return portfolio.to_dict()

# 2. Pagination to limit data transfer
@app.get("/api/trades")
async def list_trades(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
) -> dict:
    trades = db.query(Trade)\
        .offset(skip)\
        .limit(limit)\
        .all()

    total = db.query(Trade).count()

    return {
        "data": [t.to_dict() for t in trades],
        "total": total,
        "skip": skip,
        "limit": limit
    }

# 3. Field filtering for sparse queries
@app.get("/api/orders")
async def list_orders(
    fields: str = Query("id,status,symbol,quantity"),
    db: Session = Depends(get_db)
) -> list:
    requested_fields = fields.split(',')
    query = db.query(Order)

    # Only select requested fields
    if set(requested_fields) != {'*'}:
        columns = [getattr(Order, f) for f in requested_fields if hasattr(Order, f)]
        query = query.with_entities(*columns)

    return query.limit(100).all()

# 4. Compression and response streaming
@app.get("/api/historical-data")
async def get_historical_data(
    symbol: str,
    limit: int = 10000,
    accept_encoding: str = Header("")
) -> StreamingResponse:
    # For large datasets, stream response
    async def generate():
        for chunk in get_data_chunks(symbol, limit):
            yield json.dumps(chunk) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Content-Encoding": "gzip"} if "gzip" in accept_encoding else {}
    )
```

### Connection Pooling

```python
# SQLAlchemy connection pool optimization

from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool, NullPool

# Production: Use QueuePool
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,           # Connections to keep open
    max_overflow=40,        # Additional connections if needed
    pool_recycle=3600,      # Recycle connections every hour
    pool_pre_ping=True,     # Verify connections before use
    echo=False,
    connect_args={
        "timeout": 10,
        "server_settings": {
            "application_name": "bot-trading"
        }
    }
)

# Development: Use NullPool to avoid connection issues
if ENV == "development":
    engine = create_engine(DATABASE_URL, poolclass=NullPool, echo=True)
```

### Async/Await Pattern

```python
# Leverage async for I/O-bound operations

from asyncio import gather
from typing import List

class OrderService:
    async def fetch_multiple_orders(self, order_ids: List[int]):
        """Fetch multiple orders concurrently"""
        # Bad: Sequential requests
        # orders = []
        # for order_id in order_ids:
        #     order = await self.fetch_order(order_id)
        #     orders.append(order)

        # Good: Concurrent requests
        orders = await gather(
            *[self.fetch_order(order_id) for order_id in order_ids]
        )
        return orders

    async def fetch_order(self, order_id: int):
        # Simulate async API call
        async with self.http_client.get(f"/api/orders/{order_id}") as response:
            return await response.json()
```

### Request Deduplication

```python
# Deduplicate identical concurrent requests

from functools import lru_cache
from datetime import datetime, timedelta

class RequestDeduplicator:
    def __init__(self):
        self._pending = {}
        self._cache = {}
        self._cache_ttl = {}

    async def deduplicate(self, key: str, fetch_fn, ttl_seconds=60):
        """
        Deduplicate identical concurrent requests.
        Multiple identical requests within ttl_seconds share one backend call.
        """
        now = datetime.now()

        # Check cache
        if key in self._cache:
            cache_time = self._cache_ttl.get(key, now)
            if (now - cache_time).seconds < ttl_seconds:
                return self._cache[key]

        # Check pending
        if key in self._pending:
            return await self._pending[key]

        # New request
        async def fetch():
            result = await fetch_fn()
            self._cache[key] = result
            self._cache_ttl[key] = datetime.now()
            del self._pending[key]
            return result

        self._pending[key] = fetch()
        return await self._pending[key]

# Usage
deduplicator = RequestDeduplicator()

@app.get("/api/market-data/{symbol}")
async def get_market_data(symbol: str):
    return await deduplicator.deduplicate(
        f"market:{symbol}",
        lambda: fetch_binance_market_data(symbol),
        ttl_seconds=5  # Cache for 5 seconds
    )
```

## Database Performance Optimization

### Query Optimization

```python
# Index strategy for optimal query performance

from sqlalchemy import Index, String, Integer, Float, DateTime

class Trade(Base):
    __tablename__ = "trades"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String(10), nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    executed_at = Column(DateTime, nullable=False)
    status = Column(String(20), nullable=False)

    # Indexes for common queries
    __table_args__ = (
        Index('idx_user_symbol', 'user_id', 'symbol'),
        Index('idx_executed_at', 'executed_at'),
        Index('idx_status', 'status'),
        Index('idx_user_executed', 'user_id', 'executed_at'),
        Index('idx_symbol_date', 'symbol', 'executed_at'),
    )

# Query with proper index usage
async def get_user_trades(user_id: int, symbol: str = None):
    """
    Efficient query using indexes:
    - Filter by (user_id, symbol) uses idx_user_symbol
    - Ordering by executed_at uses index
    """
    query = db.query(Trade)\
        .filter(Trade.user_id == user_id)\
        .order_by(Trade.executed_at.desc())\
        .limit(100)

    if symbol:
        query = query.filter(Trade.symbol == symbol)

    return query.all()
```

### Query Plan Analysis

```python
# Analyze and optimize query plans

from sqlalchemy import event, text

class QueryLogger:
    def __init__(self, slow_query_threshold_ms=100):
        self.slow_threshold = slow_query_threshold_ms

    def setup(self, engine):
        @event.listens_for(engine, "before_cursor_execute")
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            conn.info.setdefault('query_start_time', []).append(time.time())

        @event.listens_for(engine, "after_cursor_execute")
        def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            total = time.time() - conn.info['query_start_time'].pop(-1)
            total_ms = total * 1000

            if total_ms > self.slow_threshold:
                print(f"SLOW QUERY ({total_ms:.2f}ms): {statement[:100]}")

                # Analyze query plan
                try:
                    result = cursor.execute(f"EXPLAIN ANALYZE {statement}", parameters)
                    plan = result.fetchall()
                    print("Query Plan:")
                    for row in plan:
                        print(f"  {row}")
                except Exception as e:
                    print(f"Could not analyze: {e}")

# Setup logging
query_logger = QueryLogger(slow_query_threshold_ms=100)
query_logger.setup(engine)
```

### N+1 Query Prevention

```python
# Detect and prevent N+1 queries

# Bad: N+1 queries
def get_user_portfolio_bad(user_id: int):
    user = db.query(User).filter(User.id == user_id).first()
    # Query 1: Fetch user

    positions = []
    for position in user.positions:  # Query 2-N: Fetch each position's details
        position.current_price = fetch_current_price(position.symbol)
        positions.append(position)

    return positions

# Good: Batch loading and eager loading
async def get_user_portfolio_good(user_id: int):
    user = db.query(User)\
        .options(selectinload(User.positions))\
        .filter(User.id == user_id)\
        .first()
    # Query 1: Fetch user and positions in one batch

    # Batch fetch prices (single query)
    symbols = [p.symbol for p in user.positions]
    prices = await fetch_prices_batch(symbols)

    for position in user.positions:
        position.current_price = prices[position.symbol]

    return user.positions
```

## Caching Strategy

### Multi-Layer Caching

```python
# Implement multi-layer cache hierarchy

from redis import Redis
from functools import wraps
import json
from typing import Any, Callable

class CacheManager:
    def __init__(self):
        self.redis = Redis(host='localhost', port=6379, decode_responses=True)
        self.ttl = {
            'market_data': 5,        # 5 seconds
            'portfolio': 30,         # 30 seconds
            'user_settings': 3600,   # 1 hour
            'reference_data': 86400  # 24 hours
        }

    def cache_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate consistent cache key"""
        args_str = '_'.join(str(arg) for arg in args)
        kwargs_str = '_'.join(f"{k}={v}" for k, v in sorted(kwargs.items()))
        key_parts = [prefix, args_str, kwargs_str]
        return ':'.join(filter(None, key_parts))

    def memoize(self, category: str = 'default', ttl: int = None):
        """Decorator for function-level caching"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def wrapper(*args, **kwargs):
                cache_ttl = ttl or self.ttl.get(category, 300)
                key = self.cache_key(func.__name__, *args, **kwargs)

                # Try cache
                cached = self.redis.get(key)
                if cached:
                    return json.loads(cached)

                # Execute function
                result = await func(*args, **kwargs)

                # Store in cache
                self.redis.setex(key, cache_ttl, json.dumps(result))

                return result

            return wrapper
        return decorator

    def invalidate(self, pattern: str):
        """Invalidate cache by pattern"""
        keys = self.redis.keys(pattern)
        if keys:
            self.redis.delete(*keys)

# Usage
cache = CacheManager()

@cache.memoize(category='market_data', ttl=5)
async def get_market_data(symbol: str):
    return await fetch_binance_data(symbol)

@cache.memoize(category='portfolio')
async def get_portfolio(user_id: int):
    return await fetch_user_portfolio(user_id)

# Invalidate on updates
@app.post("/api/orders")
async def create_order(order: OrderCreate):
    order = await order_service.create(order)

    # Invalidate affected caches
    cache.invalidate(f"portfolio:{order.user_id}*")
    cache.invalidate("market_data:*")

    return order
```

### Cache Invalidation Strategy

```python
# Event-based cache invalidation

from sqlalchemy import event

class CacheInvalidator:
    def __init__(self, cache: CacheManager):
        self.cache = cache

    def setup(self, Base):
        @event.listens_for(Base, 'after_insert')
        @event.listens_for(Base, 'after_update')
        @event.listens_for(Base, 'after_delete')
        def receive_after_action(mapper, connection, target):
            # Get entity class name
            entity_type = type(target).__name__

            # Define invalidation patterns
            patterns = {
                'Portfolio': [f"portfolio:{target.user_id}*"],
                'Position': [f"portfolio:{target.user_id}*"],
                'Order': [f"portfolio:{target.user_id}*", "market_data:*"],
                'User': [f"user_settings:{target.id}"],
            }

            # Invalidate related caches
            for pattern in patterns.get(entity_type, []):
                self.cache.invalidate(pattern)

# Setup invalidator
invalidator = CacheInvalidator(cache)
invalidator.setup(Base)
```

## Monitoring and Profiling

### Performance Monitoring Stack

```typescript
// Browser performance monitoring

class PerformanceMonitor {
  static captureMetrics() {
    const metrics = {
      // Navigation Timing
      navigationStart: performance.timing.navigationStart,
      domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      pageLoad: performance.timing.loadEventEnd - performance.timing.navigationStart,

      // Core Web Vitals
      lcp: 0,
      fid: 0,
      cls: 0,

      // Resource Timing
      resourceCount: performance.getEntriesByType('resource').length,
      resourceSize: this.getTotalResourceSize(),

      // Custom metrics
      apiResponseTime: 0,
      renderTime: 0
    };

    // Measure Core Web Vitals
    this.measureCoreWebVitals(metrics);

    return metrics;
  }

  static measureCoreWebVitals(metrics: any) {
    // LCP - Largest Contentful Paint
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      metrics.lcp = entries[entries.length - 1].renderTime || entries[entries.length - 1].loadTime;
    });
    observer.observe({ entryTypes: ['largest-contentful-paint'] });

    // CLS - Cumulative Layout Shift
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          metrics.cls = clsValue;
        }
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    // FID - First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      metrics.fid = list.getEntries()[0].processingStart - list.getEntries()[0].startTime;
    });
    fidObserver.observe({ entryTypes: ['first-input'] });
  }

  static getTotalResourceSize(): number {
    return performance.getEntriesByType('resource')
      .reduce((total: number, entry: any) => total + (entry.transferSize || 0), 0);
  }

  static reportMetrics(metrics: any) {
    // Send to analytics service
    fetch('/api/analytics/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics),
      keepalive: true // Don't cancel on page unload
    });
  }
}

// Auto-report metrics on page load
window.addEventListener('load', () => {
  const metrics = PerformanceMonitor.captureMetrics();
  PerformanceMonitor.reportMetrics(metrics);
});
```

### Backend Profiling

```python
# Profile API endpoints

from functools import wraps
import cProfile
import pstats
import io
import logging

logger = logging.getLogger(__name__)

def profile_endpoint(func):
    """Decorator to profile endpoint execution"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        profiler = cProfile.Profile()
        profiler.enable()

        try:
            result = func(*args, **kwargs)
        finally:
            profiler.disable()

            # Capture stats
            s = io.StringIO()
            ps = pstats.Stats(profiler, stream=s).sort_stats('cumulative')
            ps.print_stats(10)  # Top 10 functions

            logger.info(f"\nProfile for {func.__name__}:\n{s.getvalue()}")

        return result

    return wrapper

@app.get("/api/portfolio/{portfolio_id}")
@profile_endpoint
async def get_portfolio(portfolio_id: int, db: Session = Depends(get_db)):
    return db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
```

## Performance Optimization Checklist

### Frontend
- [ ] Bundle size < 200KB gzipped
- [ ] Initial load < 2s on 4G
- [ ] LCP < 2.5s
- [ ] FID/INP < 100ms
- [ ] CLS < 0.1
- [ ] Unused CSS removed
- [ ] JavaScript code split by route
- [ ] Images optimized (WebP/AVIF, proper sizes)
- [ ] No memory leaks detected
- [ ] Lighthouse score > 85

### Backend
- [ ] API response time < 200ms (p95)
- [ ] Database queries < 100ms
- [ ] No N+1 queries
- [ ] Connection pooling configured
- [ ] Proper indexes on all WHERE clauses
- [ ] Caching strategy implemented
- [ ] Async patterns used for I/O
- [ ] Request deduplication enabled
- [ ] Slow query logging enabled
- [ ] Rate limiting configured

### Database
- [ ] All JOIN columns indexed
- [ ] Foreign key columns indexed
- [ ] Query plans analyzed
- [ ] Connection pool optimized
- [ ] Partitioning strategy for large tables
- [ ] Replication lag < 1s
- [ ] Backup compression enabled
- [ ] Vacuum/ANALYZE scheduled
- [ ] Statistics updated regularly

### Monitoring
- [ ] Real User Monitoring (RUM) enabled
- [ ] Server-side metrics collected
- [ ] Database metrics tracked
- [ ] Error rates monitored
- [ ] Alerts configured for anomalies
- [ ] Performance budgets enforced
- [ ] Trending dashboard available
- [ ] SLOs defined and tracked

