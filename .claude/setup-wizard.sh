#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  DEVLMER ECOSYSTEM ENGINE v3.1 — Interactive Setup Wizard
#  Configures API keys for MCP services in a friendly, guided way.
#
#  Usage:
#    bash setup-wizard.sh                  (auto-detects .claude/)
#    bash setup-wizard.sh /path/to/project (explicit project path)
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Colors & Symbols ───────────────────────────────────────────
BOLD="\033[1m"
DIM="\033[2m"
RESET="\033[0m"
CYAN="\033[0;36m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
MAGENTA="\033[0;35m"
WHITE="\033[1;37m"
BG_BLUE="\033[44m"
BG_GREEN="\033[42m"
BG_YELLOW="\033[43m"
CHECK="✅"
SKIP="⏩"
KEY="🔑"
LOCK="🔒"
GEAR="⚙️"
ROCKET="🚀"
WAVE="👋"
LIGHT="💡"
WARN="⚠️"
PARTY="🎉"

# ─── Resolve project path ──────────────────────────────────────
if [[ -n "${1:-}" ]]; then
    PROJECT_DIR="$1"
else
    # Auto-detect: look for .claude/ in current dir or parent dirs
    dir="$(pwd)"
    while [[ "$dir" != "/" ]]; do
        if [[ -d "$dir/.claude" ]]; then
            PROJECT_DIR="$dir"
            break
        fi
        dir="$(dirname "$dir")"
    done
    PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
fi

CLAUDE_DIR="${PROJECT_DIR}/.claude"
SETTINGS_FILE="${CLAUDE_DIR}/settings.json"
ENV_FILE="${CLAUDE_DIR}/mcp-env-setup.sh"
PROFILE_FILE="${CLAUDE_DIR}/PROJECT_PROFILE.json"

# ─── Helpers ────────────────────────────────────────────────────
clear_line() { printf "\r\033[K"; }

print_header() {
    if [[ -t 1 ]] && [[ -n "${TERM:-}" ]]; then
        clear
    fi
    echo ""
    echo -e "${CYAN}${BOLD}"
    echo -e "  ╔═══════════════════════════════════════════════════════════╗"
    echo -e "  ║                                                           ║"
    echo -e "  ║        DEVLMER ECOSYSTEM ENGINE v3.1                     ║"
    echo -e "  ║        ${RESET}${CYAN}Setup Wizard — Configuración Guiada${BOLD}              ║"
    echo -e "  ║                                                           ║"
    echo -e "  ╚═══════════════════════════════════════════════════════════╝"
    echo -e "${RESET}"
}

print_welcome() {
    local project_name
    project_name=$(basename "$PROJECT_DIR")

    echo -e "  ${WAVE} ${WHITE}${BOLD}¡Bienvenido al Setup Wizard!${RESET}"
    echo ""
    echo -e "  Este asistente te guiará paso a paso para conectar"
    echo -e "  los servicios que tu proyecto ${CYAN}${BOLD}${project_name}${RESET} necesita."
    echo ""
    echo -e "  ${LIGHT} ${DIM}No necesitas configurar todos — solo los que uses.${RESET}"
    echo -e "  ${DIM}Puedes volver a correr este wizard cuando quieras.${RESET}"
    echo ""
}

print_divider() {
    echo -e "  ${DIM}─────────────────────────────────────────────────────${RESET}"
}

# Animated progress bar
show_progress() {
    local current=$1
    local total=$2
    local width=40
    local pct=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    local bar=""

    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=0; i<empty; i++)); do bar+="░"; done

    echo -e "  ${DIM}[${GREEN}${bar}${DIM}] ${pct}%${RESET}"
}

