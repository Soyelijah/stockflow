# API Contract Testing & Validation

## 1. Consumer-Driven Contract Testing with Pact

### Understanding Consumer-Driven Contracts

Pact enables consumer services to define expected API behavior, then validates the provider meets those expectations.

```yaml
# Pact architecture
Consumer Service ─── writes expectations ──► Pact Contract
                                                    │
Provider Service ◄────── validates against ────────┘

# Benefits:
- Early detection of API incompatibilities
- Consumer defines what they actually need
- Provider can evolve safely without breaking consumers
- Faster feedback loops
```

### Pact Consumer Test (Python)

```python
import pytest
from pact import Consumer, Provider, Format
import requests

# Create Pact
pact = Consumer('OrderService').has_state(
    'user 1 exists'
).upon_receiving(
    'a request for user 1'
).with_request(
    'GET', '/api/v1/users/1'
).will_respond_with(
    200,
    body={
        'user_id': 1,
        'email': 'john@example.com',
        'status': 'active',
        'created_at': '2024-01-01T00:00:00Z',
    },
    headers={'Content-Type': 'application/json'}
)

def test_get_user_from_api():
    """Test consumer expectation"""
    with pact:
        # Use pact mock provider
        response = requests.get(
            'http://localhost:8000/api/v1/users/1',
            headers={'Accept': 'application/json'}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['user_id'] == 1
        assert data['email'] == 'john@example.com'
        assert 'created_at' in data

    # Write pact contract
    pact.write_to_file('/tmp/pacts', Format.JSON)


# Multiple interactions
@pytest.fixture
def user_service_pact():
    return Consumer('OrderService').has_state(
        'user 1 exists'
    ).upon_receiving(
        'a request to create user'
    ).with_request(
        'POST',
        '/api/v1/users',
        body={'email': 'new@example.com', 'name': 'New User'}
    ).will_respond_with(
        201,
        body={'user_id': 2, 'email': 'new@example.com'},
        headers={'Location': '/api/v1/users/2'}
    )


def test_create_user(user_service_pact):
    """Test creation endpoint"""
    with user_service_pact:
        response = requests.post(
            'http://localhost:8000/api/v1/users',
            json={'email': 'new@example.com', 'name': 'New User'},
            headers={'Content-Type': 'application/json'}
        )

        assert response.status_code == 201
        assert response.json()['user_id'] == 2
        assert 'Location' in response.headers
```

### Pact Provider Verification

```python
# tests/test_provider.py - Provider service validates against consumer contracts

import pytest
from pact import Consumer, Provider
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

pact = Consumer('OrderService').has_pact_with(
    Provider('UserService'),
    pact_dir='/tmp/pacts'
)

@pytest.mark.pact
def test_provider_meets_consumer_expectations():
    """Provider verifies it meets all consumer contracts"""

    # Load all pacts from consumer
    with pact:
        pact.verify_with_provider(
            'http://localhost:8000',
            state_setup_url='http://localhost:8000/setup',
        )


# State setup for testing different scenarios
@app.post('/setup')
def setup_state(state: str):
    """Setup test data for pact state"""
    if state == 'user 1 exists':
        # Create user 1 in test DB
        db.users.insert({'id': 1, 'email': 'john@example.com', 'status': 'active'})
        return {'status': 'ready'}

    if state == 'user 1 is inactive':
        db.users.insert({'id': 1, 'email': 'john@example.com', 'status': 'inactive'})
        return {'status': 'ready'}

    return {'status': 'unknown state'}
```

### Pact Broker for Team Coordination

```bash
# Publish consumer pact to broker
docker run -d -p 80:80 \
  -e PACT_BROKER_DATABASE_URL=postgres://user:pass@db:5432/pact \
  pactfoundation/pact-broker

# Publish pact
pact-broker publish /tmp/pacts \
  --consumer-app-version=1.0.0 \
  --branch=main \
  --broker-base-url=http://pact-broker:80

# Verify provider against broker
pact-broker verify-with-broker \
  --broker-base-url=http://pact-broker:80 \
  --provider=UserService \
  --provider-app-version=1.0.0 \
  --publish-verification-results \
  --branch=main
```

