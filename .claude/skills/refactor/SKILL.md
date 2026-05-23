# Code Refactoring Skill

Systematic code refactoring using established patterns and metrics. Identify problematic code structures, apply proven refactoring techniques, and measure improvements.

## Code Smells Detection

Code smells are surface-level indicators of deeper design problems. They don't necessarily indicate bugs but suggest areas needing refactoring.

### 1. God Class / God Object

**Definition**: A class that does too much and knows too much about the system.

**Indicators**:
- Class with 500+ lines of code
- Dozens of instance variables
- Many unrelated methods
- High coupling to other classes
- Difficult to test due to complexity

**Before (Python)**:
```python
class User:
    def __init__(self, name, email, password):
        self.name = name
        self.email = email
        self.password = password

    def validate_password(self, pwd):
        return len(pwd) >= 8 and any(c.isupper() for c in pwd)

    def hash_password(self):
        import bcrypt
        self.password = bcrypt.hashpw(self.password.encode(), bcrypt.gensalt()).decode()

    def send_welcome_email(self):
        import smtplib
        # Email sending logic...
        pass

    def send_password_reset_email(self, token):
        # Email logic...
        pass

    def check_duplicate_email(self, db):
        # Database query...
        pass

    def save_to_database(self, db):
        # Save logic...
        pass

    def generate_api_token(self):
        # Token generation...
        pass

    def validate_email_format(self):
        import re
        # Email validation...
        pass
    # ... 20 more methods
```

**After (Separated Concerns)**:
```python
# Domain model - only user data
class User:
    def __init__(self, name: str, email: str, password_hash: str):
        self.name = name
        self.email = email
        self.password_hash = password_hash

# Password validation (separate responsibility)
class PasswordValidator:
    MIN_LENGTH = 8
    REQUIRES_UPPERCASE = True
    REQUIRES_DIGITS = True

    @classmethod
    def validate(cls, password: str) -> bool:
        if len(password) < cls.MIN_LENGTH:
            return False
        if cls.REQUIRES_UPPERCASE and not any(c.isupper() for c in password):
            return False
        if cls.REQUIRES_DIGITS and not any(c.isdigit() for c in password):
            return False
        return True

# Password hashing (separate responsibility)
class PasswordService:
    @staticmethod
    def hash_password(password: str) -> str:
        import bcrypt
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    @staticmethod
    def verify_password(password: str, hash: str) -> bool:
        import bcrypt
        return bcrypt.checkpw(password.encode(), hash.encode())

# Email notifications (separate responsibility)
class EmailService:
    @staticmethod
    def send_welcome_email(user: User) -> None:
        # Implementation...
        pass

    @staticmethod
    def send_password_reset_email(user: User, token: str) -> None:
        # Implementation...
        pass

# User repository (separate responsibility)
class UserRepository:
    def __init__(self, db):
        self.db = db

    async def save(self, user: User) -> None:
        # Save to database...
        pass

    async def find_by_email(self, email: str) -> Optional[User]:
        # Query database...
        pass

    async def exists(self, email: str) -> bool:
        # Check existence...
        pass

# Usage
password_validator = PasswordValidator()
if password_validator.validate(raw_password):
    password_hash = PasswordService.hash_password(raw_password)
    user = User(name, email, password_hash)
    await user_repository.save(user)
    EmailService.send_welcome_email(user)
```

### 2. Long Method

**Definition**: Methods exceeding 20-30 lines of code, making them hard to understand and test.

**Before**:
```python
def process_order(order):
    # Validate order
    if not order.items:
        raise ValueError("Order has no items")
    if order.customer_id is None:
        raise ValueError("Customer ID required")

    # Calculate totals
    subtotal = 0
    for item in order.items:
        if item.quantity <= 0:
            raise ValueError("Invalid quantity")
        subtotal += item.price * item.quantity

    # Apply discounts
    discount = 0
    if order.customer.is_member:
        discount = subtotal * 0.1
    if subtotal > 1000:
        discount = max(discount, subtotal * 0.15)

    total = subtotal - discount

    # Add shipping
    if total < 50:
        total += 10
    elif total < 100:
        total += 5

    # Process payment
    try:
        payment = payment_service.charge(order.customer.payment_method, total)
        order.payment_id = payment.id
    except PaymentException as e:
        order.status = "payment_failed"
        notify_customer(order.customer.email, f"Payment failed: {e}")
        return

    # Update inventory
    for item in order.items:
        inventory.decrease(item.product_id, item.quantity)

    # Send confirmation
    order.status = "completed"
    send_confirmation_email(order)
```

