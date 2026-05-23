# Zone Guard

Sistema de clasificación de seguridad para archivos en proyectos de software. Previene ediciones accidentales en archivos críticos y mantiene un audit log de todos los cambios en zonas sensibles.

---

## Concepto de Zonas de Seguridad

En cualquier proyecto de software, no todos los archivos tienen el mismo nivel de riesgo. Un error en un archivo CSS se puede corregir fácilmente. Un error en el código de autenticación puede exponer datos de todos los usuarios. Un error en una migración de base de datos puede corromper datos de producción irreversiblemente.

**Zone Guard** establece un protocolo claro antes de tocar cualquier archivo:

```
¿Qué archivo voy a editar?
         │
         ▼
    ┌─────────────┐
    │ Clasificar  │ → ¿Coincide con patrones ROJA?
    └─────────────┘
         │ No
         ▼
    ¿Coincide con patrones AMARILLA?
         │ No
         ▼
    VERDE — Editar libremente
```

---

## Las Tres Zonas

### ZONA ROJA — Alto Riesgo

**Concepto:** Archivos cuya modificacion incorrecta puede causar:
- Brechas de seguridad (credenciales expuestas, bypass de auth)
- Pérdida irreversible de datos de producción
- Fallos de pago o transacciones financieras
- Caída completa del sistema en producción

**Protocolo antes de editar:**
```
⛔ ZONA ROJA detectada: {archivo}

Antes de continuar, confirma:
1. ¿Tienes autorización explícita para modificar este archivo?
2. ¿Qué comportamiento va a cambiar exactamente?
3. ¿Hay tests que cubran este código?
4. ¿Has revisado el impacto en otros módulos que dependen de este archivo?
5. ¿Hay un rollback plan si algo falla?

Describe brevemente el cambio y su impacto esperado para continuar.
```

**Tipos de archivos en ZONA ROJA:**

| Patron de archivo | Razon |
|-------------------|-------|
| `**/auth/**`, `*auth*.py`, `*auth*.ts` | Autenticación y autorización |
| `**/*password*`, `**/*passwd*` | Manejo de contraseñas |
| `**/*token*`, `**/*jwt*`, `**/*secret*` | Tokens y secretos |
| `**/*payment*`, `**/*billing*`, `**/*checkout*` | Pagos y facturación |
| `**/*crypto*`, `**/*encrypt*`, `**/*cipher*` | Criptografía |
| `**/permissions/**`, `**/*rbac*`, `**/*acl*` | Control de acceso |
| `**/production/**`, `**/prod/**` | Código exclusivo de producción |
| `**/*middleware*auth*` | Middleware de autenticación |
| `backend/src/auth/**` | Módulo auth del backend |
| `src/services/auth_service.py` | Servicio de autenticación |
| `src/middleware/auth*.py` | Middleware de auth |

**Ejemplos concretos en el proyecto trading bot:**
```
backend/src/services/auth_service.py        → ROJA
backend/src/middleware/auth_middleware.py   → ROJA
backend/src/services/binance_client.py     → ROJA (maneja API keys)
backend/src/config/settings.py             → ROJA (contiene secrets config)
frontend/src/contexts/AuthContext.tsx      → ROJA
frontend/src/services/api.ts               → ROJA (interceptors con tokens)
```

---

### ZONA AMARILLA — Riesgo Medio

**Concepto:** Archivos que requieren revisión cuidadosa antes de editar porque:
- Cambios incorrectos pueden ser difíciles de revertir
- Afectan el comportamiento del sistema en su conjunto
- Requieren coordinación con otros archivos o equipo
- Pueden afectar datos existentes en producción

**Protocolo antes de editar:**
```
⚠️ ZONA AMARILLA detectada: {archivo}

Checklist antes de continuar:
[ ] ¿Hay tests que verifiquen el comportamiento actual?
[ ] ¿Este cambio requiere una migración de datos?
[ ] ¿Hay un backup reciente de la base de datos?
[ ] ¿El cambio es compatible hacia atrás (backwards compatible)?
[ ] ¿Necesitas coordinar este cambio con otros desarrolladores?

Procede con cuidado. Documenta el cambio en el commit message.
```

