# Data Validation and Integrity

Enterprise-grade validation patterns covering multiple frameworks, sanitization strategies, and production safety practices.

## Table of Contents

1. [Pydantic v2 Patterns](#pydantic-v2-patterns)
2. [Zod Schemas (TypeScript)](#zod-schemas-typescript)
3. [JSON Schema Validation](#json-schema-validation)
4. [Input Sanitization](#input-sanitization)
5. [Custom Validators](#custom-validators)
6. [Cross-Field Validation](#cross-field-validation)
7. [File Upload Validation](#file-upload-validation)
8. [API Payload Validation](#api-payload-validation)
9. [Database Constraints vs Application Validation](#database-constraints-vs-application-validation)
10. [Error Message Standardization](#error-message-standardization)

## Pydantic v2 Patterns

### Basic Validation

```python
from pydantic import BaseModel, Field, EmailStr, validator, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=0, le=150)
    referral_code: Optional[str] = Field(None, pattern=r'^REF-[A-Z0-9]{8}$')

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "SecurePass123",
                "first_name": "John",
                "last_name": "Doe",
                "age": 30,
                "referral_code": "REF-ABC12345"
            }
        }
```

### Field Validators (Pydantic v2)

```python
from pydantic import BaseModel, field_validator, field_serializer
import re
from datetime import datetime

class UserProfile(BaseModel):
    username: str
    bio: str
    website: Optional[str] = None
    created_at: datetime

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters')
        if not re.match(r'^[a-zA-Z0-9_-]+$', v):
            raise ValueError('Username can only contain letters, numbers, _, -')
        return v

    @field_validator('bio')
    @classmethod
    def validate_bio(cls, v: str) -> str:
        if len(v) > 500:
            raise ValueError('Bio must not exceed 500 characters')
        # Remove potential XSS
        return v.strip()

    @field_validator('website')
    @classmethod
    def validate_website(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not v.startswith(('http://', 'https://')):
            raise ValueError('Website must start with http:// or https://')
        if len(v) > 2048:
            raise ValueError('Website URL is too long')
        return v

    @field_validator('created_at')
    @classmethod
    def validate_created_at(cls, v: datetime) -> datetime:
        if v > datetime.utcnow():
            raise ValueError('Created date cannot be in the future')
        return v

    # Serialize datetime in ISO format
    @field_serializer('created_at')
    def serialize_datetime(self, value: datetime) -> str:
        return value.isoformat()
```

### Root Validator (Multiple Fields)

```python
from pydantic import model_validator

class PasswordReset(BaseModel):
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)
    current_password: str = Field(..., min_length=8)

    @model_validator(mode='after')
    def validate_passwords(self) -> 'PasswordReset':
        if self.new_password != self.confirm_password:
            raise ValueError('Passwords do not match')
        if self.new_password == self.current_password:
            raise ValueError('New password must be different from current')
        return self
```

### Nested Models

```python
from pydantic import BaseModel

class Address(BaseModel):
    street: str
    city: str
    state: str = Field(..., min_length=2, max_length=2)
    zip_code: str = Field(..., pattern=r'^\d{5}(-\d{4})?$')
    country: str = Field(default='US')

class BillingInfo(BaseModel):
    card_number: str = Field(..., pattern=r'^[0-9]{13,19}$')
    exp_month: int = Field(..., ge=1, le=12)
    exp_year: int = Field(...)
    cvv: str = Field(..., pattern=r'^[0-9]{3,4}$')

    @field_validator('exp_year')
    @classmethod
    def validate_exp_year(cls, v: int) -> int:
        current_year = datetime.now().year
        if v < current_year:
            raise ValueError('Card has expired')
        if v > current_year + 20:
            raise ValueError('Expiration year is invalid')
        return v

class Order(BaseModel):
    order_id: str
    items: List[OrderItem]
    billing_address: Address
    shipping_address: Optional[Address] = None
    payment: BillingInfo

    @model_validator(mode='after')
    def validate_addresses(self) -> 'Order':
        if self.shipping_address is None:
            self.shipping_address = self.billing_address
        return self
```

### Config and Strict Mode

```python
from pydantic import BaseModel, ConfigDict, ValidationError

class StrictUser(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_default=True,
        use_enum_values=True,
        populate_by_name=True,  # Allow both snake_case and camelCase
        json_schema_extra={
            "example": {"user_id": 123, "email": "user@example.com"}
        }
    )

    user_id: int
    email: str
    role: str = Field(..., pattern=r'^(admin|user|guest)$')

# Usage with error handling
try:
    user = StrictUser(
        user_id="123",  # Will be coerced to int
        email="  user@example.com  ",  # Will be stripped
        role="admin"
    )
except ValidationError as e:
    print(e.json())
    # Handle validation errors
```

## Zod Schemas (TypeScript)

### Basic Zod Setup

```typescript
import { z } from 'zod';

const UserCreateSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[!@#$%^&*]/, 'Password must contain special character'),
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name is too long'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name is too long'),
  age: z
    .number()
    .int('Age must be whole number')
    .min(0, 'Age cannot be negative')
    .max(150, 'Age is invalid'),
  referralCode: z
    .string()
    .regex(/^REF-[A-Z0-9]{8}$/, 'Invalid referral code format')
    .optional(),
});

type UserCreate = z.infer<typeof UserCreateSchema>;

// Validation
const result = UserCreateSchema.safeParse(userData);
if (!result.success) {
  console.error(result.error.flatten());
}
```

### Advanced Zod Validators

```typescript
import { z } from 'zod';

// Custom validation with refine
const PasswordResetSchema = z
  .object({
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
    currentPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different from current',
    path: ['newPassword'],
  });

// Discriminated unions (for type-safe variants)
const NotificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email'),
    email: z.string().email(),
    subject: z.string(),
  }),
  z.object({
    type: z.literal('sms'),
    phoneNumber: z.string().regex(/^\+?[0-9]{10,}$/),
    message: z.string().max(160),
  }),
  z.object({
    type: z.literal('push'),
    deviceId: z.string().uuid(),
    title: z.string(),
  }),
]);

type Notification = z.infer<typeof NotificationSchema>;

// Default values and preprocessing
const UserProfileSchema = z.object({
  username: z
    .string()
    .min(3)
    .transform((val) => val.toLowerCase())
    .transform((val) => val.trim()),
  bio: z.string().max(500).default(''),
  createdAt: z.string().datetime().pipe(z.coerce.date()),
});

// Array validation
const BulkUserCreateSchema = z.array(UserCreateSchema).min(1).max(1000);

// Conditional validation
const OrderSchema = z.object({
  items: z.array(z.object({ productId: z.string(), quantity: z.number() })),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
  }).optional(),
}).refine(
  (data) => {
    // If any item requires shipping, address is required
    const needsShipping = data.items.some((item) => item.requiresShipping);
    return !needsShipping || data.shippingAddress;
  },
  { message: 'Shipping address required for this order' },
);
```

## JSON Schema Validation

### Standalone JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "User",
  "type": "object",
  "properties": {
    "id": {
      "type": "integer",
      "description": "Unique user identifier"
    },
    "email": {
      "type": "string",
      "format": "email",
      "description": "User email address"
    },
    "username": {
      "type": "string",
      "minLength": 3,
      "maxLength": 50,
      "pattern": "^[a-zA-Z0-9_-]+$"
    },
    "age": {
      "type": "integer",
      "minimum": 0,
      "maximum": 150
    },
    "roles": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["admin", "user", "guest"]
      },
      "minItems": 1
    },
    "metadata": {
      "type": "object",
      "properties": {
        "lastLogin": {
          "type": "string",
          "format": "date-time"
        },
        "preferences": {
          "type": "object",
          "additionalProperties": true
        }
      }
    }
  },
  "required": ["id", "email", "username"],
  "additionalProperties": false
}
```

### Validation with ajv (Node.js)

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);

const userSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    age: { type: 'integer', minimum: 0 },
  },
  required: ['email'],
};

const validate = ajv.compile(userSchema);

const data = { email: 'user@example.com', age: 30 };
const valid = validate(data);

if (!valid) {
  console.error('Validation errors:', validate.errors);
}
```

## Input Sanitization

### HTML/Script Sanitization

```python
from html import escape
from bleach import clean
import re

def sanitize_html(content: str, allowed_tags: list = None) -> str:
    """Remove dangerous HTML but allow formatting"""
    if allowed_tags is None:
        allowed_tags = ['p', 'br', 'strong', 'em', 'a', 'ul', 'li']

    return clean(
        content,
        tags=allowed_tags,
        attributes={
            'a': ['href', 'title'],
            '*': ['class'],
        },
        strip=True,
    )

def sanitize_plain_text(content: str) -> str:
    """Remove all HTML, escape dangerous characters"""
    return escape(content)

# Examples
user_bio = '<img src=x onerror="alert(123)">Nice bio'
safe_bio = sanitize_html(user_bio)  # Safe HTML output

user_input = '<script>alert("xss")</script>'
safe_input = sanitize_plain_text(user_input)  # Escaped output
```

### SQL Injection Prevention

```python
from sqlalchemy import text, bindparam
from sqlalchemy.orm import Session

class UserRepository:
    def find_by_email(self, session: Session, email: str):
        """SAFE: Using parameterized queries"""
        query = text("SELECT * FROM users WHERE email = :email")
        return session.execute(query, {"email": email}).first()

    def find_by_username_unsafe(self, session: Session, username: str):
        """DANGEROUS: String concatenation (NEVER DO THIS)"""
        query = f"SELECT * FROM users WHERE username = '{username}'"
        return session.execute(query).first()

# Correct approach with ORM
from sqlalchemy.orm import select

def find_by_username(session: Session, username: str) -> User:
    """SAFE: SQLAlchemy ORM automatically parameterizes"""
    stmt = select(User).where(User.username == username)
    return session.execute(stmt).scalar_one_or_none()
```

### NoSQL Injection Prevention

```python
from pymongo import MongoClient
from bson.objectid import ObjectId

class MongoUserRepository:
    def find_by_email_safe(self, email: str):
        """SAFE: MongoDB query with type validation"""
        # Email is validated by schema before reaching here
        return self.collection.find_one({'email': email})

    def find_by_id_safe(self, user_id: str):
        """SAFE: ObjectId validation"""
        try:
            oid = ObjectId(user_id)
        except Exception:
            return None
        return self.collection.find_one({'_id': oid})

    def find_by_email_unsafe(self, email: str):
        """DANGEROUS: NoSQL injection possible"""
        # User input directly in query: {"email": {$ne: null}}
        return self.collection.find_one({'email': email})
```

### XSS Prevention in Frontend

```typescript
// React - automatic escaping
const UserProfile: React.FC<{ bio: string }> = ({ bio }) => {
  return (
    <div>
      {/* Safe: React escapes by default */}
      <p>{bio}</p>

      {/* Dangerous: dangerouslySetInnerHTML */}
      <div dangerouslySetInnerHTML={{ __html: bio }} />
    </div>
  );
};

// Use DOMPurify for HTML content
import DOMPurify from 'dompurify';

const SafeHtmlDisplay: React.FC<{ html: string }> = ({ html }) => {
  const cleanHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'],
    ALLOWED_ATTR: ['href'],
  });

  return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
};
```

## Custom Validators

### Pydantic Custom Validators

```python
from pydantic import BaseModel, field_validator, HttpUrl
import phonenumbers
from datetime import datetime, timedelta

class OrderValidator(BaseModel):
    order_id: str
    quantity: int
    discount_percent: float

    @field_validator('order_id')
    @classmethod
    def validate_order_id(cls, v: str) -> str:
        """Order ID format: ORD-YYYY-MM-NNNNN"""
        if not re.match(r'^ORD-\d{4}-\d{2}-\d{5}$', v):
            raise ValueError('Invalid order ID format')
        return v

    @field_validator('quantity')
    @classmethod
    def validate_quantity(cls, v: int) -> int:
        """Quantity must be positive and not exceed stock limit"""
        if v <= 0:
            raise ValueError('Quantity must be positive')
        if v > 9999:
            raise ValueError('Quantity exceeds maximum')
        return v

    @field_validator('discount_percent')
    @classmethod
    def validate_discount(cls, v: float) -> float:
        """Discount must be 0-100%"""
        if not 0 <= v <= 100:
            raise ValueError('Discount must be between 0 and 100')
        return v

class PhoneValidator(BaseModel):
    phone: str

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate and normalize international phone numbers"""
        try:
            parsed = phonenumbers.parse(v, 'US')  # Default region
            if not phonenumbers.is_valid_number(parsed):
                raise ValueError('Invalid phone number')
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except Exception as e:
            raise ValueError(f'Invalid phone number: {str(e)}')

class DateRangeValidator(BaseModel):
    start_date: datetime
    end_date: datetime
    max_duration_days: int = 365

    @model_validator(mode='after')
    def validate_date_range(self) -> 'DateRangeValidator':
        """Validate date range is logical and within limits"""
        if self.start_date > self.end_date:
            raise ValueError('Start date must be before end date')

        duration = (self.end_date - self.start_date).days
        if duration > self.max_duration_days:
            raise ValueError(f'Date range exceeds maximum of {self.max_duration_days} days')

        if self.start_date < datetime.utcnow() - timedelta(days=365):
            raise ValueError('Start date cannot be more than 1 year in past')

        return self
```

## Cross-Field Validation

### Conditional Validation

```python
from pydantic import BaseModel, model_validator, field_validator
from typing import Optional, Literal

class UserRegistration(BaseModel):
    account_type: Literal['personal', 'business']
    first_name: str
    last_name: str
    company_name: Optional[str] = None
    tax_id: Optional[str] = None
    business_license: Optional[str] = None

    @model_validator(mode='after')
    def validate_account_type_fields(self) -> 'UserRegistration':
        """Business accounts require additional fields"""
        if self.account_type == 'business':
            if not self.company_name:
                raise ValueError('Company name is required for business accounts')
            if not self.tax_id:
                raise ValueError('Tax ID is required for business accounts')
        elif self.account_type == 'personal':
            if self.company_name or self.tax_id:
                raise ValueError('Company fields not allowed for personal accounts')
        return self

class PaymentMethod(BaseModel):
    method_type: Literal['credit_card', 'bank_transfer', 'wallet']
    card_number: Optional[str] = None
    bank_account: Optional[str] = None
    wallet_id: Optional[str] = None
    amount: float

    @model_validator(mode='after')
    def validate_payment_fields(self) -> 'PaymentMethod':
        """Each payment method requires specific fields"""
        provided_fields = {
            'card_number': self.card_number,
            'bank_account': self.bank_account,
            'wallet_id': self.wallet_id,
        }

        if self.method_type == 'credit_card' and not self.card_number:
            raise ValueError('Card number required for credit card payments')
        if self.method_type == 'bank_transfer' and not self.bank_account:
            raise ValueError('Bank account required for transfers')
        if self.method_type == 'wallet' and not self.wallet_id:
            raise ValueError('Wallet ID required for wallet payments')

        if self.amount <= 0:
            raise ValueError('Amount must be positive')

        return self
```

### Async Cross-Field Validation

```python
from pydantic import AsyncValidatorHandler, field_validator
from typing import Any
import aiohttp

class EmailAvailabilityValidator(BaseModel):
    email: str
    confirm_email: str

    @field_validator('confirm_email')
    @classmethod
    def emails_match(cls, v: str, info) -> str:
        """Ensure email confirmation matches"""
        if 'email' in info.data and v != info.data['email']:
            raise ValueError('Email confirmation does not match')
        return v

    async def check_email_available(self, email: str) -> bool:
        """Check if email is available (DB lookup)"""
        # This would typically be a database query
        from sqlalchemy import select
        from sqlalchemy.ext.asyncio import AsyncSession

        async with AsyncSession() as session:
            stmt = select(User).where(User.email == email)
            result = await session.execute(stmt)
            return result.scalar_one_or_none() is None
```

## File Upload Validation

### File Size and Type Validation

```python
from fastapi import UploadFile, File, HTTPException
from pathlib import Path
import magic
from PIL import Image
import io

ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_IMAGE_SIZE_MB = 5
ALLOWED_DOCUMENT_TYPES = {'application/pdf', 'application/msword'}
MAX_DOCUMENT_SIZE_MB = 20

async def validate_image_upload(file: UploadFile) -> UploadFile:
    """Validate image file upload"""
    # Check file extension
    file_extension = Path(file.filename).suffix.lower()
    if file_extension not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(400, f'Invalid image format: {file_extension}')

    # Check file size
    contents = await file.read()
    file_size_mb = len(contents) / (1024 * 1024)
    if file_size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(400, f'Image exceeds {MAX_IMAGE_SIZE_MB}MB limit')

    # Verify MIME type
    mime = magic.Magic(mime=True)
    detected_mime = mime.from_buffer(contents)
    if not detected_mime.startswith('image/'):
        raise HTTPException(400, 'File is not a valid image')

    # Validate image integrity
    try:
        img = Image.open(io.BytesIO(contents))
        img.verify()
        # Check image dimensions
        if img.width > 5000 or img.height > 5000:
            raise HTTPException(400, 'Image dimensions too large')
    except Exception as e:
        raise HTTPException(400, f'Invalid image file: {str(e)}')

    # Reset file pointer for further use
    await file.seek(0)
    return file

async def validate_document_upload(file: UploadFile) -> UploadFile:
    """Validate document file upload"""
    # Check file size
    contents = await file.read()
    file_size_mb = len(contents) / (1024 * 1024)
    if file_size_mb > MAX_DOCUMENT_SIZE_MB:
        raise HTTPException(400, f'Document exceeds {MAX_DOCUMENT_SIZE_MB}MB')

    # Check MIME type
    mime = magic.Magic(mime=True)
    detected_mime = mime.from_buffer(contents)
    if detected_mime not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(400, f'Invalid document type: {detected_mime}')

    await file.seek(0)
    return file

# FastAPI endpoint
from fastapi import FastAPI, UploadFile

app = FastAPI()

@app.post('/upload-avatar')
async def upload_avatar(file: UploadFile = File(...)):
    validated_file = await validate_image_upload(file)
    # Process file
    return {'filename': validated_file.filename}

@app.post('/upload-document')
async def upload_document(file: UploadFile = File(...)):
    validated_file = await validate_document_upload(file)
    # Process file
    return {'filename': validated_file.filename}
```

## API Payload Validation

### FastAPI Integration

```python
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, validator
from typing import Optional

app = FastAPI()

class CreateOrderRequest(BaseModel):
    items: list[dict]
    billing_address: dict
    shipping_address: Optional[dict] = None
    coupon_code: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "items": [{"productId": "123", "quantity": 1}],
                "billingAddress": {"street": "123 Main St", "city": "NYC"},
            }
        }

@app.post('/orders')
async def create_order(order: CreateOrderRequest):
    """Pydantic automatically validates request"""
    # If validation fails, FastAPI returns 422 Unprocessable Entity
    # with detailed error messages
    return {"order_id": "123", "status": "pending"}

# Custom exception handler for validation errors
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Custom validation error response"""
    errors = []
    for error in exc.errors():
        errors.append({
            'field': '.'.join(str(x) for x in error['loc'][1:]),
            'message': error['msg'],
            'type': error['type'],
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={'detail': errors},
    )
```

## Database Constraints vs Application Validation

### Complementary Approach (Defense in Depth)

```python
from sqlalchemy import Column, String, Integer, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import declarative_base
from pydantic import BaseModel, field_validator

Base = declarative_base()

# Database Level: Enforce constraints at database
class UserModel(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False, unique=True)
    age = Column(Integer, nullable=False)
    username = Column(String(50), nullable=False)

    __table_args__ = (
        UniqueConstraint('username', name='uq_username'),
        CheckConstraint('age >= 0 AND age <= 150', name='ck_valid_age'),
    )

# Application Level: Validate at API boundary
class UserCreate(BaseModel):
    email: str
    age: int
    username: str

    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        """Validate email before sending to DB"""
        if '@' not in v:
            raise ValueError('Invalid email format')
        return v

    @field_validator('age')
    @classmethod
    def validate_age(cls, v: int) -> int:
        """Validate age range"""
        if not 0 <= v <= 150:
            raise ValueError('Invalid age')
        return v

    @field_validator('username')
    @classmethod
    def validate_username(cls, v: str) -> str:
        """Validate username format"""
        if len(v) < 3:
            raise ValueError('Username too short')
        return v

# Why both?
# - Application validation: Fast feedback, detailed errors, business logic
# - Database constraints: Enforce at data layer, catch bugs, prevent corruption
```

## Error Message Standardization

### Structured Error Response

```python
from pydantic import BaseModel, validator
from fastapi import FastAPI, HTTPException
from typing import List, Optional

class ErrorDetail(BaseModel):
    field: str
    message: str
    error_code: str
    suggestion: Optional[str] = None

class StandardErrorResponse(BaseModel):
    success: bool = False
    errors: List[ErrorDetail]
    request_id: Optional[str] = None

# Validation error mapping
ERROR_CODES = {
    'email.invalid': 'INVALID_EMAIL',
    'password.weak': 'WEAK_PASSWORD',
    'username.taken': 'USERNAME_TAKEN',
    'quantity.invalid': 'INVALID_QUANTITY',
}

# Custom validation with error codes
class ProductOrder(BaseModel):
    product_id: str
    quantity: int

    @validator('quantity')
    def validate_quantity(cls, v):
        if v <= 0:
            raise ValueError('Quantity must be positive')
        if v > 9999:
            raise ValueError('Quantity exceeds maximum')
        return v

# Error handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    errors = []
    for error in exc.errors():
        field = '.'.join(str(x) for x in error['loc'][1:])
        message = error['msg']

        error_detail = ErrorDetail(
            field=field,
            message=message,
            error_code=ERROR_CODES.get(f'{field}.{error["type"]}', 'VALIDATION_ERROR'),
            suggestion=get_suggestion(field, message)
        )
        errors.append(error_detail)

    return JSONResponse(
        status_code=422,
        content=StandardErrorResponse(errors=errors).dict(),
    )

def get_suggestion(field: str, message: str) -> Optional[str]:
    """Provide helpful suggestions for validation errors"""
    suggestions = {
        'email': 'Please provide a valid email address (e.g., user@example.com)',
        'password': 'Password must be 8+ characters with uppercase, number, special char',
        'username': 'Username must be 3+ characters (letters, numbers, _, - only)',
        'quantity': 'Enter a positive number not exceeding 9999',
    }
    return suggestions.get(field)
```

---

**Remember**: Validate at multiple layers - API boundary, application logic, and database. Provide clear, actionable error messages. Sanitize all user input.