**After (Extracted Methods)**:
```python
def process_order(order):
    validate_order(order)
    calculate_totals(order)
    charge_payment(order)
    if order.payment_id:
        update_inventory(order)
        send_confirmation(order)

def validate_order(order):
    if not order.items:
        raise ValueError("Order has no items")
    if order.customer_id is None:
        raise ValueError("Customer ID required")
    for item in order.items:
        if item.quantity <= 0:
            raise ValueError("Invalid quantity")

def calculate_totals(order):
    order.subtotal = sum(item.price * item.quantity for item in order.items)
    order.discount = calculate_discount(order.subtotal, order.customer)
    order.shipping = calculate_shipping(order.subtotal)
    order.total = order.subtotal - order.discount + order.shipping

def calculate_discount(subtotal, customer):
    discount = 0
    if customer.is_member:
        discount = subtotal * 0.1
    if subtotal > 1000:
        discount = max(discount, subtotal * 0.15)
    return discount

def calculate_shipping(subtotal):
    if subtotal < 50:
        return 10
    elif subtotal < 100:
        return 5
    return 0

def charge_payment(order):
    try:
        payment = payment_service.charge(
            order.customer.payment_method,
            order.total
        )
        order.payment_id = payment.id
    except PaymentException as e:
        order.status = "payment_failed"
        notify_customer(order.customer.email, f"Payment failed: {e}")

def update_inventory(order):
    for item in order.items:
        inventory.decrease(item.product_id, item.quantity)

def send_confirmation(order):
    order.status = "completed"
    send_confirmation_email(order)
```

### 3. Feature Envy

**Definition**: A method that uses more features of another class than its own.

**Before**:
```python
class OrderProcessor:
    def calculate_customer_discount(self, customer, subtotal):
        # Using too many customer details - customer knows itself better
        if customer.membership_level == "gold":
            return subtotal * 0.2
        elif customer.membership_level == "silver":
            return subtotal * 0.1
        elif customer.account_age_years > 5:
            return subtotal * 0.05
        return 0
```

**After (Move Logic to Customer)**:
```python
class Customer:
    def __init__(self, membership_level, account_age_years):
        self.membership_level = membership_level
        self.account_age_years = account_age_years

    def calculate_discount(self, subtotal):
        if self.membership_level == "gold":
            return subtotal * 0.2
        elif self.membership_level == "silver":
            return subtotal * 0.1
        elif self.account_age_years > 5:
            return subtotal * 0.05
        return 0

class OrderProcessor:
    def calculate_customer_discount(self, customer, subtotal):
        return customer.calculate_discount(subtotal)
```

### 4. Shotgun Surgery

**Definition**: A change in one place requires many small changes in many different classes.

**Before** (Scattered validation):
```python
# ValidationA.py
def validate_email(email):
    if "@" not in email:
        raise ValueError("Invalid email")

# ValidationB.py
def validate_email(email):
    if "@" not in email or len(email) < 5:
        raise ValueError("Invalid email")

# UserService.py
def validate_user_email(email):
    if "@" not in email:
        raise ValueError("Invalid email")

# When email validation changes, must update 3 places!
```

**After (Centralized Validation)**:
```python
# validators.py
class EmailValidator:
    MIN_LENGTH = 5
    VALID_DOMAINS = ["gmail.com", "outlook.com", "company.com"]

    @classmethod
    def validate(cls, email: str) -> bool:
        if "@" not in email:
            return False
        if len(email) < cls.MIN_LENGTH:
            return False
        domain = email.split("@")[1]
        if domain not in cls.VALID_DOMAINS:
            return False
        return True

# user_service.py
from validators import EmailValidator

def create_user(email: str):
    if not EmailValidator.validate(email):
        raise ValueError("Invalid email")
    # Create user...

# api.py
from validators import EmailValidator

def register_endpoint(email: str):
    if not EmailValidator.validate(email):
        return {"error": "Invalid email"}
    # Register user...

# Now single change point for email validation logic
```