**Tipos de archivos en ZONA AMARILLA:**

| Patron de archivo | Razon |
|-------------------|-------|
| `**/migrations/**`, `**/alembic/**` | Migraciones de DB — irreversibles sin backup |
| `**/*migration*` | Cualquier archivo de migración |
| `**/config/**`, `**/*config*.json`, `**/*config*.yaml` | Configuración del sistema |
| `.env*`, `**/*.env` | Variables de entorno |
| `**/docker-compose*.yml` | Configuración de infraestructura |
| `**/k8s/**`, `**/kubernetes/**` | Configuración de Kubernetes |
| `**/terraform/**` | Infraestructura como código |
| `**/scripts/**` | Scripts de mantenimiento o deployment |
| `**/seeds/**`, `**/*seed*` | Datos de seed de BD |
| `package.json`, `pyproject.toml`, `requirements.txt` | Dependencias del proyecto |
| `**/routes/**`, `**/api/**` | Definición de rutas de API (contratos públicos) |
| `**/schemas/**`, `**/models/**` | Modelos de datos y esquemas |
| `tsconfig.json`, `vite.config.ts`, `webpack.config.js` | Configuración de build |
| `**/middleware/**` (no auth) | Middleware del sistema |

**Ejemplos en el proyecto trading bot:**
```
backend/alembic/versions/**                → AMARILLA
backend/src/models/**                      → AMARILLA
backend/src/schemas/**                     → AMARILLA
backend/.env                               → AMARILLA
docker-compose.yml                         → AMARILLA
backend/src/config/settings.py             → AMARILLA/ROJA (también secretos)
frontend/src/routes.tsx                    → AMARILLA (contratos de rutas)
frontend/vite.config.ts                   → AMARILLA
```

---

### ZONA VERDE — Bajo Riesgo

**Concepto:** Archivos donde un error es fácilmente detectable y reversible. La edición no requiere protocolo especial.

**Protocolo:** Proceder normalmente. Buenas prácticas habituales.

**Tipos de archivos en ZONA VERDE:**

| Patron de archivo | Razon |
|-------------------|-------|
| `**/*.css`, `**/*.scss`, `**/*.sass` | Estilos — errores visibles y reversibles |
| `**/styles/**`, `**/assets/**` | Assets y estilos |
| `docs/**`, `**/*.md`, `README*` | Documentación |
| `**/__tests__/**`, `**/*.test.*`, `**/*.spec.*` | Tests — no van a producción directamente |
| `**/stories/**`, `**/*.stories.*` | Storybook |
| `**/.gitignore`, `**/.prettierrc`, `**/.eslintrc*` | Configuración de herramientas de dev |
| `**/locales/**`, `**/i18n/**` | Traducciones |
| `**/public/**` (no config) | Assets públicos estáticos |
| `frontend/src/components/ui/**` | Componentes UI genéricos sin lógica de negocio |
| `frontend/src/styles/**` | Estilos del frontend |

**Ejemplos en el proyecto trading bot:**
```
frontend/src/index.css                     → VERDE
frontend/src/components/ui/button.tsx      → VERDE
frontend/src/styles/**                     → VERDE
docs/**                                    → VERDE
tests/**                                   → VERDE
*.md                                       → VERDE
frontend/public/**                         → VERDE
```

---

## Configuracion por Proyecto: .zone-guard.json

Cada proyecto puede personalizar las zonas creando un archivo `.zone-guard.json` en la raíz:

