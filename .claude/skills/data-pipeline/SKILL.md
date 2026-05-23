# Data Pipeline Architecture & Implementation

## 1. ETL vs ELT Patterns

### ETL (Extract, Transform, Load)
**Best for:** Structured, well-understood data transformations; regulated industries; smaller datasets.

```python
# Traditional ETL with Apache Airflow
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

def extract_customer_data(**context):
    """Extract data from source database"""
    import pandas as pd
    from sqlalchemy import create_engine

    engine = create_engine('postgresql://user:pass@source_db:5432/analytics')
    query = """
        SELECT customer_id, email, created_at, status
        FROM customers
        WHERE created_at > %(start_date)s
    """
    df = pd.read_sql(query, engine, params={'start_date': context['ds']})
    context['task_instance'].xcom_push(key='customer_data', value=df.to_json())
    return df.shape[0]

def transform_customer_data(**context):
    """Clean, deduplicate, and enrich customer records"""
    import pandas as pd
    import json

    # Retrieve extracted data
    ti = context['task_instance']
    raw_data = ti.xcom_pull(task_ids='extract', key='customer_data')
    df = pd.read_json(raw_data)

    # Transformations
    df['email'] = df['email'].str.lower().str.strip()
    df = df.drop_duplicates(subset=['customer_id'])

    # Validation
    assert df['email'].notna().sum() > 0, "No valid emails in dataset"

    ti.xcom_push(key='transformed_data', value=df.to_json())
    return len(df)

def load_to_warehouse(**context):
    """Load transformed data into data warehouse"""
    import pandas as pd
    from sqlalchemy import create_engine

    ti = context['task_instance']
    data_json = ti.xcom_pull(task_ids='transform', key='transformed_data')
    df = pd.read_json(data_json)

    engine = create_engine('postgresql://user:pass@warehouse:5432/analytics')
    df.to_sql('customers', engine, if_exists='append', index=False, method='multi', chunksize=1000)

# DAG Definition
default_args = {
    'owner': 'data_team',
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'sla': timedelta(hours=1),
}

with DAG(
    'customer_etl_daily',
    default_args=default_args,
    schedule_interval='0 2 * * *',  # 2 AM daily
    catchup=True,
    max_active_runs=1,
) as dag:

    extract = PythonOperator(
        task_id='extract',
        python_callable=extract_customer_data,
    )

    transform = PythonOperator(
        task_id='transform',
        python_callable=transform_customer_data,
    )

    load = PythonOperator(
        task_id='load',
        python_callable=load_to_warehouse,
    )

    extract >> transform >> load
```

### ELT (Extract, Load, Transform)
**Best for:** Large-scale data; modern cloud data warehouses (Snowflake, BigQuery); complex transformations on warehouse.

```sql
-- ELT pattern: Load raw data, transform in warehouse
-- Step 1: Load raw data (simple, fast)
COPY raw_customers FROM 's3://bucket/customers.csv'
IAM_ROLE 'arn:aws:iam::123456789:role/redshift-role'
DELIMITER ',' IGNOREHEADER 1;

-- Step 2: Transform in warehouse (leverages warehouse compute)
CREATE TABLE IF NOT EXISTS stg_customers AS
SELECT
    customer_id,
    LOWER(TRIM(email)) AS email,
    created_at,
    status,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn
FROM raw_customers
WHERE created_at >= GETDATE() - INTERVAL '1 day'
AND email IS NOT NULL;

-- Remove duplicates (keep most recent)
DELETE FROM stg_customers WHERE rn > 1;

-- Step 3: Insert into production table
INSERT INTO customers
SELECT customer_id, email, created_at, status
FROM stg_customers;
```

**ELT Advantages:**
- Leverage warehouse native compute (faster, cheaper)
- Deferring transformation allows raw data reuse
- Better for exploratory analysis
- Scales to petabytes easily

---

## 2. Batch Processing with Apache Spark

### Spark SQL for Large-Scale Transformations

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, when, row_number, lit, current_timestamp
from pyspark.sql.window import Window
from pyspark.sql.types import StructType, StructField, StringType, LongType, TimestampType

# Initialize Spark Session with optimizations
spark = SparkSession.builder \
    .appName("customer_etl") \
    .config("spark.sql.adaptive.enabled", "true") \
    .config("spark.sql.adaptive.skewJoin.enabled", "true") \
    .config("spark.sql.shuffle.partitions", "200") \
    .config("spark.memory.fraction", "0.8") \
    .getOrCreate()