# Ask for a single key with description
ask_key() {
    local var_name="$1"
    local service_name="$2"
    local description="$3"
    local where_to_find="$4"
    local current_value=""

    # Check if already configured
    if [[ -f "$ENV_FILE" ]]; then
        current_value=$(grep "^export ${var_name}=" "$ENV_FILE" 2>/dev/null | sed "s/^export ${var_name}=//" | tr -d '"' | tr -d "'" || true)
    fi

    local is_configured=false
    if [[ -n "$current_value" && "$current_value" != *"your-"*"-here" && "$current_value" != "" ]]; then
        is_configured=true
    fi

    echo ""
    echo -e "  ${KEY} ${WHITE}${BOLD}${service_name}${RESET}"
    echo -e "  ${DIM}${description}${RESET}"
    echo ""

    if $is_configured; then
        local masked="${current_value:0:6}...${current_value: -4}"
        echo -e "  ${CHECK} Ya configurado: ${DIM}${masked}${RESET}"
        echo ""
        echo -e "  ${DIM}[Enter] Mantener actual  |  [n] Nueva key  |  [s] Saltar${RESET}"
        read -r -t 60 -p "  → " choice || choice=""
        case "$choice" in
            n|N)
                echo ""
                echo -e "  ${LIGHT} ${DIM}${where_to_find}${RESET}"
                read -r -s -t 120 -p "  Pega tu nueva key: " new_value || new_value=""
                echo ""
                if [[ -n "$new_value" ]]; then
                    update_env_file "$var_name" "$new_value"
                    echo -e "  ${CHECK} ${GREEN}Actualizado${RESET}"
                    return 0
                fi
                ;;
            s|S)
                echo -e "  ${SKIP} Saltado"
                return 1
                ;;
            *)
                echo -e "  ${CHECK} Manteniendo configuración actual"
                return 0
                ;;
        esac
    else
        echo -e "  ${LIGHT} ${DIM}Dónde encontrarlo: ${where_to_find}${RESET}"
        echo ""
        echo -e "  ${DIM}[Pega tu key]  |  [Enter] Saltar${RESET}"
        read -r -s -t 120 -p "  → " new_value || new_value=""
        echo ""

        if [[ -n "$new_value" ]]; then
            update_env_file "$var_name" "$new_value"
            echo -e "  ${CHECK} ${GREEN}¡Configurado!${RESET}"
            return 0
        else
            echo -e "  ${SKIP} Saltado — puedes configurarlo después"
            return 1
        fi
    fi
}

update_env_file() {
    local var_name="$1"
    local value="$2"

    if [[ ! -f "$ENV_FILE" ]]; then
        cat > "$ENV_FILE" << 'HEADER'
#!/bin/bash
# ═══════════════════════════════════════════════════════
# DEVLMER MCP — Environment Variables Setup
# Auto-generated by Setup Wizard
# ═══════════════════════════════════════════════════════
HEADER
        chmod 600 "$ENV_FILE"
    fi

    # Update or append
    if grep -q "^export ${var_name}=" "$ENV_FILE" 2>/dev/null; then
        # Use a temp file for portable sed
        local tmp_file="${ENV_FILE}.tmp"
        sed "s|^export ${var_name}=.*|export ${var_name}=\"${value}\"|" "$ENV_FILE" > "$tmp_file"
        mv "$tmp_file" "$ENV_FILE"
    else
        echo "export ${var_name}=\"${value}\"" >> "$ENV_FILE"
    fi

    chmod 600 "$ENV_FILE"
}

update_settings_json() {
    local var_name="$1"
    local value="$2"

    if [[ ! -f "$SETTINGS_FILE" ]] || ! command -v python3 &>/dev/null; then
        return
    fi

    python3 << PYEOF
import json, os

settings_path = "${SETTINGS_FILE}"
var_name = "${var_name}"
value = "${value}"

try:
    with open(settings_path) as f:
        settings = json.load(f)

    changed = False
    for mcp_name, mcp_cfg in settings.get("mcpServers", {}).items():
        env = mcp_cfg.get("env", {})
        if var_name in env:
            env[var_name] = value
            changed = True

    if changed:
        with open(settings_path, "w") as f:
            json.dump(settings, f, indent=2)
except Exception as e:
    print(f"Warning: Could not update settings.json: {e}", file=__import__('sys').stderr)
PYEOF
}