```json
{
  "$schema": "https://devlmer.com/schemas/zone-guard.json",
  "version": "1.0",
  "project": "bot-trading",
  "description": "Zone Guard configuration for cryptocurrency trading bot",
  
  "red": {
    "description": "Critical security and financial files - require explicit authorization",
    "patterns": [
      "backend/src/auth/**",
      "backend/src/middleware/auth*.py",
      "backend/src/services/auth_service.py",
      "backend/src/services/binance_client.py",
      "frontend/src/contexts/AuthContext.tsx",
      "frontend/src/services/api.ts",
      "**/src/**/*password*",
      "**/src/**/*token*",
      "**/src/**/*secret*",
      "**/src/**/*payment*",
      "**/src/**/*billing*",
      "**/*encrypt*",
      "**/*cipher*",
      "**/permissions/**",
      "**/rbac/**"
    ],
    "require_confirmation": true,
    "audit_log": true,
    "prompt": "⛔ ZONA ROJA: {file}\n\nEste archivo maneja seguridad, autenticación o datos financieros críticos.\n\n¿Cuál es el cambio exacto que vas a hacer y por qué?"
  },
  
  "yellow": {
    "description": "Configuration and infrastructure files - review before editing",
    "patterns": [
      "backend/alembic/**",
      "backend/src/models/**",
      "backend/src/schemas/**",
      "backend/.env*",
      "backend/src/config/**",
      "docker-compose*.yml",
      "frontend/src/routes.tsx",
      "frontend/vite.config.*",
      "frontend/tsconfig*.json",
      "**/migrations/**",
      "**/k8s/**",
      "package.json",
      "pyproject.toml",
      "requirements*.txt"
    ],
    "require_confirmation": false,
    "audit_log": true,
    "prompt": "⚠️ ZONA AMARILLA: {file}\n\nEste archivo afecta la configuración o estructura del sistema.\n\nChecklist: ¿tests cubriendo esto? ¿backup reciente? ¿backwards compatible?"
  },
  
  "green": {
    "description": "Low-risk files - edit freely",
    "patterns": [
      "frontend/src/**/*.css",
      "frontend/src/**/*.scss",
      "frontend/src/styles/**",
      "frontend/public/**",
      "frontend/src/components/ui/**",
      "docs/**",
      "**/*.md",
      "tests/**",
      "**/*.test.*",
      "**/*.spec.*",
      ".gitignore",
      ".prettierrc*",
      ".eslintrc*"
    ],
    "require_confirmation": false,
    "audit_log": false,
    "prompt": null
  },
  
  "settings": {
    "default_zone": "yellow",
    "audit_log_path": ".zone-guard/audit.log",
    "notify_on_red": true,
    "block_on_red": false,
    "exceptions": [
      {
        "pattern": "backend/src/auth/tests/**",
        "override_zone": "green",
        "reason": "Test files in auth are safe to edit"
      }
    ]
  }
}
```

---

## Protocolo de Verificacion Completo

### Script Python — zone-guard CLI

