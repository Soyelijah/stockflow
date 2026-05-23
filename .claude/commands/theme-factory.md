# /theme-factory — Sistema de Temas y Design Tokens

Crea o audita el sistema de temas del proyecto.

## Instrucciones

1. **Auditar tokens existentes**:
   - Colores: primarios, secundarios, semánticos (success, error, warning, info)
   - Tipografía: escalas, font families, line heights, weights
   - Espaciado: sistema consistente (4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px)
   - Sombras: elevaciones consistentes
   - Bordes: radius, widths, colores

2. **Implementar tema**:
   - CSS custom properties (--color-primary, --spacing-md, etc.)
   - Tailwind config con tokens personalizados
   - Dark/light mode toggle
   - High contrast mode para accesibilidad

3. **Generar variantes**:
   - Temas predefinidos (light, dark, high-contrast)
   - Temas por marca o cliente
   - Modo automático según preferencias del sistema

4. **Exportar tokens**:
   - JSON para consumo programático
   - CSS variables
   - Tailwind config
   - Figma-compatible tokens

5. **Verificar consistencia**:
   - Todos los componentes usan tokens (no valores hardcoded)
   - Contraste WCAG AA (4.5:1 texto, 3:1 elementos grandes)
   - Soporte para prefers-color-scheme y prefers-contrast