# ─── Service Definitions ────────────────────────────────────────
# Format: var_name|service_name|description|where_to_find
declare -a SERVICES=(
    "SUPABASE_URL|Supabase (URL)|Tu base de datos y autenticación. Supabase es como Firebase pero open source — guarda los datos de usuarios, pedidos, restaurantes.|Entra a supabase.com → Tu proyecto → Settings → API → Project URL"
    "SUPABASE_KEY|Supabase (API Key)|La llave para que Claude pueda leer y escribir en tu base de datos de forma segura.|supabase.com → Tu proyecto → Settings → API → anon/public key"
    "STRIPE_SECRET_KEY|Stripe (Pagos)|Procesa pagos con tarjeta de crédito. Cobra a los clientes y paga a los restaurantes automáticamente.|stripe.com → Developers → API keys → Secret key (empieza con sk_)"
    "GITHUB_PERSONAL_ACCESS_TOKEN|GitHub|Tu repositorio de código. Permite a Claude crear PRs, revisar código y gestionar issues.|github.com → Settings → Developer settings → Personal access tokens → Generate"
    "SENTRY_AUTH_TOKEN|Sentry (Monitoreo de Errores)|Detecta errores en producción automáticamente. Te avisa cuando algo falla antes de que los usuarios se quejen.|sentry.io → Settings → Auth Tokens → Create New Token"
    "SLACK_BOT_TOKEN|Slack (Bot Token)|Permite a Claude enviar notificaciones al equipo: alertas de errores, deployments, reportes.|api.slack.com → Tu App → OAuth → Bot User OAuth Token (empieza con xoxb-)"
    "SLACK_TEAM_ID|Slack (Team ID)|Identifica tu workspace de Slack para enviar mensajes al equipo correcto.|api.slack.com → Tu App → Settings → Team ID (o en la URL del workspace)"
    "SENDGRID_API_KEY|SendGrid (Emails)|Envía emails transaccionales: confirmaciones de pedido, recibos, recuperación de contraseña.|sendgrid.com → Settings → API Keys → Create API Key"
    "TELEGRAM_BOT_TOKEN|Telegram (Bot)|Bot de Telegram para notificaciones en tiempo real al equipo o a los clientes.|Habla con @BotFather en Telegram → /newbot → te da el token"
    "DD_API_KEY|Datadog (API Key)|Monitoreo de infraestructura: servidores, APIs, bases de datos. Ve todo en un dashboard.|app.datadoghq.com → Organization Settings → API Keys"
    "DD_APP_KEY|Datadog (App Key)|Segunda llave de Datadog para acceder a dashboards y métricas detalladas.|app.datadoghq.com → Organization Settings → Application Keys"
    "DISCORD_BOT_TOKEN|Discord (Bot)|Bot de Discord para comunidad o soporte al cliente.|discord.com/developers → Tu App → Bot → Token"
    "PINECONE_API_KEY|Pinecone (Vector DB)|Base de datos de vectores para búsqueda inteligente y recomendaciones con IA.|pinecone.io → Console → API Keys"
    "REDIS_URL|Redis (Cache)|Cache para hacer la app más rápida. Guarda datos temporales para no consultar la DB cada vez.|Tu proveedor Redis (Upstash, Redis Cloud, etc.) → Connection URL"
    "ELASTICSEARCH_URL|Elasticsearch (Búsqueda)|Motor de búsqueda potente para que los usuarios encuentren restaurantes y platos rápidamente.|Tu instancia de Elasticsearch → Connection URL"
)

