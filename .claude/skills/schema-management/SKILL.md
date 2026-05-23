# Schema Management & Design

## 1. Schema Design Patterns

### Star Schema (Data Warehouse)

```python
# Star schema example: Sales analytics

# Fact table (central): Contains metrics and foreign keys
class SalesFact(Base):
    __tablename__ = 'sales_fact'

    sale_id = Column(Integer, primary_key=True)
    date_key = Column(Integer, ForeignKey('date_dim.date_key'))
    product_key = Column(Integer, ForeignKey('product_dim.product_key'))
    customer_key = Column(Integer, ForeignKey('customer_dim.customer_key'))
    store_key = Column(Integer, ForeignKey('store_dim.store_key'))

    # Metrics (measurements)
    quantity = Column(Integer)
    revenue = Column(Numeric(12, 2))
    profit = Column(Numeric(12, 2))
    discount = Column(Numeric(5, 2))

    # Indexes for fast querying
    __table_args__ = (
        Index('idx_date_product', date_key, product_key),
        Index('idx_customer', customer_key),
    )


# Dimension tables (descriptive)
class DateDimension(Base):
    __tablename__ = 'date_dim'

    date_key = Column(Integer, primary_key=True)
    date = Column(Date, unique=True)
    year = Column(Integer)
    quarter = Column(Integer)
    month = Column(Integer)
    day_of_week = Column(String(10))
    is_holiday = Column(Boolean, default=False)


class ProductDimension(Base):
    __tablename__ = 'product_dim'

    product_key = Column(Integer, primary_key=True)
    product_id = Column(String(50), unique=True)
    product_name = Column(String(255))
    category = Column(String(100))
    subcategory = Column(String(100))
    brand = Column(String(100))
    price = Column(Numeric(10, 2))
    # SCD Type 2: Track historical changes
    valid_from = Column(DateTime, default=func.now())
    valid_to = Column(DateTime, nullable=True)
    is_current = Column(Boolean, default=True)


class CustomerDimension(Base):
    __tablename__ = 'customer_dim'

    customer_key = Column(Integer, primary_key=True)
    customer_id = Column(String(50), unique=True)
    customer_name = Column(String(255))
    city = Column(String(100))
    state = Column(String(50))
    country = Column(String(100))
    segment = Column(String(50))  # Premium, Standard, Basic
    registration_date = Column(Date)


# Query example
def analyze_sales_by_month():
    """Star schema enables efficient OLAP queries"""
    query = select(
        DateDimension.year,
        DateDimension.month,
        ProductDimension.category,
        func.sum(SalesFact.revenue).label('total_revenue'),
        func.sum(SalesFact.quantity).label('total_qty'),
        func.avg(SalesFact.profit).label('avg_profit'),
    ).join(
        SalesFact, SalesFact.date_key == DateDimension.date_key
    ).join(
        ProductDimension, SalesFact.product_key == ProductDimension.product_key
    ).group_by(
        DateDimension.year,
        DateDimension.month,
        ProductDimension.category,
    )

    return query
```

### Snowflake Schema (Normalized Dimensions)

```python
# Snowflake: Further normalized from star schema
# Example: Product dimension normalized to remove redundancy

class Brand(Base):
    __tablename__ = 'brand'
    brand_id = Column(Integer, primary_key=True)
    brand_name = Column(String(100), unique=True)

class Category(Base):
    __tablename__ = 'category'
    category_id = Column(Integer, primary_key=True)
    category_name = Column(String(100), unique=True)

class Subcategory(Base):
    __tablename__ = 'subcategory'
    subcategory_id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey('category.category_id'))
    subcategory_name = Column(String(100))

# Normalized product dimension
class ProductDimensionNormalized(Base):
    __tablename__ = 'product_dim'

    product_key = Column(Integer, primary_key=True)
    product_id = Column(String(50), unique=True)
    product_name = Column(String(255))
    brand_id = Column(Integer, ForeignKey('brand.brand_id'))
    subcategory_id = Column(Integer, ForeignKey('subcategory.subcategory_id'))
    price = Column(Numeric(10, 2))

    # Relationships
    brand = relationship('Brand')
    subcategory = relationship('Subcategory')

# Advantages: Less redundancy, easier to maintain
# Disadvantages: More joins required for queries
```

