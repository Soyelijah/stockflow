# UI Design System — Guía Completa de Producción

Referencia profesional para construir y mantener design systems escalables con React, TypeScript y Tailwind CSS v4.

---

## 1. Design Tokens — La Base de Todo

Los design tokens son los valores atómicos del sistema: colores, tipografía, spacing, sombras. Son la única fuente de verdad que conecta diseño y código.

### 1.1 Estructura de tokens

```
tokens/
├── colors.ts          # Paleta completa + semánticos
├── typography.ts      # Fuentes, tamaños, line-heights
├── spacing.ts         # Escala de espaciado
├── shadows.ts         # Elevaciones / box-shadows
├── radii.ts           # Border radii
├── motion.ts          # Duraciones y easings de animación
├── breakpoints.ts     # Puntos de quiebre responsive
└── index.ts           # Re-export unificado
```

### 1.2 Implementación en CSS Custom Properties

```css
/* tokens/tokens.css — la fuente de verdad en CSS */
:root {
  /* === COLORS — Primitivos === */
  --color-blue-50: #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-200: #bfdbfe;
  --color-blue-300: #93c5fd;
  --color-blue-400: #60a5fa;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-blue-700: #1d4ed8;
  --color-blue-800: #1e40af;
  --color-blue-900: #1e3a8a;
  --color-blue-950: #172554;

  --color-neutral-0: #ffffff;
  --color-neutral-50: #f9fafb;
  --color-neutral-100: #f3f4f6;
  --color-neutral-200: #e5e7eb;
  --color-neutral-300: #d1d5db;
  --color-neutral-400: #9ca3af;
  --color-neutral-500: #6b7280;
  --color-neutral-600: #4b5563;
  --color-neutral-700: #374151;
  --color-neutral-800: #1f2937;
  --color-neutral-900: #111827;
  --color-neutral-950: #030712;

  --color-green-500: #22c55e;
  --color-green-600: #16a34a;
  --color-red-500: #ef4444;
  --color-red-600: #dc2626;
  --color-amber-500: #f59e0b;
  --color-amber-600: #d97706;

  /* === COLORS — Semánticos (referencian primitivos) === */
  --color-primary: var(--color-blue-600);
  --color-primary-hover: var(--color-blue-700);
  --color-primary-light: var(--color-blue-50);
  --color-primary-foreground: var(--color-neutral-0);

  --color-success: var(--color-green-500);
  --color-success-foreground: var(--color-neutral-0);
  --color-error: var(--color-red-500);
  --color-error-foreground: var(--color-neutral-0);
  --color-warning: var(--color-amber-500);
  --color-warning-foreground: var(--color-neutral-900);
  --color-info: var(--color-blue-500);

  --color-background: var(--color-neutral-0);
  --color-surface: var(--color-neutral-50);
  --color-surface-elevated: var(--color-neutral-0);
  --color-border: var(--color-neutral-200);
  --color-border-strong: var(--color-neutral-400);

  --color-text-primary: var(--color-neutral-900);
  --color-text-secondary: var(--color-neutral-600);
  --color-text-disabled: var(--color-neutral-400);
  --color-text-inverse: var(--color-neutral-0);

  /* === TYPOGRAPHY === */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;

  --text-xs: 0.75rem;      /* 12px */
  --text-sm: 0.875rem;     /* 14px */
  --text-base: 1rem;       /* 16px */
  --text-lg: 1.125rem;     /* 18px */
  --text-xl: 1.25rem;      /* 20px */
  --text-2xl: 1.5rem;      /* 24px */
  --text-3xl: 1.875rem;    /* 30px */
  --text-4xl: 2.25rem;     /* 36px */

  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;

  --tracking-tight: -0.025em;
  --tracking-normal: 0em;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;

  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;

  /* === SPACING — Base 4px === */
  --space-0: 0px;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */

  /* === RADII === */
  --radius-none: 0px;
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.375rem;  /* 6px */
  --radius-lg: 0.5rem;    /* 8px */
  --radius-xl: 0.75rem;   /* 12px */
  --radius-2xl: 1rem;     /* 16px */
  --radius-full: 9999px;

  /* === SHADOWS === */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);

  /* === MOTION === */
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;

  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* === BREAKPOINTS (como reference docs) === */
  /* --bp-sm: 640px; --bp-md: 768px; --bp-lg: 1024px; --bp-xl: 1280px; */
}
```