# ─── Main Flow ──────────────────────────────────────────────────
main() {
    # Validate project
    if [[ ! -d "$CLAUDE_DIR" ]]; then
        echo -e "${RED}Error: No se encontró .claude/ en ${PROJECT_DIR}${RESET}"
        echo -e "Ejecuta primero: ${CYAN}bash install.sh \"${PROJECT_DIR}\"${RESET}"
        exit 1
    fi

    print_header
    print_welcome

    # Detect which services need keys
    local needed_services=()
    if [[ -f "$SETTINGS_FILE" ]] && command -v python3 &>/dev/null; then
        local needed_vars
        needed_vars=$(python3 -c "
import json
with open('${SETTINGS_FILE}') as f:
    d = json.load(f)
for mcp in d.get('mcpServers', {}).values():
    for k in mcp.get('env', {}):
        print(k)
" 2>/dev/null | sort -u)

        for service in "${SERVICES[@]}"; do
            local var_name="${service%%|*}"
            if echo "$needed_vars" | grep -q "^${var_name}$"; then
                needed_services+=("$service")
            fi
        done
    else
        needed_services=("${SERVICES[@]}")
    fi

    local total=${#needed_services[@]}

    if [[ $total -eq 0 ]]; then
        echo -e "  ${PARTY} ${GREEN}${BOLD}¡Tu proyecto no necesita API keys adicionales!${RESET}"
        echo -e "  ${DIM}Todos los MCPs instalados funcionan sin configuración.${RESET}"
        echo ""
        exit 0
    fi

    # Count already configured
    local configured=0
    for service in "${needed_services[@]}"; do
        local var_name="${service%%|*}"
        if [[ -f "$ENV_FILE" ]]; then
            local val
            val=$(grep "^export ${var_name}=" "$ENV_FILE" 2>/dev/null | sed "s/^export ${var_name}=//" | tr -d '"' | tr -d "'" || true)
            if [[ -n "$val" && "$val" != *"your-"*"-here" ]]; then
                ((configured++)) || true
            fi
        fi
    done

    echo -e "  ${GEAR} ${WHITE}${BOLD}Tu proyecto necesita ${total} credenciales${RESET}"
    if [[ $configured -gt 0 ]]; then
        echo -e "  ${CHECK} ${configured} ya configuradas, ${GREEN}$((total - configured)) pendientes${RESET}"
    fi
    echo ""

    print_divider
    echo ""
    echo -e "  ${BOLD}¿Cómo quieres configurar?${RESET}"
    echo ""
    echo -e "  ${CYAN}1${RESET}) ${BOLD}Guiado${RESET} — Te explico cada servicio y me das las keys ${DIM}(recomendado)${RESET}"
    echo -e "  ${CYAN}2${RESET}) ${BOLD}Solo esenciales${RESET} — Solo Supabase, Stripe y GitHub ${DIM}(lo mínimo)${RESET}"
    echo -e "  ${CYAN}3${RESET}) ${BOLD}Después${RESET} — Salir y configurar en otro momento"
    echo ""
    read -r -t 60 -p "  Elige [1/2/3]: " mode || mode="3"
    echo ""

    case "$mode" in
        2)
            # Filter to essentials only
            local essential_vars=("SUPABASE_URL" "SUPABASE_KEY" "STRIPE_SECRET_KEY" "GITHUB_PERSONAL_ACCESS_TOKEN")
            local filtered=()
            for service in "${needed_services[@]}"; do
                local var_name="${service%%|*}"
                for ev in "${essential_vars[@]}"; do
                    if [[ "$var_name" == "$ev" ]]; then
                        filtered+=("$service")
                    fi
                done
            done
            needed_services=("${filtered[@]}")
            total=${#needed_services[@]}
            ;;
        3)
            echo -e "  ${LIGHT} Sin problema. Cuando quieras configurar, ejecuta:"
            echo ""
            echo -e "  ${CYAN}  bash \"${PROJECT_DIR}/.claude/setup-wizard.sh\" \"${PROJECT_DIR}\"${RESET}"
            echo ""
            exit 0
            ;;
    esac

    # ─── Service-by-service configuration ───────────────────────
    local step=0
    local configured_now=0
    local skipped=0

    for service in "${needed_services[@]}"; do
        ((step++)) || true
        local var_name="${service%%|*}"
        local rest="${service#*|}"
        local service_name="${rest%%|*}"
        rest="${rest#*|}"
        local description="${rest%%|*}"
        local where_to_find="${rest#*|}"

        print_divider
        echo ""
        echo -e "  ${DIM}Paso ${step} de ${total}${RESET}"
        show_progress "$step" "$total"

        if ask_key "$var_name" "$service_name" "$description" "$where_to_find"; then
            ((configured_now++)) || true
            # Also update settings.json with the actual value
            local new_val
            new_val=$(grep "^export ${var_name}=" "$ENV_FILE" 2>/dev/null | sed "s/^export ${var_name}=//" | tr -d '"' | tr -d "'" || true)
            if [[ -n "$new_val" && "$new_val" != *"your-"*"-here" ]]; then
                update_settings_json "$var_name" "$new_val"
            fi
        else
            ((skipped++)) || true
        fi
    done

    # ─── Final Summary ──────────────────────────────────────────
    echo ""
    print_divider
    echo ""
    echo -e "  ${PARTY} ${WHITE}${BOLD}¡Setup Wizard Completado!${RESET}"
    echo ""
    echo -e "  ${CHECK} Configurados: ${GREEN}${BOLD}${configured_now}${RESET}"
    if [[ $skipped -gt 0 ]]; then
        echo -e "  ${SKIP} Saltados:     ${YELLOW}${skipped}${RESET} ${DIM}(puedes configurarlos después)${RESET}"
    fi
    echo ""

    if [[ $configured_now -gt 0 ]]; then
        echo -e "  ${LOCK} Tus credenciales están guardadas de forma segura en:"
        echo -e "  ${DIM}  ${ENV_FILE}${RESET}"
        echo ""
        echo -e "  ${ROCKET} ${BOLD}Para activarlas en tu sesión actual:${RESET}"
        echo -e "  ${CYAN}  source \"${ENV_FILE}\"${RESET}"
        echo ""
    fi

    if [[ $skipped -gt 0 ]]; then
        echo -e "  ${LIGHT} Para configurar los que saltaste, ejecuta de nuevo:"
        echo -e "  ${CYAN}  bash \"${PROJECT_DIR}/.claude/setup-wizard.sh\" \"${PROJECT_DIR}\"${RESET}"
    fi

    echo ""
    echo -e "  ${DIM}═══════════════════════════════════════════════════════${RESET}"
    echo -e "  ${DIM}  Devlmer Ecosystem Engine v3.1 — by Pierre Solier${RESET}"
    echo -e "  ${DIM}═══════════════════════════════════════════════════════${RESET}"
    echo ""
}

main "$@"