### Document Schema (NoSQL)

```python
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

# MongoDB/Firebase document schema

class Address(BaseModel):
    street: str
    city: str
    state: str
    zip_code: str
    country: str

class OrderItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    discount: Optional[float] = None

class Order(BaseModel):
    order_id: str
    customer_id: str
    customer_name: str
    customer_email: str

    # Denormalized for fast reads
    shipping_address: Address
    billing_address: Address

    items: List[OrderItem]
    subtotal: float
    tax: float
    shipping: float
    total: float

    status: str  # pending, confirmed, shipped, delivered
    notes: Optional[str] = None

    created_at: datetime
    updated_at: datetime
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

    # Metadata for indexing
    payment_method: str
    tracking_number: Optional[str] = None


# Usage in MongoDB
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

client = MongoClient('mongodb://localhost:27017')
db = client['ecommerce']
orders_collection = db['orders']

# Create indexes
orders_collection.create_index('order_id', unique=True)
orders_collection.create_index('customer_id')
orders_collection.create_index('status')
orders_collection.create_index('created_at', -1)  # Descending

# Query examples
# Find all orders for customer
customer_orders = orders_collection.find({'customer_id': 'CUST-123'})

# Orders by status with aggregation
from pymongo import DESCENDING

pipeline = [
    {'$match': {'status': 'delivered'}},
    {'$group': {
        '_id': '$customer_id',
        'total_spent': {'$sum': '$total'},
        'order_count': {'$sum': 1}
    }},
    {'$sort': {'total_spent': DESCENDING}},
    {'$limit': 10}
]

top_customers = list(orders_collection.aggregate(pipeline))
```

---

## 2. Schema Evolution & Versioning

### Backward Compatibility in Schema Changes

```python
from enum import Enum
from typing import Optional
from datetime import datetime

# Version 1 (original)
class UserV1(Base):
    __tablename__ = 'users_v1'

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True)
    name = Column(String(100))
    created_at = Column(DateTime, default=func.now())


# Version 2: Adding optional field (backward compatible)
class UserV2(Base):
    __tablename__ = 'users_v2'

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True)
    name = Column(String(100))
    phone = Column(String(20), nullable=True)  # NEW: Optional
    created_at = Column(DateTime, default=func.now())


# Version 3: Changing field type with migration (requires migration)
class UserV3(Base):
    __tablename__ = 'users_v3'

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True)
    name = Column(String(100))
    phone = Column(String(20), nullable=True)
    status = Column(String(20), default='active')  # NEW: Replace is_active
    created_at = Column(DateTime, default=func.now())


# Migration strategy for V1 → V2
def migrate_v1_to_v2():
    """Add optional phone field"""
    migration = '''
        ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL;
    '''
    # No data migration needed (optional field)
    return migration


# Migration strategy for V2 → V3
def migrate_v2_to_v3():
    """Change is_active (bool) to status (enum)"""
    migration = '''
        ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';

        -- Backfill data
        UPDATE users SET status = 'active' WHERE is_active = true;
        UPDATE users SET status = 'inactive' WHERE is_active = false;

        -- Drop old column
        ALTER TABLE users DROP COLUMN is_active;
    '''
    return migration
```

### Schema Registry Pattern