---

## 2. OpenAPI Specification Validation

### OpenAPI Schema Definition

```yaml
# openapi.yaml
openapi: 3.0.0
info:
  title: User API
  version: 1.2.0
  x-version-policy: "semantic"  # Track breaking changes

paths:
  /api/v1/users/{userId}:
    get:
      summary: Get user by ID
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            pattern: "^[0-9]+$"
          description: Unique user identifier

      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

        '500':
          description: Server error

    patch:
      summary: Update user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserUpdate'

      responses:
        '200':
          description: User updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

components:
  schemas:
    User:
      type: object
      required:
        - user_id
        - email
        - created_at
      properties:
        user_id:
          type: integer
          minimum: 1
        email:
          type: string
          format: email
          minLength: 5
          maxLength: 254
        name:
          type: string
          minLength: 1
          maxLength: 100
        status:
          type: string
          enum: [active, inactive, suspended]
          default: active
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    UserUpdate:
      type: object
      properties:
        email:
          type: string
          format: email
        name:
          type: string
        status:
          type: string
          enum: [active, inactive, suspended]

    ErrorResponse:
      type: object
      required:
        - error
        - message
      properties:
        error:
          type: string
        message:
          type: string
        details:
          type: object
```

### OpenAPI Validation in Python

```python
from openapi_spec_validator import validate_spec
from openapi_spec_validator.validation.validators import oas30_validator
import yaml
import jsonschema

def validate_openapi_spec(spec_path: str) -> dict:
    """Validate OpenAPI specification"""

    with open(spec_path, 'r') as f:
        spec = yaml.safe_load(f)

    try:
        # Validate against OpenAPI 3.0 schema
        validate_spec(spec)
        return {
            'valid': True,
            'errors': [],
            'warnings': []
        }

    except jsonschema.ValidationError as e:
        return {
            'valid': False,
            'errors': [str(e)],
            'warnings': []
        }

def validate_response_against_spec(response: dict, spec_path: str,
                                   endpoint: str, method: str, status_code: int) -> bool:
    """Validate API response against OpenAPI spec"""

    with open(spec_path, 'r') as f:
        spec = yaml.safe_load(f)

    # Find endpoint in spec
    path_spec = spec['paths'].get(endpoint, {})
    method_spec = path_spec.get(method.lower(), {})
    response_spec = method_spec['responses'].get(str(status_code), {})

    if not response_spec:
        raise ValueError(f"No spec for {method} {endpoint} {status_code}")

    # Get schema
    schema = response_spec['content']['application/json']['schema']

    # Validate response
    try:
        jsonschema.validate(instance=response, schema=schema)
        return True
    except jsonschema.ValidationError as e:
        print(f"Response validation error: {e.message}")
        return False
```

### Contract Testing in CI/CD

```yaml
# .github/workflows/contract-test.yml
name: Contract Testing

on: [push, pull_request]

jobs:
  contract-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.11

      - name: Install dependencies
        run: |
          pip install pact-python pytest

      - name: Run Pact consumer tests
        run: pytest tests/pact/test_consumer.py -v

      - name: Publish pact to broker
        run: |
          pact-broker publish ./pacts \
            --consumer-app-version=${{ github.sha }} \
            --branch=${{ github.ref_name }} \
            --broker-base-url=${{ secrets.PACT_BROKER_URL }}

      - name: Run Pact provider verification
        run: |
          pact-broker verify-with-broker \
            --broker-base-url=${{ secrets.PACT_BROKER_URL }} \
            --provider=UserService \
            --provider-app-version=${{ github.sha }} \
            --publish-verification-results \
            --branch=${{ github.ref_name }}

      - name: Validate OpenAPI spec
        run: python -m openapi_spec_validator openapi.yaml
```

---

## 3. Schema Backward Compatibility Checking

### Compatibility Detection

