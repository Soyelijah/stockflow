# Workspace Tools & Development Environment Setup

## Table of Contents
1. [Monorepo Setup](#monorepo-setup)
2. [Dev Container Configuration](#dev-container-configuration)
3. [Environment Variable Management](#environment-variable-management)
4. [Tool Version Management](#tool-version-management)
5. [Editor Configuration](#editor-configuration)
6. [Pre-commit Hooks](#pre-commit-hooks)
7. [Task Runners](#task-runners)
8. [Development Proxy & Tunneling](#development-proxy--tunneling)
9. [Common Pitfalls](#common-pitfalls)

## Monorepo Setup

### Nx Monorepo Setup

#### Installation
```bash
# Create new Nx workspace
npx create-nx-workspace@latest myworkspace --package-manager=npm

# Or add Nx to existing repo
npm install --save-dev nx

# Initialize Nx in existing repository
npx nx init
```

#### Nx Configuration
```json
// nx.json
{
  "extends": "nx/presets/npm.json",
  "nxCloudId": "workspace-id",
  "defaultBase": "main",
  "defaultProject": "web",
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "targetDefaults": {
    "build": {
      "cache": true,
      "inputs": ["production", "^production"],
      "outputs": ["{options.outputPath}"]
    },
    "test": {
      "cache": true,
      "inputs": ["default", "^production"]
    },
    "lint": {
      "cache": true,
      "inputs": ["default"]
    }
  },
  "namedInputs": {
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts"
    ],
    "default": ["{projectRoot}/**/*", "!{projectRoot}/.next/**/*"]
  },
  "plugins": [
    {
      "plugin": "@nx/next/plugin",
      "options": {
        "startTargetName": "start",
        "buildTargetName": "build"
      }
    }
  ]
}
```

#### Nx Project Structure
```
myworkspace/
├── apps/
│   ├── web/                    # Main web application
│   │   ├── src/
│   │   ├── project.json
│   │   └── tsconfig.json
│   └── api/                    # Backend API
│       ├── src/
│       ├── project.json
│       └── tsconfig.json
├── libs/
│   ├── shared/
│   │   ├── ui/                 # Shared UI components
│   │   │   ├── src/
│   │   │   └── project.json
│   │   └── utils/              # Shared utilities
│   │       ├── src/
│   │       └── project.json
│   └── domain/
│       ├── api-client/         # API client library
│       ├── models/             # Domain models
│       └── services/           # Business logic
├── tools/                      # Build scripts and utilities
├── nx.json
└── package.json
```

#### Nx Commands
```bash
# Generate new application
nx generate @nx/react:app web

# Generate library
nx generate @nx/react:lib shared-ui --directory=libs/shared

# Build specific project
nx build web

# Build with affected analysis (only changed projects)
nx affected:build --base=main

# Run tests
nx test web

# View dependency graph
nx dep-graph

# Lint all projects
nx lint

# Format code
nx format:write --all

# Run affected on pull request
nx affected --base=origin/main
```

### Turborepo Setup

#### Installation and Configuration
```bash
# Create Turborepo from template
npx create-turbo@latest

# Add Turborepo to existing monorepo
npm install --save-dev turbo
npx turbo init
```

#### turbo.json Configuration
```json
{
  "$schema": "https://turborepo.org/schema.json",
  "globalDependencies": [".env.local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"],
      "cache": true
    },
    "test": {
      "outputs": ["coverage/**"],
      "cache": true,
      "dependsOn": []
    },
    "lint": {
      "outputs": [],
      "cache": true,
      "dependsOn": []
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": []
    },
    "type-check": {
      "outputs": [],
      "cache": true
    }
  },
  "remoteCache": {
    "signature": true
  }
}
```

#### Turborepo Workspace Structure
```
monorepo/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── docs/
├── packages/
│   ├── ui/
│   ├── utils/
│   └── config/
├── turbo.json
└── package.json
```

#### Root package.json for Turborepo
```json
{
  "name": "monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "dev": "turbo dev --parallel",
    "type-check": "turbo type-check",
    "clean": "turbo clean",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "turbo": "latest",
    "prettier": "latest"
  }
}
```

#### Turborepo Commands
```bash
# Run build task across all packages
turbo build

# Run build only for changed packages
turbo build --filter="[main]"

# Run specific package
turbo run build --filter="@repo/web"

# Cache clearing
turbo clean

# Dry run (see what would execute)
turbo build --dry=json

# Visualize task graph
turbo build --graph

# Enable verbose logging
turbo build --verbosity=verbose
```

### pnpm Workspaces

#### Installation
```bash
# Install pnpm
npm install -g pnpm

# Initialize workspace
pnpm init -w

# Create workspace structure
mkdir -p packages/{api,ui,utils}
mkdir -p apps/{web,mobile}
```

#### pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tools/*'

catalogs:
  default:
    react: 18.2.0
    "@types/react": "^18"
    typescript: "^5.0"

publish:
  allow-scripts: true
```

#### Root package.json
```json
{
  "name": "workspace",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "scripts": {
    "dev": "pnpm --recursive dev",
    "build": "pnpm --recursive build",
    "test": "pnpm --recursive test",
    "lint": "pnpm --recursive lint",
    "type-check": "pnpm --recursive type-check"
  },
  "devDependencies": {
    "typescript": "^5.0",
    "eslint": "^8.0.0"
  }
}
```

#### pnpm Commands
```bash
# Install all dependencies
pnpm install

# Add to specific workspace
pnpm --filter @workspace/api add express

# Add shared dependency to all packages
pnpm add -w typescript -D

# Run script in single package
pnpm --filter @workspace/web build

# Run in parallel across all
pnpm --recursive --parallel build

# Check for unused dependencies
pnpm audit

# Sync monorepo dependencies
pnpm update -r
```

## Dev Container Configuration

### Docker Dev Container Setup

#### .devcontainer/devcontainer.json
```json
{
  "name": "Development Container",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:20",
  "features": {
    "ghcr.io/devcontainers/features/github-cli:1": {},
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/postgres:1": {
      "version": "16"
    }
  },
  "portsAttributes": {
    "3000": {
      "label": "Web App",
      "onAutoForward": "notify"
    },
    "5432": {
      "label": "PostgreSQL",
      "onAutoForward": "silent"
    },
    "6379": {
      "label": "Redis",
      "onAutoForward": "silent"
    }
  },
  "forwardPorts": [3000, 5432, 6379, 8000],
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-vscode.vscode-typescript-next",
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss",
        "ms-python.python",
        "ms-python.vscode-pylance"
      ],
      "settings": {
        "python.defaultInterpreterPath": "/usr/local/bin/python",
        "python.formatting.provider": "black",
        "[python]": {
          "editor.defaultFormatter": "ms-python.python",
          "editor.formatOnSave": true
        },
        "[typescript]": {
          "editor.defaultFormatter": "esbenp.prettier-vscode",
          "editor.formatOnSave": true
        },
        "typescript.preferences.quotePreference": "single",
        "typescript.updateImportsOnFileMove.enabled": "always"
      }
    }
  },
  "postCreateCommand": "npm install && pnpm install || true",
  "remoteUser": "node"
}
```

#### Dockerfile for Dev Container
```dockerfile
FROM mcr.microsoft.com/devcontainers/typescript-node:20

# Install Python
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install development tools
RUN npm install -g \
    pnpm \
    turbo \
    nx \
    vercel \
    aws-cli

# Create development user
RUN groupadd -r devuser && useradd -r -g devuser devuser

USER devuser
WORKDIR /workspace
```

### Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
      POSTGRES_DB: devdb
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  app:
    build:
      context: .
      dockerfile: .devcontainer/Dockerfile
    ports:
      - "3000:3000"
      - "8000:8000"
    volumes:
      - .:/workspace
      - /workspace/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://dev:devpass@postgres:5432/devdb
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
```

## Environment Variable Management

### .env File Patterns

#### Development .env
```bash
# .env (committed to repo with defaults)
NODE_ENV=development
API_PORT=8000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=devdb

LOG_LEVEL=debug
ENABLE_HOTRELOAD=true
CACHE_ENABLED=false
```

#### Secrets .env.local
```bash
# .env.local (NEVER committed, gitignored)
DATABASE_USER=dev
DATABASE_PASSWORD=secret123
JWT_SECRET=dev-secret-key
API_KEY=sk_test_abc123

STRIPE_SECRET_KEY=sk_test_stripe_key
OPENAI_API_KEY=sk-openai-key
```

#### Environment-specific .env files
```bash
# .env.development
DEBUG=*
VERBOSE_LOGGING=true

# .env.staging
DEBUG=app:*
VERBOSE_LOGGING=false

# .env.production
DEBUG=""
VERBOSE_LOGGING=false
ENABLE_MONITORING=true
```

#### .gitignore for Secrets
```bash
# .gitignore
.env.local
.env.*.local
.env.development.local
.env.staging.local
.env.production.local

# Keep examples
!.env.example
!.env.production.example
```

### Environment Variable Loading

#### Node.js with dotenv
```bash
npm install dotenv
```

```javascript
// src/config.ts
import dotenv from 'dotenv';
import path from 'path';

// Load env files in order
dotenv.config({ path: '.env' });
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
dotenv.config({ path: '.env.local' });

export const config = {
  port: parseInt(process.env.API_PORT || '8000'),
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    port: parseInt(process.env.DATABASE_PORT || '5432')
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES || '1d'
  }
};

// Validate required variables
const required = ['DATABASE_USER', 'DATABASE_PASSWORD', 'JWT_SECRET'];
const missing = required.filter(key => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required env vars: ${missing.join(', ')}`);
}
```

#### React with Vite
```bash
# vite.config.ts
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL)
    }
  }
})