```python
#!/usr/bin/env python3
"""
scripts/zone_guard.py
Verificador de zona de seguridad para archivos.

Uso:
    python scripts/zone_guard.py backend/src/auth/service.py
    python scripts/zone_guard.py --list-zones
    python scripts/zone_guard.py --audit
    python scripts/zone_guard.py --check-all  # Analiza archivos staged en git
"""
import json
import fnmatch
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import Optional
from enum import Enum


class Zone(Enum):
    RED = "red"
    YELLOW = "yellow"
    GREEN = "green"
    UNKNOWN = "unknown"


ZONE_COLORS = {
    Zone.RED: "\033[91m",      # Rojo
    Zone.YELLOW: "\033[93m",   # Amarillo
    Zone.GREEN: "\033[92m",    # Verde
    Zone.UNKNOWN: "\033[97m",  # Blanco
}
RESET = "\033[0m"
BOLD = "\033[1m"


# Clasificación por defecto (sin .zone-guard.json)
DEFAULT_RED_PATTERNS = [
    "**/auth/**",
    "**/*auth*.py",
    "**/*auth*.ts",
    "**/*auth*.tsx",
    "**/*password*",
    "**/*passwd*",
    "**/*token*",
    "**/*jwt*",
    "**/*secret*",
    "**/*payment*",
    "**/*billing*",
    "**/*checkout*",
    "**/*crypto*",
    "**/*encrypt*",
    "**/*cipher*",
    "**/permissions/**",
    "**/rbac/**",
    "**/acl/**",
]

DEFAULT_YELLOW_PATTERNS = [
    "**/migrations/**",
    "**/alembic/**",
    "**/*migration*",
    "**/config/**",
    "**/*config*.json",
    "**/*config*.yaml",
    "**/*config*.toml",
    ".env*",
    "**/*.env",
    "**/docker-compose*.yml",
    "**/k8s/**",
    "**/kubernetes/**",
    "**/terraform/**",
    "**/scripts/**",
    "**/seeds/**",
    "**/*seed*",
    "package.json",
    "pyproject.toml",
    "requirements*.txt",
    "**/routes/**",
    "**/api/**",
    "**/schemas/**",
    "**/models/**",
    "tsconfig*.json",
    "vite.config.*",
    "webpack.config.*",
    "**/middleware/**",
]

DEFAULT_GREEN_PATTERNS = [
    "**/*.css",
    "**/*.scss",
    "**/*.sass",
    "**/styles/**",
    "**/assets/**",
    "docs/**",
    "**/*.md",
    "README*",
    "**/__tests__/**",
    "**/*.test.*",
    "**/*.spec.*",
    "**/stories/**",
    "**/*.stories.*",
    ".gitignore",
    ".prettierrc*",
    ".eslintrc*",
    "**/locales/**",
    "**/i18n/**",
    "**/public/**",
]


def load_config(project_root: Path) -> Optional[dict]:
    """Carga .zone-guard.json si existe."""
    config_path = project_root / ".zone-guard.json"
    if config_path.exists():
        return json.loads(config_path.read_text())
    return None


def matches_pattern(filepath: str, patterns: list[str]) -> bool:
    """Verifica si un filepath coincide con algún patrón glob."""
    normalized = filepath.replace("\\", "/")
    for pattern in patterns:
        pattern_normalized = pattern.replace("\\", "/")
        if fnmatch.fnmatch(normalized, pattern_normalized):
            return True
        # También verificar contra el nombre del archivo solamente
        if fnmatch.fnmatch(Path(normalized).name, pattern_normalized.split("/")[-1]):
            return True
    return False


def classify_file(filepath: str, config: Optional[dict] = None) -> Zone:
    """Clasifica un archivo en una zona de seguridad."""
    if config:
        # Usar configuración personalizada del proyecto
        red_patterns = config.get("red", {}).get("patterns", DEFAULT_RED_PATTERNS)
        yellow_patterns = config.get("yellow", {}).get("patterns", DEFAULT_YELLOW_PATTERNS)
        green_patterns = config.get("green", {}).get("patterns", DEFAULT_GREEN_PATTERNS)
        
        # Verificar excepciones primero
        exceptions = config.get("settings", {}).get("exceptions", [])
        for exc in exceptions:
            if matches_pattern(filepath, [exc["pattern"]]):
                zone_str = exc.get("override_zone", "green")
                return Zone(zone_str)
    else:
        red_patterns = DEFAULT_RED_PATTERNS
        yellow_patterns = DEFAULT_YELLOW_PATTERNS
        green_patterns = DEFAULT_GREEN_PATTERNS
    
    # Clasificar en orden de prioridad: ROJA > AMARILLA > VERDE
    if matches_pattern(filepath, red_patterns):
        return Zone.RED
    if matches_pattern(filepath, yellow_patterns):
        return Zone.YELLOW
    if matches_pattern(filepath, green_patterns):
        return Zone.GREEN
    
    # Default: AMARILLA si no hay config, o el default configurado
    default = config.get("settings", {}).get("default_zone", "yellow") if config else "yellow"
    return Zone(default)


def get_zone_prompt(zone: Zone, filepath: str, config: Optional[dict] = None) -> str:
    """Genera el mensaje de prompt para la zona."""
    if config:
        prompt_template = config.get(zone.value, {}).get("prompt")
        if prompt_template:
            return prompt_template.replace("{file}", filepath)
    
    prompts = {
        Zone.RED: f"""
{ZONE_COLORS[Zone.RED]}{BOLD}⛔ ZONA ROJA: {filepath}{RESET}

Este archivo maneja seguridad crítica, autenticación, o datos financieros.
Un error aquí puede comprometer a todos los usuarios o datos de producción.

Antes de continuar, responde:
  1. ¿Cuál es el cambio exacto que vas a hacer?
  2. ¿Qué comportamiento cambia y qué permanece igual?
  3. ¿Existen tests que cubran este código?
  4. ¿Has revisado las dependencias de este archivo?
  5. ¿Tienes un rollback plan?

Si no puedes responder estas preguntas, NO edites este archivo ahora.
""",
        Zone.YELLOW: f"""
{ZONE_COLORS[Zone.YELLOW]}{BOLD}⚠️ ZONA AMARILLA: {filepath}{RESET}

Este archivo afecta la configuración, estructura de datos, o infraestructura del sistema.

Checklist antes de editar:
  [ ] ¿Hay tests que cubran el comportamiento actual?
  [ ] ¿Este cambio es backwards compatible?
  [ ] Si es una migración: ¿hay backup reciente de la BD?
  [ ] ¿Necesitas coordinar con otros desarrolladores?
  [ ] ¿El cambio requiere actualizar documentación?

Procede con cuidado. Documenta bien el commit.
""",
    }
    return prompts.get(zone, "")


def write_audit_log(filepath: str, zone: Zone, action: str, config: Optional[dict] = None):
    """Escribe entrada en el audit log."""
    if config:
        should_log = config.get(zone.value, {}).get("audit_log", False)
        log_path = config.get("settings", {}).get("audit_log_path", ".zone-guard/audit.log")
    else:
        should_log = zone == Zone.RED
        log_path = ".zone-guard/audit.log"
    
    if not should_log:
        return
    
    log_file = Path(log_path)
    log_file.parent.mkdir(parents=True, exist_ok=True)
    
    entry = {
        "timestamp": datetime.now().isoformat(),
        "file": filepath,
        "zone": zone.value,
        "action": action,
        "user": os.environ.get("USER", "unknown"),
        "session": os.environ.get("TERM_SESSION_ID", "unknown"),
    }
    
    with open(log_file, "a") as f:
        f.write(json.dumps(entry) + "\n")


def check_file(filepath: str, verbose: bool = True) -> Zone:
    """Verifica y muestra la zona de un archivo."""
    project_root = Path.cwd()
    config = load_config(project_root)
    zone = classify_file(filepath, config)
    
    if verbose:
        color = ZONE_COLORS[zone]
        zone_labels = {
            Zone.RED: "⛔ ROJA",
            Zone.YELLOW: "⚠️  AMARILLA",
            Zone.GREEN: "✅ VERDE",
            Zone.UNKNOWN: "❓ DESCONOCIDA",
        }
        print(f"{color}{BOLD}{zone_labels[zone]}{RESET} — {filepath}")
        
        prompt = get_zone_prompt(zone, filepath, config)
        if prompt:
            print(prompt)
    
    write_audit_log(filepath, zone, "checked", config)
    return zone


def check_staged_files():
    """Verifica todos los archivos staged en git."""
    import subprocess
    
    try:
        result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            capture_output=True, text=True, check=True
        )
        staged_files = result.stdout.strip().split("\n")
        staged_files = [f for f in staged_files if f]
    except subprocess.CalledProcessError:
        print("No se pudo obtener archivos staged de git.")
        return
    
    if not staged_files:
        print("No hay archivos staged.")
        return
    
    print(f"\nVerificando {len(staged_files)} archivo(s) staged:\n")
    
    red_files = []
    yellow_files = []
    green_files = []
    
    for filepath in staged_files:
        zone = check_file(filepath, verbose=False)
        if zone == Zone.RED:
            red_files.append(filepath)
        elif zone == Zone.YELLOW:
            yellow_files.append(filepath)
        else:
            green_files.append(filepath)
    
    if red_files:
        print(f"{ZONE_COLORS[Zone.RED]}{BOLD}⛔ ZONA ROJA ({len(red_files)} archivos):{RESET}")
        for f in red_files:
            print(f"   {ZONE_COLORS[Zone.RED]}• {f}{RESET}")
        print()
    
    if yellow_files:
        print(f"{ZONE_COLORS[Zone.YELLOW]}{BOLD}⚠️  ZONA AMARILLA ({len(yellow_files)} archivos):{RESET}")
        for f in yellow_files:
            print(f"   {ZONE_COLORS[Zone.YELLOW]}• {f}{RESET}")
        print()
    
    if green_files:
        print(f"{ZONE_COLORS[Zone.GREEN]}{BOLD}✅ ZONA VERDE ({len(green_files)} archivos):{RESET}")
        for f in green_files:
            print(f"   {ZONE_COLORS[Zone.GREEN]}• {f}{RESET}")
        print()
    
    if red_files:
        print(f"{ZONE_COLORS[Zone.RED]}{BOLD}ADVERTENCIA: Tienes archivos en ZONA ROJA en este commit.{RESET}")
        print("Asegúrate de haber revisado todos los cambios de seguridad.")


def show_audit_log(lines: int = 50):
    """Muestra el audit log reciente."""
    log_path = Path(".zone-guard/audit.log")
    if not log_path.exists():
        print("No hay audit log todavía.")
        return
    
    entries = log_path.read_text().strip().split("\n")
    entries = [json.loads(e) for e in entries if e]
    entries = entries[-lines:]
    
    print(f"\nÚltimas {len(entries)} entradas del audit log:\n")
    print(f"{'Timestamp':<25} {'Zona':<10} {'Archivo':<50} {'Usuario':<15}")
    print("-" * 100)
    
    for entry in entries:
        zone = entry.get("zone", "unknown")
        color = ZONE_COLORS.get(Zone(zone) if zone in [z.value for z in Zone] else Zone.UNKNOWN)
        print(
            f"{entry['timestamp'][:19]:<25} "
            f"{color}{zone.upper():<10}{RESET} "
            f"{entry['file']:<50} "
            f"{entry.get('user', 'unknown'):<15}"
        )


def list_zones():
    """Lista todos los patrones por zona."""
    project_root = Path.cwd()
    config = load_config(project_root)
    
    if config:
        print("Usando configuración de .zone-guard.json\n")
        for zone_name in ["red", "yellow", "green"]:
            zone_config = config.get(zone_name, {})
            patterns = zone_config.get("patterns", [])
            zone = Zone(zone_name)
            color = ZONE_COLORS[zone]
            print(f"{color}{BOLD}{zone_name.upper()}:{RESET}")
            for pattern in patterns:
                print(f"  • {pattern}")
            print()
    else:
        print("No hay .zone-guard.json — usando clasificación por defecto\n")
        print(f"{ZONE_COLORS[Zone.RED]}{BOLD}ROJA:{RESET}")
        for p in DEFAULT_RED_PATTERNS:
            print(f"  • {p}")
        print(f"\n{ZONE_COLORS[Zone.YELLOW]}{BOLD}AMARILLA:{RESET}")
        for p in DEFAULT_YELLOW_PATTERNS:
            print(f"  • {p}")
        print(f"\n{ZONE_COLORS[Zone.GREEN]}{BOLD}VERDE:{RESET}")
        for p in DEFAULT_GREEN_PATTERNS:
            print(f"  • {p}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Zone Guard — Security zone checker")
    parser.add_argument("file", nargs="?", help="Archivo a verificar")
    parser.add_argument("--check-all", action="store_true", help="Verificar archivos staged en git")
    parser.add_argument("--audit", action="store_true", help="Mostrar audit log")
    parser.add_argument("--list-zones", action="store_true", help="Listar todos los patrones por zona")
    args = parser.parse_args()
    
    if args.check_all:
        check_staged_files()
    elif args.audit:
        show_audit_log()
    elif args.list_zones:
        list_zones()
    elif args.file:
        zone = check_file(args.file)
        sys.exit(0 if zone != Zone.RED else 1)
    else:
        parser.print_help()
```