```python
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.json_schema import JSONSerializer, JSONDeserializer
import json

class SchemaRegistry:
    """Manage schemas with versioning"""

    def __init__(self, registry_url: str = 'http://localhost:8081'):
        self.client = SchemaRegistryClient({'url': registry_url})

    def register_schema(self, subject: str, schema: dict, version: int = None) -> int:
        """Register or fetch schema version"""

        schema_str = json.dumps(schema)

        # Check if schema already exists
        try:
            schema_id = self.client.register_schema(subject, schema_str)
            return schema_id
        except Exception as e:
            print(f"Schema registration error: {e}")
            raise

    def get_schema_versions(self, subject: str) -> list:
        """List all versions of a schema"""
        return self.client.get_subject_versions(subject)

    def get_schema_by_version(self, subject: str, version: int) -> dict:
        """Fetch specific schema version"""
        schema_info = self.client.get_schema(subject, version)
        return json.loads(schema_info)

    def get_latest_schema(self, subject: str) -> dict:
        """Fetch latest schema"""
        schema_info = self.client.get_latest_schema(subject)
        return json.loads(schema_info[0])

    def check_compatibility(self, subject: str, new_schema: dict) -> bool:
        """Check if new schema is compatible with latest"""
        new_schema_str = json.dumps(new_schema)

        result = self.client.check_compatibility(subject, new_schema_str)
        return result['is_compatible']


# Usage
registry = SchemaRegistry()

# Define schemas
user_schema_v1 = {
    'type': 'object',
    'properties': {
        'user_id': {'type': 'integer'},
        'email': {'type': 'string'},
        'name': {'type': 'string'},
    },
    'required': ['user_id', 'email']
}

user_schema_v2 = {
    'type': 'object',
    'properties': {
        'user_id': {'type': 'integer'},
        'email': {'type': 'string'},
        'name': {'type': 'string'},
        'phone': {'type': 'string', 'null': True},  # NEW optional
    },
    'required': ['user_id', 'email']
}

# Register v1
schema_id_v1 = registry.register_schema('user-value', user_schema_v1)

# Check if v2 is backward compatible
is_compatible = registry.check_compatibility('user-value', user_schema_v2)
if is_compatible:
    schema_id_v2 = registry.register_schema('user-value', user_schema_v2)
```

---

## 3. Index Design Strategies

### Index Selection

```python
from sqlalchemy import Index, create_engine, text

class IndexStrategy:
    """Design optimal indexes for performance"""

    @staticmethod
    def create_indexes():
        """Define strategic indexes"""

        # Single column indexes
        # Use when: Frequent WHERE, JOIN, ORDER BY on this column
        class User(Base):
            __tablename__ = 'users'
            id = Column(Integer, primary_key=True)
            email = Column(String(255))
            created_at = Column(DateTime)

            # Indexes
            __table_args__ = (
                Index('idx_email', 'email'),
                Index('idx_created_at', 'created_at'),
            )

        # Composite indexes
        # Use when: Frequently filtering by multiple columns together
        class Order(Base):
            __tablename__ = 'orders'
            id = Column(Integer, primary_key=True)
            customer_id = Column(Integer)
            status = Column(String(20))
            created_at = Column(DateTime)

            __table_args__ = (
                # Index for (customer_id, status) queries
                Index('idx_customer_status', 'customer_id', 'status'),

                # Index for (status, created_at) range queries
                Index('idx_status_date', 'status', 'created_at'),
            )

        # Partial indexes
        # Use when: Frequently filtering by condition
        class Product(Base):
            __tablename__ = 'products'
            id = Column(Integer, primary_key=True)
            name = Column(String(255))
            is_active = Column(Boolean, default=True)
            price = Column(Numeric(10, 2))

            # Index only active products
            __table_args__ = (
                Index(
                    'idx_active_products',
                    'name',
                    postgresql_where=text('is_active = true')
                ),
            )

    @staticmethod
    def analyze_index_usage(engine):
        """Identify missing or unused indexes"""

        # PostgreSQL: Find unused indexes
        query = """
            SELECT schemaname, tablename, indexname, idx_scan
            FROM pg_stat_user_indexes
            WHERE idx_scan = 0
            AND indexname NOT LIKE 'pg_toast%'
            ORDER BY pg_relation_size(indexrelid) DESC;
        """

        # PostgreSQL: Find missing indexes
        missing_query = """
            SELECT schemaname, tablename,
                   attname,
                   n_distinct,
                   correlation
            FROM pg_stats
            WHERE correlation < -0.1 OR correlation > 0.1
            AND schemaname NOT IN ('pg_catalog', 'information_schema')
            ORDER BY ABS(correlation) DESC;
        """

        with engine.connect() as conn:
            result = conn.execute(text(query))
            print("Unused Indexes:")
            for row in result:
                print(f"  {row[0]}.{row[1]}.{row[2]}")
```