```python
from typing import Dict, List, Set, Any
import json

class CompatibilityChecker:
    """Detect backward/forward compatibility issues"""

    BREAKING_CHANGES = []
    WARNINGS = []

    @staticmethod
    def check_field_removal(old_schema: Dict, new_schema: Dict) -> List[str]:
        """Detect removed required fields (breaking)"""
        old_required = set(old_schema.get('required', []))
        new_required = set(new_schema.get('required', []))

        removed = old_required - new_required
        return [f"Required field removed: {field}" for field in removed]

    @staticmethod
    def check_type_changes(old_schema: Dict, new_schema: Dict) -> List[str]:
        """Detect type changes (breaking if narrower)"""
        old_type = old_schema.get('type')
        new_type = new_schema.get('type')

        if old_type and new_type and old_type != new_type:
            return [f"Type changed: {old_type} → {new_type}"]

        return []

    @staticmethod
    def check_enum_changes(old_schema: Dict, new_schema: Dict) -> List[str]:
        """Detect enum value changes"""
        old_enum = set(old_schema.get('enum', []))
        new_enum = set(new_schema.get('enum', []))

        removed_values = old_enum - new_enum
        if removed_values:
            return [f"Enum values removed: {removed_values}"]

        return []

    @staticmethod
    def check_constraint_tightening(old_schema: Dict, new_schema: Dict) -> List[str]:
        """Detect tightened constraints (e.g., minLength increased)"""
        warnings = []

        # minLength increase
        old_min = old_schema.get('minLength')
        new_min = new_schema.get('minLength')
        if old_min and new_min and new_min > old_min:
            warnings.append(f"minLength increased: {old_min} → {new_min}")

        # Pattern change
        if old_schema.get('pattern') != new_schema.get('pattern'):
            warnings.append("Pattern/validation rule changed")

        return warnings

    def check_schema_compatibility(self, old_schema: Dict,
                                   new_schema: Dict) -> Dict[str, List[str]]:
        """Comprehensive compatibility check"""

        issues = {
            'breaking_changes': [],
            'warnings': [],
            'safe': True
        }

        # Check all fields in old schema
        for field_name, field_schema in old_schema.get('properties', {}).items():
            if field_name not in new_schema.get('properties', {}):
                issues['breaking_changes'].append(f"Field removed: {field_name}")
                issues['safe'] = False
                continue

            new_field_schema = new_schema['properties'][field_name]

            # Type changes
            type_issues = self.check_type_changes(field_schema, new_field_schema)
            if type_issues:
                issues['breaking_changes'].extend(type_issues)
                issues['safe'] = False

            # Enum changes
            enum_issues = self.check_enum_changes(field_schema, new_field_schema)
            if enum_issues:
                issues['breaking_changes'].extend(enum_issues)
                issues['safe'] = False

            # Constraint changes
            constraint_issues = self.check_constraint_tightening(field_schema, new_field_schema)
            if constraint_issues:
                issues['warnings'].extend(constraint_issues)

        return issues


# Usage
checker = CompatibilityChecker()

old_schema = {
    'type': 'object',
    'required': ['user_id', 'email'],
    'properties': {
        'user_id': {'type': 'integer'},
        'email': {'type': 'string', 'format': 'email'},
        'phone': {'type': 'string'},
    }
}

new_schema = {
    'type': 'object',
    'required': ['user_id'],  # email removed from required
    'properties': {
        'user_id': {'type': 'string'},  # Type changed!
        'email': {'type': 'string', 'format': 'email', 'minLength': 10},
    }
    # phone field removed
}

result = checker.check_schema_compatibility(old_schema, new_schema)
print(result)
# Output:
# {
#   'breaking_changes': [
#     'Type changed: integer → string',
#     'Field removed: phone'
#   ],
#   'warnings': ['minLength increased: None → 10'],
#   'safe': False
# }
```

### Compatibility Enforcement in CI/CD

