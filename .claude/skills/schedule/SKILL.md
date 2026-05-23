# Schedule Skill - Professional Task Scheduling and Automation

## Overview

This skill provides comprehensive task scheduling and automation capabilities for enterprise applications. Covers cron expressions, APScheduler, task queues, retry strategies, and distributed job management.

## Core Concepts

### 1. Cron Expression Basics

Cron format: `minute hour day_of_month month day_of_week`

```
# Format: M H D Mo DoW
# M:  0-59 (minute)
# H:  0-23 (hour, 24-hour)
# D:  1-31 (day of month)
# Mo: 1-12 (month)
# DoW: 0-6 (day of week, 0=Sunday)

# Every day at 9:00 AM
0 9 * * *

# Every weekday at 8:30 AM
30 8 * * 1-5

# Every Monday at 3:00 PM
0 15 * * 1

# First day of month at midnight
0 0 1 * *

# Every 15 minutes
*/15 * * * *

# Every hour on the 30th minute
30 * * * *

# Every 6 hours
0 */6 * * *

# At 2:30 AM on weekends
30 2 * * 0,6

# Last day of February (complex, requires logic)
0 0 28-31 2 *

# Every 5 minutes during business hours (9-17)
*/5 9-17 * * *
```

### 2. APScheduler - Python Background Jobs

#### Installation and Setup
```bash
pip install apscheduler
```

#### Basic Scheduled Job
```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
import logging

logging.basicConfig()
logging.getLogger('apscheduler').setLevel(logging.DEBUG)

# Create scheduler
scheduler = BackgroundScheduler()

# Define job function
def my_scheduled_job():
    print(f"Job running at {datetime.now()}")

# Add job with interval trigger (every 10 seconds)
scheduler.add_job(
    my_scheduled_job,
    IntervalTrigger(seconds=10),
    id='job_id_1',
    name='My Scheduled Job'
)

# Add job with cron trigger
scheduler.add_job(
    my_scheduled_job,
    CronTrigger(hour=9, minute=0, day_of_week='mon-fri'),
    id='job_id_2',
    name='Weekday Morning Job'
)

# Start scheduler
scheduler.start()

# Keep application running
try:
    import time
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    scheduler.shutdown()
    print("Scheduler shut down")
```

#### Cron-Based Scheduling
```python
from apscheduler.triggers.cron import CronTrigger

# Every day at 9:00 AM
scheduler.add_job(
    my_scheduled_job,
    CronTrigger(hour=9, minute=0),
    id='daily_job'
)

# Every weekday at 8:30 AM
scheduler.add_job(
    my_scheduled_job,
    CronTrigger(hour=8, minute=30, day_of_week='mon-fri'),
    id='weekday_job'
)

# Every 1st of month at 00:00
scheduler.add_job(
    my_scheduled_job,
    CronTrigger(day=1, hour=0, minute=0),
    id='monthly_job'
)

# Every 15 minutes
scheduler.add_job(
    my_scheduled_job,
    CronTrigger(minute='*/15'),
    id='every_15min'
)

# Monday-Friday, 9-17, every 30 minutes
scheduler.add_job(
    my_scheduled_job,
    CronTrigger(
        hour='9-17',
        minute='*/30',
        day_of_week='mon-fri'
    ),
    id='business_hours_job'
)
```

#### Timezone-Aware Scheduling
```python
from apscheduler.triggers.cron import CronTrigger
import pytz

# Schedule in specific timezone
eastern = pytz.timezone('US/Eastern')
pacific = pytz.timezone('US/Pacific')

scheduler.add_job(
    my_scheduled_job,
    CronTrigger(hour=9, minute=0, timezone=eastern),
    id='eastern_job'
)

scheduler.add_job(
    my_scheduled_job,
    CronTrigger(hour=9, minute=0, timezone=pacific),
    id='pacific_job'
)

# Current timezone aware scheduling
from datetime import datetime, timezone
now = datetime.now(timezone.utc)
print(f"Current UTC time: {now}")
```

#### Job Scheduling in Web Framework