// .env files in React
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=MyApp

// Access in code
const apiUrl = import.meta.env.VITE_API_URL
```

#### Python with python-dotenv
```bash
pip install python-dotenv
```

```python
# src/config.py
import os
from dotenv import load_dotenv

# Load .env files
load_dotenv('.env')
load_dotenv(f'.env.{os.getenv("ENVIRONMENT", "development")}')
load_dotenv('.env.local', override=True)

DATABASE_URL = os.getenv('DATABASE_URL')
SECRET_KEY = os.getenv('SECRET_KEY')
DEBUG = os.getenv('DEBUG', 'false').lower() == 'true'

# Validate required vars
REQUIRED_VARS = ['DATABASE_URL', 'SECRET_KEY']
for var in REQUIRED_VARS:
    if not os.getenv(var):
        raise ValueError(f"Missing required env var: {var}")
```

## Tool Version Management

### Node Version Management with nvm

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node versions
nvm install 20
nvm install 18

# Use specific version
nvm use 20

# Set default version
nvm alias default 20

# .nvmrc file (auto-switch)
echo "20.11.0" > .nvmrc

# Auto-switch on cd
nvm use  # Uses .nvmrc if present
```

### Python Version Management with pyenv

```bash
# Install pyenv
curl https://pyenv.run | bash

# Install Python versions
pyenv install 3.11.0
pyenv install 3.12.0

# Use specific version globally
pyenv global 3.11.0

# Use in specific directory
pyenv local 3.12.0

# .python-version file (auto-switch)
echo "3.11.0" > .python-version

# Verify version
python --version
```