### 1.3 Dark mode con CSS variables

```css
/* Un solo override: solo cambian los semánticos */
[data-theme="dark"],
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-primary: var(--color-blue-400);
    --color-primary-hover: var(--color-blue-300);
    --color-primary-light: var(--color-blue-950);

    --color-background: var(--color-neutral-950);
    --color-surface: var(--color-neutral-900);
    --color-surface-elevated: var(--color-neutral-800);
    --color-border: var(--color-neutral-700);
    --color-border-strong: var(--color-neutral-500);

    --color-text-primary: var(--color-neutral-50);
    --color-text-secondary: var(--color-neutral-400);
    --color-text-disabled: var(--color-neutral-600);

    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.4);
  }
}
```

### 1.4 Integración con Tailwind CSS v4

```css
/* src/index.css — Tailwind v4 usa @theme */
@import "tailwindcss";

@theme {
  /* Mapear tokens a utilidades Tailwind */
  --color-primary: var(--color-primary);
  --color-primary-hover: var(--color-primary-hover);
  --color-success: var(--color-success);
  --color-error: var(--color-error);
  --color-warning: var(--color-warning);
  --color-surface: var(--color-surface);
  --color-border: var(--color-border);
  --color-text: var(--color-text-primary);
  --color-text-muted: var(--color-text-secondary);

  --font-family-sans: var(--font-sans);
  --font-family-mono: var(--font-mono);

  --spacing-*: initial;  /* Resetear y usar nuestros tokens */
  --spacing-1: var(--space-1);
  --spacing-2: var(--space-2);
  --spacing-3: var(--space-3);
  --spacing-4: var(--space-4);
  --spacing-6: var(--space-6);
  --spacing-8: var(--space-8);

  --border-radius-sm: var(--radius-sm);
  --border-radius-md: var(--radius-md);
  --border-radius-lg: var(--radius-lg);
  --border-radius-xl: var(--radius-xl);
  --border-radius-full: var(--radius-full);

  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
}

/* Utilidades personalizadas */
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
  .scrollbar-hide {
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
  }
}
```

### 1.5 Tokens en TypeScript (type-safe)

```typescript
// tokens/index.ts
export const tokens = {
  colors: {
    primary: "var(--color-primary)",
    success: "var(--color-success)",
    error: "var(--color-error)",
    warning: "var(--color-warning)",
  },
  spacing: {
    1: "var(--space-1)",
    2: "var(--space-2)",
    4: "var(--space-4)",
    8: "var(--space-8)",
  },
  radii: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    full: "var(--radius-full)",
  },
  duration: {
    fast: "var(--duration-fast)",
    normal: "var(--duration-normal)",
    slow: "var(--duration-slow)",
  },
} as const;

export type ColorToken = keyof typeof tokens.colors;
export type SpacingToken = keyof typeof tokens.spacing;
```

---

## 2. Sistema de Color

### 2.1 Jerarquía de colores

```
NIVEL 1 — PRIMITIVOS (paleta bruta)
Blue 50-950, Neutral 0-950, Green, Red, Amber, etc.
→ Nunca usar directamente en componentes

NIVEL 2 — SEMÁNTICOS (intención)
primary, success, error, warning, info
surface, background, border
text-primary, text-secondary, text-disabled
→ Usar en componentes siempre que sea posible

NIVEL 3 — COMPONENTE (variantes específicas)
button-primary-bg, button-primary-border, input-focus-ring
→ Solo para componentes complejos con muchos estados
```

### 2.2 Verificación de contraste WCAG 2.1

```typescript
// Herramienta: verificar ratio de contraste
function getContrastRatio(hex1: string, hex2: string): number {
    const l1 = getLuminance(hex1);
    const l2 = getLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

function getLuminance(hex: string): number {
    const rgb = hexToRgb(hex);
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
        const sRGB = c / 255;
        return sRGB <= 0.03928
            ? sRGB / 12.92
            : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG 2.1 AA requirements:
// Normal text (< 18px o < 14px bold): ratio >= 4.5:1
// Large text (>= 18px o >= 14px bold): ratio >= 3:1
// UI components y decorativos: ratio >= 3:1
```

