# /security-audit — Auditoría de Seguridad

Ejecuta una auditoría de seguridad completa del proyecto actual.

## Instrucciones

1. **Escanear dependencias** por vulnerabilidades conocidas:
   - Python: `pip-audit` o `safety check`
   - Node.js: `npm audit` o `yarn audit`
   - Revisa CVEs en las versiones instaladas

2. **Detectar secrets expuestos**:
   - Busca API keys, tokens, passwords en el código
   - Verifica que `.env` esté en `.gitignore`
   - Revisa git history por secrets comiteados accidentalmente

3. **OWASP Top 10 Check**:
   - SQL Injection: busca queries sin parametrizar
   - XSS: busca renders de HTML sin sanitizar
   - CSRF: verifica tokens en formularios
   - Auth bypass: revisa middleware de autenticación
   - Data exposure: verifica que datos sensibles no se filtren en responses

4. **Headers de seguridad**:
   - Content-Security-Policy
   - X-Frame-Options
   - X-Content-Type-Options
   - Strict-Transport-Security

5. **Configuración de auth**:
   - JWT: verifica expiración, algoritmo, secret rotation
   - Passwords: hashing con bcrypt/argon2, no MD5/SHA1
   - Rate limiting en endpoints de auth
   - 2FA implementation si aplica

6. **Generar reporte** con findings clasificados por severidad (Critical/High/Medium/Low/Info).

## Output esperado
Un reporte estructurado con:
- Resumen ejecutivo
- Findings con severidad, descripción, ubicación y remediación
- Score de seguridad 0-100