### Multi-tool Version Manager with asdf

#### asdf Installation
```bash
git clone https://github.com/asdf-vm/asdf.git ~/.asdf

# Add to shell profile
echo '. "$HOME/.asdf/asdf.sh"' >> ~/.bashrc
echo '. "$HOME/.asdf/asdf.completions.bash"' >> ~/.bashrc
```

#### asdf Configuration
```bash
# .tool-versions
nodejs 20.11.0
python 3.11.0
golang 1.21.0
rust 1.75.0
```

#### asdf Commands
```bash
# Add plugins
asdf plugin add nodejs
asdf plugin add python
asdf plugin add golang

# Install versions
asdf install

# List available versions
asdf list all nodejs

# Use specific version locally
asdf local nodejs 20.11.0

# Use globally
asdf global nodejs 20.11.0
```

## Editor Configuration

### EditorConfig

```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.py]
indent_size = 4

[*.{md,markdown}]
trim_trailing_whitespace = false

[*.json]
indent_size = 2
```

### VSCode Settings

#### .vscode/settings.json
```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "editor.rulers": [80, 120],
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.python",
    "editor.formatOnSave": true
  },
  "python.formatting.provider": "black",
  "python.linting.pylintEnabled": true,
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true
  },
  "files.watcherExclude": {
    "**/node_modules": true
  }
}
```

#### .vscode/extensions.json
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "ms-python.python",
    "ms-python.vscode-pylance",
    "bradlc.vscode-tailwindcss",
    "eamodio.gitlens",
    "github.copilot"
  ]
}
```

#### .vscode/launch.json
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend (Python)",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["src.main:app", "--reload", "--port", "8000"],
      "jinja": true,
      "cwd": "${workspaceFolder}/backend"
    },
    {
      "name": "Frontend (Node)",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vite/bin/vite.js",
      "cwd": "${workspaceFolder}/frontend"
    }
  ],
  "compounds": [
    {
      "name": "Full Stack",
      "configurations": ["Backend (Python)", "Frontend (Node)"]
    }
  ]
}
```

## Pre-commit Hooks

### Husky Setup

```bash
# Install husky
npm install husky --save-dev
npx husky install

# Create hook
npx husky add .husky/pre-commit "npm run lint"
npx husky add .husky/commit-msg "npx commitlint --edit"
```