# Read from distributed source
df = spark.read \
    .format("jdbc") \
    .option("url", "jdbc:postgresql://source:5432/db") \
    .option("dbtable", "customers") \
    .option("user", "user") \
    .option("password", "pass") \
    .option("numPartitions", "10") \
    .option("fetchsize", "10000") \
    .load()

# Complex transformations
cleaned_df = df \
    .filter(col("email").isNotNull()) \
    .withColumn("email", col("email").cast(StringType()).lower()) \
    .withColumn("domain", col("email").substr(col("email").instr(col("email"), "@") + 1, 255)) \
    .withColumn("is_corporate", when(col("domain").isin("gmail.com", "yahoo.com", "hotmail.com"), False).otherwise(True)) \
    .withColumn("signup_date", col("created_at").cast(TimestampType())) \
    .withColumn("days_since_signup", (current_timestamp() - col("signup_date")) / 86400)

# Deduplication with ranking
window_spec = Window.partitionBy("customer_id").orderBy(col("created_at").desc())
deduplicated = cleaned_df \
    .withColumn("row_num", row_number().over(window_spec)) \
    .filter(col("row_num") == 1) \
    .drop("row_num")

# Data quality checks
quality_report = deduplicated \
    .select(
        lit("customer_etl").alias("pipeline"),
        col("customer_id").isNull().cast("long").alias("null_ids"),
        col("email").isNull().cast("long").alias("null_emails"),
    ) \
    .groupBy().sum()

quality_report.show()

# Write with partitioning for optimal query performance
deduplicated.write \
    .mode("overwrite") \
    .partitionBy("signup_date") \
    .parquet("s3://warehouse/customers/v2/")
```

### Pandas for Smaller Batch Jobs

```python
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def process_daily_sales_batch(input_path: str, output_path: str) -> dict:
    """
    Process daily sales data with validation and error handling
    Returns quality metrics
    """
    try:
        # Read with type inference
        df = pd.read_csv(
            input_path,
            dtype={
                'order_id': str,
                'amount': float,
                'currency': str,
                'customer_id': str,
            },
            parse_dates=['order_date'],
            infer_datetime_format=True,
        )

        initial_row_count = len(df)

        # Data quality checks
        invalid_rows = df[
            (df['amount'].isna()) |
            (df['amount'] < 0) |
            (df['order_date'].isna())
        ]

        df = df.drop(invalid_rows.index)

        # Transform
        df['day_of_week'] = df['order_date'].dt.day_name()
        df['month'] = df['order_date'].dt.to_period('M')
        df['amount_usd'] = df.apply(
            lambda row: convert_to_usd(row['amount'], row['currency']),
            axis=1
        )

        # Aggregate by customer
        customer_summary = df.groupby('customer_id').agg({
            'order_id': 'count',
            'amount_usd': ['sum', 'mean', 'std'],
            'order_date': ['min', 'max'],
        }).reset_index()

        customer_summary.columns = ['customer_id', 'order_count', 'total_spent',
                                     'avg_order_value', 'std_order_value',
                                     'first_order', 'last_order']

        # Write with compression
        customer_summary.to_parquet(
            output_path,
            compression='snappy',
            index=False,
            engine='pyarrow',
        )

        return {
            'status': 'success',
            'input_rows': initial_row_count,
            'output_rows': len(customer_summary),
            'removed_rows': initial_row_count - len(df),
            'timestamp': datetime.now().isoformat(),
        }

    except Exception as e:
        return {
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat(),
        }
