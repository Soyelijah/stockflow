# Theme and Design System Factory

## I. Design Tokens Foundation

### 1.1 Token Organization Structure

```typescript
// tokens/tokens.ts - Single source of truth
export const tokens = {
  colors: {
    // ... all colors
  },
  typography: {
    // ... all typography
  },
  spacing: {
    // ... all spacing
  },
  shadows: {
    // ... all shadows
  },
  radii: {
    // ... all border radius
  },
  transitions: {
    // ... all animations
  },
};
```

### 1.2 Color Token System

```typescript
export const colorTokens = {
  // Primitive colors (raw values)
  primitive: {
    white: '#ffffff',
    black: '#000000',
    slate50: '#f9fafb',
    slate100: '#f3f4f6',
    // ... full palette
  },

  // Semantic tokens (meaningful names)
  semantic: {
    // Core actions
    primary: {
      light: '#e0f2fe',
      DEFAULT: '#0ea5e9',
      dark: '#0284c7',
    },
    secondary: {
      light: '#fce7f3',
      DEFAULT: '#ec4899',
      dark: '#be185d',
    },

    // Status/feedback
    success: {
      light: '#dcfce7',
      DEFAULT: '#22c55e',
      dark: '#16a34a',
    },
    warning: {
      light: '#fef3c7',
      DEFAULT: '#eab308',
      dark: '#d97706',
    },
    error: {
      light: '#fee2e2',
      DEFAULT: '#ef4444',
      dark: '#dc2626',
    },
    info: {
      light: '#dbeafe',
      DEFAULT: '#3b82f6',
      dark: '#1d4ed8',
    },

    // Surface/background
    background: {
      primary: '#ffffff',
      secondary: '#f9fafb',
      tertiary: '#f3f4f6',
      disabled: '#f0f0f0',
    },

    // Text
    text: {
      primary: '#1a202c',
      secondary: '#4a5568',
      tertiary: '#718096',
      disabled: '#cbd5e0',
      inverse: '#ffffff',
    },

    // Borders
    border: {
      light: '#e2e8f0',
      DEFAULT: '#cbd5e0',
      dark: '#a0aec0',
    },
  },

  // Component-specific tokens
  component: {
    button: {
      primary: {
        bg: '#0ea5e9',
        text: '#ffffff',
        border: '#0284c7',
        hover: {
          bg: '#0284c7',
        },
      },
      secondary: {
        bg: '#f3f4f6',
        text: '#1a202c',
        border: '#cbd5e0',
        hover: {
          bg: '#e5e7eb',
        },
      },
    },
    input: {
      bg: '#ffffff',
      border: '#cbd5e0',
      text: '#1a202c',
      focus: {
        border: '#0ea5e9',
        ring: 'rgba(14, 165, 233, 0.1)',
      },
    },
  },
};
```

### 1.3 Typography Tokens

```typescript
export const typographyTokens = {
  // Font families
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", "Monaco", monospace',
    serif: 'Georgia, serif',
  },

  // Font sizes (relative to 16px base)
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
  },

  // Font weights
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  // Line heights
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Letter spacing
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },

  // Predefined text styles
  textStyles: {
    h1: {
      fontSize: '2.25rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '1.875rem',
      fontWeight: 600,
      lineHeight: 1.25,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    body: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 500,
      lineHeight: 1.4,
      letterSpacing: '0.05em',
    },
  },
};
```

### 1.4 Spacing Tokens

```typescript
export const spacingTokens = {
  // Base unit: 4px
  0: '0',
  px: '1px',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  2: '0.5rem',      // 8px
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  32: '8rem',       // 128px
};

// Semantic spacing
export const semanticSpacing = {
  // Container padding
  containerPadding: spacingTokens[4],      // 16px

  // Component internal spacing
  component: {
    compact: spacingTokens[2],              // 8px
    normal: spacingTokens[4],               // 16px
    relaxed: spacingTokens[6],              // 24px
  },

  // Vertical rhythm (line spacing)
  rhythm: {
    tight: spacingTokens[3],                // 12px
    normal: spacingTokens[4],               // 16px
    relaxed: spacingTokens[6],              // 24px
  },
};
```

### 1.5 Shadow Tokens

```typescript
export const shadowTokens = {
  none: 'none',

  // Elevation shadows
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.1)',

  // Depth shadows
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',

  // Color-specific shadows (accent colors)
  primary: '0 0 20px rgba(14, 165, 233, 0.3)',
  success: '0 0 20px rgba(34, 197, 94, 0.3)',
  error: '0 0 20px rgba(239, 68, 68, 0.3)',
};
```

### 1.6 Border Radius Tokens

```typescript
export const radiusTokens = {
  none: '0',
  sm: '0.25rem',    // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',   // Pill shape
};
```

