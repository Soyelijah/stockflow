# Frontend Design Implementation Guide

## I. Component Architecture Patterns

### 1.1 Atomic Design System

Structure components hierarchically for scalability and reusability:

**Atoms** (base components, no dependencies)
- Button, Badge, Icon, TextField, Label
- Typical file: `src/components/atoms/Button.tsx`
- Props: `variant`, `size`, `disabled`, `onClick`, children
- No business logic, pure UI

**Molecules** (combinations of atoms)
- SearchInput (TextField + Icon + Button)
- FormField (Label + TextField + ErrorMessage)
- CardHeader (Heading + Icon + Action)
- Responsibility: Combine atoms with minimal logic

**Organisms** (complex UI sections)
- NavBar, Sidebar, Modal, Card with footer
- Can include business logic
- Handle composition of molecules and atoms

**Templates** (page-level layouts)
- AuthLayout, DashboardLayout, ContentLayout
- Define spacing, grid, regions
- No content, structure only

**Pages** (concrete implementations)
- LoginPage, DashboardPage
- Inject data and services
- Business logic and state management

### 1.2 Component Composition Rules

```typescript
// Bad: Monolithic component
export function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  // 300+ lines mixing data, UI, styling
}

// Good: Composed architecture
export function UserProfile({ userId }) {
  return (
    <UserLayout>
      <UserHeader userId={userId} />
      <UserBio userId={userId} />
      <UserPosts userId={userId} />
    </UserLayout>
  );
}
```

**Composition principles:**
- Each component has single responsibility
- Data fetching in container components (hooks)
- Presentation logic in presentational components
- Custom hooks for shared logic (`useUser`, `usePosts`)

### 1.3 Prop Interface Design

```typescript
// Define clear, extensible prop interfaces
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

// Avoid prop drilling with Context when >3 levels
interface LayoutContextType {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  theme: 'light' | 'dark';
}

export const LayoutContext = createContext<LayoutContextType | null>(null);
```

### 1.4 Component Folder Structure

```
src/components/
├── atoms/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.module.css
│   │   └── Button.test.tsx
│   ├── Icon/
│   ├── Badge/
│   └── TextField/
├── molecules/
│   ├── SearchInput/
│   ├── FormField/
│   └── Card/
├── organisms/
│   ├── NavBar/
│   ├── Sidebar/
│   └── Modal/
├── templates/
│   ├── AuthLayout/
│   └── DashboardLayout/
├── hooks/
│   ├── useUser.ts
│   ├── usePosts.ts
│   └── useDebounce.ts
└── contexts/
    ├── AuthContext.tsx
    └── ThemeContext.tsx
```

---

## II. Responsive Design Systems

### 2.1 Mobile-First Approach

```typescript
// Tailwind: mobile-first breakpoints
// Default (mobile): < 640px
// sm: 640px and up
// md: 768px and up
// lg: 1024px and up
// xl: 1280px and up
// 2xl: 1536px and up

export function ResponsiveGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* 1 column mobile, 2 medium, 3 large, 4 extra-large */}
      <Card />
    </div>
  );
}
```

### 2.2 Fluid Typography & Spacing

```typescript
// CSS custom properties for fluid values
// Using CSS clamp for responsive sizing
export function FluidText() {
  return (
    <h1 className="text-[clamp(1.5rem,5vw,3rem)]">
      Responsive heading (scales with viewport)
    </h1>
  );
}

// Spacing scale: 4px base unit
// Tailwind: p-1 (4px), p-2 (8px), p-4 (16px), p-8 (32px)
const spacingScale = {
  xs: '0.25rem',  // 4px
  sm: '0.5rem',   // 8px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
  '2xl': '3rem',  // 48px
};
```

### 2.3 Responsive Image Strategy

