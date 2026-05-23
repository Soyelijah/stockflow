# Changelog Agent

Skill completo para gestión de changelogs, versionado semántico, y release notes profesionales.

---

## Conventional Commits — Especificacion Completa

### Formato

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Tipos y sus efectos en semver

| Tipo | Descripcion | Bump semver | Ejemplo |
|------|-------------|-------------|---------|
| `feat` | Nueva funcionalidad | MINOR | `feat(auth): add OAuth2 Google login` |
| `fix` | Corrección de bug | PATCH | `fix(api): handle null user in session` |
| `perf` | Mejora de rendimiento | PATCH | `perf(db): add index on orders.created_at` |
| `refactor` | Refactorización sin cambio de comportamiento | PATCH | `refactor(services): extract validation logic` |
| `docs` | Documentación únicamente | PATCH | `docs: update API reference for /orders` |
| `style` | Formato, espacios, punto y coma (no lógica) | PATCH | `style: apply prettier formatting` |
| `test` | Añadir o corregir tests | PATCH | `test(auth): add missing coverage for logout` |
| `build` | Sistema de build, dependencias externas | PATCH | `build: upgrade fastapi to 0.110.0` |
| `ci` | Configuración de CI/CD | PATCH | `ci: add coverage report step to pipeline` |
| `chore` | Tareas de mantenimiento que no entran en otros tipos | PATCH | `chore: update .gitignore` |
| `revert` | Revertir un commit anterior | PATCH | `revert: feat(auth): add OAuth2 (breaks tests)` |

### Breaking Changes — MAJOR bump

Un breaking change se indica de dos formas:

```bash
# Forma 1: ! después del tipo (shorthand)
feat!: remove deprecated /api/v1/users endpoint

# Forma 2: Footer BREAKING CHANGE (permite más contexto)
feat(api): redesign authentication flow

Previously the login endpoint returned {token: string}.
Now it returns {access_token: string, refresh_token: string, expires_in: number}.

BREAKING CHANGE: The `token` field has been renamed to `access_token`.
Clients must update their token handling code.
Migration: replace `response.token` with `response.access_token`.
```

### Scopes recomendados por tipo de proyecto

```bash
# Trading bot
feat(auth): ...          # Autenticación
feat(trading): ...       # Lógica de trading
feat(orders): ...        # Gestión de órdenes
feat(portfolio): ...     # Portafolio
feat(risk): ...          # Risk management
fix(binance): ...        # Cliente Binance
fix(websocket): ...      # WebSocket
perf(db): ...            # Base de datos

# NestJS monorepo
feat(backend): ...
feat(admin-panel): ...
feat(website): ...
feat(widget): ...
fix(api): ...
ci(github): ...
```

---

## Versionado Semantico (semver)

```
MAJOR.MINOR.PATCH[-prerelease][+build]
 1  .  2  .  3  -alpha.1   +001
```

### Reglas de bump

```
PATCH bump cuando:
  - fix: cualquier bug fix
  - perf: mejora de rendimiento
  - refactor: sin cambio de API pública
  - docs, style, test, build, ci, chore

MINOR bump cuando:
  - feat: nueva funcionalidad compatible hacia atrás
  - deprecation: marcar algo como deprecated (pero aún funciona)

MAJOR bump cuando:
  - BREAKING CHANGE: cualquier tipo que rompa compatibilidad
  - Eliminar funcionalidad existente
  - Cambiar comportamiento de API existente
```

### Versiones pre-release

```bash
1.0.0-alpha.1      # Primera alpha, inestable
1.0.0-beta.1       # Beta, más estable que alpha
1.0.0-rc.1         # Release candidate, lista para producción si no hay bugs
1.0.0              # Release estable
```

---

## CHANGELOG.md — Keep a Changelog Standard

### Formato de archivo completo

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Feature en desarrollo que no ha sido lanzada aún

---

## [2.1.0] - 2026-05-02