```python
# FastAPI example
from fastapi import FastAPI
from apscheduler.schedulers.background import BackgroundScheduler
from contextlib import asynccontextmanager

app = FastAPI()

# Global scheduler reference
scheduler = None

def startup_event():
    global scheduler
    scheduler = BackgroundScheduler()

    # Add jobs
    scheduler.add_job(
        periodic_task,
        'cron',
        hour=9,
        minute=0,
        id='morning_task',
        name='Morning Task'
    )

    scheduler.start()

def shutdown_event():
    global scheduler
    if scheduler:
        scheduler.shutdown()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    startup_event()
    yield
    # Shutdown
    shutdown_event()

app = FastAPI(lifespan=lifespan)

def periodic_task():
    print("Periodic task executed")

@app.get("/jobs")
def list_jobs():
    """List all scheduled jobs"""
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            'id': job.id,
            'name': job.name,
            'trigger': str(job.trigger),
            'next_run_time': str(job.next_run_time)
        })
    return jobs

@app.post("/jobs/{job_id}/pause")
def pause_job(job_id: str):
    """Pause a job"""
    job = scheduler.get_job(job_id)
    if job:
        job.pause()
        return {"status": "paused", "job_id": job_id}
    return {"error": "Job not found"}

@app.post("/jobs/{job_id}/resume")
def resume_job(job_id: str):
    """Resume a paused job"""
    job = scheduler.get_job(job_id)
    if job:
        job.resume()
        return {"status": "resumed", "job_id": job_id}
    return {"error": "Job not found"}
```

### 3. Retry Strategies

```python
from apscheduler.executors.pool import ThreadPoolExecutor, ProcessPoolExecutor
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

# Configure scheduler with persistence and retry
scheduler = BackgroundScheduler({
    'apscheduler.jobstores.default': {
        'type': 'sqlalchemy',
        'url': 'sqlite:///jobs.sqlite'
    },
    'apscheduler.executors.default': {
        'type': 'thread',
        'max_workers': 20
    },
    'apscheduler.executors.processpool': {
        'type': 'processpool',
        'max_workers': 5
    },
    'apscheduler.job_defaults.coalesce': True,
    'apscheduler.job_defaults.max_instances': 1
})

def job_with_retry(retries=3):
    """Job function with built-in retry logic"""
    attempt = 0
    max_attempts = retries

    def execute_with_retry():
        nonlocal attempt
        attempt += 1

        try:
            # Your job logic here
            result = perform_operation()
            return result
        except Exception as e:
            if attempt < max_attempts:
                print(f"Attempt {attempt} failed. Retrying...")
                execute_with_retry()
            else:
                print(f"All {max_attempts} attempts failed")
                raise

    return execute_with_retry()

# Add job with error handling
def my_job():
    try:
        print("Executing job...")
        job_with_retry(retries=3)
    except Exception as e:
        print(f"Job failed after retries: {e}")
        # Log to error tracking service

scheduler.add_job(
    my_job,
    'cron',
    hour=9,
    minute=0,
    id='resilient_job'
)
```

### 4. Task Queues with Celery

#### Installation
```bash
pip install celery redis
```

#### Basic Setup
```python
from celery import Celery
from datetime import datetime
import time

# Create Celery app
app = Celery(
    'myapp',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0'
)

# Configure Celery
app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_time_limit=30 * 60,  # 30 minute hard limit
    task_soft_time_limit=25 * 60,  # 25 minute soft limit
)

# Define task
@app.task(bind=True, max_retries=3)
def long_running_task(self, data):
    """Task with automatic retry on failure"""
    try:
        print(f"Processing: {data}")
        time.sleep(5)
        return f"Completed: {data}"
    except Exception as exc:
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)

# Define periodic task
@app.task
def periodic_task():
    """Task that runs on schedule"""
    print(f"Periodic task at {datetime.now()}")
    return "Done"

@app.task
def send_email(to_address, subject, message):
    """Send email task"""
    print(f"Sending email to {to_address}")
    # Email sending logic
    return f"Email sent to {to_address}"

# Schedule periodic tasks
from celery.schedules import crontab

app.conf.beat_schedule = {
    'daily-task': {
        'task': 'tasks.periodic_task',
        'schedule': crontab(hour=9, minute=0),
    },
    'every-15-minutes': {
        'task': 'tasks.long_running_task',
        'schedule': crontab(minute='*/15'),
        'args': ('default_data',)
    },
    'weekday-morning': {
        'task': 'tasks.send_email',
        'schedule': crontab(hour=8, minute=30, day_of_week='mon-fri'),
        'kwargs': {
            'to_address': 'team@example.com',
            'subject': 'Daily Report',
            'message': 'Here is your daily report'
        }
    }
}
```

