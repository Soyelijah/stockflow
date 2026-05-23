# /nano-banana — Generación de Imágenes con Gemini

Genera imágenes de alta calidad usando Nano-Banana-MCP (Google Gemini).

## Instrucciones

1. **Verificar configuración**:
   - Comprobar que la API key de Gemini está configurada
   - Si no, guiar al usuario para obtener una en https://aistudio.google.com/apikey
   - Verificar conexión con un test simple

2. **Generar imagen**:
   - Tomar el prompt del usuario
   - Optimizar el prompt para Gemini (ser descriptivo, incluir estilo, iluminación, composición)
   - Ejecutar generación con los parámetros configurados

3. **Parámetros disponibles**:
   - `--size`: 1024x1024 (default), 1920x1080, 2048x2048
   - `--quality`: high (default), medium, low
   - `--style`: realistic, artistic, minimal, professional
   - `--format`: png (default), jpg, webp

4. **Post-procesamiento**:
   - Optimizar tamaño de archivo
   - Generar variantes (thumbnail, responsive sizes)
   - Agregar metadatos

5. **Cache y historial**:
   - Cachear imágenes generadas en `.claude/cache/images/`
   - Mantener historial de prompts y resultados
   - Reutilizar imágenes previas cuando sea posible

## Flags
- `--reset`: Resetear configuración de Nano-Banana-MCP
- `--prompt "..."`: Prompt personalizado
- `--size WxH`: Tamaño de imagen
- `--quality level`: Nivel de calidad
- `--style name`: Estilo visual