---

## II. CSS Custom Properties Architecture

### 2.1 CSS Variable Setup

```css
/* styles/variables.css - Light theme (default) */
:root {
  /* Colors */
  --color-primary: 14 165 233;
  --color-primary-dark: 2 132 199;
  --color-success: 34 197 94;
  --color-error: 239 68 68;
  --color-text: 26 32 44;
  --color-text-secondary: 74 85 104;
  --color-bg: 255 255 255;
  --color-bg-secondary: 249 250 251;
  --color-border: 203 213 225;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: '"JetBrains Mono"', Monaco, monospace;

  /* Spacing */
  --space-0: 0;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

  /* Radii */
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;

  /* Transitions */
  --transition-fast: 0.15s ease-in-out;
  --transition-base: 0.3s ease-in-out;
  --transition-slow: 0.5s ease-in-out;

  /* Color space */
  color-scheme: light;
}

/* Dark theme */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: 56 189 248;
    --color-text: 249 250 251;
    --color-bg: 17 24 39;
    --color-bg-secondary: 31 41 55;
    --color-border: 55 65 81;
    color-scheme: dark;
  }
}

/* Manual dark mode (with class) */
html[data-theme='dark'] {
  --color-primary: 56 189 248;
  --color-text: 249 250 251;
  --color-bg: 17 24 39;
  --color-bg-secondary: 31 41 55;
  --color-border: 55 65 81;
  color-scheme: dark;
}
```

### 2.2 Using CSS Variables

```css
/* components.css */
.button {
  background-color: hsl(var(--color-primary));
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  border: none;
  font-family: var(--font-sans);
  transition: background-color var(--transition-fast);
}

.button:hover {
  background-color: hsl(var(--color-primary-dark));
}

/* Input field */
.input {
  background-color: hsl(var(--color-bg));
  color: hsl(var(--color-text));
  border: 1px solid hsl(var(--color-border));
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
}

.input:focus {
  outline: none;
  border-color: hsl(var(--color-primary));
  box-shadow: 0 0 0 3px hsl(var(--color-primary) / 0.1);
}
```

### 2.3 Scoped Theme Variables

```css
/* Override for specific components */
.card {
  background-color: hsl(var(--color-bg));
  box-shadow: var(--shadow-md);
}

/* Inverse theme for dark sections */
.dark-section {
  --color-bg: 17 24 39;
  --color-text: 249 250 251;
  --color-border: 55 65 81;

  background-color: hsl(var(--color-bg));
  color: hsl(var(--color-text));
}
```

---

## III. Tailwind CSS Customization

### 3.1 Tailwind Config with Custom Tokens

```javascript
// tailwind.config.js
import { tokens } from './src/tokens/tokens.js';

export default {
  content: ['./src/**/*.{ts,tsx}'],

  theme: {
    extend: {
      // Colors mapped from tokens
      colors: {
        primary: {
          50: tokens.colors.primary[50],
          100: tokens.colors.primary[100],
          500: tokens.colors.primary[500],
          600: tokens.colors.primary[600],
          900: tokens.colors.primary[900],
        },
        success: tokens.colors.semantic.success,
        error: tokens.colors.semantic.error,
      },

      // Typography
      fontSize: tokens.typography.sizes,
      fontWeight: tokens.typography.weights,
      lineHeight: tokens.typography.lineHeights,
      fontFamily: {
        sans: tokens.typography.fonts.sans,
        mono: tokens.typography.fonts.mono,
      },

      // Spacing
      spacing: tokens.spacing,
      gap: tokens.spacing,

      // Shadows
      boxShadow: tokens.shadows,

      // Border radius
      borderRadius: tokens.radii,

      // Transitions
      transitionDuration: {
        fast: '150ms',
        base: '300ms',
        slow: '500ms',
      },
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
      },
    },
  },

  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
```

### 3.2 Tailwind Dark Mode Configuration

```javascript
// tailwind.config.js
export default {
  // Option 1: Class-based dark mode
  darkMode: 'class',

  // Option 2: System preference (prefers-color-scheme)
  // darkMode: 'media',

  // Option 3: Custom selector
  // darkMode: ['class', '[data-theme="dark"]'],

  theme: {
    extend: {
      colors: {
        // Colors adapt automatically with dark: prefix
        background: {
          light: '#ffffff',
          dark: '#1a202c',
        },
      },
    },
  },
};
```

### 3.3 Using Tailwind with Dark Mode

```typescript
export function Card() {
  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-6 rounded-lg shadow-md dark:shadow-lg">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
        Card Title
      </h2>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Card content
      </p>
    </div>
  );
}
```

---

## IV. Shadcn/UI Theming

### 4.1 Shadcn CSS Variables