#### Running Celery Workers
```bash
# Start worker
celery -A myapp worker --loglevel=info

# Start beat scheduler
celery -A myapp beat --loglevel=info

# Both together (development only)
celery -A myapp worker --loglevel=info --beat
```

#### Task Monitoring
```python
from celery import Celery
from celery.result import AsyncResult

app = Celery('myapp', broker='redis://localhost:6379/0')

# Send task and get ID
task = long_running_task.delay('important_data')
task_id = task.id

# Check task status
def check_task_status(task_id):
    result = AsyncResult(task_id, app=app)

    if result.state == 'PENDING':
        return {'state': 'pending', 'progress': 0}
    elif result.state == 'PROGRESS':
        return {
            'state': 'progress',
            'progress': result.info.get('progress', 0)
        }
    elif result.state == 'SUCCESS':
        return {
            'state': 'success',
            'result': result.result
        }
    elif result.state == 'FAILURE':
        return {
            'state': 'failure',
            'error': str(result.info)
        }

# Track progress in long task
@app.task(bind=True)
def process_large_dataset(self, dataset_size):
    """Task that reports progress"""
    for i in range(dataset_size):
        # Update progress
        self.update_state(
            state='PROGRESS',
            meta={'progress': (i + 1) / dataset_size * 100}
        )
        # Processing logic
        time.sleep(1)

    return f'Processed {dataset_size} items'
```

### 5. Node.js Scheduling with node-cron

#### Installation
```bash
npm install node-cron
```

#### Basic Scheduling
```javascript
const cron = require('node-cron');

// Run task every day at 9:00 AM
cron.schedule('0 9 * * *', () => {
  console.log('Running daily task');
  performDailyTask();
});

// Every 15 minutes
cron.schedule('*/15 * * * *', () => {
  console.log('Running every 15 minutes');
});

// Every weekday at 8:30 AM
cron.schedule('30 8 * * 1-5', () => {
  console.log('Weekday morning task');
});

// First day of month at midnight
cron.schedule('0 0 1 * *', () => {
  console.log('Monthly task');
});

// Complex: Every 5 minutes during business hours
cron.schedule('*/5 9-17 * * *', () => {
  console.log('Business hours task');
});
```

#### Task with Error Handling
```javascript
const cron = require('node-cron');

// Create task with error handling
const task = cron.schedule('0 9 * * *', () => {
  try {
    console.log('Task starting...');
    // Async task
    performAsyncTask()
      .then(result => {
        console.log('Task completed:', result);
      })
      .catch(error => {
        console.error('Task failed:', error);
        // Send alert
        notifyError(error);
      });
  } catch (error) {
    console.error('Unexpected error:', error);
  }
});

// Control task
task.stop();      // Stop running
task.start();     // Start/resume
task.destroy();   // Destroy task
```

#### Task Queue with Bull (Node.js)
```javascript
const Queue = require('bull');

// Create queue (requires Redis)
const emailQueue = new Queue('email', {
  redis: {
    host: 'localhost',
    port: 6379
  }
});

// Process jobs
emailQueue.process(5, async (job) => {
  console.log('Processing email job:', job.id);
  const { to, subject, message } = job.data;

  try {
    await sendEmail(to, subject, message);
    return { status: 'sent' };
  } catch (error) {
    // Retry with exponential backoff
    throw error;
  }
});

// Add job to queue
async function queueEmail(to, subject, message) {
  const job = await emailQueue.add(
    { to, subject, message },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: true
    }
  );

  return job.id;
}

// Monitor job events
emailQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed: ${result.status}`);
});

emailQueue.on('failed', (job, err) => {
  console.log(`Job ${job.id} failed: ${err.message}`);
});

// Get queue stats
emailQueue.getJobCounts().then(counts => {
  console.log('Queue stats:', counts);
  // { active, completed, failed, delayed, waiting }
});
```

### 6. Dead Letter Detection and Handling

```python
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime

