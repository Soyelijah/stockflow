# Project Intelligence — DEE Domain Fingerprinting

Skill que activa la inteligencia del ecosistema DEE para analizar el proyecto actual, detectar su stack tecnológico y dominio, y orquestar los skills y agentes correctos.

## Cuándo se activa

- Al inicio de sesión si no existe `PROJECT_PROFILE.json`
- Cuando el usuario pregunta sobre el stack o dominio del proyecto
- Cuando hay dudas sobre qué skills o agentes son relevantes
- Después de agregar nuevas tecnologías al proyecto

---

## Pipeline de Inteligencia

### Fase 1 — Fingerprinting

Ejecutar el fingerprinter de DEE:

```bash
python3 .claude/detect_project.py --path . --output .claude/PROJECT_PROFILE.json
```

El fingerprinter analiza:
- `package.json`, `pyproject.toml`, `Cargo.toml`, `pom.xml` → tecnologías
- Estructura de directorios → arquitectura (monorepo, fullstack, microservices)
- Patrones de código → frameworks específicos
- Tests, CI, Docker → madurez del proyecto

**Exclusiones importantes** (no se escanean para evitar auto-contaminación):
- `.claude/` — archivos del ecosistema DEE
- `node_modules/`, `.git/`, `dist/`, `build/`
- `devlmer-ecosystem-engine/`

### Fase 2 — Clasificación de Dominio

| Dominio | Señales clave | Skills primarios |
|---------|--------------|-----------------|
| `fintech` | binance, stripe, plaid, payments, trading | senior-backend, senior-security, senior-architect |
| `saas` | auth, subscriptions, multitenancy, billing | senior-backend, senior-frontend, senior-architect |
| `ecommerce` | cart, products, orders, checkout | senior-backend, senior-frontend, seo-optimizer |
| `chatbot` | whatsapp, twilio, dialogflow, socket.io | senior-backend, websocket-events, senior-security |
| `mobile_app` | react-native, flutter, expo | mobile-design, senior-frontend |
| `devtools` | cli, sdk, npm package, api | senior-backend, mcp-builder, senior-architect |
| `analytics` | dashboards, charts, metrics, reports | senior-frontend, senior-backend, ui-design-system |
| `ai_agent` | langchain, openai, anthropic, embeddings | senior-prompt-engineer, senior-backend |
| `healthcare` | hl7, fhir, hipaa, medical records | senior-security, senior-backend, senior-architect |
| `pos` | caja, productos, inventario, fiscal | senior-backend, senior-security |

### Fase 3 — Perfil generado

`PROJECT_PROFILE.json` contiene:

```json
{
  "engine_version": "3.1",
  "project_name": "mi-proyecto",
  "domain": "fintech",
  "domain_confidence": 0.87,
  "secondary_domains": ["saas"],
  "technologies": {
    "react": 0.95,
    "fastapi": 0.90,
    "postgresql": 0.85
  },
  "primary_stack": {
    "frontend": "React 19",
    "backend": "FastAPI",
    "database": "PostgreSQL + TimescaleDB"
  },
  "architecture": "fullstack",
  "maturity": {
    "has_tests": true,
    "has_ci": false,
    "has_docker": true
  },
  "complexity": "high",
  "active_skills": ["senior-backend", "senior-security", "senior-architect"],
  "suggested_agents": ["risk_agent", "compliance_agent"]
}
```

### Fase 4 — Auto-routing de Skills

Basado en el dominio y stack detectado, DEE activa automáticamente:

```
Dominio: fintech + Stack: FastAPI + React
→ Skills activos: senior-backend, senior-security, senior-architect, senior-frontend
→ Agentes sugeridos: risk_agent, compliance_agent, strategy_agent
→ MCPs relevantes: github, postgres, redis
```

---

## Comandos de diagnóstico

### Ver perfil actual
```bash
cat .claude/PROJECT_PROFILE.json | python3 -m json.tool
```

### Re-escanear proyecto
```bash
python3 .claude/detect_project.py --path . --verbose
```

### Ver skills activos para este proyecto
```bash
python3 .claude/orchestrate.py --summary
```

### Health check del ecosistema
```bash
# Verificar que todos los skills referenciados existen
python3 -c "
import json, os
profile = json.load(open('.claude/PROJECT_PROFILE.json'))
skills_dir = '.claude/skills'
for skill in profile.get('active_skills', []):
    path = os.path.join(skills_dir, skill, 'SKILL.md')
    status = '✅' if os.path.exists(path) else '❌ MISSING'
    print(f'  {status} {skill}')
"
```

---

## Actualizar perfil cuando cambia el stack

Cuando agregues una nueva tecnología al proyecto:

1. Re-ejecutar fingerprinter
2. Verificar que el dominio sigue siendo correcto
3. Actualizar skills activos si es necesario

```bash
# Después de npm install react-query o pip install celery, etc.
python3 .claude/detect_project.py --path . --output .claude/PROJECT_PROFILE.json --verbose
```

---

## Integración con SessionStart hook

DEE ejecuta automáticamente en cada sesión:

```python
# En SessionStart hook (config/settings.json)
import json, os

profile_path = ".claude/PROJECT_PROFILE.json"
if os.path.exists(profile_path):
    profile = json.load(open(profile_path))
    domain = profile.get("domain", "unknown")
    skills = profile.get("active_skills", [])
    print(f"🧠 Project Intelligence activo")
    print(f"   Dominio: {domain} (confianza: {profile.get('domain_confidence', 0):.0%})")
    print(f"   ✅ Skills activos: {', '.join(skills)}")
else:
    print("⚠️  Sin PROJECT_PROFILE.json — ejecuta: python3 .claude/detect_project.py")
```

---

## Troubleshooting

### Dominio clasificado incorrectamente
- Verifica que `.claude/` esté en la lista de exclusión del fingerprinter
- Aumenta señales del dominio correcto (keywords en README, nombres de carpetas)
- Usa `--verbose` para ver el scoring por dominio

### Skills equivocados activados
- Revisa `"domain_confidence"` — si es < 0.6, la detección es incierta
- Edita `PROJECT_PROFILE.json` manualmente para forzar el dominio correcto
- Re-ejecuta orchestrate.py

### Fingerprinter no detecta tecnología X
- El fingerprinter busca: archivos de configuración, extensiones de archivo, contenido de package.json
- Si falta, crea un issue en https://github.com/Soyelijah/devlmer-ecosystem-engine/issues