---

## 4. Partitioning Strategies

### Table Partitioning

```python
from sqlalchemy.dialects.postgresql import TIMESTAMP
from datetime import datetime, timedelta

class PartitioningStrategy:
    """Optimize large tables with partitioning"""

    @staticmethod
    def create_partitioned_table():
        """Range partitioning by date"""

        # PostgreSQL: Partitioned table
        create_table_sql = """
            CREATE TABLE IF NOT EXISTS events (
                event_id BIGSERIAL,
                user_id INTEGER NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                event_data JSONB,
                created_at TIMESTAMP NOT NULL,
                PRIMARY KEY (event_id, created_at)
            ) PARTITION BY RANGE (created_at);

            -- Create monthly partitions
            CREATE TABLE events_2024_01 PARTITION OF events
                FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

            CREATE TABLE events_2024_02 PARTITION OF events
                FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

            -- Indexes on partitions
            CREATE INDEX idx_events_2024_01_user
                ON events_2024_01 (user_id);

            CREATE INDEX idx_events_2024_02_user
                ON events_2024_02 (user_id);
        """

        return create_table_sql

    @staticmethod
    def create_list_partition():
        """List partitioning by category"""

        sql = """
            CREATE TABLE sales (
                id BIGSERIAL,
                region VARCHAR(50) NOT NULL,
                amount DECIMAL(10, 2),
                created_at TIMESTAMP
            ) PARTITION BY LIST (region);

            CREATE TABLE sales_us PARTITION OF sales
                FOR VALUES IN ('US', 'CA');

            CREATE TABLE sales_eu PARTITION OF sales
                FOR VALUES IN ('DE', 'FR', 'UK', 'IT');

            CREATE TABLE sales_apac PARTITION OF sales
                FOR VALUES IN ('JP', 'AU', 'SG');
        """

        return sql

    @staticmethod
    def create_hash_partition():
        """Hash partitioning for distribution"""

        sql = """
            CREATE TABLE user_events (
                event_id BIGSERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                event_type VARCHAR(50),
                created_at TIMESTAMP
            ) PARTITION BY HASH (user_id);

            -- Create 4 hash partitions
            CREATE TABLE user_events_0 PARTITION OF user_events
                FOR VALUES WITH (MODULUS 4, REMAINDER 0);

            CREATE TABLE user_events_1 PARTITION OF user_events
                FOR VALUES WITH (MODULUS 4, REMAINDER 1);

            CREATE TABLE user_events_2 PARTITION OF user_events
                FOR VALUES WITH (MODULUS 4, REMAINDER 2);

            CREATE TABLE user_events_3 PARTITION OF user_events
                FOR VALUES WITH (MODULUS 4, REMAINDER 3);
        """

        return sql

    @staticmethod
    def manage_partitions():
        """Maintenance: Archive old partitions"""

        maintenance_sql = """
            -- Detach old partition
            ALTER TABLE events DETACH PARTITION events_2023_01;

            -- Archive to cold storage
            CREATE TABLE events_2023_01_archive AS
                SELECT * FROM events_2023_01;

            DROP TABLE events_2023_01;

            -- Create new partition for upcoming month
            CREATE TABLE events_2024_03 PARTITION OF events
                FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
        """

        return maintenance_sql
```

---

## 5. Schema Documentation

### Auto-Generated Documentation