```python
# tests/test_schema_compatibility.py

import json
import pytest
from schema_compatibility import CompatibilityChecker

@pytest.fixture
def current_spec():
    """Load current OpenAPI spec"""
    with open('openapi.yaml', 'r') as f:
        import yaml
        return yaml.safe_load(f)

@pytest.fixture
def previous_spec():
    """Load previous OpenAPI spec from main branch"""
    import subprocess
    yaml_content = subprocess.check_output([
        'git', 'show', 'main:openapi.yaml'
    ]).decode()
    import yaml
    return yaml.safe_load(yaml_content)

def test_no_breaking_schema_changes(current_spec, previous_spec):
    """Fail build if breaking changes detected"""

    checker = CompatibilityChecker()
    current_schema = current_spec['components']['schemas']['User']
    previous_schema = previous_spec['components']['schemas']['User']

    result = checker.check_schema_compatibility(previous_schema, current_schema)

    # Fail on breaking changes
    assert result['safe'], f"Breaking changes detected: {result['breaking_changes']}"

    # Warn on deprecations
    if result['warnings']:
        pytest.warns(UserWarning, match=str(result['warnings']))
```

---

## 4. gRPC Proto Validation

### Protocol Buffers Contract Definition

```protobuf
// user_service.proto
syntax = "proto3";
package user.v1;

service UserService {
  rpc GetUser(GetUserRequest) returns (User) {}
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse) {}
  rpc CreateUser(CreateUserRequest) returns (User) {}
  rpc UpdateUser(UpdateUserRequest) returns (User) {}
}

message GetUserRequest {
  int32 user_id = 1;
}

message User {
  int32 user_id = 1;
  string email = 2;
  string name = 3;
  Status status = 4;
  google.protobuf.Timestamp created_at = 5;
  google.protobuf.Timestamp updated_at = 6;

  enum Status {
    UNKNOWN = 0;
    ACTIVE = 1;
    INACTIVE = 2;
    SUSPENDED = 3;
  }
}

message ListUsersRequest {
  int32 page = 1;
  int32 page_size = 2;
}

message ListUsersResponse {
  repeated User users = 1;
  int32 total_count = 2;
  int32 page = 3;
}

message CreateUserRequest {
  string email = 1;
  string name = 2;
}

message UpdateUserRequest {
  int32 user_id = 1;
  string email = 2;
  string name = 3;
}
```

### Proto Compatibility Rules

```python
# Enforce proto evolution rules
class ProtoCompatibilityRules:
    """
    Proto backward compatibility rules (from protobuf docs):

    SAFE:
    - Adding optional fields (field numbers never reused)
    - Adding new messages
    - Adding new RPC methods
    - Adding oneof with new field numbers

    BREAKING:
    - Removing fields
    - Changing field numbers (changes serialized format)
    - Changing field types in incompatible ways
    - Removing RPC methods
    - Changing field names (not serialized, but breaks JSON mapping)
    """

    @staticmethod
    def validate_field_number_reuse(old_proto: Dict, new_proto: Dict) -> List[str]:
        """Detect reused field numbers (breaks backward compatibility)"""
        issues = []

        old_fields = {f['number']: f['name'] for f in old_proto.get('fields', [])}
        new_fields = {f['number']: f['name'] for f in new_proto.get('fields', [])}

        # Check for reused numbers
        for num, old_name in old_fields.items():
            if num in new_fields and new_fields[num] != old_name:
                issues.append(f"Field number {num} reused: {old_name} → {new_fields[num]}")

        return issues

    @staticmethod
    def validate_field_type_changes(old_proto: Dict, new_proto: Dict) -> List[str]:
        """Detect incompatible type changes"""
        issues = []

        old_fields = {f['name']: f for f in old_proto.get('fields', [])}
        new_fields = {f['name']: f for f in new_proto.get('fields', [])}

        for name, old_field in old_fields.items():
            if name not in new_fields:
                continue

            new_field = new_fields[name]

            # Type compatibility check
            if old_field['type'] != new_field['type']:
                # Some type changes are compatible (int32 ↔ int64)
                compatible_changes = {
                    ('int32', 'int64'), ('int64', 'int32'),
                    ('float', 'double'), ('double', 'float'),
                    ('string', 'bytes'), ('bytes', 'string'),
                }

                if (old_field['type'], new_field['type']) not in compatible_changes:
                    issues.append(f"Incompatible type change: {name} ({old_field['type']} → {new_field['type']})")

        return issues
```