```

---

## 3. Stream Processing with Kafka & Redis Streams

### Kafka-Based Stream Pipeline

```python
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError
import json
import logging
from typing import Callable, Dict, Any
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StreamProcessor:
    """Real-time event processing pipeline"""

    def __init__(self, bootstrap_servers: list, group_id: str):
        self.consumer = KafkaConsumer(
            'user-events',
            bootstrap_servers=bootstrap_servers,
            group_id=group_id,
            auto_offset_reset='earliest',
            enable_auto_commit=False,  # Manual commit for exactly-once
            value_deserializer=lambda x: json.loads(x.decode('utf-8')),
            max_poll_records=100,
            session_timeout_ms=30000,
        )

        self.producer = KafkaProducer(
            bootstrap_servers=bootstrap_servers,
            value_serializer=lambda x: json.dumps(x).encode('utf-8'),
            acks='all',  # Wait for all replicas
            retries=3,
        )

        self.state_store = {}  # Local state for windowed aggregations

    def process_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Transform and enrich event"""
        try:
            user_id = event.get('user_id')
            event_type = event.get('type')

            # Enrich with context
            enriched = {
                **event,
                'processed_at': datetime.utcnow().isoformat(),
                'pipeline_version': '2.1',
                'user_segment': self._get_user_segment(user_id),
            }

            # Apply business rules
            if event_type == 'purchase' and enriched.get('amount', 0) > 1000:
                enriched['requires_review'] = True

            return enriched
        except Exception as e:
            logger.error(f"Event processing error: {e}", exc_info=True)
            return None

    def _get_user_segment(self, user_id: str) -> str:
        """Lookup user segment from cache/DB"""
        # In production, use Redis cache
        return 'standard'

    def run(self, max_messages: int = None):
        """Main event loop"""
        messages_processed = 0

        try:
            for message in self.consumer:
                event = message.value
                logger.info(f"Received event: {event['user_id']} - {event['type']}")

                # Process
                enriched_event = self.process_event(event)

                if enriched_event:
                    # Send to downstream topic
                    self._send_event(enriched_event)

                    # Manual commit after successful processing
                    self.consumer.commit()
                    messages_processed += 1

                if max_messages and messages_processed >= max_messages:
                    break

        except KeyboardInterrupt:
            logger.info("Shutting down processor...")
        finally:
            self.consumer.close()

    def _send_event(self, event: Dict[str, Any]):
        """Send processed event to output topic"""
        future = self.producer.send(
            'processed-events',
            value=event,
            key=event['user_id'].encode('utf-8'),
        )

        try:
            record_metadata = future.get(timeout=10)
            logger.debug(f"Sent to {record_metadata.topic} partition {record_metadata.partition}")
        except KafkaError as e:
            logger.error(f"Send error: {e}")
            # Implement dead letter queue
            self._send_to_dlq(event, str(e))

    def _send_to_dlq(self, event: Dict[str, Any], error: str):
        """Send failed event to dead letter queue"""
        dlq_event = {
            **event,
            'error': error,
            'failed_at': datetime.utcnow().isoformat(),
        }
        self.producer.send('events-dlq', value=dlq_event)


# Usage
if __name__ == '__main__':
    processor = StreamProcessor(
        bootstrap_servers=['kafka:9092'],
        group_id='user-event-processor-v1'
    )
    processor.run()
```

### Redis Streams for Event Sourcing

```python
import redis
import json
from datetime import datetime
from typing import List, Dict, Any

class RedisStreamEventStore:
    """Event sourcing with Redis Streams"""

    def __init__(self, redis_url: str = 'redis://localhost:6379/0'):
        self.redis = redis.from_url(redis_url)
        self.stream_key = 'transaction-events'

    def append_event(self, event_type: str, data: Dict[str, Any], **kwargs) -> str:
        """Append immutable event to stream"""
        event = {
            'type': event_type,
            'data': json.dumps(data),
            'timestamp': datetime.utcnow().isoformat(),
            **kwargs,
        }

        # Returns event ID (e.g., '1609459200000-0')
        event_id = self.redis.xadd(self.stream_key, event)
        return event_id.decode('utf-8')

    def read_events(self, from_id: str = '0', count: int = 100) -> List[tuple]:
        """Read events from stream"""
        events = self.redis.xrange(
            self.stream_key,
            min=from_id,
            count=count
        )
        return events

    def read_latest(self, count: int = 10) -> List[tuple]:
        """Read N most recent events"""
        return self.redis.xrevrange(self.stream_key, count=count)

    def create_consumer_group(self, group_name: str):
        """Create consumer group for parallel processing"""
        try:
            self.redis.xgroup_create(self.stream_key, group_name, id='0')
        except redis.ResponseError:
            pass  # Group already exists

    def read_pending(self, group_name: str, consumer_name: str, count: int = 10) -> List[tuple]:
        """Read messages for consumer group"""
        messages = self.redis.xreadgroup(
            {self.stream_key: '>'},
            group_name,
            consumer_name,
            count=count,
            block=1000,
        )
        return messages

    def ack_message(self, group_name: str, event_id: str):
        """Acknowledge message processing"""
        self.redis.xack(self.stream_key, group_name, event_id)


# Event sourcing example
store = RedisStreamEventStore()

# Record events
store.append_event('order.created', {'order_id': 'ORD-123', 'amount': 99.99})
store.append_event('payment.received', {'order_id': 'ORD-123', 'amount': 99.99})
store.append_event('order.shipped', {'order_id': 'ORD-123', 'tracking': 'TRK-789'})

# Read full event log
events = store.read_latest(count=10)
for event_id, event_data in events:
    print(f"Event {event_id}: {event_data}")
```

---

## 4. Data Lake Architecture

### Multi-Layer Data Lake Design

```
s3://company-data-lake/
├── raw/                          # Bronze layer (raw, unmodified)
│   ├── customers/
│   │   ├── 2024-01-01/
│   │   ├── 2024-01-02/
│   │   └── _metadata/
│   ├── transactions/
│   ├── clickstream/
│   └── third_party/
├── processed/                     # Silver layer (cleaned, deduplicated)
│   ├── customers/
│   │   └── v2/
│   ├── transactions/
│   └── user_features/
└── analytics/                     # Gold layer (business-ready)
    ├── customer_360/
    ├── revenue_dashboard/
    └── ml_features/
```

### Data Lakehouse Pattern (Delta Lake)

```python
from delta import configure_spark_with_delta_pip
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, current_timestamp

# Create Spark session with Delta
spark = configure_spark_with_delta_pip(SparkSession.builder).getOrCreate()

# ACID transaction support
transactions = spark.read.format("delta").load("s3://data-lake/processed/transactions/")

# Time travel (read data from specific version)
old_version = spark.read.format("delta").option("versionAsOf", 5).load("s3://data-lake/processed/transactions/")

# Data quality with constraints
spark.sql("""
    CREATE TABLE IF NOT EXISTS transactions (
        transaction_id STRING NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status STRING,
        created_at TIMESTAMP,
        CONSTRAINT valid_amount CHECK (amount > 0),
        CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed'))
    )
    USING DELTA