---

## Integracion con Claude Code Hooks (PreToolUse)

### Hook de pre-edicion

```python
# .claude/hooks/pre_tool_use.py
"""
Hook que se ejecuta ANTES de cualquier uso de herramienta Edit/Write/Bash.
Verifica la zona de seguridad del archivo que se va a editar.
"""
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../scripts"))

from zone_guard import classify_file, Zone, load_config, get_zone_prompt, write_audit_log
from pathlib import Path


def check_tool_use(tool_name: str, tool_input: dict) -> dict:
    """
    Retorna:
        {"allow": True}  — permitir la acción
        {"allow": False, "message": "..."}  — bloquear con mensaje
        {"allow": True, "warning": "..."}  — permitir con advertencia
    """
    # Solo nos importa Edit, Write, y algunos comandos Bash
    if tool_name not in ["Edit", "Write"]:
        if tool_name == "Bash":
            command = tool_input.get("command", "")
            # Verificar si el comando edita archivos críticos
            if not any(cmd in command for cmd in ["echo >", "cat >", "tee ", "> "]):
                return {"allow": True}
        else:
            return {"allow": True}
    
    # Extraer el filepath
    filepath = tool_input.get("file_path") or tool_input.get("path")
    if not filepath:
        return {"allow": True}
    
    # Clasificar el archivo
    project_root = Path.cwd()
    config = load_config(project_root)
    zone = classify_file(filepath, config)
    
    # Audit log
    write_audit_log(filepath, zone, f"tool:{tool_name}", config)
    
    if zone == Zone.RED:
        prompt = get_zone_prompt(zone, filepath, config)
        
        # En modo block: bloquear y requerir confirmación explícita
        block_on_red = config.get("settings", {}).get("block_on_red", False) if config else False
        
        if block_on_red:
            return {
                "allow": False,
                "message": prompt,
            }
        else:
            # Mostrar advertencia pero permitir
            return {
                "allow": True,
                "warning": prompt,
            }
    
    elif zone == Zone.YELLOW:
        prompt = get_zone_prompt(zone, filepath, config)
        return {
            "allow": True,
            "warning": prompt,
        }
    
    return {"allow": True}


# Punto de entrada para el hook
if __name__ == "__main__":
    input_data = json.loads(sys.stdin.read())
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    
    result = check_tool_use(tool_name, tool_input)
    print(json.dumps(result))
```