### 2.3 Paleta de colores estándar con ratios verificados

| Token semántico | Light value | Ratio vs white | Ratio vs dark bg | WCAG AA |
|----------------|-------------|----------------|-----------------|---------|
| primary | blue-600 (#2563eb) | 5.1:1 | 3.8:1 | ✅ Normal text |
| success | green-600 (#16a34a) | 4.7:1 | - | ✅ Normal text |
| error | red-600 (#dc2626) | 5.3:1 | - | ✅ Normal text |
| warning | amber-600 (#d97706) | 3.1:1 | - | ✅ Large text |
| text-primary | neutral-900 (#111827) | 17.4:1 | - | ✅ AAA |
| text-secondary | neutral-600 (#4b5563) | 7.0:1 | - | ✅ AAA |

---

## 3. Sistema de Tipografía

### 3.1 Type scale con fluid typography

```css
/* Fluid typography con clamp() — escala automáticamente entre breakpoints */
:root {
  --text-fluid-sm:  clamp(0.75rem, 2vw, 0.875rem);
  --text-fluid-base: clamp(0.875rem, 2.5vw, 1rem);
  --text-fluid-lg:  clamp(1rem, 3vw, 1.25rem);
  --text-fluid-xl:  clamp(1.25rem, 4vw, 1.875rem);
  --text-fluid-2xl: clamp(1.5rem, 5vw, 2.25rem);
  --text-fluid-3xl: clamp(1.875rem, 6vw, 3rem);
}
```

### 3.2 Configuración de tipografía en componentes

```typescript
// Clases de tipografía reutilizables
export const typography = {
  // Display
  "display-xl": "text-4xl font-bold leading-tight tracking-tight",
  "display-lg": "text-3xl font-bold leading-tight tracking-tight",
  "display-md": "text-2xl font-semibold leading-snug",
  
  // Headers
  "heading-xl": "text-xl font-semibold leading-snug",
  "heading-lg": "text-lg font-semibold leading-snug",
  "heading-md": "text-base font-semibold leading-normal",
  "heading-sm": "text-sm font-semibold leading-normal tracking-wide uppercase",
  
  // Body
  "body-lg": "text-lg font-normal leading-relaxed",
  "body-md": "text-base font-normal leading-relaxed",
  "body-sm": "text-sm font-normal leading-normal",
  
  // UI
  "label-lg": "text-sm font-medium leading-normal",
  "label-md": "text-xs font-medium leading-normal tracking-wide",
  "caption": "text-xs font-normal leading-normal text-text-secondary",
  "code": "font-mono text-sm",
} as const;

export type TypographyVariant = keyof typeof typography;
```

---

## 4. Sistema de Spacing

### 4.1 Grid de 4px

```
El espaciado sigue múltiplos de 4px. Esta regla previene valores arbitrarios.

Valores permitidos: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96
Equivalentes: 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24

NUNCA: padding: 5px, margin: 7px, gap: 11px
SIEMPRE: padding: 4px o 8px, margin: 8px, gap: 12px
```

### 4.2 Spacing semántico por contexto

```typescript
// Guía de qué spacing usar dónde
export const spacing_guide = {
  // Dentro de componentes
  inset_xs: "p-1",     // 4px — badges, tags compact
  inset_sm: "p-2",     // 8px — botones sm, inputs sm
  inset_md: "p-3",     // 12px — botones md
  inset_lg: "p-4",     // 16px — cards, panels
  inset_xl: "p-6",     // 24px — modals, secciones
  
  // Entre componentes
  gap_xs: "gap-1",     // 4px — entre iconos y texto inline
  gap_sm: "gap-2",     // 8px — entre elementos relacionados
  gap_md: "gap-4",     // 16px — entre componentes del mismo grupo
  gap_lg: "gap-6",     // 24px — entre grupos
  gap_xl: "gap-8",     // 32px — entre secciones
  
  // Layout
  section_padding: "py-16 px-4 md:px-6 lg:px-8",
  container_max: "max-w-7xl mx-auto",
} as const;
```

---

## 5. Atomic Design en React + TypeScript

### 5.1 Estructura de carpetas

```
src/components/
├── ui/                      # ÁTOMOS — componentes base primitivos
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   ├── Button.stories.tsx
│   │   └── index.ts
│   ├── Input/
│   ├── Badge/
│   ├── Avatar/
│   ├── Spinner/
│   └── Icon/
├── composite/               # MOLÉCULAS — combinaciones de átomos
│   ├── SearchInput/         # Input + Icon + Button
│   ├── UserAvatar/          # Avatar + Badge
│   ├── FormField/           # Label + Input + ErrorMessage
│   └── DataTable/
├── patterns/                # ORGANISMOS — secciones con lógica
│   ├── Header/
│   ├── Sidebar/
│   ├── DataGrid/
│   └── Modal/
└── layouts/                 # TEMPLATES — estructura de páginas
    ├── DashboardLayout/
    ├── AuthLayout/
    └── PublicLayout/
```

---

## 6. Componentes Completos con TypeScript

### 6.1 Button — Variantes, sizes, estados

```typescript
// ui/Button/Button.tsx
import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: [
    "bg-[var(--color-primary)] text-white",
    "hover:bg-[var(--color-primary-hover)]",
    "focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
    "disabled:bg-[var(--color-neutral-300)] disabled:cursor-not-allowed",
  ].join(" "),

  secondary: [
    "bg-[var(--color-surface)] text-[var(--color-text-primary)]",
    "border border-[var(--color-border)]",
    "hover:bg-[var(--color-neutral-100)] hover:border-[var(--color-border-strong)]",
    "focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),

  ghost: [
    "bg-transparent text-[var(--color-text-primary)]",
    "hover:bg-[var(--color-neutral-100)]",
    "focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),

  danger: [
    "bg-[var(--color-error)] text-white",
    "hover:bg-[var(--color-red-600)]",
    "focus-visible:ring-2 focus-visible:ring-[var(--color-error)] focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),

  outline: [
    "bg-transparent text-[var(--color-primary)]",
    "border border-[var(--color-primary)]",
    "hover:bg-[var(--color-primary-light)]",
    "focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),
};

const sizes: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-xs gap-1 rounded-sm",
  sm: "h-8 px-3 text-sm gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-md",
  lg: "h-12 px-6 text-base gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        className={cn(
          // Base
          "inline-flex items-center justify-center font-medium",
          "transition-colors duration-[var(--duration-fast)]",
          "select-none outline-none",
          // Variant
          variants[variant],
          // Size
          sizes[size],
          // Full width
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2
            className="animate-spin"
            size={size === "xs" ? 12 : size === "sm" ? 14 : size === "lg" ? 18 : 16}
            aria-hidden="true"
          />
        ) : leftIcon ? (
          <span aria-hidden="true">{leftIcon}</span>
        ) : null}

        {children && <span>{children}</span>}

        {!loading && rightIcon && (
          <span aria-hidden="true">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
```

### 6.2 Input — Con label, error, hint, prefix/suffix

```typescript
// ui/Input/Input.tsx
import { forwardRef, InputHTMLAttributes, useId } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      size = "md",
      prefix,
      suffix,
      required,
      disabled,
      className,
      id: externalId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    const sizeClasses = {
      sm: "h-8 text-sm px-2.5",
      md: "h-10 text-sm px-3",
      lg: "h-12 text-base px-4",
    };

    const hasPrefix = Boolean(prefix);
    const hasSuffix = Boolean(suffix) || Boolean(error);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "text-sm font-medium text-[var(--color-text-primary)]",
              disabled && "text-[var(--color-text-disabled)]"
            )}
          >
            {label}
            {required && (
              <span
                aria-label="campo requerido"
                className="ml-1 text-[var(--color-error)]"
              >
                *
              </span>
            )}
          </label>
        )}

        <div className="relative">
          {hasPrefix && (
            <div
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2",
                "text-[var(--color-text-secondary)] pointer-events-none",
                size === "sm" && "left-2"
              )}
              aria-hidden="true"
            >
              {prefix}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={
              [error ? errorId : null, hint ? hintId : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className={cn(
              // Base
              "w-full rounded-[var(--radius-md)] border bg-[var(--color-background)]",
              "text-[var(--color-text-primary)]",
              "transition-colors duration-[var(--duration-fast)]",
              "outline-none",
              // Placeholder
              "placeholder:text-[var(--color-text-disabled)]",
              // Size
              sizeClasses[size],
              // Prefix/suffix padding
              hasPrefix && (size === "sm" ? "pl-7" : "pl-9"),
              hasSuffix && (size === "sm" ? "pr-7" : "pr-9"),
              // States
              error
                ? "border-[var(--color-error)] focus:ring-2 focus:ring-[var(--color-error)]/20"
                : [
                    "border-[var(--color-border)]",
                    "hover:border-[var(--color-border-strong)]",
                    "focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20",
                  ],
              disabled && [
                "bg-[var(--color-surface)]",
                "text-[var(--color-text-disabled)]",
                "cursor-not-allowed",
                "border-[var(--color-border)]",
              ],
              className
            )}
            {...props}
          />

          {(hasSuffix || error) && (
            <div
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2",
                "text-[var(--color-text-secondary)]",
                size === "sm" && "right-2"
              )}
              aria-hidden="true"
            >
              {error ? (
                <AlertCircle
                  size={16}
                  className="text-[var(--color-error)]"
                />
              ) : (
                suffix
              )}
            </div>
          )}
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="flex items-center gap-1 text-xs text-[var(--color-error)]"
          >
            {error}
          </p>
        )}

        {hint && !error && (
          <p
            id={hintId}
            className="text-xs text-[var(--color-text-secondary)]"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
```

### 6.3 Card — Header, content, footer, variantes

```typescript
// ui/Card/Card.tsx
import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "bordered" | "elevated" | "flat";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

const variantClasses: Record<CardVariant, string> = {
  default: "bg-[var(--color-surface)] border border-[var(--color-border)]",
  bordered: "bg-[var(--color-background)] border-2 border-[var(--color-border)]",
  elevated: "bg-[var(--color-surface-elevated)] shadow-[var(--shadow-md)] border-0",
  flat: "bg-[var(--color-surface)] border-0",
};

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-6",
  lg: "p-6 md:p-8",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "default",
      padding = "md",
      interactive = false,
      className,
      children,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius-xl)] overflow-hidden",
        variantClasses[variant],
        paddingClasses[padding],
        interactive && [
          "cursor-pointer",
          "transition-all duration-[var(--duration-normal)]",
          "hover:shadow-[var(--shadow-lg)] hover:border-[var(--color-border-strong)]",
          "focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2",
          "active:scale-[0.99]",
        ],
        className
      )}
      tabIndex={interactive ? 0 : undefined}
      role={interactive ? "button" : undefined}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = "Card";

// Sub-componentes
export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col gap-1.5 pb-4 border-b border-[var(--color-border)]",
      className
    )}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-snug text-[var(--color-text-primary)]",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[var(--color-text-secondary)]", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-4", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between pt-4 border-t border-[var(--color-border)]",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
```

### 6.4 Modal — Accessible con focus trap y keyboard navigation

```typescript
// patterns/Modal/Modal.tsx
import {
  useEffect,
  useRef,
  useCallback,
  createPortal,
  ReactNode,
  KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  closeOnOverlayClick?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]",
};

// Focus trap — solo el contenido del modal recibe foco
function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;

    const modal = ref.current;
    const focusableSelectors = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(", ");

    const getFocusableElements = () =>
      Array.from(modal.querySelectorAll<HTMLElement>(focusableSelectors));

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const previousFocus = document.activeElement as HTMLElement;

    // Enfocar primer elemento del modal
    const firstFocusable = getFocusableElements()[0];
    firstFocusable?.focus();

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restaurar foco al cerrar
      previousFocus?.focus();
    };
  }, [active, ref]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  closeOnOverlayClick = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = `modal-title-${Math.random().toString(36).slice(2)}`;
  const descId = description ? `modal-desc-${titleId}` : undefined;

  useFocusTrap(modalRef, open);

  // Cerrar con Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "animate-in fade-in duration-[var(--duration-normal)]"
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={cn(
          "relative w-full bg-[var(--color-background)]",
          "rounded-[var(--radius-2xl)] shadow-[var(--shadow-xl)]",
          "flex flex-col",
          "animate-in zoom-in-95 slide-in-from-bottom-4",
          "duration-[var(--duration-normal)]",
          sizeClasses[size]
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[var(--color-border)]">
          <div className="pr-4">
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descId}
                className="mt-1 text-sm text-[var(--color-text-secondary)]"
              >
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="shrink-0 -mt-1 -mr-1"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-6 pt-4 border-t border-[var(--color-border)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
```

---

## 7. Accesibilidad WCAG 2.1 AA

### 7.1 Checklist de accesibilidad por componente

```
TODOS LOS COMPONENTES:
□ Contraste de color >= 4.5:1 para texto normal, >= 3:1 para texto grande
□ Focus visible con outline claro (ring de 2px mínimo)
□ No depende solo del color para comunicar información
□ Funciona sin ratón (solo teclado)

BOTONES E INTERACTIVOS:
□ aria-label cuando no hay texto visible
□ aria-busy="true" cuando está loading
□ aria-disabled cuando está deshabilitado (o disabled nativo)
□ Tamaño de click target >= 44x44px (WCAG 2.5.8)

FORMULARIOS:
□ <label> asociado con htmlFor al id del input
□ aria-required="true" en campos obligatorios
□ aria-invalid="true" cuando hay error
□ aria-describedby apuntando al mensaje de error

MODALES/DIALOGS:
□ role="dialog" aria-modal="true"
□ aria-labelledby apuntando al título
□ Focus trap activo mientras está abierto
□ Escape cierra el modal
□ Foco regresa al elemento que abrió el modal al cerrar

IMÁGENES:
□ alt descriptivo en imágenes de contenido
□ alt="" en imágenes decorativas
□ No texto en imágenes (si es necesario, incluirlo en alt)

TABLAS:
□ <caption> o aria-label
□ scope="col" en <th> de columna
□ scope="row" en <th> de fila

LIVE REGIONS (notificaciones, toasts):
□ role="alert" para mensajes urgentes (se anuncia inmediatamente)
□ role="status" aria-live="polite" para updates no urgentes
```

### 7.2 Focus management

```typescript
// Hook para manejar focus programáticamente
function useFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  
  const focus = useCallback(() => {
    requestAnimationFrame(() => {
      ref.current?.focus();
    });
  }, []);
  
  return [ref, focus] as const;
}

// Uso
function ConfirmDialog({ onConfirm, onCancel }: Props) {
  const [confirmRef, focusConfirm] = useFocus<HTMLButtonElement>();
  
  // Al abrir, enfocar el botón de confirmar (o cancelar según UX)
  useEffect(() => {
    focusConfirm();
  }, [focusConfirm]);
  
  return (
    <dialog>
      <p>¿Estás seguro?</p>
      <button onClick={onCancel}>Cancelar</button>
      <button ref={confirmRef} onClick={onConfirm}>Confirmar</button>
    </dialog>
  );
}
```

### 7.3 Skip links para keyboard navigation

```typescript
// Agrega al inicio de tu App — permite saltar navegación repetitiva
function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <a
        href="#main-content"
        className="
          fixed top-2 left-2 z-[9999]
          bg-[var(--color-primary)] text-white
          px-4 py-2 rounded-md text-sm font-medium
          focus:not-sr-only
        "
      >
        Saltar al contenido principal
      </a>
    </div>
  );
}
```

---

## 8. Dark Mode

### 8.1 Toggle de dark mode con localStorage

```typescript
// hooks/useTheme.ts
import { useState, useEffect } from "react";

type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme") as Theme) ?? "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && prefersDark);

    root.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, setTheme };
}

// Componente toggle
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={`Cambiar a modo ${theme === "dark" ? "claro" : "oscuro"}`}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
```

### 8.2 Evitar flash of unstyled content (FOUC)

```html
<!-- En el <head> de tu HTML, antes de cualquier CSS -->
<script>
  (function() {
    const theme = localStorage.getItem('theme') || 'system';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  })();
</script>
```

---

## 9. Responsive Design

### 9.1 Mobile-first breakpoints

```css
/* Tailwind defaults — usarlos consistentemente */
/* sm: 640px — Tablets pequeñas / landscape móvil */
/* md: 768px — Tablets */
/* lg: 1024px — Desktop pequeño */
/* xl: 1280px — Desktop */
/* 2xl: 1536px — Desktop grande */

/* Principio: diseñar PRIMERO para móvil, luego agregar md:, lg: */
```

### 9.2 Container responsive

```typescript
function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full mx-auto px-4 sm:px-6 lg:px-8",
        "max-w-7xl",  // 1280px máximo
        className
      )}
    >
      {children}
    </div>
  );
}
```

### 9.3 Grid responsive

```typescript
// Grid que adapta columnas según viewport
function ResponsiveGrid({
  children,
  cols = { sm: 1, md: 2, lg: 3 },
}: {
  children: React.ReactNode;
  cols?: { sm?: number; md?: number; lg?: number };
}) {
  const colClasses = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  return (
    <div
      className={cn(
        "grid gap-4 md:gap-6",
        cols.sm && colClasses[cols.sm as keyof typeof colClasses],
        cols.md && `md:${colClasses[cols.md as keyof typeof colClasses]}`,
        cols.lg && `lg:${colClasses[cols.lg as keyof typeof colClasses]}`
      )}
    >
      {children}
    </div>
  );
}
```

---

## 10. Sistema de Animaciones

### 10.1 Motion tokens y reduced motion

```css
/* Respetar preferencia del usuario — OBLIGATORIO */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 10.2 Framer Motion — Patrones comunes

```typescript
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// Hook para respetar preferencias del sistema
function useMotion() {
  const prefersReduced = useReducedMotion();
  
  return {
    // Si prefers-reduced-motion, duración mínima
    transition: prefersReduced
      ? { duration: 0 }
      : { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
    
    springTransition: prefersReduced
      ? { duration: 0 }
      : { type: "spring", stiffness: 300, damping: 30 },
  };
}

// Variantes reutilizables
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

// Uso en listas con stagger
function AnimatedList({ items }: { items: string[] }) {
  return (
    <AnimatePresence>
      {items.map((item, i) => (
        <motion.div
          key={item}
          variants={slideUp}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{
            duration: 0.2,
            delay: i * 0.05,  // Stagger de 50ms por ítem
          }}
        >
          {item}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
```

---

## 11. Patrones de Datos

### 11.1 Loading Skeleton

```typescript
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--color-neutral-200)]",
        "dark:bg-[var(--color-neutral-700)]",
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

// Skeleton de card
function CardSkeleton() {
  return (
    <div className="p-6 space-y-4" aria-label="Cargando...">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}
```

### 11.2 Empty State

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      role="status"
    >
      {icon && (
        <div className="mb-4 text-[var(--color-text-disabled)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-[var(--color-text-secondary)] max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="primary"
          size="sm"
          className="mt-4"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

---

## 12. Storybook Integration

### 12.1 Configuración base

```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { Plus, Trash } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "danger", "outline"],
      description: "Visual variant del botón",
    },
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg"],
    },
    loading: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
    fullWidth: {
      control: "boolean",
    },
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: "Componente base de botón con 5 variantes, 4 tamaños y estados de loading/disabled.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Historia base — usa los args de argTypes
export const Default: Story = {
  args: {
    children: "Botón",
    variant: "primary",
    size: "md",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 items-center">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 items-center">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button leftIcon={<Plus size={16} />}>Agregar</Button>
      <Button variant="danger" leftIcon={<Trash size={16} />}>Eliminar</Button>
    </div>
  ),
};

export const Loading: Story = {
  args: {
    children: "Guardando...",
    loading: true,
    variant: "primary",
  },
};
```

---

## 13. Governance del Design System

### 13.1 Versionado semántico

```
MAJOR.MINOR.PATCH

MAJOR — breaking changes (cambios que rompen la API del componente)
  Ejemplos: renombrar props, cambiar tipo de prop, eliminar variante
  Requiere: Migration guide obligatorio

MINOR — features nuevas backward compatible
  Ejemplos: nueva variante, nueva prop opcional, nuevo componente
  Requiere: Update en docs y stories

PATCH — bug fixes y mejoras de accesibilidad
  Ejemplos: fix de contraste, fix de focus, corrección de estilos
  No requiere migración
```

### 13.2 Proceso de deprecation

```typescript
// Deprecar con warning en desarrollo
interface ButtonProps {
  /** @deprecated Use `variant="danger"` instead. Will be removed in v3.0 */
  destructive?: boolean;
  variant?: ButtonVariant;
}

function Button({ destructive, variant, ...props }: ButtonProps) {
  if (process.env.NODE_ENV !== "production" && destructive !== undefined) {
    console.warn(
      "[Button] La prop `destructive` está deprecada. " +
      "Usa `variant=\"danger\"` en su lugar. " +
      "Se eliminará en la versión 3.0."
    );
  }
  
  const resolvedVariant = destructive ? "danger" : variant;
  // ...
}
```

### 13.3 Checklist para nuevo componente

```
ANTES DE CREAR:
□ ¿Ya existe un componente similar que se pueda extender?
□ ¿Se usará en 3+ lugares? Si no → componente local, no global

DURANTE DESARROLLO:
□ TypeScript estricto (sin any, con generics donde aplica)
□ forwardRef para todos los componentes que wrappean elementos DOM
□ displayName establecido
□ Props con valores por defecto sensatos
□ aria-* correctos según el rol ARIA
□ focus visible con ring en todos los estados interactivos
□ Contraste verificado en light y dark mode
□ Tested en keyboard-only navigation

ANTES DE PUBLICAR:
□ Story con todas las variantes documentadas
□ Story de accesibilidad (a11y addon sin errores)
□ Tests de renderizado y accesibilidad (jest-axe)
□ Entrada en CHANGELOG.md
□ PR con captura de pantalla en light y dark mode
```

---

## 14. Tailwind v4 Patterns Específicos

### 14.1 @layer para estilos base

```css
/* src/index.css */
@import "tailwindcss";

@layer base {
  /* Reset opinado */
  *, *::before, *::after {
    box-sizing: border-box;
  }
  
  html {
    font-family: var(--font-sans);
    color: var(--color-text-primary);
    background: var(--color-background);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  /* Scroll behavior respetando preferencias */
  @media (prefers-reduced-motion: no-preference) {
    html {
      scroll-behavior: smooth;
    }
  }
  
  /* Focus visible global */
  :focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}

@layer components {
  /* Componentes CSS puro si se usan muchas veces */
  .card-base {
    @apply rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)];
  }
  
  .input-base {
    @apply w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)];
    @apply focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20;
    @apply transition-colors duration-[var(--duration-fast)];
  }
}
```

### 14.2 Utilidades con @theme en v4

```css
@theme {
  /* Colores custom accesibles como bg-brand-*, text-brand-* */
  --color-brand-50: #eff6ff;
  --color-brand-500: #2563eb;
  --color-brand-900: #1e3a8a;
  
  /* Fuentes custom */
  --font-display: "Cal Sans", var(--font-sans);
  
  /* Animaciones custom */
  --animate-shimmer: shimmer 2s linear infinite;
}

@keyframes shimmer {
  from { background-position: -200% 0; }
  to { background-position: 200% 0; }
}

/* Uso: className="bg-brand-500 font-display animate-shimmer" */
```

---

## Recursos y Referencias

- WCAG 2.1 Quick Reference: https://www.w3.org/WAI/WCAG21/quickref/
- ARIA Authoring Practices Guide: https://www.w3.org/WAI/ARIA/apg/
- Tailwind CSS v4 Docs: https://tailwindcss.com/docs
- Radix UI Primitives: https://www.radix-ui.com/primitives
- Framer Motion: https://www.framer.com/motion/
- Storybook Docs: https://storybook.js.org/docs
- Color contrast checker: https://webaim.org/resources/contrastchecker/
- A11y Project Checklist: https://www.a11yproject.com/checklist/
