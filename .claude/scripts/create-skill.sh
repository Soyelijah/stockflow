#!/usr/bin/env bash
# DEE — Crear un nuevo skill personalizado
set -euo pipefail

SKILL_NAME="${1:-}"
SKILLS_DIR=".claude/skills"

if [[ -z "$SKILL_NAME" ]]; then
    echo "❌ Uso: bash .claude/scripts/create-skill.sh <nombre-del-skill>"
    echo "   Ejemplo: bash .claude/scripts/create-skill.sh mi-custom-skill"
    exit 1
fi

# Validar nombre
if [[ ! "$SKILL_NAME" =~ ^[a-z][a-z0-9-]*$ ]]; then
    echo "❌ El nombre del skill debe ser kebab-case (ej: mi-skill-custom)"
    exit 1
fi

SKILL_DIR="${SKILLS_DIR}/${SKILL_NAME}"

if [[ -d "$SKILL_DIR" ]]; then
    echo "⚠️  El skill '${SKILL_NAME}' ya existe en ${SKILL_DIR}"
    exit 1
fi

mkdir -p "$SKILL_DIR"

cat > "${SKILL_DIR}/SKILL.md" << EOF
---
name: ${SKILL_NAME}
description: "Skill personalizado: ${SKILL_NAME}"
triggers:
  - "${SKILL_NAME}"
---

# ${SKILL_NAME}

## Descripción
[Describe qué hace este skill]

## Cuándo usar
- [Trigger 1]
- [Trigger 2]

## Instrucciones
1. [Paso 1]
2. [Paso 2]

## Checklist
- [ ] [Verificación 1]
- [ ] [Verificación 2]

## Mejores prácticas
- [Práctica 1]
- [Práctica 2]
EOF

echo "✅ Skill '${SKILL_NAME}' creado en ${SKILL_DIR}/"
echo "   Edita ${SKILL_DIR}/SKILL.md para personalizar el contenido."