---

## Audit Log — Formato y Analisis

### Formato del log

```jsonl
{"timestamp": "2026-05-02T10:15:32", "file": "backend/src/auth/service.py", "zone": "red", "action": "tool:Edit", "user": "pierre", "session": "abc123"}
{"timestamp": "2026-05-02T10:16:01", "file": "backend/alembic/versions/001_add_index.py", "zone": "yellow", "action": "tool:Write", "user": "pierre", "session": "abc123"}
{"timestamp": "2026-05-02T11:22:44", "file": "frontend/src/styles/globals.css", "zone": "green", "action": "tool:Edit", "user": "pierre", "session": "def456"}
```

### Comandos de análisis del audit log

```bash
# Ver todos los accesos a ZONA ROJA hoy
grep '"zone": "red"' .zone-guard/audit.log | grep "$(date +%Y-%m-%d)"

# Contar ediciones por zona
python3 -c "
import json
from pathlib import Path
from collections import Counter

entries = [json.loads(l) for l in Path('.zone-guard/audit.log').read_text().strip().split('\n') if l]
zones = Counter(e['zone'] for e in entries)
print('Accesos por zona:')
for zone, count in zones.most_common():
    print(f'  {zone}: {count}')
"

# Ver archivos más editados en zona roja (posibles hotspots de riesgo)
grep '"zone": "red"' .zone-guard/audit.log | python3 -c "
import json, sys
from collections import Counter
entries = [json.loads(l) for l in sys.stdin if l.strip()]
files = Counter(e['file'] for e in entries)
print('Top 10 archivos ROJA más accedidos:')
for f, count in files.most_common(10):
    print(f'  {count:3d}x  {f}')
"
```