### Added
- Portfolio real-time WebSocket con reconexión automática y exponential backoff
- Soporte para órdenes STOP_LOSS y TAKE_PROFIT en el motor de trading
- Dashboard de riesgo con métricas en tiempo real (VaR, Sharpe ratio, max drawdown)

### Changed
- El endpoint `GET /api/portfolio` ahora incluye campo `unrealized_pnl` en cada posición
- Tiempo de reconexión WebSocket reducido de 5s a 1s para primera reconexión

### Fixed
- Bug donde las órdenes de mercado fallaban silenciosamente al superar el límite de tasa Binance
- Error de autenticación intermitente cuando el token se refrescaba durante una request activa
- Cálculo incorrecto de PnL para posiciones en USDT con precio de entrada fraccional

### Security
- Tokens de API Binance ahora se cifran en reposo con AES-256 en lugar de almacenarse en texto
- Rate limiting implementado en endpoints de auth para prevenir fuerza bruta

---

## [2.0.0] - 2026-04-15

### Breaking Changes
- El campo `token` en la respuesta de login fue renombrado a `access_token`
- El endpoint `/api/v1/orders` fue reemplazado por `/api/orders` (sin versión en URL)
- Se requiere Python 3.11+ (antes 3.9+)

### Added
- Sistema de notificaciones en tiempo real vía WebSocket
- Soporte multi-exchange: Coinbase Pro (experimental)
- Auto-trading con estrategias configurables (Moving Average, RSI, Bollinger Bands)

### Removed
- Eliminado el endpoint deprecado `/api/v1/users/me` (usar `/api/users/profile`)
- Eliminada dependencia de `aiohttp` (reemplazado por `httpx`)

### Migration Guide
Ver [MIGRATION.md](./MIGRATION.md) para instrucciones detalladas de v1.x → v2.0.

---

## [1.5.2] - 2026-03-20

### Fixed
- Hotfix: Fix división por cero en cálculo de Sharpe ratio con portfolio vacío

---

## [1.5.1] - 2026-03-18

### Fixed
- Los WebSockets no se reconectaban después de timeout de 1 hora

---

## [1.5.0] - 2026-03-01

### Added
- Gráficos de velas (candlestick) con soporte TradingView Lightweight Charts
- Exportación de historial de trades a CSV

### Changed
- Mejorado el rendimiento del endpoint de portfolio (de 800ms a 120ms promedio)

---

[Unreleased]: https://github.com/user/repo/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/user/repo/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/user/repo/compare/v1.5.2...v2.0.0
[1.5.2]: https://github.com/user/repo/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/user/repo/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/user/repo/releases/tag/v1.5.0
```

### Secciones del CHANGELOG y qué va en cada una

| Seccion | Contenido |
|---------|-----------|
| **Added** | Nuevas funcionalidades (feat) |
| **Changed** | Cambios en funcionalidad existente que son compatibles hacia atrás |
| **Deprecated** | Funcionalidades que serán eliminadas en versiones futuras |
| **Removed** | Funcionalidades eliminadas en esta versión |
| **Fixed** | Bug fixes |
| **Security** | Vulnerabilidades corregidas |
| **Breaking Changes** | Solo en MAJOR versions, listar todo lo que rompe |
| **Performance** | Mejoras de rendimiento notables |

---

## Script Bash — Auto-generacion de CHANGELOG desde git log

```bash
#!/bin/bash
# scripts/generate-changelog.sh
# Uso: ./scripts/generate-changelog.sh [desde_tag] [hasta_ref]
# Ejemplo: ./scripts/generate-changelog.sh v1.5.0 HEAD

set -e

FROM_TAG="${1:-$(git describe --tags --abbrev=0 2>/dev/null || echo '')}"
TO_REF="${2:-HEAD}"
VERSION_DATE=$(date +%Y-%m-%d)

# Si no hay tags, usar el primer commit
if [ -z "$FROM_TAG" ]; then
    FROM_TAG=$(git rev-list --max-parents=0 HEAD)
