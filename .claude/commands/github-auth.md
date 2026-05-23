# /github-auth — Verificación de Autenticación GitHub

Verifica y configura la integración con GitHub CLI.

## Instrucciones

1. **Verificar GitHub CLI**:
   ```bash
   gh auth status
   ```
   - Si no está autenticado, guiar al usuario con `gh auth login`
   - Verificar scopes necesarios (repo, read:org, workflow)

2. **Verificar acceso al repositorio**:
   - Confirmar que el usuario tiene acceso push al repo actual
   - Verificar la rama por defecto (main/master)
   - Comprobar protecciones de rama

3. **Configurar MCP de GitHub**:
   - Verificar que el MCP de GitHub está configurado en settings.json
   - Verificar que el token tiene los permisos necesarios
   - Testar con una operación simple (listar issues)

4. **Información del repositorio**:
   - Owner/Nombre del repo
   - Visibilidad (público/privado)
   - Ramas activas
   - Estado de GitHub Actions
   - Releases más recientes

5. **Guardar configuración**:
   - Actualizar `.claude/config/github-config.json` con el estado verificado