```typescript
// Use picture element for art direction
export function ResponsiveHero() {
  return (
    <picture>
      <source media="(max-width: 640px)" srcSet="/hero-mobile.jpg" />
      <source media="(min-width: 641px)" srcSet="/hero-desktop.jpg" />
      <img src="/hero-desktop.jpg" alt="Hero" className="w-full h-auto" />
    </picture>
  );
}

// Next.js Image component (automatic optimization)
import Image from 'next/image';

export function OptimizedImage() {
  return (
    <Image
      src="/image.jpg"
      alt="Description"
      width={1200}
      height={600}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      priority={false}
    />
  );
}
```

### 2.4 Container Queries (Modern Approach)

```typescript
// Containers that respond to their own width, not viewport
export function CardContainer() {
  return (
    <div className="@container p-4">
      <div className="text-sm @sm:text-base @md:text-lg @lg:text-xl">
        Text scales based on container, not viewport
      </div>
    </div>
  );
}

// Tailwind config setup
module.exports = {
  theme: {
    extend: {
      containers: {
        xs: '20rem',
        sm: '30rem',
        md: '40rem',
        lg: '50rem',
      },
    },
  },
};
```

---

## III. CSS Architecture

### 3.1 BEM (Block Element Modifier)

```css
/* Block: standalone entity */
.card {
  padding: 1rem;
  border-radius: 8px;
  background: var(--color-surface);
}

/* Element: part of block */
.card__header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.card__title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* Modifier: variation of block/element */
.card--elevated {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card__title--secondary {
  color: var(--color-text-secondary);
  font-weight: 400;
}
```

**BEM in React with CSS Modules:**
```typescript
import styles from './Card.module.css';

export function Card({ elevated, children, title }) {
  return (
    <div className={`${styles.card} ${elevated ? styles['card--elevated'] : ''}`}>
      <div className={styles.card__header}>
        <h2 className={styles.card__title}>{title}</h2>
      </div>
      <div className={styles.card__body}>{children}</div>
    </div>
  );
}
```

### 3.2 CSS Modules Approach

```typescript
// Button.module.css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.button:hover {
  transform: translateY(-2px);
}

.primary {
  background-color: var(--color-primary);
  color: white;
}

.primary:hover {
  background-color: var(--color-primary-dark);
}

// Button.tsx
import styles from './Button.module.css';

export function Button({ variant = 'primary', children, ...props }) {
  return (
    <button className={`${styles.button} ${styles[variant]}`} {...props}>
      {children}
    </button>
  );
}
```

### 3.3 CSS-in-JS with Emotion

```typescript
import { css } from '@emotion/react';
import styled from '@emotion/styled';

// Styled component approach
export const StyledButton = styled.button<{ variant: 'primary' | 'secondary' }>`
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;

  background-color: ${(props) =>
    props.variant === 'primary'
      ? 'var(--color-primary)'
      : 'var(--color-surface)'};

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// CSS approach
export const buttonStyles = (variant: string) =>
  css`
    display: inline-flex;
    align-items: center;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    background-color: ${variant === 'primary'
      ? 'var(--color-primary)'
      : 'var(--color-surface)'};
  `;
```

### 3.4 Tailwind CSS Best Practices

```typescript
// ✓ Good: Use Tailwind classes directly
export function Card() {
  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Title</h2>
      <p className="text-gray-600">Content</p>
    </div>
  );
}

// ✗ Bad: Dynamic class construction (JIT compiler breaks)
const bgColor = 'blue'; // ✗ bg-${bgColor}-500 won't work
<div className={`bg-${bgColor}-500`} /> // ✗ JIT can't parse this

// ✓ Good: Use inline styles or mapping for dynamic values
const colorMap = {
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  green: 'bg-green-500',
};
<div className={colorMap[bgColor]} />

// ✓ Or use CSS variables
export function DynamicCard({ accentColor }) {
  return (
    <div
      style={{ '--accent': accentColor } as React.CSSProperties}
      className="rounded-lg bg-white p-6 shadow-md"
    >
      Content
    </div>
  );
}
```

**Tailwind Configuration (tailwind.config.js):**
```javascript
module.exports = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/pages/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          900: '#0c2d48',
        },
      },
      spacing: {
        '128': '32rem',
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
```

---

## IV. Animation Patterns

### 4.1 Framer Motion Essentials

```typescript
import { motion } from 'framer-motion';

// Basic animation on mount/unmount
export function FadeInCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="rounded-lg bg-white p-6 shadow-md"
    >
      Fades in and slides up on mount
    </motion.div>
  );
}