---

## 5. GraphQL Schema Validation

### GraphQL Schema Evolution

```graphql
# schema.graphql

# Query root type
type Query {
  user(id: ID!): User
  users(first: Int = 10, after: String): UserConnection!
  searchUsers(query: String!): [User!]!
}

# User type with versioning
type User {
  id: ID!
  email: String!
  name: String!
  status: UserStatus!
  createdAt: DateTime!
  updatedAt: DateTime!
  # New field (safe: optional)
  avatar: String
  # Deprecated fields (safe: keep for backward compat)
  legacyId: Int @deprecated(reason: "Use id instead")
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  # New enum value (safe)
  DELETED
}

input UserInput {
  email: String!
  name: String!
  # Optional field (safe)
  avatar: String
}

type Mutation {
  createUser(input: UserInput!): User!
  updateUser(id: ID!, input: UserInput!): User!
  deleteUser(id: ID!): Boolean!
}

scalar DateTime
```

### GraphQL Compatibility Checking

```python
from graphql import build_schema, parse, GraphQLError
from typing import List, Dict, Set

class GraphQLSchemaValidator:
    """Validate GraphQL schema changes"""

    @staticmethod
    def get_all_types(schema_str: str) -> Set[str]:
        """Extract all type names from schema"""
        schema = build_schema(schema_str)
        return set(schema.type_map.keys())

    @staticmethod
    def check_field_breaking_changes(old_schema_str: str,
                                      new_schema_str: str) -> List[str]:
        """Detect breaking field changes"""
        issues = []

        old_schema = build_schema(old_schema_str)
        new_schema = build_schema(new_schema_str)

        # Check all types and fields
        for type_name, old_type in old_schema.type_map.items():
            if type_name.startswith('__'):  # Skip introspection
                continue

            if not hasattr(old_type, 'fields'):
                continue

            new_type = new_schema.type_map.get(type_name)
            if not new_type:
                issues.append(f"Type removed: {type_name}")
                continue

            # Check for removed fields
            old_fields = getattr(old_type, 'fields', {})
            new_fields = getattr(new_type, 'fields', {})

            for field_name, old_field in old_fields.items():
                if field_name not in new_fields:
                    # Removed field is breaking (clients depend on it)
                    issues.append(f"Field removed: {type_name}.{field_name}")

                else:
                    new_field = new_fields[field_name]

                    # Check return type compatibility
                    old_return = str(old_field.type)
                    new_return = str(new_field.type)

                    # If field was non-null and is now nullable, breaking
                    if old_return.endswith('!') and not new_return.endswith('!'):
                        issues.append(f"Field nullability changed: {type_name}.{field_name}")

                    # If field input type narrowed, breaking
                    if old_return.replace('!', '') != new_return.replace('!', ''):
                        if field_name not in ['__typename']:
                            issues.append(f"Field type changed: {type_name}.{field_name}")

        return issues

    @staticmethod
    def check_enum_breaking_changes(old_schema_str: str,
                                     new_schema_str: str) -> List[str]:
        """Detect enum value removals"""
        issues = []

        old_schema = build_schema(old_schema_str)
        new_schema = build_schema(new_schema_str)

        for type_name, old_type in old_schema.type_map.items():
            if hasattr(old_type, 'values'):
                old_values = set(old_type.values.keys())

                new_type = new_schema.type_map.get(type_name)
                new_values = set(new_type.values.keys()) if hasattr(new_type, 'values') else set()

                removed = old_values - new_values
                if removed:
                    issues.append(f"Enum values removed from {type_name}: {removed}")

        return issues

# Test schema compatibility
old_schema = """
type Query {
  user(id: ID!): User
}

type User {
  id: ID!
  email: String!
}
"""

new_schema = """
type Query {
  user(id: ID!): User
}

type User {
  id: ID!
  email: String!
  phone: String
}
"""

validator = GraphQLSchemaValidator()
breaking = validator.check_field_breaking_changes(old_schema, new_schema)
print(f"Breaking changes: {breaking}")  # Empty - phone field is additive
```