fi

echo "Generando changelog desde $FROM_TAG hasta $TO_REF..."

# Función para extraer commits de un tipo
get_commits() {
    local type="$1"
    # Conventional commits: type(scope): description o type!: description
    git log "${FROM_TAG}..${TO_REF}" \
        --pretty=format:"%s" \
        --no-merges \
        | grep -E "^${type}(\(.+\))?!?:" \
        | sed "s/^${type}(\(.*\))!*: /- **\1**: /" \
        | sed "s/^${type}!*: /- /"
}

# Detectar breaking changes
BREAKING=$(git log "${FROM_TAG}..${TO_REF}" --pretty=format:"%s%n%b" --no-merges \
    | grep -E "(BREAKING CHANGE:|^.+!:)" || true)

# Determinar bump de versión
bump_type="patch"
if [ -n "$BREAKING" ]; then
    bump_type="major"
elif get_commits "feat" | grep -q "."; then
    bump_type="minor"
fi

echo ""
echo "Tipo de bump detectado: $bump_type"
echo ""

# Calcular nueva versión
CURRENT_VERSION=$(git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "0.0.0")
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]:-0}"
MINOR="${VERSION_PARTS[1]:-0}"
PATCH="${VERSION_PARTS[2]:-0}"

case $bump_type in
    major) NEW_VERSION="$((MAJOR + 1)).0.0" ;;
    minor) NEW_VERSION="${MAJOR}.$((MINOR + 1)).0" ;;
    patch) NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
esac

echo "Versión: $CURRENT_VERSION → $NEW_VERSION"
echo ""

# Generar secciones del changelog
ADDED=$(get_commits "feat")
FIXED=$(get_commits "fix")
PERF=$(get_commits "perf")
DOCS=$(get_commits "docs")
BUILD=$(get_commits "build")
CI=$(get_commits "ci")
REFACTOR=$(get_commits "refactor")
BREAKING_SECTION=""

if [ -n "$BREAKING" ]; then
    BREAKING_SECTION="\n### Breaking Changes\n\n$(echo "$BREAKING" | sed 's/BREAKING CHANGE: /- /')\n"
fi

# Construir entrada de changelog
CHANGELOG_ENTRY="## [${NEW_VERSION}] - ${VERSION_DATE}
${BREAKING_SECTION}"

[ -n "$ADDED" ] && CHANGELOG_ENTRY+="
### Added
${ADDED}
"

[ -n "$FIXED" ] && CHANGELOG_ENTRY+="
### Fixed
${FIXED}
"

[ -n "$PERF" ] && CHANGELOG_ENTRY+="
### Performance
${PERF}
"

[ -n "$REFACTOR" ] && CHANGELOG_ENTRY+="
### Changed
${REFACTOR}
"

[ -n "$DOCS" ] && CHANGELOG_ENTRY+="
### Documentation
${DOCS}
"

[ -n "$BUILD" ] || [ -n "$CI" ] && CHANGELOG_ENTRY+="
### Build
${BUILD}${CI}
"

echo "============================================"
echo "$CHANGELOG_ENTRY"
echo "============================================"

