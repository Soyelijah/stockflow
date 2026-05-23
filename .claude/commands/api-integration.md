# /api-integration — Verificación de Integración API

Verifica patrones de integración API en el proyecto.

## Instrucciones

1. **Revisar endpoints**:
   - Consistencia de naming (kebab-case para URLs)
   - Versionado correcto (/api/v1/...)
   - HTTP methods apropiados (GET para lectura, POST para creación, etc.)
   - Status codes correctos (201 para creación, 404 para not found, etc.)

2. **Validación de payloads**:
   - Request validation con Pydantic/Zod/Joi
   - Response serialization consistente
   - Error responses estandarizados (RFC 7807 Problem Details)

3. **Autenticación y autorización**:
   - Bearer token validation
   - Role-based access control
   - API key management

4. **Rate limiting y throttling**:
   - Límites por endpoint
   - Headers X-RateLimit-*
   - Retry-After en 429 responses

5. **Documentación**:
   - OpenAPI/Swagger spec actualizada
   - Ejemplos de request/response
   - Códigos de error documentados

6. **Testing**:
   - Tests de contrato
   - Tests de integración
   - Mocks y fixtures actualizados