// Staggered children animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function AnimatedList({ items }) {
  return (
    <motion.ul variants={containerVariants} initial="hidden" animate="visible">
      {items.map((item) => (
        <motion.li key={item.id} variants={itemVariants}>
          {item.name}
        </motion.li>
      ))}
    </motion.ul>
  );
}

// Gesture animations (hover, tap, drag)
export function InteractiveCard() {
  return (
    <motion.div
      whileHover={{ scale: 1.05, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
      whileTap={{ scale: 0.98 }}
      drag
      dragElastic={0.2}
      dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
      className="cursor-grab rounded-lg bg-white p-6 active:cursor-grabbing"
    >
      Drag me around
    </motion.div>
  );
}
```

### 4.2 Scroll-Triggered Animations

```typescript
import { useInView } from 'framer-motion';
import { useRef } from 'react';

export function ScrollTriggeredSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6 }}
    >
      Animates when scrolled into view
    </motion.section>
  );
}
```

### 4.3 CSS Transition Patterns

```typescript
// CSS Transitions in Tailwind
export function TransitionExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        Content appears/disappears
      </motion.div>
    </div>
  );
}

// CSS class transitions
export function CSSTransitions() {
  return (
    <div className="transition-all duration-300 ease-in-out hover:shadow-lg hover:scale-105">
      Smooth transition on hover
    </div>
  );
}
```

### 4.4 Performance Optimization for Animations

```typescript
// Use transform and opacity (GPU-accelerated)
export function PerformantAnimation() {
  return (
    <motion.div
      // ✓ Good: GPU-accelerated properties
      animate={{
        x: 100,
        y: 50,
        opacity: 0.5,
        scale: 1.1,
        rotate: 45,
      }}
      transition={{ duration: 0.3 }}
    >
      Uses transform + opacity (fast)
    </motion.div>
  );
}

// ✗ Avoid animating width/height (expensive)
// Use scale/transform instead when possible

// Use will-change CSS for expensive animations
export function WillChangeOptimization() {
  return (
    <div style={{ willChange: 'transform, opacity' }}>
      Tells browser to prepare for animation
    </div>
  );
}
```

---

## V. Accessibility (WCAG 2.1 AA)

### 5.1 Semantic HTML

```typescript
// ✓ Good: Semantic elements
export function AccessibleNav() {
  return (
    <nav aria-label="Main navigation">
      <ul role="list">
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
      </ul>
    </nav>
  );
}

// ✗ Bad: Non-semantic divs
export function BadNav() {
  return (
    <div>
      <div>
        <div onClick={() => navigate('/')}>Home</div>
      </div>
    </div>
  );
}
```

### 5.2 ARIA Attributes

```typescript
// Dialog/Modal
export function AccessibleModal({ isOpen, onClose, title }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-hidden={!isOpen}
    >
      <h2 id="dialog-title">{title}</h2>
      <button aria-label="Close dialog" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

// Loading state
export function LoadingSpinner() {
  return <div role="status" aria-live="polite">Loading...</div>;
}

// List region
export function AccessibleList({ items }) {
  return (
    <ul role="list" aria-label="Search results">
      {items.map((item) => (
        <li key={item.id} role="listitem">
          {item.name}
        </li>
      ))}
    </ul>
  );
}
```

### 5.3 Keyboard Navigation

```typescript
// Keyboard-accessible button
export function AccessibleButton({ onClick, children }) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <button
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {children}
    </button>
  );
}