# Preguntar si insertar en CHANGELOG.md
read -p "¿Insertar en CHANGELOG.md? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Insertar después de la primera línea de ## [Unreleased]
    TEMP_FILE=$(mktemp)
    awk -v entry="$CHANGELOG_ENTRY" '
        /^## \[Unreleased\]/{print; found=1; next}
        found && /^---/{print "---"; print ""; print entry; found=0; next}
        {print}
    ' CHANGELOG.md > "$TEMP_FILE"
    mv "$TEMP_FILE" CHANGELOG.md
    echo "CHANGELOG.md actualizado."
    
    # Actualizar links al final del archivo
    REPO_URL=$(git remote get-url origin | sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')
    echo "[${NEW_VERSION}]: ${REPO_URL}/compare/v${CURRENT_VERSION}...v${NEW_VERSION}" >> CHANGELOG.md
fi

echo "Nueva versión sugerida: v${NEW_VERSION}"
```

---

## Script Python — Generador Avanzado de Changelog

```python
#!/usr/bin/env python3
"""
scripts/generate_changelog.py
Generador de changelog desde Conventional Commits.

Uso:
    python scripts/generate_changelog.py
    python scripts/generate_changelog.py --from v1.5.0 --to HEAD
    python scripts/generate_changelog.py --dry-run
    python scripts/generate_changelog.py --format github-release
"""
import subprocess
import re
import sys
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional
import argparse


@dataclass
class ConventionalCommit:
    type: str
    scope: Optional[str]
    description: str
    body: str
    is_breaking: bool
    breaking_description: Optional[str]
    hash: str
    author: str


SECTION_ORDER = [
    ("feat", "Added"),
    ("fix", "Fixed"),
    ("perf", "Performance"),
    ("refactor", "Changed"),
    ("security", "Security"),
    ("docs", "Documentation"),
    ("build", "Build"),
    ("ci", "CI/CD"),
    ("chore", "Maintenance"),
]

COMMIT_PATTERN = re.compile(
    r"^(?P<type>feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)"
    r"(?:\((?P<scope>[^)]+)\))?(?P<breaking>!)?"
    r": (?P<description>.+)$",
    re.IGNORECASE,
)


def run_git(command: str) -> str:
    result = subprocess.run(
        command.split(),
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def get_commits(from_ref: str, to_ref: str) -> list[ConventionalCommit]:
    """Obtiene y parsea commits conventional entre dos refs."""
    separator = "---COMMIT---"
    log_format = f"{separator}%H|%an|%s%n%b"
    
    try:
        raw = run_git(
            f"git log {from_ref}..{to_ref} --pretty=format:{log_format} --no-merges"
        )
    except subprocess.CalledProcessError:
        return []
    
    commits = []
    for raw_commit in raw.split(separator):
        if not raw_commit.strip():
            continue
        
        lines = raw_commit.strip().splitlines()
        if not lines:
            continue
        
        first_line = lines[0]
        parts = first_line.split("|", 2)
        if len(parts) < 3:
            continue
        
        commit_hash, author, subject = parts
        body = "\n".join(lines[1:]).strip()
        
        match = COMMIT_PATTERN.match(subject)
        if not match:
            continue
        
        # Detectar breaking change en footer
        breaking_match = re.search(r"BREAKING CHANGE: (.+)", body, re.DOTALL)
        is_breaking = bool(match.group("breaking")) or breaking_match is not None
        breaking_desc = breaking_match.group(1).strip() if breaking_match else None
        
        commits.append(ConventionalCommit(
            type=match.group("type").lower(),
            scope=match.group("scope"),
            description=match.group("description"),
            body=body,
            is_breaking=is_breaking,
            breaking_description=breaking_desc or (subject if is_breaking else None),
            hash=commit_hash[:8],
            author=author,
        ))
    
    return commits


def determine_bump(commits: list[ConventionalCommit]) -> str:
    if any(c.is_breaking for c in commits):
        return "major"
    if any(c.type == "feat" for c in commits):
        return "minor"
    return "patch"


def bump_version(current: str, bump: str) -> str:
    current = current.lstrip("v")
    parts = current.split(".")
    major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2].split("-")[0])
    
    if bump == "major":
        return f"{major + 1}.0.0"
    elif bump == "minor":
        return f"{major}.{minor + 1}.0"
    else:
        return f"{major}.{minor}.{patch + 1}"


def format_commit_line(commit: ConventionalCommit) -> str:
    scope_part = f"**{commit.scope}**: " if commit.scope else ""
    return f"- {scope_part}{commit.description} (`{commit.hash}`)"