### 5. Data Clumps

**Definition**: A group of variables that are often used together should be grouped into a class.

**Before**:
```python
def create_user(first_name, last_name, street, city, state, zip_code, phone):
    # These address fields always appear together
    user = {
        "first_name": first_name,
        "last_name": last_name,
        "street": street,
        "city": city,
        "state": state,
        "zip_code": zip_code,
        "phone": phone
    }
    return user

def update_user_address(user, street, city, state, zip_code):
    user["street"] = street
    user["city"] = city
    user["state"] = state
    user["zip_code"] = zip_code
    return user

def format_address(street, city, state, zip_code):
    return f"{street}, {city}, {state} {zip_code}"
```

**After (Extracted Class)**:
```python
from dataclasses import dataclass

@dataclass
class Address:
    street: str
    city: str
    state: str
    zip_code: str

    def format(self) -> str:
        return f"{self.street}, {self.city}, {self.state} {self.zip_code}"

@dataclass
class User:
    first_name: str
    last_name: str
    address: Address
    phone: str

def create_user(first_name: str, last_name: str, address: Address, phone: str) -> User:
    return User(first_name, last_name, address, phone)

def update_user_address(user: User, address: Address) -> User:
    user.address = address
    return user

# Usage
address = Address("123 Main St", "Boston", "MA", "02101")
user = create_user("John", "Doe", address, "617-555-0100")
print(user.address.format())
```

### 6. Duplicate Code

**Definition**: Same or similar code appearing in multiple places.

**Before**:
```python
class OrderService:
    def process_physical_order(self, order):
        # Validate
        if not order.items:
            raise ValueError("No items")
        if not order.customer:
            raise ValueError("No customer")

        # Calculate
        total = sum(item.price * item.quantity for item in order.items)
        total += self.calculate_tax(total)
        total += self.calculate_shipping(order.address)

        # Process
        self.charge_payment(order, total)
        self.send_confirmation(order)

    def process_digital_order(self, order):
        # Validate (duplicated)
        if not order.items:
            raise ValueError("No items")
        if not order.customer:
            raise ValueError("No customer")

        # Calculate (similar but different)
        total = sum(item.price * item.quantity for item in order.items)
        total += self.calculate_tax(total)
        # No shipping for digital

        # Process (duplicated)
        self.charge_payment(order, total)
        self.send_confirmation(order)
```

**After (Extracted Base Process)**:
```python
from abc import ABC, abstractmethod

class OrderProcessor(ABC):
    def process_order(self, order):
        self.validate(order)
        total = self.calculate_total(order)
        self.charge_payment(order, total)
        self.send_confirmation(order)

    def validate(self, order):
        if not order.items:
            raise ValueError("No items")
        if not order.customer:
            raise ValueError("No customer")

    @abstractmethod
    def calculate_total(self, order) -> float:
        pass

class PhysicalOrderProcessor(OrderProcessor):
    def calculate_total(self, order) -> float:
        base_total = sum(item.price * item.quantity for item in order.items)
        base_total += self.calculate_tax(base_total)
        base_total += self.calculate_shipping(order.address)
        return base_total

class DigitalOrderProcessor(OrderProcessor):
    def calculate_total(self, order) -> float:
        base_total = sum(item.price * item.quantity for item in order.items)
        base_total += self.calculate_tax(base_total)
        return base_total
```

## Refactoring Patterns

### Extract Method Pattern

Convert code fragment into separate method with clear, descriptive name.

```python
# BEFORE
class Report:
    def generate(self):
        # ... setup code ...

        # Complex calculation section
        subtotal = 0
        for item in items:
            subtotal += item.cost * item.quantity
        tax = subtotal * 0.1
        total = subtotal + tax

        # Another complex section
        discount = 0
        if customer.is_premium:
            discount = total * 0.2
        final_total = total - discount

        return {"subtotal": subtotal, "tax": tax, "total": final_total}

# AFTER
class Report:
    def generate(self):
        subtotal = self._calculate_subtotal()
        tax = self._calculate_tax(subtotal)
        discount = self._calculate_discount(subtotal + tax)
        final_total = (subtotal + tax) - discount
        return {"subtotal": subtotal, "tax": tax, "total": final_total}

    def _calculate_subtotal(self) -> float:
        return sum(item.cost * item.quantity for item in items)

    def _calculate_tax(self, subtotal: float) -> float:
        return subtotal * 0.1

    def _calculate_discount(self, total: float) -> float:
        return total * 0.2 if customer.is_premium else 0
```

