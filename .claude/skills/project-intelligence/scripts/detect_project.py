#!/usr/bin/env python3
"""
DYSA Project Intelligence Engine v3.0 — Enterprise Project Fingerprinter

Scans any codebase and produces a structured project profile:
- 80+ technology signatures with confidence scoring
- 22 business domains with weighted keyword matching
- Architecture pattern detection (8 patterns)
- Maturity assessment on 12 axes
- Multi-domain fusion (projects can match multiple domains)
- Dependency graph awareness
- Security posture assessment
"""

import os
import sys
import json
import re
from pathlib import Path
from collections import Counter, defaultdict
from typing import Optional

class ProjectFingerprinter:
    """Enterprise-grade codebase analyzer."""

    # ═══════════════════════════════════════════════════════════════
    # TECHNOLOGY SIGNATURES — 80+ technologies
    # Format: "filename" | "filename:content" | "*.ext" | "dir/"
    # ═══════════════════════════════════════════════════════════════
    TECH_SIGNATURES = {
        # ── Frontend Frameworks ────────────────────────────────
        "react":          ["package.json:\"react\"", "jsx", "tsx"],
        "nextjs":         ["next.config.js", "next.config.ts", "next.config.mjs", "app/layout.tsx", "app/layout.js", "pages/_app"],
        "nuxt":           ["nuxt.config.ts", "nuxt.config.js", ".nuxtrc"],
        "vue":            ["package.json:\"vue\"", "vue"],
        "angular":        ["angular.json", "package.json:@angular/core"],
        "svelte":         ["svelte.config.js", "package.json:svelte"],
        "sveltekit":      ["svelte.config.js", "package.json:@sveltejs/kit"],
        "astro":          ["astro.config.mjs", "astro.config.ts", "package.json:astro"],
        "remix":          ["remix.config.js", "package.json:@remix-run"],
        "solid":          ["package.json:solid-js"],
        "qwik":           ["package.json:@builder.io/qwik"],
        "htmx":           ["package.json:htmx", "htmx"],

        # ── CSS / UI ──────────────────────────────────────────
        "tailwind":       ["tailwind.config.js", "tailwind.config.ts", "package.json:tailwindcss"],
        "shadcn":         ["components.json", "package.json:@radix-ui"],
        "chakra":         ["package.json:@chakra-ui"],
        "material_ui":    ["package.json:@mui/material"],
        "ant_design":     ["package.json:antd"],
        "styled_components": ["package.json:styled-components"],

        # ── Backend Frameworks ─────────────────────────────────
        "fastapi":        ["requirements.txt:fastapi", "pyproject.toml:fastapi", "main.py:FastAPI", "main.py:fastapi"],
        "django":         ["manage.py", "settings.py:INSTALLED_APPS", "wsgi.py", "asgi.py:django"],
        "flask":          ["requirements.txt:flask", "app.py:Flask"],
        "express":        ["package.json:express", "server.js:express", "app.js:express"],
        "nestjs":         ["nest-cli.json", "package.json:@nestjs/core"],
        "hono":           ["package.json:hono"],
        "fastify":        ["package.json:fastify"],
        "koa":            ["package.json:koa"],
        "rails":          ["Gemfile:rails", "config/routes.rb"],
        "laravel":        ["artisan", "composer.json:laravel"],
        "spring":         ["pom.xml:spring-boot", "build.gradle:spring-boot"],
        "dotnet":         ["*.csproj", "Program.cs", "appsettings.json"],
        "golang_web":     ["go.mod", "main.go"],
        "rust_web":       ["Cargo.toml", "src/main.rs"],
        "elixir_phoenix": ["mix.exs:phoenix"],

        # ── Mobile ────────────────────────────────────────────
        "react_native":   ["package.json:react-native", "metro.config.js", "app.json:expo"],
        "flutter":        ["pubspec.yaml:flutter", "lib/main.dart"],
        "swift":          ["Package.swift", "xcodeproj"],
        "kotlin_android": ["build.gradle.kts:android", "AndroidManifest.xml"],
        "ionic":          ["package.json:@ionic"],
        "capacitor":      ["capacitor.config.ts", "package.json:@capacitor"],
        "expo":           ["app.json:expo", "package.json:expo"],

        # ── Data / ML / AI ────────────────────────────────────
        "jupyter":        ["ipynb"],
        "tensorflow":     ["requirements.txt:tensorflow", "package.json:@tensorflow"],
        "pytorch":        ["requirements.txt:torch", "requirements.txt:pytorch"],
        "langchain":      ["requirements.txt:langchain", "package.json:langchain"],
        "llamaindex":     ["requirements.txt:llama-index", "requirements.txt:llama_index"],
        "openai_sdk":     ["requirements.txt:openai", "package.json:openai"],
        "anthropic_sdk":  ["requirements.txt:anthropic", "package.json:@anthropic-ai"],
        "huggingface":    ["requirements.txt:transformers", "requirements.txt:huggingface"],
        "pandas":         ["requirements.txt:pandas"],
        "scikit_learn":   ["requirements.txt:scikit-learn"],
        "mlflow":         ["mlflow/", "requirements.txt:mlflow"],
        "dbt":            ["dbt_project.yml", "profiles.yml"],
        "airflow":        ["dags/", "requirements.txt:apache-airflow"],
        "crewai":         ["requirements.txt:crewai"],
        "autogen":        ["requirements.txt:autogen", "requirements.txt:pyautogen"],

        # ── Databases ─────────────────────────────────────────
        "postgresql":     [".env:POSTGRES", "docker-compose.yml:postgres", "docker-compose.yaml:postgres"],
        "mysql":          [".env:MYSQL", "docker-compose.yml:mysql"],
        "mongodb":        [".env:MONGO", "package.json:mongoose", "package.json:mongodb"],
        "redis":          [".env:REDIS", "docker-compose.yml:redis", "docker-compose.yaml:redis"],
        "sqlite":         [".env:SQLITE", "*.sqlite", "*.db"],
        "supabase":       [".env:SUPABASE", "package.json:@supabase"],
        "firebase":       ["firebase.json", ".firebaserc", "package.json:firebase"],
        "prisma":         ["prisma/schema.prisma"],
        "drizzle":        ["drizzle.config.ts", "package.json:drizzle-orm"],
        "sqlalchemy":     ["requirements.txt:sqlalchemy", "alembic.ini", "requirements.txt:alembic"],
        "typeorm":        ["package.json:typeorm", "ormconfig.json"],
        "neon":           [".env:NEON", "package.json:@neondatabase"],
        "turso":          [".env:TURSO", "package.json:@libsql"],
        "timescaledb":    ["docker-compose.yml:timescale", "docker-compose.yaml:timescale"],
        "elasticsearch":  [".env:ELASTIC", "docker-compose.yml:elasticsearch"],
        "pinecone":       [".env:PINECONE", "requirements.txt:pinecone", "package.json:@pinecone-database"],
        "chromadb":       ["requirements.txt:chromadb"],
        "weaviate":       ["requirements.txt:weaviate", ".env:WEAVIATE"],
        "qdrant":         ["requirements.txt:qdrant", ".env:QDRANT"],

        # ── Auth ──────────────────────────────────────────────
        "auth0":          [".env:AUTH0", "package.json:@auth0"],
        "clerk":          ["package.json:@clerk"],
        "nextauth":       ["package.json:next-auth", "package.json:@auth/core"],
        "lucia":          ["package.json:lucia"],
        "jwt":            ["requirements.txt:pyjwt", "package.json:jsonwebtoken"],
        "oauth":          [".env:OAUTH", ".env:GOOGLE_CLIENT"],
        "keycloak":       [".env:KEYCLOAK", "docker-compose.yml:keycloak"],
        "supertokens":    ["package.json:supertokens"],

        # ── Payments ──────────────────────────────────────────
        "stripe":         [".env:STRIPE", "package.json:stripe", "requirements.txt:stripe"],
        "paypal":         [".env:PAYPAL", "package.json:@paypal"],
        "lemonsqueezy":   ["package.json:@lemonsqueezy"],

        # ── Infrastructure ────────────────────────────────────
        "docker":         ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", ".dockerignore"],
        "kubernetes":     ["k8s/", "kubernetes/", "*.yaml:kind: Deployment"],
        "terraform":      ["*.tf", "terraform.tfstate"],
        "pulumi":         ["Pulumi.yaml"],
        "serverless_fw":  ["serverless.yml", "serverless.ts"],
        "cloudflare_workers": ["wrangler.toml", "wrangler.json"],
        "aws_cdk":        ["cdk.json", "package.json:aws-cdk"],
        "aws_sam":        ["template.yaml:AWS::Serverless"],

        # ── CI/CD ─────────────────────────────────────────────
        "github_actions": [".github/workflows/"],
        "gitlab_ci":      [".gitlab-ci.yml"],
        "vercel":         ["vercel.json", ".vercel/"],
        "netlify":        ["netlify.toml"],
        "railway":        ["railway.toml", "railway.json"],
        "render":         ["render.yaml"],
        "fly_io":         ["fly.toml"],

        # ── Testing ───────────────────────────────────────────
        "jest":           ["jest.config.js", "jest.config.ts", "package.json:jest"],
        "vitest":         ["vitest.config.ts", "package.json:vitest"],
        "pytest":         ["pytest.ini", "conftest.py", "requirements.txt:pytest", "pyproject.toml:pytest"],
        "cypress":        ["cypress.config.ts", "cypress.config.js", "cypress/"],
        "playwright_test": ["playwright.config.ts", "playwright.config.js"],
        "mocha":          ["package.json:mocha", ".mocharc.yml"],
        "storybook":      [".storybook/", "package.json:@storybook"],

        # ── Messaging / Real-time ─────────────────────────────
        "websocket":      ["package.json:ws", "requirements.txt:websocket"],
        "socket_io":      ["package.json:socket.io"],
        "graphql":        ["schema.graphql", "package.json:@apollo", "package.json:graphql"],
        "trpc":           ["package.json:@trpc"],
        "grpc":           ["*.proto", "requirements.txt:grpcio"],
        "kafka":          [".env:KAFKA", "docker-compose.yml:kafka"],
        "rabbitmq":       [".env:RABBIT", "docker-compose.yml:rabbitmq"],
        "nats":           [".env:NATS", "docker-compose.yml:nats"],

        # ── Monitoring / Logging ──────────────────────────────
        "sentry":         [".env:SENTRY", "package.json:@sentry"],
        "datadog":        [".env:DD_", "package.json:dd-trace"],
        "prometheus":     ["prometheus.yml", "docker-compose.yml:prometheus"],
        "grafana":        ["docker-compose.yml:grafana"],
        "opentelemetry":  ["package.json:@opentelemetry", "requirements.txt:opentelemetry"],
        "structlog":      ["requirements.txt:structlog"],
        "pino":           ["package.json:pino"],

        # ── Email / Notifications ─────────────────────────────
        "sendgrid":       [".env:SENDGRID", "package.json:@sendgrid"],
        "resend":         ["package.json:resend", ".env:RESEND"],
        "postmark":       [".env:POSTMARK", "package.json:postmark"],
        "twilio":         [".env:TWILIO", "package.json:twilio"],
        "onesignal":      [".env:ONESIGNAL"],

        # ── Storage / CDN ─────────────────────────────────────
        "aws_s3":         [".env:AWS_S3", ".env:S3_BUCKET", ".env:AWS_ACCESS"],
        "cloudinary":     [".env:CLOUDINARY", "package.json:cloudinary"],
        "uploadthing":    ["package.json:uploadthing"],
        "r2":             [".env:R2_", "wrangler.toml:r2_buckets"],
        "minio":          [".env:MINIO", "docker-compose.yml:minio"],

        # ── CMS ───────────────────────────────────────────────
        "wordpress":      ["wp-config.php", "wp-content/"],
        "strapi":         ["package.json:@strapi"],
        "sanity":         ["sanity.config.ts", "package.json:@sanity"],
        "contentful":     ["package.json:contentful"],
        "ghost":          ["package.json:ghost"],
        "payload":        ["package.json:payload"],
        "keystonejs":     ["package.json:@keystone-6"],

        # ── Search ────────────────────────────────────────────
        "algolia":        [".env:ALGOLIA", "package.json:algoliasearch"],
        "meilisearch":    [".env:MEILI", "docker-compose.yml:meilisearch"],
        "typesense":      [".env:TYPESENSE"],

        # ── Monorepo Tools ────────────────────────────────────
        "turborepo":      ["turbo.json"],
        "nx":             ["nx.json"],
        "lerna":          ["lerna.json"],
        "pnpm_workspace": ["pnpm-workspace.yaml"],

        # ── State Management ──────────────────────────────────
        "zustand":        ["package.json:zustand"],
        "redux":          ["package.json:@reduxjs/toolkit", "package.json:redux"],
        "jotai":          ["package.json:jotai"],
        "tanstack_query": ["package.json:@tanstack/react-query"],
        "swr":            ["package.json:swr"],

        # ── Blockchain / Web3 ─────────────────────────────────
        "ethers":         ["package.json:ethers"],
        "web3js":         ["package.json:web3"],
        "hardhat":        ["hardhat.config.ts", "hardhat.config.js"],
        "foundry":        ["foundry.toml"],
        "solidity":       ["sol"],
        "wagmi":          ["package.json:wagmi"],
    }

    # ═══════════════════════════════════════════════════════════════
    # DOMAIN DETECTION — 22 domains with weighted keywords
    # Higher weight = stronger signal. "keyword:weight" format
    # ═══════════════════════════════════════════════════════════════
    DOMAIN_PATTERNS = {
        "ecommerce": {
            "keywords": ["cart:3", "checkout:3", "product:2", "catalog:2", "inventory:2",
                        "sku:3", "order:1", "payment:2", "shipping:2", "store:1",
                        "shopify:3", "woocommerce:3", "stripe:1", "price:1", "discount:2"],
            "tech_boost": {"stripe": 0.2, "algolia": 0.3, "cloudinary": 0.1}
        },
        "fintech": {
            "keywords": ["trading:3", "portfolio:3", "balance:2", "transaction:2",
                        "ledger:3", "wallet:3", "exchange:2", "kyc:3", "compliance:2",
                        "strategy:2", "signal:3", "binance:3", "order:1", "position:3",
                        "risk:2", "pnl:3", "profit:2", "stop_loss:3", "take_profit:3",
                        "candlestick:3", "ohlcv:3", "ticker:2", "market_data:3",
                        "backtest:3", "drawdown:3", "sharpe:3", "alpha:3"],
            "tech_boost": {"timescaledb": 0.3, "redis": 0.1, "websocket": 0.2}
        },
        "healthtech": {
            "keywords": ["patient:3", "diagnosis:3", "medical:3", "health:2", "ehr:3",
                        "clinical:3", "prescription:3", "hipaa:3", "fhir:3", "telehealth:3",
                        "appointment:2", "provider:2", "insurance:2", "claim:2"],
            "tech_boost": {}
        },
        "edtech": {
            "keywords": ["course:3", "lesson:3", "student:3", "quiz:3", "enrollment:3",
                        "curriculum:3", "lms:3", "grade:2", "assessment:2", "learning:2",
                        "instructor:3", "certificate:2", "module:1", "progress:1"],
            "tech_boost": {}
        },
        "saas": {
            "keywords": ["subscription:3", "tenant:3", "billing:2", "plan:2", "tier:3",
                        "onboarding:2", "dashboard:1", "workspace:2", "organization:2",
                        "seats:3", "usage:1", "quota:2", "feature_flag:3", "multi_tenant:3"],
            "tech_boost": {"stripe": 0.2, "clerk": 0.2, "auth0": 0.2}
        },
        "social": {
            "keywords": ["post:2", "feed:3", "profile:2", "follow:3", "like:2",
                        "comment:2", "share:2", "timeline:3", "notification:1",
                        "friend:2", "message:1", "story:2", "reel:3"],
            "tech_boost": {"redis": 0.1, "elasticsearch": 0.2}
        },
        "marketplace": {
            "keywords": ["listing:3", "seller:3", "buyer:3", "bid:3", "review:2",
                        "rating:2", "category:1", "commission:3", "escrow:3",
                        "dispute:2", "payout:2", "gmv:3", "take_rate:3"],
            "tech_boost": {"stripe": 0.2, "algolia": 0.2}
        },
        "crm": {
            "keywords": ["contact:2", "lead:3", "pipeline:3", "deal:3", "opportunity:3",
                        "account:2", "campaign:2", "sales:2", "funnel:2", "prospect:3"],
            "tech_boost": {}
        },
        "chatbot": {
            "keywords": ["conversation:2", "intent:3", "entity:3", "dialog:3", "nlp:3",
                        "chatbot:3", "utterance:3", "dialog_flow:3", "nlu:3",
                        "slot_filling:3", "response_template:3", "fallback:2",
                        "channel:1", "webhook:1"],
            "tech_boost": {"langchain": 0.3, "openai_sdk": 0.2, "anthropic_sdk": 0.2}
        },
        "ai_agent": {
            "keywords": ["agent:2", "tool_use:3", "chain:2", "prompt:2", "llm:3",
                        "embedding:3", "vector:3", "rag:3", "retrieval:3",
                        "autonomous:3", "planning:2", "reasoning:3", "memory:2",
                        "function_calling:3", "tool:1"],
            "tech_boost": {"langchain": 0.3, "llamaindex": 0.3, "openai_sdk": 0.2,
                          "anthropic_sdk": 0.2, "pinecone": 0.3, "chromadb": 0.3,
                          "crewai": 0.4, "autogen": 0.4}
        },
        "analytics": {
            "keywords": ["dashboard:2", "metric:2", "report:2", "chart:2", "visualization:3",
                        "kpi:3", "funnel:2", "cohort:3", "retention:2", "etl:3",
                        "data_pipeline:3", "warehouse:3", "dimension:3", "measure:3"],
            "tech_boost": {"dbt": 0.4, "airflow": 0.3, "elasticsearch": 0.2}
        },
        "devtools": {
            "keywords": ["cli:3", "plugin:2", "extension:2", "sdk:3", "api:1",
                        "webhook:2", "middleware:1", "lint:2", "formatter:3",
                        "package:2", "registry:2", "scaffold:3", "generator:3"],
            "tech_boost": {}
        },
        "content": {
            "keywords": ["blog:3", "article:3", "cms:3", "author:2", "publish:2",
                        "media:2", "editor:2", "content:2", "markdown:2", "post:1",
                        "seo:2", "slug:2", "draft:2", "editorial:3"],
            "tech_boost": {"sanity": 0.4, "strapi": 0.4, "contentful": 0.4, "ghost": 0.4}
        },
        "iot": {
            "keywords": ["sensor:3", "device:3", "telemetry:3", "mqtt:3", "gateway:3",
                        "firmware:3", "edge:2", "ota:3", "fleet:2", "actuator:3",
                        "protocol:2", "zigbee:3", "lora:3"],
            "tech_boost": {"timescaledb": 0.2}
        },
        "gaming": {
            "keywords": ["game:3", "player:3", "score:2", "level:2", "achievement:3",
                        "leaderboard:3", "match:2", "lobby:3", "spawn:3", "inventory:1",
                        "quest:3", "npc:3", "multiplayer:3", "physics:2"],
            "tech_boost": {}
        },
        "hr": {
            "keywords": ["employee:3", "payroll:3", "leave:3", "recruitment:3",
                        "onboarding:2", "performance:2", "benefit:3", "applicant:3",
                        "interview:3", "salary:3", "attendance:3", "timesheet:3"],
            "tech_boost": {}
        },
        "logistics": {
            "keywords": ["shipment:3", "tracking:2", "route:2", "warehouse:3",
                        "delivery:3", "fleet:3", "dispatch:3", "carrier:3",
                        "manifest:3", "pickup:2", "last_mile:3", "geofence:3"],
            "tech_boost": {}
        },
        "real_estate": {
            "keywords": ["property:3", "listing:2", "agent:1", "tenant:2", "lease:3",
                        "mortgage:3", "inspection:3", "mls:3", "sqft:3", "appraisal:3",
                        "closing:2", "escrow:2", "rental:3"],
            "tech_boost": {}
        },
        "legal": {
            "keywords": ["contract:3", "clause:3", "compliance:2", "litigation:3",
                        "discovery:2", "nda:3", "filing:3", "deposition:3",
                        "arbitration:3", "statute:3", "precedent:3", "brief:2"],
            "tech_boost": {}
        },
        "marketing": {
            "keywords": ["campaign:3", "audience:3", "segment:3", "conversion:3",
                        "funnel:2", "ab_test:3", "email_sequence:3", "landing:2",
                        "cta:3", "impression:3", "click_rate:3", "attribution:3"],
            "tech_boost": {}
        },
        "web3": {
            "keywords": ["blockchain:3", "smart_contract:3", "token:2", "nft:3",
                        "defi:3", "dao:3", "mint:3", "stake:3", "swap:2",
                        "wallet:2", "metamask:3", "solidity:3", "evm:3"],
            "tech_boost": {"ethers": 0.4, "hardhat": 0.4, "foundry": 0.4, "solidity": 0.4, "wagmi": 0.3}
        },
        "api_platform": {
            "keywords": ["api_key:3", "rate_limit:3", "developer_portal:3", "documentation:2",
                        "versioning:2", "deprecation:3", "throttle:3", "metered:3",
                        "openapi:3", "swagger:3", "endpoint:1", "sdk:2"],
            "tech_boost": {"graphql": 0.2, "trpc": 0.2}
        },
    }

    # ═══════════════════════════════════════════════════════════════
    # ARCHITECTURE PATTERNS
    # ═══════════════════════════════════════════════════════════════
    ARCHITECTURE_SIGNALS = {
        "monorepo":       {"files": ["pnpm-workspace.yaml", "lerna.json", "nx.json", "turbo.json"], "dirs": ["packages/", "apps/"]},
        "fullstack":      {"dirs": ["frontend/", "backend/", "client/", "server/", "web/", "api/"]},
        "microservices":  {"files": ["docker-compose.yml", "docker-compose.yaml"], "content_check": {"file": "docker-compose", "min_services": 4}},
        "serverless":     {"files": ["serverless.yml", "serverless.ts", "template.yaml"], "dirs": ["functions/", "lambdas/"]},
        "jamstack":       {"tech_requires": ["nextjs", "nuxt", "astro", "gatsby"], "dirs": ["content/", "posts/"]},
        "event_driven":   {"files": [], "dirs": ["events/", "handlers/", "listeners/"], "tech_requires_any": ["kafka", "rabbitmq", "nats"]},
        "modular_monolith": {"dirs": ["modules/", "domains/", "bounded_contexts/"]},
        "plugin_based":   {"dirs": ["plugins/", "extensions/", "addons/"], "files": ["plugin.json", "manifest.json"]},
    }

    def __init__(self, project_path: str):
        self.root = Path(project_path).resolve()
        self.files: list[str] = []
        self.dirs: list[str] = []
        self._file_cache: dict[str, str] = {}
        self.file_stats: Counter = Counter()
        self.detected_tech: dict[str, float] = {}
        self.detected_domains: dict[str, float] = {}

    # ───────────────────────────────────────────────────────────────
    # PUBLIC API
    # ───────────────────────────────────────────────────────────────
    def scan(self) -> dict:
        """Full project scan → structured fingerprint."""
        self._collect_files()
        self._detect_technologies()
        self._detect_domains()

        tech_sorted = sorted(self.detected_tech.items(), key=lambda x: -x[1])
        domain_sorted = sorted(self.detected_domains.items(), key=lambda x: -x[1])

        # Multi-domain: return all with >25% confidence
        primary_domain = domain_sorted[0] if domain_sorted and domain_sorted[0][1] > 0.15 else ("generic", 0)
        secondary = [d for d in domain_sorted[1:5] if d[1] > 0.15]

        return {
            "engine_version": "3.0.0",
            "project_path": str(self.root),
            "project_name": self.root.name,

            # Technologies
            "technologies": {k: round(v, 2) for k, v in tech_sorted if v > 0.25},
            "primary_stack": self._classify_stack(tech_sorted),
            "tech_count": sum(1 for v in self.detected_tech.values() if v > 0.25),

            # Domain
            "domain": primary_domain[0],
            "domain_confidence": round(primary_domain[1], 2),
            "secondary_domains": [{"name": d[0], "confidence": round(d[1], 2)} for d in secondary],
            "is_multi_domain": len(secondary) > 0 and secondary[0][1] > 0.4,

            # Architecture
            "architecture": self._detect_architecture(),

            # Maturity
            "maturity": self._assess_maturity(),

            # Complexity
            "complexity": self._assess_complexity(tech_sorted),

            # Security posture
            "security": self._assess_security(),

            # File stats
            "file_stats": dict(self.file_stats.most_common(20)),
            "total_files": len(self.files),

            # Capabilities
            "has_tests": self._has("test", "spec", "conftest"),
            "has_ci": self._has_dir(".github/workflows") or self._has_file(".gitlab-ci.yml"),
            "has_docker": self._has_file("Dockerfile") or self._has_file("docker-compose.yml"),
            "has_docs": self._has_dir("docs/") or self._has_file("README.md"),
            "has_env": self._has_file(".env") or self._has_file(".env.local"),
            "has_monitoring": any(t in self.detected_tech for t in ["sentry", "datadog", "prometheus", "opentelemetry"]),
            "has_i18n": self._has_dir("locales/") or self._has_dir("i18n/") or self._has_file("i18n.ts"),
            "has_storybook": "storybook" in self.detected_tech,
            "has_api_docs": self._has_file("openapi.yaml") or self._has_file("swagger.json") or self._has("api/docs"),
        }

    # ───────────────────────────────────────────────────────────────
    # FILE COLLECTION
    # ───────────────────────────────────────────────────────────────
    def _collect_files(self):
        skip = {
            "node_modules", ".git", "__pycache__", ".next", ".nuxt",
            "dist", "build", ".cache", "vendor", "venv", ".venv",
            ".tox", "coverage", ".pytest_cache", ".mypy_cache",
            "target", ".gradle", ".idea", ".vscode", ".turbo",
            ".output", ".svelte-kit", ".vercel", ".netlify",
            "android/build", "ios/Pods", ".dart_tool"
        }
        for dirpath, dirnames, filenames in os.walk(self.root):
            dirnames[:] = [d for d in dirnames if d not in skip]
            rel_dir = os.path.relpath(dirpath, self.root)
            self.dirs.append(rel_dir)
            for fn in filenames:
                rel = os.path.join(rel_dir, fn)
                self.files.append(rel)
                ext = Path(fn).suffix.lstrip(".")
                if ext:
                    self.file_stats[ext] += 1

    def _read_head(self, rel_path: str, lines: int = 80) -> str:
        if rel_path in self._file_cache:
            return self._file_cache[rel_path]
        try:
            full = self.root / rel_path
            if full.stat().st_size > 500_000:
                return ""
            with open(full, "r", errors="ignore") as f:
                content = "".join(f.readline() for _ in range(lines))
            self._file_cache[rel_path] = content
            return content
        except Exception:
            return ""

    # ───────────────────────────────────────────────────────────────
    # TECHNOLOGY DETECTION
    # ───────────────────────────────────────────────────────────────
    def _detect_technologies(self):
        for tech, sigs in self.TECH_SIGNATURES.items():
            score = 0.0
            for sig in sigs:
                if ":" in sig and not sig.startswith("*"):
                    file_pat, content_pat = sig.split(":", 1)
                    matches = [f for f in self.files if file_pat in f]
                    for m in matches[:3]:
                        if content_pat.lower() in self._read_head(m).lower():
                            score += 1.0
                elif sig.startswith("*.") or (len(sig) <= 5 and "." not in sig and "/" not in sig):
                    ext = sig.lstrip("*.")
                    count = self.file_stats.get(ext, 0)
                    if count > 0:
                        score += min(1.0, count / 5)
                elif sig.endswith("/"):
                    if any(sig.rstrip("/") in d for d in self.dirs):
                        score += 1.0
                else:
                    if any(sig in f for f in self.files):
                        score += 1.0
            if score > 0:
                self.detected_tech[tech] = min(score / max(len(sigs), 1), 1.0)

    # ───────────────────────────────────────────────────────────────
    # DOMAIN DETECTION — weighted keywords + tech boost
    # ───────────────────────────────────────────────────────────────
    def _detect_domains(self):
        # Build searchable text from files + dirs + key config content
        all_text = " ".join(self.files + self.dirs).lower().replace("/", " ").replace("_", " ").replace("-", " ")
        for f in self.files:
            if any(f.endswith(x) for x in ["README.md", "package.json", "pyproject.toml", "CLAUDE.md", "Cargo.toml", "mix.exs"]):
                all_text += " " + self._read_head(f).lower()

        for domain, config in self.DOMAIN_PATTERNS.items():
            total_weight = 0
            max_possible = 0
            for kw_spec in config["keywords"]:
                parts = kw_spec.split(":")
                kw, weight = parts[0], int(parts[1])
                max_possible += weight
                if kw in all_text:
                    # Count occurrences (capped at 5)
                    occurrences = min(all_text.count(kw), 5)
                    total_weight += weight * (1 + 0.1 * (occurrences - 1))

            # Apply tech boost
            for tech, boost in config.get("tech_boost", {}).items():
                if tech in self.detected_tech and self.detected_tech[tech] > 0.3:
                    total_weight += boost * max_possible

            if total_weight > 0 and max_possible > 0:
                self.detected_domains[domain] = min(total_weight / (max_possible * 0.35), 1.0)

    # ───────────────────────────────────────────────────────────────
    # STACK CLASSIFICATION
    # ───────────────────────────────────────────────────────────────
    def _classify_stack(self, tech_sorted: list) -> dict:
        layers = {
            "frontend": {"react", "nextjs", "nuxt", "vue", "angular", "svelte", "sveltekit",
                        "astro", "remix", "solid", "qwik", "htmx", "react_native", "flutter",
                        "swift", "kotlin_android", "ionic", "capacitor", "expo"},
            "backend": {"fastapi", "django", "flask", "express", "nestjs", "hono", "fastify",
                       "koa", "rails", "laravel", "spring", "dotnet", "golang_web",
                       "rust_web", "elixir_phoenix"},
            "database": {"postgresql", "mysql", "mongodb", "redis", "sqlite", "supabase",
                        "firebase", "timescaledb", "elasticsearch", "neon", "turso",
                        "pinecone", "chromadb", "weaviate", "qdrant"},
            "orm": {"prisma", "drizzle", "sqlalchemy", "typeorm"},
            "infrastructure": {"docker", "kubernetes", "terraform", "pulumi", "serverless_fw",
                              "cloudflare_workers", "aws_cdk", "aws_sam", "vercel", "netlify",
                              "railway", "render", "fly_io"},
            "ai_ml": {"langchain", "llamaindex", "openai_sdk", "anthropic_sdk", "huggingface",
                     "pytorch", "tensorflow", "scikit_learn", "crewai", "autogen"},
            "testing": {"jest", "vitest", "pytest", "cypress", "playwright_test", "mocha", "storybook"},
            "monitoring": {"sentry", "datadog", "prometheus", "grafana", "opentelemetry"},
        }

        result = {layer: [] for layer in layers}
        result["other"] = []
        for tech, score in tech_sorted:
            if score < 0.25:
                continue
            placed = False
            for layer, techs in layers.items():
                if tech in techs:
                    result[layer].append(tech)
                    placed = True
                    break
            if not placed:
                result["other"].append(tech)

        return {k: v for k, v in result.items() if v}

    # ───────────────────────────────────────────────────────────────
    # ARCHITECTURE DETECTION
    # ───────────────────────────────────────────────────────────────
    def _detect_architecture(self) -> dict:
        detected = []

        for pattern, signals in self.ARCHITECTURE_SIGNALS.items():
            score = 0
            # Check files
            for f in signals.get("files", []):
                if self._has_file(f):
                    score += 1
            # Check dirs
            for d in signals.get("dirs", []):
                if self._has_dir(d):
                    score += 1
            # Check tech requirements
            for t in signals.get("tech_requires", []):
                if t in self.detected_tech:
                    score += 1
            for t in signals.get("tech_requires_any", []):
                if t in self.detected_tech:
                    score += 1
                    break
            # Content check (e.g., count services in docker-compose)
            cc = signals.get("content_check")
            if cc:
                for f in self.files:
                    if cc["file"] in f:
                        content = self._read_head(f, 200)
                        if content.count("image:") + content.count("build:") >= cc["min_services"]:
                            score += 2

            if score > 0:
                detected.append({"pattern": pattern, "confidence": min(score / 3, 1.0)})

        detected.sort(key=lambda x: -x["confidence"])
        primary = detected[0]["pattern"] if detected else "monolith"
        return {
            "primary": primary,
            "all_detected": detected[:4],
        }

    # ───────────────────────────────────────────────────────────────
    # MATURITY ASSESSMENT — 12 axes
    # ───────────────────────────────────────────────────────────────
    def _assess_maturity(self) -> dict:
        axes = {
            "testing":        self._has("test", "spec", "conftest"),
            "ci_cd":          self._has_dir(".github/workflows") or self._has_file(".gitlab-ci.yml"),
            "containerized":  self._has_file("Dockerfile") or self._has_file("docker-compose.yml"),
            "linting":        any(self._has_file(f) for f in [".eslintrc.js", ".eslintrc.json", "eslint.config.js", "biome.json", "ruff.toml", ".flake8", ".pylintrc"]),
            "type_safety":    self.file_stats.get("ts", 0) + self.file_stats.get("tsx", 0) > 0,
            "monitoring":     any(t in self.detected_tech for t in ["sentry", "datadog", "prometheus", "opentelemetry"]),
            "documentation":  self._has_dir("docs/") or self._has_file("README.md"),
            "env_management": self._has_file(".env.example") or self._has_file(".env.sample"),
            "security":       self._has_file("SECURITY.md") or self._has_file(".snyk"),
            "api_docs":       self._has_file("openapi.yaml") or self._has("swagger") or self._has("api/docs"),
            "migrations":     self._has_dir("migrations/") or self._has_file("alembic.ini") or self._has_dir("prisma/migrations"),
            "i18n":           self._has_dir("locales/") or self._has_dir("i18n/"),
        }

        score = sum(axes.values())
        if score <= 2: level = "prototype"
        elif score <= 4: level = "mvp"
        elif score <= 6: level = "growth"
        elif score <= 9: level = "production"
        else: level = "enterprise"

        return {"level": level, "score": score, "max_score": 12, "axes": axes}

    # ───────────────────────────────────────────────────────────────
    # COMPLEXITY ASSESSMENT
    # ───────────────────────────────────────────────────────────────
    def _assess_complexity(self, tech_sorted: list) -> dict:
        tech_count = sum(1 for _, v in tech_sorted if v > 0.25)
        languages = len([ext for ext, cnt in self.file_stats.items() if cnt > 3 and ext in
                        {"py", "ts", "tsx", "js", "jsx", "rb", "go", "rs", "java", "kt",
                         "swift", "dart", "cs", "php", "ex", "sol", "vue", "svelte"}])

        if tech_count <= 3 and len(self.files) < 50:
            level = "simple"
        elif tech_count <= 6 and len(self.files) < 200:
            level = "moderate"
        elif tech_count <= 12 and len(self.files) < 800:
            level = "complex"
        else:
            level = "enterprise"

        return {
            "level": level,
            "total_files": len(self.files),
            "technologies": tech_count,
            "languages": languages,
            "estimated_loc": sum(
                self.file_stats.get(ext, 0) * avg
                for ext, avg in [("py", 80), ("ts", 60), ("tsx", 80), ("js", 50),
                                ("jsx", 70), ("go", 60), ("rs", 70), ("java", 80)]
            ),
        }

    # ───────────────────────────────────────────────────────────────
    # SECURITY POSTURE
    # ───────────────────────────────────────────────────────────────
    def _assess_security(self) -> dict:
        has_auth = any(t in self.detected_tech for t in
                      ["auth0", "clerk", "nextauth", "lucia", "jwt", "oauth", "keycloak", "supertokens"])
        has_env_example = self._has_file(".env.example") or self._has_file(".env.sample")
        has_gitignore_env = False
        if self._has_file(".gitignore"):
            gi = self._read_head(".gitignore", 100)
            has_gitignore_env = ".env" in gi

        return {
            "has_auth": has_auth,
            "auth_provider": [t for t in ["auth0", "clerk", "nextauth", "lucia", "jwt", "oauth", "keycloak"]
                            if t in self.detected_tech],
            "env_secured": has_gitignore_env,
            "has_env_example": has_env_example,
            "has_security_policy": self._has_file("SECURITY.md"),
            "has_rate_limiting": self._has("rate_limit") or self._has("throttle"),
            "has_cors": self._has("cors"),
            "has_helmet": self._has_file("package.json") and "helmet" in self._read_head("package.json") if self._has_file("package.json") else False,
        }

    # ───────────────────────────────────────────────────────────────
    # HELPERS
    # ───────────────────────────────────────────────────────────────
    def _has(self, *keywords) -> bool:
        return any(kw in f.lower() for f in self.files for kw in keywords)

    def _has_file(self, name: str) -> bool:
        return any(name in f for f in self.files)

    def _has_dir(self, name: str) -> bool:
        return any(name.rstrip("/") in d for d in self.dirs)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    fp = ProjectFingerprinter(path)
    result = fp.scan()
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