def generate_changelog_entry(
    version: str,
    commits: list[ConventionalCommit],
    release_date: str = None,
) -> str:
    release_date = release_date or date.today().isoformat()
    lines = [f"## [{version}] - {release_date}", ""]
    
    # Breaking changes primero
    breaking = [c for c in commits if c.is_breaking]
    if breaking:
        lines.append("### Breaking Changes")
        lines.append("")
        for commit in breaking:
            desc = commit.breaking_description or commit.description
            lines.append(f"- {desc}")
        lines.append("")
    
    # Resto de secciones en orden
    for commit_type, section_name in SECTION_ORDER:
        type_commits = [
            c for c in commits
            if c.type == commit_type and not c.is_breaking
        ]
        if type_commits:
            lines.append(f"### {section_name}")
            lines.append("")
            for commit in type_commits:
                lines.append(format_commit_line(commit))
            lines.append("")
    
    return "\n".join(lines)


def generate_github_release_notes(
    version: str,
    commits: list[ConventionalCommit],
) -> str:
    """Formato para GitHub Releases — más narrativo y orientado al usuario."""
    lines = [f"# Release v{version}", ""]
    
    # Resumen ejecutivo
    n_feat = sum(1 for c in commits if c.type == "feat")
    n_fix = sum(1 for c in commits if c.type == "fix")
    breaking = [c for c in commits if c.is_breaking]
    
    if breaking:
        lines.append(f"> ⚠️ This is a **breaking release** with {len(breaking)} breaking change(s).")
        lines.append("")
    
    summary_parts = []
    if n_feat: summary_parts.append(f"{n_feat} new feature{'s' if n_feat > 1 else ''}")
    if n_fix: summary_parts.append(f"{n_fix} bug fix{'es' if n_fix > 1 else ''}")
    
    if summary_parts:
        lines.append(f"This release includes {' and '.join(summary_parts)}.")
        lines.append("")
    
    lines.append("## What's Changed")
    lines.append("")
    
    # Secciones
    for commit_type, section_name in SECTION_ORDER:
        type_commits = [c for c in commits if c.type == commit_type]
        if type_commits:
            lines.append(f"### {section_name}")
            for commit in type_commits:
                lines.append(format_commit_line(commit))
            lines.append("")
    
    if breaking:
        lines.append("## Migration Guide")
        lines.append("")
        for commit in breaking:
            lines.append(f"### {commit.description}")
            if commit.breaking_description:
                lines.append("")
                lines.append(commit.breaking_description)
            lines.append("")
    
    lines.append("**Full Changelog**: Compare view in GitHub")
    
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Generate CHANGELOG from conventional commits")
    parser.add_argument("--from", dest="from_ref", default=None)
    parser.add_argument("--to", dest="to_ref", default="HEAD")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--format", choices=["changelog", "github-release"], default="changelog")
    args = parser.parse_args()
    
    # Determinar from_ref
    from_ref = args.from_ref
    if not from_ref:
        try:
            from_ref = run_git("git describe --tags --abbrev=0")
        except subprocess.CalledProcessError:
            from_ref = run_git("git rev-list --max-parents=0 HEAD")
    
    print(f"Analizando commits: {from_ref}..{args.to_ref}")
    
    commits = get_commits(from_ref, args.to_ref)
    if not commits:
        print("No se encontraron conventional commits en el rango especificado.")
        sys.exit(0)
    
    bump = determine_bump(commits)
    current_version = from_ref.lstrip("v") if from_ref else "0.0.0"
    
    try:
        new_version = bump_version(current_version, bump)
    except (ValueError, IndexError):
        new_version = "1.0.0"
    
    print(f"Tipo de bump: {bump.upper()} → v{new_version}")
    print(f"Commits analizados: {len(commits)}")
    print("")
    
    if args.format == "github-release":
        output = generate_github_release_notes(new_version, commits)
    else:
        output = generate_changelog_entry(new_version, commits)
    
    print(output)
    
    if not args.dry_run:
        changelog_path = Path("CHANGELOG.md")
        if changelog_path.exists():
            existing = changelog_path.read_text()
            # Insertar después de [Unreleased] o al principio
            if "## [Unreleased]" in existing:
                updated = existing.replace(
                    "## [Unreleased]",
                    f"## [Unreleased]\n\n---\n\n{output}",
                    1,
                )
            else:
                updated = f"{output}\n\n{existing}"
            changelog_path.write_text(updated)
            print(f"CHANGELOG.md actualizado con v{new_version}")
        else:
            header = "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n"
            changelog_path.write_text(header + output)
            print(f"CHANGELOG.md creado con v{new_version}")