### Move Field Pattern

Move field from one class to another when a field is used more by another class.

```python
# BEFORE
class Account:
    def __init__(self, name, bank_name, routing_number, account_number):
        self.name = name
        self.bank_name = bank_name
        self.routing_number = routing_number
        self.account_number = account_number

    def get_iban(self):
        return f"{self.bank_name}-{self.routing_number}-{self.account_number}"

# AFTER
class BankDetails:
    def __init__(self, bank_name, routing_number, account_number):
        self.bank_name = bank_name
        self.routing_number = routing_number
        self.account_number = account_number

    def get_iban(self):
        return f"{self.bank_name}-{self.routing_number}-{self.account_number}"

class Account:
    def __init__(self, name, bank_details: BankDetails):
        self.name = name
        self.bank_details = bank_details
```

### Replace Conditional with Polymorphism

Replace complex if/else logic with inheritance hierarchy.

```python
# BEFORE
class Bird:
    def __init__(self, bird_type):
        self.bird_type = bird_type

    def get_speed(self):
        if self.bird_type == "sparrow":
            return 20
        elif self.bird_type == "eagle":
            return 50
        elif self.bird_type == "penguin":
            return 0  # Can't fly
        else:
            raise ValueError("Unknown bird type")

# AFTER
from abc import ABC, abstractmethod

class Bird(ABC):
    @abstractmethod
    def get_speed(self) -> int:
        pass

class Sparrow(Bird):
    def get_speed(self) -> int:
        return 20

class Eagle(Bird):
    def get_speed(self) -> int:
        return 50

class Penguin(Bird):
    def get_speed(self) -> int:
        return 0

# Usage
birds: list[Bird] = [Sparrow(), Eagle(), Penguin()]
for bird in birds:
    print(bird.get_speed())  # Polymorphic call
```

### Introduce Parameter Object

Replace method parameters with single object when many related parameters appear together.

```python
# BEFORE
def create_order(customer_name, customer_email, item_id, item_quantity,
                 shipping_address, shipping_city, shipping_zip):
    # Implementation with 7 parameters
    pass

# AFTER
from dataclasses import dataclass

@dataclass
class Customer:
    name: str
    email: str

@dataclass
class OrderItem:
    item_id: str
    quantity: int

@dataclass
class ShippingAddress:
    address: str
    city: str
    zip_code: str

def create_order(customer: Customer, item: OrderItem, shipping: ShippingAddress):
    # Much clearer intent and easier to test
    pass
```

### Replace Conditional with Guard Clause

Replace if/else structures with early returns (guard clauses).

```python
# BEFORE
def get_employee_salary(employee):
    salary = 0
    if employee.is_active:
        if employee.years_employed > 5:
            salary = 50000
        else:
            salary = 40000
    else:
        salary = 0
    return salary

# AFTER
def get_employee_salary(employee):
    if not employee.is_active:
        return 0
    if employee.years_employed > 5:
        return 50000
    return 40000
```

## Metrics and Measurement

### Cyclomatic Complexity

Measures the number of independent paths through code. High complexity indicates testability issues.

**Calculation**: Count decision points (if, for, while, case) + 1

```python
# Complexity = 1
def simple_function(x):
    return x * 2

# Complexity = 2 (1 if condition)
def medium_function(x):
    if x > 0:
        return x
    return 0

# Complexity = 4 (3 if conditions)
def complex_function(x, y):
    if x > 0:
        if y > 0:
            return x + y
        else:
            return x
    else:
        return y
```

**Targets**:
- Green (1-10): Low risk, easy to maintain
- Yellow (11-20): Moderate risk, consider refactoring
- Red (21+): High risk, urgent refactoring needed

