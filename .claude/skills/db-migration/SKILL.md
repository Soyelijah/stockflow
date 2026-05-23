# Database Migration Management

Enterprise-grade database migration strategy covering multiple frameworks, zero-downtime deployment patterns, and production safety practices.

## Table of Contents

1. [Migration Framework Comparison](#migration-framework-comparison)
2. [Alembic (Python/SQLAlchemy)](#alembic-pythonsqlalchemy)
3. [TypeORM Migrations (NestJS/Node.js)](#typeorm-migrations-nestsnode)
4. [Django Migrations](#django-migrations)
5. [Prisma Migrate](#prisma-migrate)
6. [Zero-Downtime Migration Patterns](#zero-downtime-migration-patterns)
7. [Rollback Strategies](#rollback-strategies)
8. [Data Migrations vs Schema Migrations](#data-migrations-vs-schema-migrations)
9. [Migration Testing](#migration-testing)
10. [Common Pitfalls](#common-pitfalls)
11. [Version Control for Migrations](#version-control-for-migrations)

## Migration Framework Comparison

### Selection Criteria

| Framework | Best For | Version Control | Reversibility | Speed | Learning Curve |
|-----------|----------|-----------------|---------------|-------|-----------------|
| **Alembic** | FastAPI, SQLAlchemy | SQL + Python | Excellent | Fast | Medium |
| **TypeORM** | NestJS, Express | JavaScript/SQL | Good | Very Fast | Medium |
| **Django** | Django ORM | Python DSL | Excellent | Fast | Low |
| **Prisma** | Modern Node.js | Declarative | Good | Very Fast | Low |

**Decision Matrix:**
- **Legacy system with custom SQL**: Alembic or TypeORM
- **Greenfield with ORM**: Prisma or Django
- **Large teams, complex schemas**: Alembic (explicitness)
- **Rapid development cycles**: Prisma (speed)

## Alembic (Python/SQLAlchemy)

### Setup

```bash
# Install
pip install alembic sqlalchemy

# Initialize
alembic init migrations
```

### Configuration (alembic.ini)

```ini
# Critical settings for production
sqlalchemy.url = postgresql://user:pass@localhost/dbname

# Logging
sqlalchemy.echo = false  # Production: false
sqlalchemy.echo_pool = false

# Migration execution
script_location = migrations
version_path_separator = /
version_locations = %(here)s/versions
```

### Directory Structure

```
project/
├── alembic/
│   ├── versions/           # Migration files: 001_create_users.py
│   ├── env.py              # Execution environment
│   ├── script.py.mako      # Template for new migrations
│   └── alembic.ini         # Configuration
├── src/
│   └── models/             # SQLAlchemy models
└── requirements.txt
```

### Creating Migrations

#### Auto-Generate (Recommended for Schema)

```bash
# Alembic detects model changes
alembic revision --autogenerate -m "Add user_roles table"
```

Generated file (`versions/001_add_user_roles.py`):

```python
"""Add user_roles table"""
from alembic import op
import sqlalchemy as sa

revision = '001abc123'
down_revision = '000xyz789'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'user_roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_user_roles_user_id', 'user_roles', ['user_id'])

def downgrade() -> None:
    op.drop_index('ix_user_roles_user_id', 'user_roles')
    op.drop_table('user_roles')
```

#### Manual Migration (for Complex Logic)

```python
"""Denormalize order totals"""
from alembic import op
import sqlalchemy as sa

revision = '002def456'
down_revision = '001abc123'

def upgrade() -> None:
    # Add new column
    op.add_column('orders', sa.Column('total_cached', sa.Numeric(10, 2), nullable=True))

    # Backfill data in batches
    connection = op.get_bind()
    from sqlalchemy import text

    # Batch update to avoid locking entire table
    connection.execute(text("""
        UPDATE orders
        SET total_cached = (
            SELECT SUM(price * quantity)
            FROM order_items
            WHERE order_items.order_id = orders.id
        )
        WHERE total_cached IS NULL
        LIMIT 10000
    """))

    # Make non-nullable after backfill
    op.alter_column('orders', 'total_cached', nullable=False)

    # Add constraint
    op.create_check_constraint(
        'ck_orders_total_positive',
        'orders',
        'total_cached > 0'
    )

def downgrade() -> None:
    op.drop_constraint('ck_orders_total_positive', 'orders', type_='check')
    op.drop_column('orders', 'total_cached')
```

### Migration Execution

```bash
# Show current version
alembic current

# Show migration history
alembic history --verbose

# Upgrade to latest
alembic upgrade head

# Upgrade to specific revision
alembic upgrade 001abc123

# Downgrade to previous
alembic downgrade -1

# Downgrade to base (first migration)
alembic downgrade base

# Dry-run (show SQL without executing)
alembic upgrade head --sql
```

### env.py Configuration (Online vs Offline)

```python
from alembic import context
from sqlalchemy import engine_from_config, pool
import logging

# For online migrations (recommended for production)
def run_migrations_online() -> None:
    configuration = context.config

    # Use environment variable for connection
    url = os.getenv('DATABASE_URL')

    config_dict = {
        'sqlalchemy.url': url,
        'sqlalchemy.poolclass': pool.NullPool,  # No connection pooling for migrations
        'sqlalchemy.echo': False,
    }

    engine = engine_from_config(config_dict, prefix='sqlalchemy.')

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,  # Compare column types
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()

    engine.dispose()

# Always use online mode for production
context.run_migrations_online()
```

## TypeORM Migrations (NestJS/Node.js)

### Setup

```bash
npm install typeorm @nestjs/typeorm
npx typeorm init --name migration_project --database postgres
```

### Configuration (data-source.ts)

```typescript
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,  // CRITICAL: Never use in production
  logging: process.env.NODE_ENV === 'development',
  migrationsRun: process.env.NODE_ENV === 'production',
});
```

### Entity Example (User)

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @Column({ type: 'enum', enum: ['user', 'admin'], default: 'user' })
  role: 'user' | 'admin';

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  last_login: Date;
}
```

### Creating Migrations

```bash
# Generate from entity changes
npx typeorm migration:generate src/migrations/AddUserRoles

# Create empty migration
npx typeorm migration:create src/migrations/AddUserRoles
```

### Generated Migration Example

```typescript
import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddUserRoles1712000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_roles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'role',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          {
            columnNames: ['user_id'],
            isUnique: false,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_roles');
    const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('user_id') !== -1);
    await queryRunner.dropForeignKey('user_roles', foreignKey);
    await queryRunner.dropTable('user_roles');
  }
}
```

### Running Migrations

```bash
# Run pending migrations
npx typeorm migration:run -d src/data-source.ts

# Show migration status
npx typeorm migration:show -d src/data-source.ts

# Revert last migration
npx typeorm migration:revert -d src/data-source.ts

# Dry-run with QueryRunner logging
DEBUG=* npx typeorm migration:run
```

## Django Migrations

### Creating Migrations

```bash
# Create models
python manage.py startapp users

# Create migration from model changes
python manage.py makemigrations users
python manage.py makemigrations users --name add_user_roles

# Create empty migration for custom operations
python manage.py makemigrations users --empty --name add_user_roles
```

### Example Models

```python
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    role = models.CharField(
        max_length=50,
        choices=[('user', 'User'), ('admin', 'Admin')],
        default='user'
    )
    last_login = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'users'

class UserRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='roles')
    role = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_roles'
        unique_together = ('user', 'role')
```

### Generated Migration

```python
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserRole',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True)),
                ('role', models.CharField(max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='users.user')),
            ],
            options={'db_table': 'user_roles'},
        ),
        migrations.AlterUniqueTogether(
            name='userrole',
            unique_together={('user', 'role')},
        ),
    ]
```

### Data Migration Pattern

```bash
python manage.py makemigrations users --empty --name backfill_user_roles
```

```python
from django.db import migrations

def backfill_roles(apps, schema_editor):
    User = apps.get_model('users', 'User')
    UserRole = apps.get_model('users', 'UserRole')

    for user in User.objects.all().iterator(chunk_size=1000):
        UserRole.objects.create(user=user, role=user.role)

def reverse_backfill(apps, schema_editor):
    UserRole = apps.get_model('users', 'UserRole')
    UserRole.objects.all().delete()

class Migration(migrations.Migration):
    dependencies = [
        ('users', '0002_userrole'),
    ]

    operations = [
        migrations.RunPython(backfill_roles, reverse_backfill),
    ]
```

### Executing Migrations

```bash
# Show migration status
python manage.py showmigrations

# Apply migrations
python manage.py migrate

# Apply specific app migrations
python manage.py migrate users

# Rollback to specific migration
python manage.py migrate users 0001_initial

# Dry-run
python manage.py migrate --plan
```

## Prisma Migrate

### Setup

```bash
npm install @prisma/client prisma --save-dev
npx prisma init
```

### Schema Definition (schema.prisma)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int     @id @default(autoincrement())
  email     String  @unique
  password  String
  role      Role    @default(USER)
  createdAt DateTime @default(now())

  roles     UserRole[]
  orders    Order[]

  @@map("users")
}

model UserRole {
  id        Int     @id @default(autoincrement())
  userId    Int
  role      String
  createdAt DateTime @default(now())

  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, role])
  @@map("user_roles")
}

model Order {
  id         Int     @id @default(autoincrement())
  userId     Int
  total      Decimal @db.Numeric(10, 2)
  status     String

  user       User @relation(fields: [userId], references: [id])
  items      OrderItem[]

  @@map("orders")
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  orderId   Int
  productId Int
  quantity  Int
  price     Decimal @db.Numeric(10, 2)

  order     Order @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("order_items")
}

enum Role {
  USER
  ADMIN
}
```

### Migration Workflow

```bash
# Create migration
npx prisma migrate dev --name add_user_roles

# Deploy migrations (CI/CD)
npx prisma migrate deploy

# View migration history
npx prisma migrate status

# Rollback last migration (dev only)
npx prisma migrate resolve --rolled-back add_user_roles

# Generate migration without applying
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma
```

### Generated Migration (SQL)

```sql
-- CreateTable
CREATE TABLE "user_roles" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_role_key" ON "user_roles"("userId", "role");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## Zero-Downtime Migration Patterns

### Pattern 1: Expand-Contract (Best for Column Additions)

**Goal**: Add new column without downtime

**Timing**: 3 deployments

```
Deployment 1 (Expand):
- Add new column to schema (nullable)
- Write to both old and new columns
- No code changes needed

Deployment 2 (Contract):
- Backfill data to new column (off-peak)
- Make column NOT NULL
- Remove code that writes to old column

Deployment 3 (Cleanup):
- Drop old column
- Verify no queries use old column
```

**Example: Add verified_email Column**

```python
# Migration 1: Add column (nullable)
def upgrade() -> None:
    op.add_column('users', sa.Column('verified_email', sa.String(255), nullable=True))

# Application code (Deployment 2)
def create_user(email: str, password: str) -> User:
    user = User(
        email=email,
        password_hash=hash_password(password),
        verified_email=email,  # Write to both columns
    )
    session.add(user)
    return user

# Migration 2: Make non-nullable
def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(text("""
        UPDATE users SET verified_email = email WHERE verified_email IS NULL
    """))
    op.alter_column('users', 'verified_email', nullable=False)

# Migration 3: Drop old email column (if applicable)
def upgrade() -> None:
    op.drop_column('users', 'email')
```

### Pattern 2: Feature Flag with Gradual Rollout

```python
# Migration: Add new column
op.add_column('users', sa.Column('payment_method_v2', sa.String(50), nullable=True))

# Application code with feature flag
def process_payment(user_id: int) -> None:
    if feature_flag_enabled('payment_v2'):
        user = session.query(User).filter_by(id=user_id).first()
        method = user.payment_method_v2  # New column
    else:
        method = get_legacy_payment_method(user_id)  # Old system

    return process_with_method(method)

# Rollout schedule:
# Week 1: 5% traffic
# Week 2: 25% traffic
# Week 3: 50% traffic
# Week 4: 100% traffic (remove flag)
```

### Pattern 3: Blue-Green Deployment

**Use for**: Major schema reorganizations

```
Infrastructure:
- Blue environment (old schema, old code)
- Green environment (new schema, new code)
- Load balancer routes traffic

Process:
1. Deploy new code and schema to Green
2. Run data sync from Blue to Green (continuous)
3. Run validation queries on Green
4. Switch load balancer to Green
5. Keep Blue for rollback (48 hours)
```

## Rollback Strategies

### Level 1: Automatic Rollback (Single Migration)

```bash
# If something fails immediately
alembic downgrade -1  # Revert last migration
typeorm migration:revert
python manage.py migrate users 0001_initial
npx prisma migrate resolve --rolled-back migration_name
```

### Level 2: Multi-Step Rollback (Deployed Feature)

**Scenario**: Feature deployed 3 migrations ago, needs rollback

```bash
# Option A: Selective downgrade
alembic downgrade 001abc123  # Go back to specific revision

# Option B: Identify dependencies
alembic history --verbose

# Verify no other migrations depend on this one
# Then downgrade carefully
alembic downgrade -3
```

### Level 3: Data Recovery Rollback (After Deployment)

**Scenario**: Data was corrupted by migration logic, need restore

```python
# Step 1: Identify issue
SELECT * FROM users WHERE created_at > NOW() - INTERVAL '1 hour'

# Step 2: Restore from backup
pg_restore --data-only --table=users backup.sql

# Step 3: Verify data integrity
SELECT COUNT(*) FROM users WHERE verified_email IS NULL

# Step 4: Fix application code
# (Don't run migration until code is fixed)

# Step 5: Re-run migration
alembic upgrade head
```

**Best Practices**:
- Always backup before running migrations in production
- Test rollback procedure in staging first
- Keep migrations simple and focused
- Document rollback steps in migration comments

```python
"""Denormalize order_total - ROLLBACK PROCEDURE:
Restore from backup if data corruption occurs.
See: https://wiki/incident/order-denorm-rollback
"""
```

## Data Migrations vs Schema Migrations

### Schema Migration (Structure Change)

**Characteristics**:
- Changes table structure, constraints, indices
- Reversible without data loss
- Alembic auto-generates from models
- Fast execution (< 1 second typical)

**Examples**:
- Add column
- Add index
- Create new table
- Change column type
- Add constraint

```python
def upgrade() -> None:
    op.create_index('ix_orders_user_id', 'orders', ['user_id'])

def downgrade() -> None:
    op.drop_index('ix_orders_user_id', 'orders')
```

### Data Migration (Value Change)

**Characteristics**:
- Transforms existing data
- May require significant compute time
- Must be written manually
- Reversibility depends on data preservation

**Examples**:
- Populate new column from old data
- Denormalize values
- Migrate to new domain model
- Encrypt sensitive data
- Convert timezone formats

```python
def upgrade() -> None:
    # Add column first (schema migration)
    op.add_column('orders', sa.Column('total_cached', sa.Numeric(10, 2), nullable=True))

    # Then backfill data in safe batches
    connection = op.get_bind()

    while True:
        result = connection.execute(text("""
            UPDATE orders
            SET total_cached = (
                SELECT COALESCE(SUM(price * quantity), 0)
                FROM order_items
                WHERE order_items.order_id = orders.id
            )
            WHERE total_cached IS NULL
            LIMIT 10000
        """))

        if result.rowcount == 0:
            break

        # Allow other queries to execute
        time.sleep(1)

def downgrade() -> None:
    op.drop_column('orders', 'total_cached')
```

### Combining Migrations (Expand-Contract)

```python
# Migration 1: Schema change (add column)
def upgrade() -> None:
    op.add_column('users', sa.Column('phone_number_validated', sa.Boolean, default=False, nullable=True))

# This is separate from data backfill
# Application code does the data population
def upgrade_user_phone(user_id: int):
    user = session.query(User).filter_by(id=user_id).first()
    is_valid = validate_phone(user.phone_number)
    user.phone_number_validated = is_valid
    session.commit()

# Migration 2: Make non-nullable after backfill
def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(text("UPDATE users SET phone_number_validated = false WHERE phone_number_validated IS NULL"))
    op.alter_column('users', 'phone_number_validated', nullable=False)
```

## Migration Testing

### Unit Test Pattern

```python
import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, create_engine, text

@pytest.fixture
def migration_engine():
    """Create test database engine"""
    engine = create_engine('postgresql://test:test@localhost/test_migrations')
    return engine

@pytest.fixture
def alembic_config():
    """Load Alembic configuration"""
    return Config('alembic.ini')

def test_migration_upgrade(migration_engine, alembic_config):
    """Test forward migration"""
    from alembic.command import upgrade

    # Start from base
    upgrade(alembic_config, 'base')

    # Run specific migration
    upgrade(alembic_config, '001_add_users')

    # Verify schema
    inspector = inspect(migration_engine)
    tables = inspector.get_table_names()
    assert 'users' in tables

    columns = [col['name'] for col in inspector.get_columns('users')]
    assert 'email' in columns
    assert 'created_at' in columns

def test_migration_downgrade(migration_engine, alembic_config):
    """Test rollback"""
    from alembic.command import upgrade, downgrade

    upgrade(alembic_config, '001_add_users')

    # Verify table exists
    inspector = inspect(migration_engine)
    assert 'users' in inspector.get_table_names()

    # Rollback
    downgrade(alembic_config, 'base')

    # Verify table removed
    inspector = inspect(migration_engine)
    assert 'users' not in inspector.get_table_names()

def test_data_migration_idempotent(migration_engine):
    """Data migrations must be idempotent"""
    with migration_engine.connect() as conn:
        # Run migration
        conn.execute(text("""
            UPDATE orders
            SET total_cached = (SELECT SUM(price * quantity) FROM order_items)
            WHERE total_cached IS NULL
        """))
        conn.commit()

        # Run again - should not change anything
        result = conn.execute(text("SELECT COUNT(*) FROM orders WHERE total_cached IS NULL"))
        assert result.scalar() == 0
```

### Integration Test in CI/CD

```yaml
# .github/workflows/migration-test.yml
name: Test Migrations

on: [push, pull_request]

jobs:
  test-migrations:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-timescaledb
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: test_db
        options: --health-cmd pg_isready --health-interval 10s
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Test migration upgrade
        run: |
          alembic upgrade head

      - name: Verify schema
        run: |
          psql -h localhost -U postgres -d test_db -c "\dt"

      - name: Test migration downgrade
        run: |
          alembic downgrade -1

      - name: Test data integrity
        run: |
          pytest tests/migrations/ -v
```

## Common Pitfalls

### Pitfall 1: Renaming Columns Without Zero-Downtime Pattern

**Problem**: Rename column → old code still references old name → 500 errors

**Bad**:
```python
op.alter_column('users', 'phonenumber', new_column_name='phone_number')
```

**Good** (Expand-Contract):
```python
# Migration 1: Add new column
op.add_column('users', sa.Column('phone_number', sa.String(20), nullable=True))

# App code: Write to both
user.phone_number = value
user.phonenumber = value  # Deprecated

# Migration 2: Backfill
UPDATE users SET phone_number = phonenumber WHERE phone_number IS NULL

# Migration 3: Drop old column (after verifying code doesn't reference it)
op.drop_column('users', 'phonenumber')
```

### Pitfall 2: Large Table Alterations Causing Locks

**Problem**: `ALTER TABLE users ADD COLUMN` on 10M rows locks entire table for 2 hours → site down

**Bad**:
```python
op.add_column('users', sa.Column('last_login', sa.DateTime))
```

**Good** (for large tables):
```python
# 1. Add nullable column (instant, no lock)
op.add_column('users', sa.Column('last_login', sa.DateTime, nullable=True))

# 2. Create index (can run concurrently)
op.create_index('ix_users_last_login', 'users', ['last_login'], postgresql_concurrently=True)

# 3. Backfill in batches (doesn't lock entire table)
connection = op.get_bind()
while True:
    result = connection.execute(text("""
        UPDATE users
        SET last_login = NOW()
        WHERE last_login IS NULL
        LIMIT 10000
    """))
    if result.rowcount == 0:
        break
    time.sleep(0.5)  # Breathing room for other queries
```

### Pitfall 3: Index Locks During Creation

**Problem**: `CREATE INDEX` locks table → cannot query → timeout errors

**Solution**: Use CONCURRENT for PostgreSQL

```python
# Bad: Default behavior locks table
op.create_index('ix_users_email', 'users', ['email'])

# Good: Concurrent index creation
def upgrade() -> None:
    op.execute('CREATE INDEX CONCURRENTLY ix_users_email ON users (email)')

def downgrade() -> None:
    op.drop_index('ix_users_email')
```

**Important**: CONCURRENT cannot be used in a transaction:
```python
def upgrade() -> None:
    # Set isolation level to allow concurrent index creation
    op.execute('SET statement_timeout = "10min"')
    op.execute('CREATE INDEX CONCURRENTLY ix_orders_status ON orders (status)')
```

### Pitfall 4: Insufficient Testing of Rollback Path

**Problem**: Migration works forward, but downgrade is broken

**Prevention**:
```bash
# Test both directions
alembic upgrade head
alembic downgrade base
alembic upgrade head

# Verify data integrity after rollback
SELECT COUNT(*) FROM users WHERE id IS NULL  # Should be 0
```

### Pitfall 5: Foreign Key Constraint Violations

**Problem**: Add constraint on column with inconsistent data

**Bad**:
```python
op.create_foreign_key('fk_orders_users', 'orders', 'users',
                      ['user_id'], ['id'])
```
*Fails if orders.user_id references non-existent user IDs*

**Good**:
```python
# Migration 1: Add nullable constraint
op.add_column('orders', sa.Column('user_id_new', sa.Integer))

# Migration 2: Validate and fix data
# Find orphaned references
SELECT * FROM orders WHERE user_id NOT IN (SELECT id FROM users)

# Clean them up
DELETE FROM orders WHERE user_id NOT IN (SELECT id FROM users)

# Then create constraint
op.create_foreign_key(...)
```

## Version Control for Migrations

### Git Workflow

```bash
# Feature branch
git checkout -b feature/add-user-roles

# Create migration
alembic revision --autogenerate -m "Add user roles table"

# Commit migration
git add alembic/versions/001_add_user_roles.py
git commit -m "db: add user_roles table with cascade delete"

# Push and PR
git push origin feature/add-user-roles
```

### Migration Naming Convention

```
{timestamp}_{action}_{table}.py
001_create_users.py
002_add_status_to_orders.py
003_backfill_order_totals.py
004_drop_legacy_column.py
```

### CLAUDE.md Documentation

```yaml
# Document migration in project CLAUDE.md

## Database Migrations
- Framework: Alembic + SQLAlchemy
- Directory: backend/alembic/versions/
- Naming: {number}_{description}.py
- Rules:
  - Auto-generate from models when possible
  - Test downgrade path in CI/CD
  - Use batching for data backfill on large tables
  - Never lock entire table in production
  - Document rollback procedure in comments
```

### CI/CD Integration

```yaml
# Deploy pipeline includes migration verification
on: [push]
jobs:
  database:
    steps:
      - name: Generate SQL (dry-run)
        run: alembic upgrade head --sql > migrations.sql

      - name: Show migrations to apply
        run: cat migrations.sql

      - name: Run pytest with migration tests
        run: pytest tests/migrations/ -v

      - name: Deploy to staging
        run: alembic upgrade head

      - name: Smoke test API
        run: curl http://staging-api/health
```

---

**Remember**: Migrations are permanent changes to production data. Test thoroughly, plan rollbacks, and communicate schema changes to all stakeholders.