if __name__ == "__main__":
    main()
```

---

## GitHub Actions — Auto-changelog en merge a main

```yaml
# .github/workflows/changelog.yml
name: Auto Changelog

on:
  push:
    branches: [main]
  pull_request:
    types: [closed]

jobs:
  update-changelog:
    if: github.event.pull_request.merged == true || github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: read
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Necesario para acceder al historial completo
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Generate changelog
        id: changelog
        run: |
          python scripts/generate_changelog.py --dry-run > /tmp/changelog_entry.txt
          echo "entry<<EOF" >> $GITHUB_OUTPUT
          cat /tmp/changelog_entry.txt >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT
      
      - name: Update CHANGELOG.md
        run: python scripts/generate_changelog.py
      
      - name: Commit changelog
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add CHANGELOG.md
          git diff --staged --quiet || git commit -m "docs: update CHANGELOG.md [skip ci]"
          git push
      
      - name: Create GitHub Release (on main push with tag)
        if: startsWith(github.ref, 'refs/tags/')
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref_name }}
          release_name: Release ${{ github.ref_name }}
          body: ${{ steps.changelog.outputs.entry }}
          draft: false
          prerelease: ${{ contains(github.ref_name, '-alpha') || contains(github.ref_name, '-beta') || contains(github.ref_name, '-rc') }}
```

---

## Herramientas de Ecosistema

### standard-version (Node.js)

```bash
# Instalación
npm install -D standard-version

# package.json
{
  "scripts": {
    "release": "standard-version",
    "release:major": "standard-version --release-as major",
    "release:minor": "standard-version --release-as minor",
    "release:patch": "standard-version --release-as patch",
    "release:dry": "standard-version --dry-run"
  }
}

# .versionrc.json
{
  "types": [
    {"type": "feat", "section": "Features"},
    {"type": "fix", "section": "Bug Fixes"},
    {"type": "perf", "section": "Performance"},
    {"type": "refactor", "section": "Code Refactoring"},
    {"type": "docs", "hidden": true},
    {"type": "style", "hidden": true},
    {"type": "test", "hidden": true},
    {"type": "chore", "hidden": true}
  ],
  "commitUrlFormat": "https://github.com/{{owner}}/{{repository}}/commit/{{hash}}",
  "compareUrlFormat": "https://github.com/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}"
}

# Uso
npm run release           # Bump automático según commits
npm run release:dry       # Vista previa sin aplicar cambios
git push --follow-tags    # Push con tag
```

### changesets (monorepos)

```bash
# Instalación
npm install -D @changesets/cli

# Inicializar
npx changeset init

# Crear un changeset (hacer esto ANTES de cada PR)
npx changeset add

# Revisar changesets pendientes
npx changeset status

# Aplicar changesets y hacer release
npx changeset version    # Actualiza package.json y CHANGELOG
npx changeset publish    # Publica a npm/registry
```

---

## Changelogs Malos vs Buenos

### Ejemplo MALO

```markdown
## [2.1.0] - 2026-05-02

### Changed
- Fixed stuff
- Updated dependencies
- Refactored auth
- Made things faster
- Various bug fixes
```

**Problemas:**
- "Fixed stuff" no dice QUE se fixo
- "Updated dependencies" — cuales? de que a que version? hay breaking changes?
- "Made things faster" — cuanto? donde?
- No hay contexto para el usuario que actualiza

### Ejemplo BUENO

```markdown
## [2.1.0] - 2026-05-02