**Tools**:
```bash
# Python: radon
pip install radon
radon cc src/ -a  # Average complexity
radon cc src/ -b  # Color-coded by complexity

# Node.js: complexity-report
npm install complexity-report
cr -r src/

# Java: Checkstyle
mvn checkstyle:checkstyle
```

### Coupling (Afferent/Efferent)

**Efferent Coupling (Ce)**: How many classes this class depends on
**Afferent Coupling (Ca)**: How many classes depend on this class

**Instability = Ce / (Ce + Ca)**
- 0 = highly stable, hard to change
- 1 = highly unstable, easy to change (but others depend on it)
- Target: 0.3-0.7

```python
# High efferent coupling (Ce = 5)
class OrderProcessor:
    def __init__(self):
        self.payment_service = PaymentService()
        self.inventory_service = InventoryService()
        self.email_service = EmailService()
        self.logger = Logger()
        self.database = Database()

# Better: Dependency injection reduces coupling
class OrderProcessor:
    def __init__(self, payment_service: PaymentService,
                 inventory_service: InventoryService,
                 email_service: EmailService,
                 logger: Logger,
                 database: Database):
        self.payment_service = payment_service
        self.inventory_service = inventory_service
        self.email_service = email_service
        self.logger = logger
        self.database = database
```

### Cohesion

How closely related methods and fields are within a class.

**LCOM (Lack of Cohesion of Methods)**: Higher = lower cohesion

```python
# Low cohesion - unrelated methods
class UserManager:
    def create_user(self, name, email):
        # Create user logic
        pass

    def calculate_tax(self, amount, rate):
        # Tax calculation logic - unrelated!
        pass

    def send_email(self, recipient, message):
        # Email sending - unrelated!
        pass

# High cohesion - related methods
class User:
    def __init__(self, name, email):
        self.name = name
        self.email = email

    def update_email(self, new_email):
        self.email = new_email

    def is_valid(self):
        return "@" in self.email and len(self.name) > 0

# Tax calculation in separate class
class TaxCalculator:
    def calculate(self, amount, rate):
        return amount * rate

# Email in separate service
class EmailService:
    def send(self, recipient, message):
        pass
```

## Refactoring Workflow

### 1. Establish Baseline Metrics

```bash
# Python
radon cc src/ -a
radon mi src/

# JavaScript/TypeScript
npm run lint -- --max-warnings 0
npm run test -- --coverage
```

### 2. Identify Refactoring Candidates

- Classes/functions exceeding complexity threshold
- High duplication (>10% similar code)
- Large methods (>30 lines)
- High coupling (Ce > 10)
- Low cohesion (LCOM > 0.5)

### 3. Refactor with Tests

```python
# Always refactor with tests in place
# 1. Run tests - should pass
pytest tests/ -v

# 2. Refactor small piece
# 3. Run tests - should still pass
pytest tests/ -v

# 4. Repeat until done
```

### 4. Verify Improvements

```bash
# Measure complexity after refactoring
radon cc src/ -a --min A  # Show only A-grade functions

# Check coverage maintained
pytest tests/ --cov=src/

# Lint check
ruff check src/
black --check src/
```

## Refactoring Safety Checklist

- [ ] All tests passing before refactoring
- [ ] Small, focused changes (single responsibility per commit)
- [ ] Tests still passing after each change
- [ ] Code review before merging
- [ ] No behavioral changes (same inputs = same outputs)
- [ ] Performance benchmarks if applicable
- [ ] Documentation updated if public API changed
- [ ] Backward compatibility maintained if library

## Anti-Patterns to Avoid

### Premature Refactoring

Don't refactor until code demonstrates clear problems:
- Wait until method complexity exceeds 15
- Wait until duplication appears 3+ times
- Don't optimize prematurely

### Over-Engineering

```python
# DON'T: Over-designed factory pattern for simple task
class CalculatorFactory:
    _instance = None
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

calculator = CalculatorFactory()
result = calculator.add(2, 2)

# DO: Simple is better
def add(a, b):
    return a + b

result = add(2, 2)
```

### Changing While Refactoring

Never mix refactoring with feature development:
- One commit = refactoring OR feature, never both
- This makes it easy to revert if something breaks

---

**Last Updated**: 2026-04-07
**Refactoring Guide Version**: 2.0
**Based On**: Martin Fowler's Refactoring (2nd Edition)