---

## Configuracion Rapida en un Proyecto Nuevo

```bash
# 1. Copiar el script
mkdir -p scripts .zone-guard
cp path/to/zone_guard.py scripts/

# 2. Crear configuración básica
cat > .zone-guard.json << 'EOF'
{
  "version": "1.0",
  "red": {
    "patterns": ["**/auth/**", "**/*password*", "**/*token*", "**/*secret*", "**/*payment*"],
    "audit_log": true
  },
  "yellow": {
    "patterns": ["**/migrations/**", "**/config/**", ".env*", "docker-compose*.yml", "**/models/**"],
    "audit_log": true
  },
  "green": {
    "patterns": ["**/*.css", "docs/**", "**/*.md", "**/*.test.*", "**/*.spec.*"],
    "audit_log": false
  },
  "settings": {
    "default_zone": "yellow",
    "audit_log_path": ".zone-guard/audit.log",
    "block_on_red": false
  }
}
EOF

# 3. Añadir al .gitignore (el log no se versiona, o sí — decisión del equipo)
echo ".zone-guard/audit.log" >> .gitignore

# 4. Verificar un archivo
python scripts/zone_guard.py backend/src/auth/service.py

# 5. Verificar todos los archivos staged antes de un commit
python scripts/zone_guard.py --check-all

# 6. Añadir como git hook pre-commit
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
python scripts/zone_guard.py --check-all
EOF
chmod +x .git/hooks/pre-commit
```