#### .husky/pre-commit
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Lint staged files
npx lint-staged

# Run tests
npm test -- --bail

# Type check
npm run type-check
```

### lint-staged Configuration

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.py": [
      "black --line-length 100",
      "isort"
    ],
    "*.{json,yaml,yml}": [
      "prettier --write"
    ]
  }
}
```

### Conventional Commits with commitlint

```bash
npm install @commitlint/config-conventional @commitlint/cli --save-dev
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit "$1"'
```

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',      // New feature
        'fix',       // Bug fix
        'docs',      // Documentation
        'style',     // Code style (no logic change)
        'refactor',  // Code refactoring
        'perf',      // Performance improvement
        'test',      // Tests
        'chore',     // Build, CI, deps
        'ci'         // CI configuration
      ]
    ],
    'subject-case': [2, 'never', ['start-case', 'pascal-case']]
  }
};
```

## Task Runners

### Make (Makefile)

```makefile
# Makefile
.PHONY: install dev build test lint clean help

PYTHON := python3
NODE := node
NPM := npm

help:
	@echo "Development tasks:"
	@grep -E '^\w+:' Makefile | awk -F: '{print "  make " $$1}'

install:
	@echo "Installing dependencies..."
	$(NPM) install
	cd backend && $(PYTHON) -m pip install -r requirements.txt

dev:
	@echo "Starting development servers..."
	$(NPM) run dev &
	cd backend && $(PYTHON) -m uvicorn src.main:app --reload

build:
	@echo "Building project..."
	$(NPM) run build
	cd backend && $(PYTHON) -m pip install -r requirements.txt

test:
	@echo "Running tests..."
	$(NPM) test
	cd backend && $(PYTHON) -m pytest tests/ -v

lint:
	@echo "Linting code..."
	$(NPM) run lint
	cd backend && $(PYTHON) -m black --check src/
	cd backend && $(PYTHON) -m ruff check src/

format:
	@echo "Formatting code..."
	$(NPM) run format
	cd backend && $(PYTHON) -m black src/
	cd backend && $(PYTHON) -m ruff check --fix src/

clean:
	@echo "Cleaning up..."
	rm -rf dist/ build/ node_modules/
	cd backend && rm -rf .venv/ dist/
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -name "*.pyc" -delete
```

### Just (Justfile)

```bash
# Justfile
set shell := ["bash", "-c"]

@help:
    just --list --unsorted

@install:
    npm install
    cd backend && pip install -r requirements.txt

@dev:
    npm run dev &
    cd backend && python -m uvicorn src.main:app --reload

@build:
    npm run build
    cd backend && pip install -r requirements.txt

@test:
    npm test
    cd backend && pytest tests/ -v

@lint:
    npm run lint
    cd backend && black --check src/ && ruff check src/

@format:
    npm run format
    cd backend && black src/ && ruff check --fix src/

@clean:
    rm -rf dist/ node_modules/
    cd backend && rm -rf .venv/ && find . -type d -name __pycache__ -delete
```

### TaskFile (Taskfile.yml)

```yaml
# Taskfile.yml
version: '3'

tasks:
  install:
    desc: Install all dependencies
    cmds:
      - npm install
      - cd backend && pip install -r requirements.txt

  dev:
    desc: Start development servers
    cmds:
      - npm run dev &
      - cd backend && python -m uvicorn src.main:app --reload

  build:
    desc: Build project
    cmds:
      - npm run build
      - cd backend && pip install -r requirements.txt

  test:
    desc: Run all tests
    cmds:
      - npm test
      - cd backend && pytest tests/ -v

  lint:
    desc: Lint code
    cmds:
      - npm run lint
      - cd backend && black --check src/ && ruff check src/

  format:
    desc: Format code
    cmds:
      - npm run format
      - cd backend && black src/ && ruff check --fix src/

  clean:
    desc: Clean build artifacts
    cmds:
      - rm -rf dist/ node_modules/
      - cd backend && rm -rf .venv/ build/
```

## Development Proxy & Tunneling

### ngrok for Local Tunnel

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from ngrok.com

# Authenticate
ngrok config add-authtoken <YOUR_TOKEN>

# Create tunnel to local server
ngrok http 3000

# Custom subdomain
ngrok http 3000 --subdomain=myapp

# HTTPS with custom domain
ngrok http 3000 --domain=api.myapp.dev
```

#### ngrok Configuration
```yaml
# ~/.ngrok2/ngrok.yml
authtoken: YOUR_TOKEN
region: us
tunnels:
  web:
    proto: http
    addr: 3000
    subdomain: myapp-web
  api:
    proto: http
    addr: 8000
    subdomain: myapp-api
```