def monitor_dead_jobs():
    """Monitor and alert on failed scheduled jobs"""
    scheduler = BackgroundScheduler()
    failed_jobs = []

    def check_job_execution():
        """Check if critical jobs have executed recently"""
        critical_jobs = ['daily_sync', 'hourly_check', 'backup_task']

        for job_id in critical_jobs:
            job = scheduler.get_job(job_id)
            if job:
                if job.next_run_time is None:
                    failed_jobs.append({
                        'job_id': job_id,
                        'failure_time': datetime.now(),
                        'status': 'paused_or_failed'
                    })

                    # Send alert
                    alert_ops_team(f"Critical job {job_id} appears to have failed")

    scheduler.add_job(
        check_job_execution,
        'interval',
        minutes=5,
        id='dead_job_monitor'
    )

    return scheduler, failed_jobs

def with_job_execution_tracking(func):
    """Decorator to track job execution and report failures"""
    import functools
    from datetime import datetime

    last_execution = {}

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        job_name = func.__name__
        try:
            result = func(*args, **kwargs)
            last_execution[job_name] = {
                'timestamp': datetime.now(),
                'status': 'success'
            }
            return result
        except Exception as e:
            last_execution[job_name] = {
                'timestamp': datetime.now(),
                'status': 'failed',
                'error': str(e)
            }
            raise

    wrapper.last_execution = last_execution
    return wrapper

# Usage
@with_job_execution_tracking
def my_critical_job():
    print("Executing critical job")
    # Job logic here
```

### 7. Distributed Scheduling with Multiple Workers

```python
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore

# Shared job store across multiple instances
scheduler = BackgroundScheduler({
    'apscheduler.jobstores.default': {
        'type': 'sqlalchemy',
        'url': 'postgresql://user:password@localhost/jobs_db'
    },
    'apscheduler.job_defaults.coalesce': True,
    'apscheduler.job_defaults.max_instances': 1  # Prevent duplicate execution
})

# Each worker reads from shared database
scheduler.add_job(
    my_task,
    'cron',
    hour=9,
    minute=0,
    id='distributed_task'
)

scheduler.start()

# Only one instance will execute the job
# (enforced by database-level locking)
```

### 8. Calendar-Based Scheduling

```python
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta

# Run on specific dates
def schedule_for_dates(scheduler, job_func, dates):
    """Schedule job for specific list of dates"""
    for date in dates:
        trigger = CronTrigger(
            year=date.year,
            month=date.month,
            day=date.day,
            hour=9,
            minute=0
        )
        scheduler.add_job(
            job_func,
            trigger,
            id=f'scheduled_{date.isoformat()}'
        )

# Run on business days excluding holidays
def schedule_business_days(scheduler, job_func, holidays=None):
    """Schedule for weekdays excluding holidays"""
    if holidays is None:
        holidays = []

    def before_func(scheduler, job):
        # Check if today is a holiday
        today = datetime.now().date()
        return today not in holidays

    scheduler.add_job(
        job_func,
        'cron',
        day_of_week='mon-fri',
        hour=9,
        minute=0
    )
```

## Best Practices

1. **Timezone Consistency**: Always use UTC internally, convert for display
2. **Idempotent Jobs**: Design jobs to be safely re-runnable
3. **Monitoring**: Track job execution and failures
4. **Logging**: Comprehensive logging for debugging
5. **Resource Limits**: Set timeout and concurrency limits
6. **Error Handling**: Implement retry strategies appropriately
7. **Job Persistence**: Use databases for critical job schedules
8. **Graceful Shutdown**: Ensure proper cleanup on termination
9. **Testing**: Test scheduled jobs with mock clocks
10. **Documentation**: Document job purposes and schedules

## Limitations

- Single-machine APScheduler not suitable for distributed systems
- Cron lacks second-level precision (minimum is 1 minute)
- Memory-based job stores lost on restart
- No built-in UI for job management (use APScheduler REST API)

## Dependencies

```bash
# Python
pip install apscheduler celery redis pytz

# Node.js
npm install node-cron bull redis
```

## Resources

- [APScheduler Documentation](https://apscheduler.readthedocs.io/)
- [Celery Documentation](https://docs.celeryproject.org/)
- [node-cron Documentation](https://www.npmjs.com/package/node-cron)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Cron Expression Tester](https://crontab.guru/)