---

## 6. Mock Server Generation

### Generating Mock Servers from OpenAPI

```python
# Generate mock server from OpenAPI spec
from openapi_mock_server import OpenAPIMockServer
import yaml

with open('openapi.yaml', 'r') as f:
    spec = yaml.safe_load(f)

# Create mock server
mock_server = OpenAPIMockServer(spec=spec, host='0.0.0.0', port=8000)

# Define response examples for specific endpoints
mock_server.set_example(
    path='/api/v1/users/{userId}',
    method='GET',
    status_code=200,
    response={
        'user_id': 1,
        'email': 'john@example.com',
        'status': 'active',
        'created_at': '2024-01-01T00:00:00Z'
    }
)

mock_server.set_example(
    path='/api/v1/users/{userId}',
    method='GET',
    status_code=404,
    response={
        'error': 'NOT_FOUND',
        'message': 'User not found'
    }
)

# Start mock server
mock_server.start()
# Server now listens at http://0.0.0.0:8000
# Auto-validates requests against spec
# Returns example responses or generates realistic data
```

### Consumer Testing Against Mock Server

```python
import requests
import pytest
from mock_server_fixture import mock_server

@pytest.fixture(scope='module')
def mock_api():
    """Start mock server for test module"""
    server = OpenAPIMockServer(spec_path='openapi.yaml')
    server.start()
    yield server
    server.stop()

def test_consumer_integration(mock_api):
    """Test consumer against mock API"""

    # Call mock server (which validates against OpenAPI spec)
    response = requests.get(
        'http://localhost:8000/api/v1/users/1',
        headers={'Accept': 'application/json'}
    )

    assert response.status_code == 200
    data = response.json()
    assert 'user_id' in data
    assert 'email' in data
    assert 'status' in data
```

### Prism Mock Server (Industry Standard)

```bash
# Install Prism CLI
npm install -g @stoplight/prism-cli

# Start mock server from OpenAPI spec
prism mock openapi.yaml --host 0.0.0.0 --port 8000

# Prism automatically:
# - Validates requests against OpenAPI spec
# - Generates realistic example responses
# - Returns 400 for invalid requests
# - Supports dynamic response examples

# Test against mock
curl -X GET http://localhost:8000/api/v1/users/1 \
  -H "Accept: application/json"

# Response with example data from OpenAPI spec
# {
#   "user_id": 1,
#   "email": "test@example.com",
#   "status": "active"
# }
```

---

## Key Patterns & Best Practices

### Contract Testing Workflow

```
1. Consumer defines expectations (Pact tests)
   ↓
2. Consumer publishes to Pact Broker
   ↓
3. Provider pulls expectations
   ↓
4. Provider verifies against implementation
   ↓
5. Both services safe to deploy independently
```

### Versioning Strategy

```
API Version Scheme:
- v1: Original version
- v2: Breaking changes (incompatible with v1)
- v1.1: Backward compatible additions
- v1.1-beta: Experimental features

Support Multiple Versions:
- Accept header routing: Accept: application/vnd.api+json;version=2
- Path-based: /api/v1/..., /api/v2/...
- Header-based: X-API-Version: 2
```

### CI/CD Integration Checklist

```yaml
Contract Testing Checklist:
☐ Pact tests in consumer
☐ Publish to Pact Broker
☐ Provider verification
☐ OpenAPI spec validation
☐ Schema compatibility check
☐ Mock server generation
☐ Breaking change detection
☐ Deprecation warnings
☐ Documentation updates
☐ Backward compatibility tests
```