```css
/* styles/globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --muted: 221.2 63.6% 97.8%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 222.2 47.4% 11.2%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.3% 65.1%;
    --accent: 210 40% 98%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

### 4.2 Shadcn Component Theming

```typescript
// components/ui/button.tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

---

## V. Material UI Theming

### 5.1 MUI Theme Configuration

```typescript
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0ea5e9',
      light: '#38bdf8',
      dark: '#0284c7',
      contrastText: '#fff',
    },
    secondary: {
      main: '#ec4899',
    },
    success: {
      main: '#22c55e',
    },
    error: {
      main: '#ef4444',
    },
    warning: {
      main: '#eab308',
    },
    info: {
      main: '#3b82f6',
    },
    background: {
      default: '#ffffff',
      paper: '#f9fafb',
    },
    text: {
      primary: 'rgba(26, 32, 44, 1)',
      secondary: 'rgba(74, 85, 104, 0.7)',
    },
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    h1: {
      fontSize: '2.25rem',
      fontWeight: 700,
    },
    h2: {
      fontSize: '1.875rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <YourApp />
    </ThemeProvider>
  );
}
```

---

## VI. Component Variants System

### 6.1 Class Variance Authority (CVA)

```typescript
import { cva, type VariantProps } from "class-variance-authority"

// Define variants declaratively
const buttonStyles = cva(
  // Base styles (always applied)
  "px-4 py-2 rounded-md font-semibold transition-colors",
  {
    variants: {
      // Variant groups
      intent: {
        primary: "bg-blue-600 text-white hover:bg-blue-700",
        secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        small: "px-3 py-1 text-sm",
        medium: "px-4 py-2 text-base",
        large: "px-6 py-3 text-lg",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
      },
    },
    compoundVariants: [
      // Variants that depend on multiple conditions
      {
        intent: "primary",
        disabled: true,
        className: "bg-blue-300",
      },
    ],
    defaultVariants: {
      intent: "primary",
      size: "medium",
    },
  }
)

// TypeScript-safe component
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles>

export const Button = ({ intent, size, disabled, ...props }: ButtonProps) => (
  <button
    className={buttonStyles({ intent, size, disabled })}
    disabled={disabled}
    {...props}
  />
)
```

### 6.2 Styled Components Variants

```typescript
import styled, { css } from 'styled-components';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'small' | 'medium' | 'large';

const buttonVariants = {
  primary: css`
    background-color: var(--color-primary);
    color: white;

    &:hover {
      background-color: var(--color-primary-dark);
    }
  `,
  secondary: css`
    background-color: var(--color-bg-secondary);
    color: var(--color-text);
    border: 1px solid var(--color-border);

    &:hover {
      background-color: var(--color-border);
    }
  `,
  danger: css`
    background-color: var(--color-error);
    color: white;

    &:hover {
      opacity: 0.9;
    }
  `,
};

const buttonSizes = {
  small: css`
    padding: var(--space-1) var(--space-3);
    font-size: 0.875rem;
  `,
  medium: css`
    padding: var(--space-2) var(--space-4);
    font-size: 1rem;
  `,
  large: css`
    padding: var(--space-3) var(--space-6);
    font-size: 1.125rem;
  `,
};

export const StyledButton = styled.button<{
  variant: ButtonVariant;
  size: ButtonSize;
}>`
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-sans);
  font-weight: 600;
  transition: background-color var(--transition-fast);

  ${(props) => buttonVariants[props.variant]}
  ${(props) => buttonSizes[props.size]}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