// Tab order management
export function Form() {
  return (
    <form>
      <input type="text" placeholder="Name" tabIndex={0} />
      <input type="email" placeholder="Email" tabIndex={1} />
      <button type="submit" tabIndex={2}>Submit</button>
    </form>
  );
}
```

### 5.4 Color Contrast & Readability

```typescript
// Ensure 4.5:1 contrast ratio for normal text, 3:1 for large text
export const accessibleColors = {
  textPrimary: '#1a202c', // dark gray on white: 12:1
  textSecondary: '#4a5568', // medium gray on white: 7:1
  textInverse: '#ffffff', // white on dark: 21:1
  focusRing: '#0ea5e9', // blue: 3.6:1 on white
};

// Font sizing guidelines
export function TextHierarchy() {
  return (
    <>
      <h1 className="text-4xl font-bold">Heading 1 (36px, weight 700)</h1>
      <h2 className="text-3xl font-semibold">Heading 2 (28px, weight 600)</h2>
      <p className="text-base leading-relaxed">Body text (16px, line-height 1.5)</p>
    </>
  );
}
```

### 5.5 Accessibility Checklist

- [ ] All images have alt text (`<img alt="..." />`)
- [ ] Form inputs have associated labels (`<label htmlFor="..." />`)
- [ ] Color is not sole means of conveying information
- [ ] 4.5:1 contrast ratio for normal text, 3:1 for large text
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus indicators visible (`:focus-visible`, ring classes)
- [ ] ARIA landmarks: `<nav>`, `<main>`, `<footer>`, `role="region"`
- [ ] Links have descriptive text (not "click here")
- [ ] Error messages clear and associated with form fields
- [ ] Dynamic content updates announced (`aria-live="polite"`)
- [ ] No content on hover-only (keyboard users can't access)
- [ ] Video/audio has captions and transcripts

---

## VI. Performance Budgets

### 6.1 Web Vitals Targets (Core Web Vitals)

```
Largest Contentful Paint (LCP): < 2.5s
First Input Delay (FID): < 100ms
Cumulative Layout Shift (CLS): < 0.1
```

### 6.2 Bundle Size Budget

```javascript
// package.json
{
  "budgets": [
    {
      "type": "bundle",
      "name": "main",
      "baselines": {
        "gzip": "150kb"
      },
      "thresholds": {
        "gzip": "160kb"
      }
    },
    {
      "type": "bundle",
      "name": "dashboard",
      "baselines": {
        "gzip": "80kb"
      },
      "thresholds": {
        "gzip": "90kb"
      }
    }
  ]
}
```

### 6.3 Code Splitting Strategy

```typescript
// Lazy load routes
import { lazy, Suspense } from 'react';

const DashboardPage = lazy(() => import('./pages/Dashboard'));
const SettingsPage = lazy(() => import('./pages/Settings'));

export function Router() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Suspense>
  );
}

// Lazy load components
const HeavyChart = lazy(() => import('./components/HeavyChart'));

export function ReportPage() {
  const [showChart, setShowChart] = useState(false);

  return (
    <>
      <button onClick={() => setShowChart(true)}>Show Chart</button>
      {showChart && (
        <Suspense fallback={<div>Loading chart...</div>}>
          <HeavyChart />
        </Suspense>
      )}
    </>
  );
}
```

### 6.4 Image Optimization

```typescript
// WebP with fallback
export function OptimizedImage() {
  return (
    <picture>
      <source srcSet="/image.webp" type="image/webp" />
      <img src="/image.jpg" alt="Description" width={800} height={600} />
    </picture>
  );
}

// Responsive images with srcset
export function ResponsiveImage() {
  return (
    <img
      src="/image-600w.jpg"
      srcSet="/image-300w.jpg 300w, /image-600w.jpg 600w, /image-1200w.jpg 1200w"
      sizes="(max-width: 600px) 100vw, 50vw"
      alt="Description"
    />
  );
}
```

---

## VII. Dark Mode Implementation

### 7.1 CSS Custom Properties Approach

```typescript
// theme.css
:root {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-text-primary: #1a202c;
  --color-text-secondary: #4a5568;
  --color-border: #e2e8f0;
}

html[data-theme='dark'] {
  --color-bg-primary: #1a202c;
  --color-bg-secondary: #2d3748;
  --color-text-primary: #f7fafc;
  --color-text-secondary: #cbd5e0;
  --color-border: #4a5568;
}