---

## Casos de Uso Practicos

### Caso 1: Claude va a editar un archivo de auth

```
Claude detecta: Voy a editar backend/src/auth/auth_service.py

Zone Guard evalúa: auth_service.py → coincide con **/auth/** → ZONA ROJA

Claude muestra:
⛔ ZONA ROJA: backend/src/auth/auth_service.py

Este archivo maneja autenticación crítica.

Antes de continuar, confirma:
1. ¿Cuál es el cambio exacto?
2. ¿Hay tests que cubran este código?
...

[Claude espera confirmación o describe el cambio antes de proceder]
```

### Caso 2: Migración de base de datos

```
Claude detecta: Voy a crear backend/alembic/versions/002_add_portfolio_table.py

Zone Guard evalúa: alembic/versions/ → coincide con **/alembic/** → ZONA AMARILLA

Claude muestra:
⚠️ ZONA AMARILLA: alembic/versions/002_add_portfolio_table.py

Checklist antes de crear esta migración:
[ ] ¿Hay backup de la BD antes de aplicar?
[ ] ¿La migración tiene rollback (downgrade)?
[ ] ¿Has probado en entorno de desarrollo?

[Claude verifica y procede con cautela]
```

### Caso 3: Archivo CSS

```
Claude detecta: Voy a editar frontend/src/styles/dashboard.css

Zone Guard evalúa: *.css → coincide con **/*.css → ZONA VERDE

Claude procede directamente sin interrupciones.
```

---

## Resumen de Comandos

```bash
# Verificar un archivo específico
python scripts/zone_guard.py src/auth/service.py

# Verificar todos los archivos staged
python scripts/zone_guard.py --check-all

# Ver el audit log
python scripts/zone_guard.py --audit

# Listar todos los patrones configurados
python scripts/zone_guard.py --list-zones

# Ver archivos en zona roja que se van a commitear
git diff --cached --name-only | python3 -c "
import sys
sys.path.insert(0, 'scripts')
from zone_guard import classify_file, Zone
for f in sys.stdin.read().strip().split():
    if f and classify_file(f) == Zone.RED:
        print(f'⛔ ROJA: {f}')
"
```