```

---

## VII. Theme Switching Implementation

### 7.1 React Context Theme Provider

```typescript
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Restore from localStorage
    return (localStorage.getItem('theme') as Theme) || 'system';
  });

  const [isDark, setIsDark] = useState(false);

  // Update HTML class and CSS variables
  useEffect(() => {
    const resolvedTheme = theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

    setIsDark(resolvedTheme === 'dark');
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');

    // Persist preference
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen to system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        setIsDark(mediaQuery.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

### 7.2 Theme Toggle Component

```typescript
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setTheme('light')}
        className={theme === 'light' ? 'text-blue-600' : 'text-gray-600'}
        title="Light mode"
      >
        ☀️
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={theme === 'dark' ? 'text-blue-600' : 'text-gray-600'}
        title="Dark mode"
      >
        🌙
      </button>
      <button
        onClick={() => setTheme('system')}
        className={theme === 'system' ? 'text-blue-600' : 'text-gray-600'}
        title="System"
      >
        💻
      </button>
    </div>
  );
}
```

---

## VIII. Token Generation and Export

### 8.1 Generate CSS Variables

```typescript
// scripts/generate-css-variables.ts
import { tokens } from '../src/tokens/tokens';
import * as fs from 'fs';

function tokensToCss(tokens: any, prefix = '') {
  let css = '';

  for (const [key, value] of Object.entries(tokens)) {
    const varName = prefix
      ? `--${prefix}-${key}`
      : `--${key}`;

    if (typeof value === 'object') {
      // Recursively handle nested objects
      css += tokensToCss(value, varName.replace('--', ''));
    } else {
      css += `  ${varName}: ${value};\n`;
    }
  }

  return css;
}

const cssContent = `:root {\n${tokensToCss(tokens)}\n}`;

fs.writeFileSync(
  'src/styles/generated-variables.css',
  cssContent
);

console.log('✓ CSS variables generated');
```

### 8.2 Export to JSON (for design tools)

```typescript
// scripts/export-tokens.ts
import { tokens } from '../src/tokens/tokens';
import * as fs from 'fs';

// Transform tokens to design tool format
const designTokens = {
  colors: tokens.colors,
  typography: tokens.typography,
  spacing: tokens.spacing,
  shadows: tokens.shadows,
  radii: tokens.radii,
};

fs.writeFileSync(
  'tokens.json',
  JSON.stringify(designTokens, null, 2)
);

console.log('✓ Tokens exported to tokens.json');
```

### 8.3 Generate Figma Plugin File

```typescript
// scripts/export-figma-tokens.ts
// Exports to format compatible with Figma Tokens plugin

const figmaTokens = {
  global: {
    colors: {
      primary: {
        value: tokens.colors.primary[500],
        type: 'color',
      },
      success: {
        value: tokens.colors.semantic.success[500],
        type: 'color',
      },
    },
    spacing: {
      base: {
        value: tokens.spacing.md,
        type: 'sizing',
      },
    },
  },
};

// Save as tokens.json for Figma plugin
```

---

## IX. Testing Theme System

### 9.1 Theme Consistency Tests

```typescript
// tests/theme.test.ts
import { describe, it, expect } from 'vitest';
import { tokens } from '../src/tokens/tokens';

describe('Theme tokens', () => {
  it('should have all required color groups', () => {
    expect(tokens.colors).toHaveProperty('primary');
    expect(tokens.colors).toHaveProperty('semantic');
    expect(tokens.colors).toHaveProperty('neutral');
  });

  it('should have valid hex color values', () => {
    const hexRegex = /^#[0-9A-F]{6}$/i;

    Object.values(tokens.colors.primary).forEach((color) => {
      expect(typeof color).toBe('string');
      expect(color).toMatch(hexRegex);
    });
  });

  it('should have complete typography scale', () => {
    expect(tokens.typography.sizes).toHaveProperty('xs');
    expect(tokens.typography.sizes).toHaveProperty('base');
    expect(tokens.typography.sizes).toHaveProperty('2xl');
  });

  it('should have balanced spacing scale', () => {
    const spacingValues = Object.values(tokens.spacing);
    expect(spacingValues.length).toBeGreaterThan(5);
  });

  it('contrast ratio should meet WCAG AA', () => {
    // Test with color-contrast library
    const contrast = getContrast(
      tokens.colors.neutral[900],
      '#ffffff'
    );
    expect(contrast).toBeGreaterThan(4.5);
  });
});
```

### 9.2 Dark Mode Tests

```typescript
describe('Dark mode theme', () => {
  it('should apply dark theme class', () => {
    document.documentElement.classList.add('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should toggle theme on button click', async () => {
    render(<ThemeToggle />);
    const darkButton = screen.getByTitle('Dark mode');

    fireEvent.click(darkButton);

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe(
        'dark'
      );
    });
  });

  it('should persist theme preference', () => {
    render(<ThemeProvider><App /></ThemeProvider>);

    // Change theme
    const darkButton = screen.getByTitle('Dark mode');
    fireEvent.click(darkButton);

    // Check localStorage
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
```

---

## X. Theme Factory Checklist

- [ ] All design tokens defined (colors, typography, spacing, shadows, radii)
- [ ] CSS custom properties set up with light/dark variants
- [ ] Tailwind config extended with custom tokens
- [ ] Dark mode implemented (CSS class or media query)
- [ ] Theme context provider created and wired into app
- [ ] Theme toggle component created
- [ ] Shadcn/UI colors aligned with brand palette
- [ ] All components use semantic color tokens (not arbitrary colors)
- [ ] Dark mode colors tested for contrast (WCAG AA minimum)
- [ ] Theme tokens exported for design tools (Figma, etc.)
- [ ] Theme switching persisted to localStorage
- [ ] System preference (prefers-color-scheme) respected
- [ ] Theme tests written and passing
- [ ] Design system documentation generated
- [ ] Token generation scripts automated

This factory approach ensures consistency across all design tokens and enables rapid, scalable theme management.