### Cloudflare Tunnel (Warp)

```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create myapp

# Route traffic
cloudflared tunnel route dns myapp myapp.example.com
cloudflared tunnel route cname myapp api.example.com

# Start tunnel
cloudflared tunnel run myapp
```

#### cloudflared Configuration
```yaml
# ~/.cloudflared/config.yml
tunnel: myapp-tunnel-id
credentials-file: /Users/user/.cloudflared/myapp-tunnel-id.json

ingress:
  - hostname: api.example.com
    service: http://localhost:8000
  - hostname: app.example.com
    service: http://localhost:3000
  - service: http_status:404
```

### Local Development with mkcert

```bash
# Install mkcert
brew install mkcert nss

# Create local CA
mkcert -install

# Generate certificates
mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 ::1

# Use in local servers
# Node/Express
const https = require('https');
const fs = require('fs');
const app = require('./app');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(3000);
```

## Common Pitfalls

### Pitfall 1: .env Secrets in Version Control

**Problem**: Accidentally committing secrets like API keys to Git.

```bash
# Bad: .env in repo
.env
DATABASE_PASSWORD=secret123
API_KEY=sk_test_abc

# Good: Only committed template
.env.example
DATABASE_PASSWORD=***CHANGE_ME***
API_KEY=***CHANGE_ME***

# Good: .gitignore
.env
.env.local
.env.*.local
```

### Pitfall 2: Inconsistent Node/Python Versions Across Team

**Problem**: "Works on my machine" due to version differences.

```bash
# Bad: No version specification
npm install  # Could use any Node version

# Good: Specify in .nvmrc, .python-version, or .tool-versions
echo "18.17.0" > .nvmrc
echo "3.11.0" > .python-version

# Good: Document in README
# Node 18.17.0
# Python 3.11.0
# PostgreSQL 15
```

### Pitfall 3: Monorepo Dependency Duplication

**Problem**: Same dependency installed multiple times at different versions.

```bash
# Bad: Each package has own node_modules
apps/
├── api/
│   └── node_modules/lodash@4.17.20
├── web/
│   └── node_modules/lodash@4.17.21

# Good: pnpm hoists to root
pnpm install

# Good: npm workspaces with deduping
npm dedupe
```

### Pitfall 4: Pre-commit Hooks Too Slow

**Problem**: Developers disable hooks due to slow execution.

```bash
# Bad: Heavy operations blocking commit
pre-commit:
  - npm run type-check
  - npm run build
  - npm test

# Good: Only lint staged files
lint-staged:
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
```

### Pitfall 5: Environment Variables Missing in Deployment

**Problem**: .env.local works locally but missing in CI/CD.

```yaml
# Bad: No env validation
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: npm build

# Good: Validate required vars
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: production
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      API_KEY: ${{ secrets.API_KEY }}
    steps:
      - run: npm build
      - run: node -e "require('dotenv').config(); const config = require('./config'); console.log('Config loaded')"
```

### Pitfall 6: Dev Container Out of Sync with Production

**Problem**: Dev container differs from production, causing "works in Docker" issues.

```dockerfile
# Bad: Dev and prod use different base images
# Dockerfile
FROM node:20-alpine
# Production setup

# .devcontainer/Dockerfile
FROM node:20  # Different base!

# Good: Share base image
# Dockerfile.base
FROM node:20-alpine
RUN apk add --no-cache postgresql-client

# Dockerfile
FROM devcontainer-base:latest
# Prod-specific config

# .devcontainer/Dockerfile
FROM devcontainer-base:latest
# Dev-specific config
```

---

## Tools Quick Reference

| Tool | Purpose | Command |
|------|---------|---------|
| Nx | Monorepo management | `nx build`, `nx dep-graph` |
| Turborepo | Monorepo caching | `turbo build`, `turbo dev` |
| pnpm | Efficient pkg manager | `pnpm install`, `pnpm --filter` |
| nvm | Node version mgmt | `nvm use 20` |
| pyenv | Python version mgmt | `pyenv local 3.11` |
| asdf | Multi-tool version mgmt | `asdf install` |
| Husky | Git hooks | `npx husky add .husky/pre-commit` |
| lint-staged | Run checks on staged files | `lint-staged` |
| Make | Task runner | `make build` |
| Just | Modern task runner | `just build` |
| Task | YAML task runner | `task build` |
| ngrok | Local tunnel | `ngrok http 3000` |
| Cloudflare Tunnel | Production tunnel | `cloudflared tunnel run` |
| mkcert | Local HTTPS certs | `mkcert localhost` |