// component.css
.card {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}
```

### 7.2 React Context for Theme Switching

```typescript
import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const currentTheme = theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

    setIsDark(currentTheme === 'dark');
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

// Usage
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle theme
    </button>
  );
}
```

### 7.3 Tailwind Dark Mode

```typescript
// tailwind.config.js
module.exports = {
  darkMode: 'class', // or 'media' for system preference
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#0ea5e9',
          dark: '#38bdf8',
        },
      },
    },
  },
};

// Component with dark mode colors
export function Card() {
  return (
    <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <h2 className="text-blue-600 dark:text-blue-400">Title</h2>
    </div>
  );
}
```

---

## VIII. Design Tokens to Code

### 8.1 Token Definition

```typescript
// tokens/tokens.ts
export const tokens = {
  colors: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      500: '#0ea5e9',
      900: '#0c2d48',
    },
    semantic: {
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
      info: '#3b82f6',
    },
  },
  typography: {
    fonts: {
      sans: 'system-ui, -apple-system, sans-serif',
      mono: '"Monaco", "Courier New", monospace',
    },
    sizes: {
      xs: '0.75rem',   // 12px
      sm: '0.875rem',  // 14px
      base: '1rem',    // 16px
      lg: '1.125rem',  // 18px
      xl: '1.25rem',   // 20px
      '2xl': '1.5rem', // 24px
    },
    weights: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.1)',
  },
  radii: {
    sm: '0.375rem',   // 6px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    full: '9999px',
  },
};
```

### 8.2 Token Usage in Components

```typescript
import { tokens } from '@/tokens/tokens';

export function Card() {
  return (
    <div
      style={{
        backgroundColor: tokens.colors.primary[50],
        borderRadius: tokens.radii.lg,
        padding: tokens.spacing.md,
        boxShadow: tokens.shadows.md,
      }}
    >
      <h2
        style={{
          fontSize: tokens.typography.sizes.lg,
          fontWeight: tokens.typography.weights.semibold,
          color: tokens.colors.primary[900],
        }}
      >
        Title
      </h2>
    </div>
  );
}
```

### 8.3 Export to Tailwind

```javascript
// tailwind.config.js - generated from tokens
import { tokens } from './src/tokens/tokens.js';

module.exports = {
  theme: {
    colors: tokens.colors,
    spacing: tokens.spacing,
    fontSize: tokens.typography.sizes,
    fontWeight: tokens.typography.weights,
    lineHeight: tokens.typography.lineHeights,
    borderRadius: tokens.radii,
    boxShadow: tokens.shadows,
    fontFamily: tokens.typography.fonts,
  },
};
```

---

## IX. Component Implementation Checklist

- [ ] Component follows atomic design principles
- [ ] Props interface fully typed with TypeScript
- [ ] Component renders correctly on mobile/tablet/desktop
- [ ] Responsive breakpoints tested (xs, sm, md, lg, xl)
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible and styled
- [ ] ARIA attributes present where needed
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Images have descriptive alt text
- [ ] Loading and error states handled
- [ ] Animations perform >60fps
- [ ] Bundle impact analyzed (tree-shaking works)
- [ ] Component tested with axe accessibility scanner
- [ ] Dark mode colors defined
- [ ] Design tokens used consistently
- [ ] Component story in Storybook (if applicable)
- [ ] JSDoc comments explain complex logic

---

## X. Quick Reference: Common Patterns

**Layout Grid:**
```jsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
```

**Flexbox Center:**
```jsx
<div className="flex items-center justify-center">
```

**Responsive Text:**
```jsx
<h1 className="text-2xl md:text-3xl lg:text-4xl">
```

**Focus Ring (Accessibility):**
```jsx
<button className="focus:outline-none focus:ring-2 focus:ring-blue-500">
```

**Dark Mode Toggle:**
```jsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
```

This guide provides production-ready patterns for building scalable, accessible, performant frontend systems.