""")

# Merge for upsert operations (slowly changing dimensions)
updates_df = spark.read.parquet("s3://staging/customer_updates/")

spark.sql("""
    MERGE INTO customers c
    USING updates u ON c.customer_id = u.customer_id
    WHEN MATCHED AND u.updated_at > c.updated_at THEN
        UPDATE SET *
    WHEN NOT MATCHED THEN
        INSERT *
""")
```

---

## 5. Pipeline Orchestration

### Airflow Advanced Patterns

```python
from airflow import DAG
from airflow.providers.apache.spark.operators.spark_sql import SparkSqlOperator
from airflow.providers.postgres.operators.postgres import PostgresOperator
from airflow.sensors.external_task import ExternalTaskSensor
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.models import Variable
from airflow.exceptions import AirflowException
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

default_args = {
    'owner': 'data_platform',
    'depends_on_past': False,
    'start_date': datetime(2024, 1, 1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
    'retry_exponential_backoff': True,
    'max_retry_delay': timedelta(hours=1),
    'sla': timedelta(hours=4),
    'pool': 'default_pool',
    'queue': 'default',
}

with DAG(
    'advanced_etl_pipeline',
    default_args=default_args,
    description='Advanced ETL with error handling and monitoring',
    schedule_interval='0 2 * * *',
    catchup=True,
    max_active_runs=1,
    tags=['etl', 'critical'],
) as dag:

    # Wait for upstream data
    wait_for_source_data = ExternalTaskSensor(
        task_id='wait_for_source_data',
        external_dag_id='upstream_data_pipeline',
        external_task_id='export_data',
        timeout=3600,
        poke_interval=60,
        mode='reschedule',
    )

    # Extraction phase
    extract_task = BashOperator(
        task_id='extract_data',
        bash_command="""
            set -e
            export DB_HOST={{ var.json.db_config.host }}
            export DB_USER={{ var.json.db_config.user }}
            python /pipelines/extract.py \
                --output /tmp/{{ ds }}/raw_data.parquet \
                --date {{ ds }}
        """,
        env={
            'AIRFLOW_HOME': '/airflow',
        },
    )

    # Validation before transformation
    def validate_extracted_data(**context):
        import pyarrow.parquet as pq

        file_path = f"/tmp/{context['ds']}/raw_data.parquet"
        table = pq.read_table(file_path)

        if table.num_rows == 0:
            raise AirflowException("No data extracted!")

        logger.info(f"Validated {table.num_rows} rows")

    validate_task = PythonOperator(
        task_id='validate_extraction',
        python_callable=validate_extracted_data,
    )

    # Transformation with Spark
    transform_task = SparkSqlOperator(
        task_id='transform_data',
        sql="""
            SELECT
                customer_id,
                COUNT(*) as order_count,
                SUM(amount) as total_spent,
                CURRENT_TIMESTAMP as processed_at
            FROM raw_data
            WHERE created_at >= DATE('{{ ds }}')
            GROUP BY customer_id
        """,
        conf={
            'spark.executor.memory': '4g',
            'spark.executor.cores': '4',
        },
    )

    # Load to data warehouse
    load_task = PostgresOperator(
        task_id='load_to_warehouse',
        sql="""
            INSERT INTO customer_summary (customer_id, order_count, total_spent, processed_at)
            SELECT customer_id, order_count, total_spent, processed_at
            FROM staging_customer_summary
            ON CONFLICT (customer_id) DO UPDATE
            SET order_count = EXCLUDED.order_count,
                total_spent = EXCLUDED.total_spent,
                processed_at = EXCLUDED.processed_at;
        """,
    )

    # Dependencies
    wait_for_source_data >> extract_task >> validate_task >> transform_task >> load_task
```

### Prefect for Dynamic Pipelines

```python
from prefect import flow, task, get_run_logger, in_process_executor
from prefect.task_runs import wait_for_task_run
from prefect.futures import resolve
from typing import List
import asyncio

@task(retries=3, retry_delay_seconds=60)
async def extract_batch(batch_id: str) -> dict:
    """Extract data batch with retry logic"""
    logger = get_run_logger()
    logger.info(f"Extracting batch {batch_id}")

    # Simulate async data loading
    await asyncio.sleep(1)
    return {
        'batch_id': batch_id,
        'row_count': 1000,
        'data': [1, 2, 3],
    }

@task
async def transform_batch(batch: dict) -> dict:
    """Transform batch with validation"""
    logger = get_run_logger()

    if batch['row_count'] == 0:
        logger.warning(f"Empty batch: {batch['batch_id']}")

    return {
        **batch,
        'transformed': True,
    }

@task
async def load_batch(batch: dict) -> bool:
    """Load batch to destination"""
    logger = get_run_logger()
    logger.info(f"Loading batch {batch['batch_id']}")
    return True

@flow(name="dynamic_batched_pipeline", log_prints=True)
async def process_pipeline(batch_ids: List[str]):
    """Process multiple batches in parallel"""
    logger = get_run_logger()

    # Extract in parallel
    extraction_futures = [extract_batch(bid) for bid in batch_ids]
    extracted_batches = await resolve(extraction_futures)

    # Transform in parallel
    transform_futures = [transform_batch(batch) for batch in extracted_batches]
    transformed_batches = await resolve(transform_futures)

    # Load in parallel
    load_futures = [load_batch(batch) for batch in transformed_batches]
    results = await resolve(load_futures)

    logger.info(f"Pipeline completed: {sum(results)}/{len(results)} batches loaded")
    return results

# Run with native asyncio
if __name__ == '__main__':
    asyncio.run(
        process_pipeline(['batch_001', 'batch_002', 'batch_003'])
    )
```

---

## 6. Data Quality & Monitoring

### Schema Registry Pattern

```python
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.json_schema import JSONDeserializer
import json

schema_registry = SchemaRegistryClient({'url': 'http://schema-registry:8081'})

# Define schema with validation rules
customer_schema = {
    "type": "object",
    "properties": {
        "customer_id": {
            "type": "string",
            "pattern": "^CUST-[0-9]{6}$",
        },
        "email": {
            "type": "string",
            "format": "email",
        },
        "created_at": {
            "type": "string",
            "format": "date-time",
        },
    },
    "required": ["customer_id", "email"],
    "additionalProperties": False,
}

# Register schema
schema_id = schema_registry.register_schema(
    subject_name='customer-value',
    schema_str=json.dumps(customer_schema)
)

# Validate data against schema
from jsonschema import validate, ValidationError

def validate_customer_record(record: dict) -> bool:
    try:
        validate(instance=record, schema=customer_schema)
        return True
    except ValidationError as e:
        logger.error(f"Schema validation failed: {e.message}")
        return False
```

### Data Quality Checks with Great Expectations

```python
from great_expectations.dataset import PandasDataset
import pandas as pd

def run_quality_checks(df: pd.DataFrame) -> dict:
    """Run comprehensive data quality checks"""

    gex_df = PandasDataset(df)
    results = {}

    # Basic checks
    results['no_nulls_email'] = gex_df.expect_column_values_to_not_be_null(
        'email'
    )

    results['valid_emails'] = gex_df.expect_column_values_to_match_regex(
        'email',
        '^[\\w\\.-]+@[\\w\\.-]+\\.\\w+$'
    )

    # Range checks
    results['valid_amounts'] = gex_df.expect_column_values_to_be_between(
        'amount',
        min_value=0,
        max_value=1000000,
    )

    # Uniqueness
    results['unique_ids'] = gex_df.expect_column_values_to_be_unique(
        'customer_id'
    )

    # Statistical checks
    results['reasonable_dates'] = gex_df.expect_column_values_to_be_dateutil_parseable(
        'created_at'
    )

    # Report
    success_count = sum(1 for r in results.values() if r.success)
    return {
        'total_checks': len(results),
        'passed': success_count,
        'failed': len(results) - success_count,
        'details': results,
    }
```

---

## 7. Idempotency & Error Handling

### Idempotent Message Processing

```python
import hashlib
import json
from typing import Any, Dict

class IdempotentProcessor:
    """Ensure exactly-once processing semantics"""

    def __init__(self, redis_client, expiry_seconds: int = 86400):
        self.redis = redis_client
        self.expiry = expiry_seconds

    def generate_idempotency_key(self, message: Dict[str, Any]) -> str:
        """Generate deterministic key from message content"""
        # Use source system ID + timestamp + content hash
        content = json.dumps(message, sort_keys=True)
        content_hash = hashlib.sha256(content.encode()).hexdigest()

        return f"idempotent:{message['source']}:{message['timestamp']}:{content_hash}"

    def process_once(self, message: Dict[str, Any], processor_fn, *args, **kwargs) -> Any:
        """Execute processor function only once per unique message"""

        idempotency_key = self.generate_idempotency_key(message)

        # Check if already processed
        cached_result = self.redis.get(idempotency_key)
        if cached_result:
            logger.info(f"Message already processed: {idempotency_key}")
            return json.loads(cached_result)

        # Process new message
        try:
            result = processor_fn(message, *args, **kwargs)

            # Cache result
            self.redis.setex(
                idempotency_key,
                self.expiry,
                json.dumps(result, default=str)
            )

            return result

        except Exception as e:
            logger.error(f"Processing failed: {e}")
            raise


# Usage example
processor = IdempotentProcessor(redis_client)

def handle_payment(message: Dict) -> dict:
    order_id = message['order_id']
    amount = message['amount']

    # Charge customer
    charge_result = stripe.Charge.create(
        amount=int(amount * 100),
        currency='usd',
        idempotency_key=f"order_{order_id}",  # Stripe also uses idempotency
    )

    return {'charge_id': charge_result.id, 'status': 'success'}

result = processor.process_once(
    {'source': 'payment-queue', 'timestamp': '2024-01-01T12:00:00',
     'order_id': 'ORD-123', 'amount': 99.99},
    handle_payment
)
```

### Dead Letter Queue Pattern

```python
import logging
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime

class RetryStrategy(Enum):
    EXPONENTIAL = "exponential"
    LINEAR = "linear"
    FIXED = "fixed"

@dataclass
class DeadLetterMessage:
    original_message: dict
    error: str
    retry_count: int
    first_error_at: str
    last_error_at: str
    next_retry_at: str = None
    source_topic: str = None

class DeadLetterHandler:
    """Manage messages that fail processing"""

    def __init__(self, redis_client, max_retries: int = 5):
        self.redis = redis_client
        self.max_retries = max_retries
        self.dlq_key = "dlq:messages"

    def send_to_dlq(self, message: dict, error: Exception, source_topic: str = None):
        """Route failed message to dead letter queue"""

        dlq_msg = DeadLetterMessage(
            original_message=message,
            error=str(error),
            retry_count=0,
            first_error_at=datetime.utcnow().isoformat(),
            last_error_at=datetime.utcnow().isoformat(),
            source_topic=source_topic,
        )

        # Store in Redis with TTL
        msg_key = f"{self.dlq_key}:{message.get('id', hash(str(message)))}"
        self.redis.setex(msg_key, 604800, json.dumps(asdict(dlq_msg)))  # 7 days

        logging.error(f"Message sent to DLQ: {msg_key}")

    def retry_dlq_message(self, message_key: str, retry_strategy: RetryStrategy = RetryStrategy.EXPONENTIAL):
        """Attempt to reprocess DLQ message"""

        dlq_msg_str = self.redis.get(message_key)
        if not dlq_msg_str:
            return False

        dlq_msg = json.loads(dlq_msg_str)

        if dlq_msg['retry_count'] >= self.max_retries:
            logging.error(f"Max retries exceeded for {message_key}")
            self.redis.move(message_key, 1)  # Move to another DB (archive)
            return False

        # Calculate next retry time
        retry_count = dlq_msg['retry_count'] + 1
        if retry_strategy == RetryStrategy.EXPONENTIAL:
            delay_seconds = 2 ** retry_count
        elif retry_strategy == RetryStrategy.LINEAR:
            delay_seconds = retry_count * 60
        else:  # FIXED
            delay_seconds = 300

        dlq_msg['retry_count'] = retry_count
        dlq_msg['last_error_at'] = datetime.utcnow().isoformat()

        # Re-queue with delay
        self.redis.setex(
            f"retry:{message_key}",
            delay_seconds,
            json.dumps(dlq_msg)
        )

        return True
```

---

## 8. Testing Data Pipelines

### Unit & Integration Tests

```python
import pytest
import pandas as pd
from unittest.mock import Mock, patch

def test_extract_customer_data(mock_database_connection):
    """Test extraction logic"""

    # Setup
    mock_df = pd.DataFrame({
        'customer_id': ['CUST-001', 'CUST-002'],
        'email': ['test1@example.com', 'test2@example.com'],
        'created_at': pd.to_datetime(['2024-01-01', '2024-01-02']),
    })

    mock_database_connection.execute.return_value = mock_df

    # Execute
    from pipeline import extract_customer_data
    result = extract_customer_data(mock_database_connection)

    # Assert
    assert len(result) == 2
    assert result['customer_id'].tolist() == ['CUST-001', 'CUST-002']

def test_transform_handles_null_emails():
    """Test null email handling"""
    from pipeline import transform_data

    df = pd.DataFrame({
        'customer_id': ['1', '2', '3'],
        'email': ['test@example.com', None, 'test3@example.com'],
    })

    result = transform_data(df)

    # Should drop nulls
    assert len(result) == 2
    assert result['email'].isna().sum() == 0

def test_pipeline_with_empty_dataset():
    """Test handling of empty input"""
    from pipeline import process_batch

    empty_df = pd.DataFrame(columns=['customer_id', 'email'])

    with pytest.raises(ValueError, match="No data to process"):
        process_batch(empty_df)

@pytest.fixture
def sample_kafka_message():
    return {
        'user_id': 'user-123',
        'action': 'purchase',
        'amount': 99.99,
        'timestamp': '2024-01-01T12:00:00Z',
    }

def test_stream_processor_enriches_events(sample_kafka_message):
    """Test event enrichment in stream processor"""
    from stream_processor import StreamProcessor

    processor = StreamProcessor(['localhost:9092'], 'test-group')
    enriched = processor.process_event(sample_kafka_message)

    assert 'processed_at' in enriched
    assert 'user_segment' in enriched
    assert enriched['pipeline_version'] == '2.1'
```

---

## Key Takeaways

1. **Choose ETL or ELT based on scale**: ETL for small, complex transforms; ELT for data warehouse scale
2. **Implement idempotency** to handle retries safely
3. **Monitor data quality** at every stage with schema validation
4. **Use dead letter queues** for failed messages
5. **Partition data** for performance at scale
6. **Version your schemas** and track changes
7. **Test pipeline logic** thoroughly with edge cases
8. **Implement monitoring** for SLAs and alerting on failures