### Added
- **portfolio**: Real-time P&L updates via WebSocket — no more page refresh needed
- **trading**: STOP_LOSS and TAKE_PROFIT order types for automated risk management
- **risk**: VaR (Value at Risk) calculation in the risk dashboard (95% confidence interval, 1-day)

### Fixed
- **orders**: Market orders no longer fail silently when hitting Binance rate limits —
  now retries 3 times with exponential backoff and shows an error notification
- **auth**: Intermittent 401 errors during JWT refresh when a request was in-flight
  (race condition in token refresh logic)

### Performance
- **portfolio endpoint**: Response time reduced from ~800ms to ~120ms by adding
  a composite index on (user_id, created_at) in the positions table

### Security
- **binance**: API keys are now encrypted at rest with AES-256-GCM instead of
  being stored as plaintext in the database
```

---

## Templates de Release Notes por Audiencia

### Para Developers (técnico)

```markdown
## v2.1.0 — Technical Release Notes

**Bump type:** MINOR (backwards compatible)
**Python:** 3.11+ required (no change)
**DB migrations:** 1 new migration (add index, auto-applied on startup)

### API Changes
- `GET /api/portfolio` — response now includes `unrealized_pnl` field per position
- `WS /ws/portfolio/{user_id}` — now broadcasts on every price tick (was every 5s)

### Dependencies Updated
- fastapi: 0.109.0 → 0.110.1 (security fix CVE-2024-XXXX)
- sqlalchemy: 2.0.25 → 2.0.30

### Performance Benchmarks
- Portfolio endpoint: 800ms → 120ms (p95)
- WebSocket message latency: 120ms → 18ms
```

### Para End Users (no técnico)

```markdown
## What's new in version 2.1.0

Hi traders! Here's what we improved this week:

**Your portfolio now updates automatically**
You no longer need to refresh the page to see your current profits and losses.
The numbers update live as market prices change.

**New order types: Stop Loss and Take Profit**
Protect your trades automatically. Set a price where you want to sell if things
go wrong (Stop Loss), or lock in profits when you hit your target (Take Profit).

**Bug fixes**
We fixed a bug that was sometimes causing orders to fail without showing an error
message. You'll now always see a notification if something goes wrong.
```

### Para Ejecutivos (resumen)

```markdown
## Release 2.1.0 — Executive Summary (May 2, 2026)

**Risk:** LOW — No breaking changes, backwards compatible release

**Impact:**
- 3 new features shipped (portfolio real-time, stop-loss/take-profit, risk metrics)
- 2 critical bug fixes (silent order failures, auth race condition)
- System performance improved 85% on the portfolio endpoint (800ms → 120ms)
- Security: Binance API keys now encrypted at rest

**Next release:** v2.2.0 targeting May 16, focused on multi-exchange support (Coinbase)
```

---

## Comandos Rapidos

```bash
# Ver commits desde el último tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline --no-merges

# Ver solo conventional commits por tipo
git log --oneline --no-merges | grep "^[a-f0-9]* feat"
git log --oneline --no-merges | grep "^[a-f0-9]* fix"

# Crear tag semántico
git tag -a v2.1.0 -m "Release v2.1.0"
git push origin v2.1.0

# Ver diferencias entre versiones
git diff v2.0.0..v2.1.0 --stat

# Generar changelog interactivo
git log --pretty=format:"%h %s (%an)" $(git describe --tags --abbrev=0)..HEAD
```

---

## Commitlint — Validar Conventional Commits en CI

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2, 'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert', 'security']
    ],
    'scope-enum': [
      1, 'always',
      ['auth', 'trading', 'orders', 'portfolio', 'risk', 'binance', 'websocket', 'db', 'api', 'frontend', 'ci', 'deps']
    ],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 200],
  },
};
```

```bash
# Instalar
npm install -D @commitlint/cli @commitlint/config-conventional husky

# Configurar hook
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit ${1}'
```