```python
from sqlalchemy import inspect
from typing import Dict, List
import json

class SchemaDocumenter:
    """Generate documentation from schema"""

    def __init__(self, engine):
        self.engine = engine
        self.inspector = inspect(engine)

    def generate_schema_docs(self) -> Dict:
        """Create comprehensive schema documentation"""

        schema_docs = {
            'tables': {},
            'relationships': [],
            'views': [],
            'generated_at': datetime.now().isoformat()
        }

        for table_name in self.inspector.get_table_names():
            schema_docs['tables'][table_name] = self._document_table(table_name)

        return schema_docs

    def _document_table(self, table_name: str) -> Dict:
        """Document single table"""

        columns = self.inspector.get_columns(table_name)
        primary_keys = self.inspector.get_pk_constraint(table_name)
        foreign_keys = self.inspector.get_foreign_keys(table_name)
        indexes = self.inspector.get_indexes(table_name)

        table_doc = {
            'name': table_name,
            'description': f"Table: {table_name}",
            'columns': [],
            'primary_key': primary_keys.get('constrained_columns', []),
            'foreign_keys': foreign_keys,
            'indexes': indexes,
            'row_count': None,
        }

        for col in columns:
            table_doc['columns'].append({
                'name': col['name'],
                'type': str(col['type']),
                'nullable': col['nullable'],
                'default': str(col['default']) if col['default'] else None,
            })

        return table_doc

    def generate_markdown(self, schema_docs: Dict) -> str:
        """Convert schema to markdown documentation"""

        markdown = "# Database Schema Documentation\n\n"

        for table_name, table_info in schema_docs['tables'].items():
            markdown += f"## {table_name}\n\n"

            # Columns
            markdown += "| Column | Type | Nullable | Default |\n"
            markdown += "|--------|------|----------|----------|\n"

            for col in table_info['columns']:
                null_str = "Yes" if col['nullable'] else "No"
                markdown += f"| {col['name']} | {col['type']} | {null_str} | {col['default'] or '-'} |\n"

            markdown += "\n"

            # Indexes
            if table_info['indexes']:
                markdown += "### Indexes\n"
                for idx in table_info['indexes']:
                    markdown += f"- `{idx['name']}`: {', '.join(idx['column_names'])}\n"
                markdown += "\n"

        return markdown

# Usage
from sqlalchemy import create_engine

engine = create_engine('postgresql://user:pass@localhost:5432/mydb')
documenter = SchemaDocumenter(engine)

docs = documenter.generate_schema_docs()
markdown = documenter.generate_markdown(docs)

with open('SCHEMA.md', 'w') as f:
    f.write(markdown)
```

---

## 6. Schema Migration

### Alembic Migration Management

```bash
# Initialize Alembic
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Add phone to users"

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Custom Migration Example

```python
# alembic/versions/001_add_user_phone.py

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # Add column
    op.add_column('users', sa.Column('phone', sa.String(20), nullable=True))

    # Create index
    op.create_index('idx_phone', 'users', ['phone'])

    # Add constraint
    op.create_check_constraint('ck_phone_format', 'users',
                               "phone ~ '^[0-9\-\+\(\)\ ]+$'")

def downgrade():
    op.drop_constraint('ck_phone_format', 'users')
    op.drop_index('idx_phone', 'users')
    op.drop_column('users', 'phone')


# Zero-downtime migration pattern
def upgrade_safe():
    # Step 1: Add column with default (non-blocking)
    op.add_column('users', sa.Column('phone', sa.String(20),
                                      server_default=''))

    # Step 2: Backfill data (can be large)
    op.execute(
        "UPDATE users SET phone = '' WHERE phone IS NULL"
    )

    # Step 3: Add constraint
    op.alter_column('users', 'phone', nullable=False)

    # Step 4: Index can be created in background
    op.create_index('idx_phone', 'users', ['phone'],
                    postgresql_concurrently=True)
```

---

## Key Schema Management Principles

```
1. Design for Read Patterns First
   - Understand queries before designing schema
   - Denormalize if needed for performance

2. Version Everything
   - Schema versions in code
   - Track migrations
   - Document breaking changes

3. Plan for Evolution
   - Make changes backward compatible
   - Test migrations on staging
   - Have rollback plan

4. Index Strategically
   - Index frequently filtered/joined columns
   - Use composite indexes for common WHERE patterns
   - Regularly audit index usage

5. Partition Large Tables
   - Time-based: Events, logs, time-series
   - Geographic: By region/location
   - Category: By tenant, type

6. Document Thoroughly
   - Auto-generate from schema
   - Include rationale for design choices
   - Document relationships and constraints
```

