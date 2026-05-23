# Brand Guidelines and Identity Management

## I. Color Systems

### 1.1 Core Color Palette

Define primary, secondary, and semantic colors with multiple shades:

```typescript
export const brandColors = {
  // Primary: Brand identity, CTAs, key elements
  primary: {
    50: '#f0f9ff',   // Lightest (hover states, disabled)
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',  // Standard (primary buttons, links)
    600: '#0284c7',  // Dark (active states, hover on buttons)
    700: '#0369a1',
    800: '#075985',
    900: '#0c2d48',  // Darkest
  },

  // Secondary: Accent, alternative actions
  secondary: {
    50: '#fdf2f8',
    500: '#ec4899',  // Pink
    600: '#be185d',
    900: '#500724',
  },

  // Semantic: Context-specific meaning
  semantic: {
    success: {
      50: '#f0fdf4',
      500: '#22c55e',
      900: '#14532d',
    },
    warning: {
      50: '#fefce8',
      500: '#eab308',
      900: '#78350f',
    },
    error: {
      50: '#fef2f2',
      500: '#ef4444',
      900: '#7f1d1d',
    },
    info: {
      50: '#eff6ff',
      500: '#3b82f6',
      900: '#1e3a8a',
    },
  },

  // Neutrals: Text, backgrounds, borders
  neutral: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',  // Secondary text
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};
```

### 1.2 Color Usage Rules

```typescript
// ✓ CORRECT: Using predefined colors
const cardStyle = {
  backgroundColor: brandColors.neutral[50],
  borderColor: brandColors.neutral[200],
  color: brandColors.neutral[900],
};

// ✗ INCORRECT: Arbitrary colors
const cardStyle = {
  backgroundColor: '#f5f5f5',  // Doesn't match system
  borderColor: '#cccccc',
};

// Color application patterns
export const colorPatterns = {
  // Text
  textPrimary: brandColors.neutral[900],
  textSecondary: brandColors.neutral[600],
  textTertiary: brandColors.neutral[500],
  textDisabled: brandColors.neutral[400],

  // Interactive elements
  buttonPrimary: brandColors.primary[500],
  buttonPrimaryHover: brandColors.primary[600],
  buttonSecondary: brandColors.neutral[200],
  buttonSecondaryHover: brandColors.neutral[300],

  // Feedback
  successBackground: brandColors.semantic.success[50],
  successBorder: brandColors.semantic.success[200],
  successText: brandColors.semantic.success[900],

  // Surfaces
  surfacePrimary: '#ffffff',
  surfaceSecondary: brandColors.neutral[50],
  surfaceInverse: brandColors.neutral[900],
  surfaceDisabled: brandColors.neutral[100],
};
```

### 1.3 Color Accessibility

```typescript
// Contrast ratios (WCAG AA standard)
// Normal text: 4.5:1
// Large text: 3:1
// UI components: 3:1

export const contrastChecks = {
  // ✓ PASS: 12:1 (excellent)
  text: {
    color: brandColors.neutral[900],
    background: '#ffffff',
    ratio: '12:1',
  },

  // ✓ PASS: 4.5:1 (minimum for normal text)
  lightText: {
    color: brandColors.neutral[600],
    background: '#ffffff',
    ratio: '4.5:1',
  },

  // ✗ FAIL: 2.5:1 (too low)
  disabledText: {
    color: brandColors.neutral[300],
    background: '#ffffff',
    ratio: '2.5:1', // Don't use this combination
  },
};

// Test contrast with: https://webaim.org/resources/contrastchecker/
```

### 1.4 Dark Mode Colors

```typescript
export const darkModeColors = {
  // Light colors become dark in dark mode
  primary: {
    50: '#0c2d48',   // Was lightest, now darkest
    500: '#38bdf8',  // Lighter variant for readability
    900: '#f0f9ff',  // Was darkest, now lightest
  },

  neutral: {
    50: '#111827',   // Dark background
    900: '#f9fafb',  // Light text
  },

  // Implementation: CSS custom properties
  // :root { --color-primary: 0 0% 100%; }
  // html[data-theme='dark'] { --color-primary: 15 100% 50%; }
};
```

---

## II. Typography System

### 2.1 Font Selection

```typescript
export const typography = {
  // Typefaces
  fontFamily: {
    sans: {
      name: 'Inter',
      weight: '400-700',
      fallback: 'system-ui, -apple-system, sans-serif',
      usage: 'Body text, UI, headings',
      url: 'https://fonts.google.com/specimen/Inter',
    },
    mono: {
      name: 'JetBrains Mono',
      weight: '400, 600',
      fallback: 'monospace',
      usage: 'Code, data, technical content',
      url: 'https://www.jetbrainsmono.com/',
    },
  },

  // Weights
  fontWeights: {
    light: 300,       // Rarely used (disabled text)
    regular: 400,     // Body text default
    medium: 500,      // Secondary headings
    semibold: 600,    // Primary headings, emphasis
    bold: 700,        // Large headings, strong emphasis
  },
};
```

### 2.2 Type Scale

```typescript
export const typeScale = {
  // Display: Large headings (hero, page titles)
  display1: {
    size: '3.5rem',      // 56px
    lineHeight: 1.1,
    weight: 700,
    letterSpacing: '-0.02em',
    usage: 'Page titles, hero sections',
  },
  display2: {
    size: '2.875rem',    // 46px
    lineHeight: 1.15,
    weight: 700,
    usage: 'Section titles',
  },

  // Heading: Page structure (h1-h3)
  h1: {
    size: '2.25rem',     // 36px
    lineHeight: 1.2,
    weight: 700,
    usage: 'Main page heading',
  },
  h2: {
    size: '1.875rem',    // 30px
    lineHeight: 1.25,
    weight: 600,
    usage: 'Section headings',
  },
  h3: {
    size: '1.5rem',      // 24px
    lineHeight: 1.3,
    weight: 600,
    usage: 'Subsection headings',
  },

  // Body: Default text
  bodyLarge: {
    size: '1.125rem',    // 18px
    lineHeight: 1.6,
    weight: 400,
    usage: 'Lead paragraphs, intros',
  },
  body: {
    size: '1rem',        // 16px
    lineHeight: 1.6,
    weight: 400,
    usage: 'Regular body text',
  },
  bodySmall: {
    size: '0.875rem',    // 14px
    lineHeight: 1.5,
    weight: 400,
    usage: 'Secondary text, captions',
  },

  // UI: Labels, controls
  label: {
    size: '0.75rem',     // 12px
    lineHeight: 1.4,
    weight: 500,
    letterSpacing: '0.05em',
    usage: 'Form labels, metadata',
  },
  labelSmall: {
    size: '0.6875rem',   // 11px
    lineHeight: 1.4,
    weight: 500,
    usage: 'Small labels, tags',
  },
};

// Implementation in React
export function Heading1({ children }) {
  return (
    <h1
      style={{
        fontSize: typeScale.h1.size,
        lineHeight: typeScale.h1.lineHeight,
        fontWeight: typeScale.h1.weight,
      }}
    >
      {children}
    </h1>
  );
}
```

### 2.3 Line Height and Letter Spacing

```typescript
// Line Height Guidelines
export const lineHeights = {
  tight: 1.2,      // Headings (more compact)
  normal: 1.5,     // Body text (readable)
  relaxed: 1.75,   // Long-form content
  loose: 2,        // Poetry, special content
};

// Letter Spacing (tracking)
export const letterSpacing = {
  tighter: '-0.05em',  // Headlines (visual tightness)
  tight: '-0.02em',
  normal: '0em',
  wide: '0.05em',      // Labels, uppercase text (better readability)
  wider: '0.1em',
};

// Example: All-caps text needs wider tracking
export function SmallLabel({ children }) {
  return (
    <span
      style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}
```

---

## III. Logo Usage Rules

### 3.1 Logo Variations

```
Primary Logo (default use)
├─ Horizontal (logo + wordmark side-by-side)
├─ Vertical (logo above wordmark)
└─ Icon (logo only, compact spaces)

Monochrome Versions (single color)
├─ Black (on light backgrounds)
├─ White (on dark backgrounds)
└─ Brand color

One-Color Applications (when color impossible)
├─ Full color preferred
├─ Monochrome acceptable for small sizes
├─ Never outline-only
```

### 3.2 Clearspace and Sizing

```
MINIMUM CLEARSPACE (padding around logo)
├─ Desktop: 1x logo height
├─ Mobile: 0.5x logo height
├─ Never place text or elements within clearspace

MINIMUM SIZE
├─ Print: 1 inch (25.4mm) width
├─ Web: 120px width
├─ Mobile: 100px width
├─ Favicon: 32x32px (simplified)
└─ Never scale below minimum size
```

### 3.3 Logo Do's and Don'ts

```
✓ DO
├─ Use provided logo files (SVG preferred)
├─ Maintain aspect ratio
├─ Apply adequate clearspace
├─ Use on solid, high-contrast backgrounds
├─ Use in correct colors from palette

✗ DON'T
├─ Stretch or distort logo
├─ Add drop shadows without approval
├─ Change colors (no gradient versions)
├─ Rotate at odd angles
├─ Place on busy/low-contrast backgrounds
├─ Combine with competing graphics
└─ Use outdated logo versions
```

### 3.4 File Formats and Delivery

```typescript
export const logoAssets = {
  // Vector (for web, scalable)
  svg: {
    fileName: 'logo-primary.svg',
    usage: 'Web, all screen sizes',
    colorSpace: 'RGB',
    variants: ['color', 'monochrome-black', 'monochrome-white'],
  },

  // Raster (for print, high DPI)
  png: {
    fileName: 'logo-primary.png',
    resolution: '300 DPI',
    dimensions: '2400x1200px',
    usage: 'Print, high-quality output',
  },

  // Favicon (browser tab)
  ico: {
    fileName: 'favicon.ico',
    sizes: ['16x16', '32x32', '48x48'],
    usage: 'Browser tabs, bookmarks',
  },
};
```

---

## IV. Spacing and Layout System

### 4.1 Spacing Scale

```typescript
export const spacing = {
  // Base unit: 4px (smallest practical size)
  // Scale: 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 80, 96

  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
  '4xl': '5rem',   // 80px
  '5xl': '6rem',   // 96px
};

// Application: Padding, margins, gaps
export function Card({ children }) {
  return (
    <div className="p-md rounded-lg bg-white shadow-sm">
      <div className="space-y-lg">
        {children}
      </div>
    </div>
  );
}
```

### 4.2 Grid System

```typescript
// 12-column grid (responsive)
export const gridConfig = {
  // Desktop (1200px viewport)
  desktop: {
    columns: 12,
    gap: spacing.lg,      // 24px
    maxWidth: '1440px',
    marginX: 'auto',
  },

  // Tablet (768px viewport)
  tablet: {
    columns: 8,
    gap: spacing.md,      // 16px
  },

  // Mobile (375px viewport)
  mobile: {
    columns: 4,
    gap: spacing.sm,      // 8px
  },
};

// Column widths for 12-column grid
export const gridColumns = {
  full: '12 / 12',      // 100%
  half: '6 / 12',       // 50%
  third: '4 / 12',      // 33%
  quarter: '3 / 12',    // 25%
  twoThirds: '8 / 12',  // 67%
};

// Usage in CSS Grid
export function ResponsiveGrid({ children }) {
  return (
    <div className="grid grid-cols-4 gap-md md:grid-cols-8 lg:grid-cols-12 lg:gap-lg">
      {/* Components span appropriate columns */}
    </div>
  );
}
```

### 4.3 Padding and Margin Guidelines

```typescript
// Container padding (outer spacing)
export const containerPadding = {
  mobile: spacing.sm,   // 8px
  tablet: spacing.md,   // 16px
  desktop: spacing.lg,  // 24px
};

// Component spacing (internal)
export const componentSpacing = {
  compact: spacing.sm,      // 8px (dense info, data tables)
  normal: spacing.md,       // 16px (standard spacing)
  comfortable: spacing.lg,  // 24px (breathing room)
  relaxed: spacing.xl,      // 32px (hero sections)
};

// Vertical rhythm (consistent line spacing)
export function VerticalRhythm() {
  return (
    <div className="space-y-lg">
      {/* Each child separated by spacing.lg (24px) */}
      <h2>Heading</h2>
      <p>Paragraph 1</p>
      <p>Paragraph 2</p>
    </div>
  );
}
```

---

## V. Iconography Guidelines

### 5.1 Icon System

```typescript
export const iconography = {
  // Base size: 24px (standard UI icon)
  sizes: {
    xs: '16px',    // Decorative, inline
    sm: '20px',    // Small controls
    md: '24px',    // Standard UI icons
    lg: '32px',    // Larger icons, hero sections
    xl: '48px',    // Very large, standalone
  },

  // Stroke width
  strokeWidth: {
    thin: 1.5,
    regular: 2,
    bold: 2.5,
  },

  // Icon libraries
  recommended: [
    {
      name: 'Lucide React',
      url: 'https://lucide.dev',
      usage: 'Modern, consistent, 24x24 grid',
    },
    {
      name: 'Heroicons',
      url: 'https://heroicons.com',
      usage: 'Tailwind Labs, hand-crafted',
    },
    {
      name: 'Feather Icons',
      url: 'https://feathericons.com',
      usage: 'Minimal, clean, open-source',
    },
  ],
};

// Icon guidelines
export function IconUsage() {
  return (
    <>
      {/* ✓ Icon + label (always) */}
      <button>
        <SaveIcon size={24} />
        <span>Save</span>
      </button>

      {/* ✗ Icon only (without context) */}
      <button title="Save"> {/* At minimum, add title */}
        <SaveIcon size={24} />
      </button>

      {/* ✓ Consistent sizing */}
      <div className="flex gap-sm">
        <HomeIcon size={24} />
        <SettingsIcon size={24} />
        <HelpIcon size={24} />
      </div>

      {/* ✗ Inconsistent sizing */}
      <div className="flex gap-sm">
        <HomeIcon size={20} />
        <SettingsIcon size={28} />
        <HelpIcon size={24} />
      </div>
    </>
  );
}
```

---

## VI. Photography and Illustration

### 6.1 Photography Style

```typescript
export const photographyStyle = {
  // Subject matter
  subjects: [
    'People in authentic, relatable situations',
    'Real product usage (not staged)',
    'Diverse representation (age, ethnicity, ability)',
    'Genuine emotions and moments',
  ],

  // Technical requirements
  technical: {
    aspectRatio: '16:9 or 4:3',
    resolution: 'Minimum 2x display density (2560px for web)',
    colorProfile: 'sRGB',
    format: 'JPG (web), PNG (transparency)',
  },

  // Editing style
  editing: [
    'Natural, minimal post-processing',
    'Consistent color grading across collection',
    'Slight warm color temp (3000-4000K)',
    'Avoid extreme saturation or filters',
    'Maintain skin tones across diversity',
  ],

  // Usage rules
  doNotUse: [
    'Stock photos of obviously fake scenarios',
    'Overly posed or unnatural compositions',
    'Photos with competing branding/logos',
    'Very dark or low-contrast images',
  ],
};
```

### 6.2 Illustration Style

```typescript
export const illustrationStyle = {
  // Art direction
  characteristics: [
    'Geometric, modern shapes',
    'Limited color palette (3-5 colors per illustration)',
    'Consistent line weight and perspective',
    'Readable at all sizes (not overly detailed)',
    'Slightly whimsical but professional',
  ],

  // Technical
  format: 'SVG (scalable, small file size)',
  viewBox: '0 0 200 200', // Standard canvas
  lineHeight: '2px', // Stroke width
  colorRefs: 'Use brand colors only',

  // Scenarios
  useFor: [
    'Empty states',
    'Error pages',
    'Onboarding screens',
    'Feature highlights',
    'Progress indicators',
  ],

  doNotUse: [
    'Realistic/photographic illustrations',
    '3D or isometric in some places, flat in others',
    'Different art styles mixed together',
  ],
};

// Illustration component
export function Illustration({ name, size = 'md' }) {
  const sizes = { sm: 100, md: 200, lg: 400 };
  return (
    <img
      src={`/illustrations/${name}.svg`}
      alt={name}
      width={sizes[size]}
      height={sizes[size]}
    />
  );
}
```

---

## VII. Brand Voice and Tone

### 7.1 Brand Voice (Consistent)

```typescript
export const brandVoice = {
  // Attributes
  attributes: [
    'Friendly but professional',
    'Clear and direct',
    'Helpful, not condescending',
    'Honest and transparent',
    'Encouraging and optimistic',
  ],

  // What we sound like
  sounds_like: [
    'A knowledgeable colleague',
    'A helpful guide',
    'A supportive mentor',
  ],

  // What we don't sound like
  doesn't_sound_like: [
    'Corporate and stuffy',
    'Overly casual or unprofessional',
    'Negative or pessimistic',
    'Condescending or talking down',
  ],

  // Examples
  examples: {
    ✓_do: [
      'We're here to help',
      'Let's fix this together',
      'You've got this',
    ],
    ✗_dont: [
      'The system regrets to inform you',
      'Error code 4042',
      'User has failed to input valid data',
    ],
  },
};
```

### 7.2 Tone (Varies by Context)

```typescript
export const toneGuide = {
  // Professional contexts (support, documentation)
  professional: {
    complexity: 'technical',
    emotion: 'neutral to supportive',
    example: 'To reset your password, visit your account settings...',
  },

  // Error/problem contexts (errors, warnings)
  empathetic: {
    complexity: 'simple',
    emotion: 'understanding, helpful',
    example: "That didn't work. Here's what we can try...",
  },

  // Success/celebration contexts (achievements, milestones)
  celebratory: {
    complexity: 'enthusiastic',
    emotion: 'positive, encouraging',
    example: 'You did it! Your project is live.',
  },

  // Friendly contexts (onboarding, empty states)
  friendly: {
    complexity: 'conversational',
    emotion: 'warm, encouraging',
    example: "Welcome! Let's get you set up in just a few minutes.",
  },
};
```

---

## VIII. Brand Audit Checklist

### 8.1 Visual Consistency Audit

- [ ] All colors match brand palette (no random hex colors)
- [ ] Typography uses only brand typefaces (no substitutions)
- [ ] Icon sizes consistent (24px standard for UI)
- [ ] Spacing follows 4px grid (no arbitrary padding/margin)
- [ ] Logo usage follows clearspace rules
- [ ] Shadows consistent (using defined shadow scale)
- [ ] Border radius consistent (using defined radius scale)
- [ ] Line heights follow typography guidelines

### 8.2 Voice and Tone Audit

- [ ] No corporate jargon or buzzwords
- [ ] Error messages helpful and specific
- [ ] Button labels use verb-noun pattern
- [ ] Tone appropriate for context (professional, friendly, etc.)
- [ ] No condescending language
- [ ] Consistent terminology across product
- [ ] Punctuation consistent (Oxford comma, periods in labels, etc.)
- [ ] Abbreviations explained on first use

### 8.3 Multi-Platform Audit

- [ ] Logo renders correctly on web, iOS, Android
- [ ] Colors accessible on light and dark backgrounds
- [ ] Typography readable at all screen sizes
- [ ] Icons scale properly (no blurry rasterization)
- [ ] Spacing proportional across breakpoints
- [ ] Brand elements recognizable across platforms
- [ ] Photography/illustrations consistent in style

### 8.4 Accessibility Audit

- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Text has minimum 12px size on mobile
- [ ] Line height minimum 1.5 for body text
- [ ] Focus indicators visible and branded
- [ ] Icons have alt text or labels
- [ ] No color-only information conveyance
- [ ] Motion/animation not distracting (< 3 seconds)

---

## IX. Multi-Platform Implementation

### 9.1 Web Implementation

```typescript
// CSS Variables for consistent theming
:root {
  --color-primary: 0 144 229;      /* hsl values for dynamic adjustment */
  --color-success: 34 197 94;
  --color-text: 17 24 39;
  --spacing-xs: 0.25rem;
  --spacing-md: 1rem;
  --font-sans: 'Inter', system-ui;
  --rounded-md: 0.5rem;
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}

html[data-theme='dark'] {
  --color-primary: 56 189 248;
  --color-text: 249 250 251;
}

// Tailwind config
export const tailwindConfig = {
  theme: {
    colors: {
      primary: 'hsl(var(--color-primary))',
      success: 'hsl(var(--color-success))',
    },
    spacing: {
      xs: 'var(--spacing-xs)',
      md: 'var(--spacing-md)',
    },
    fontFamily: {
      sans: 'var(--font-sans)',
    },
  },
};
```

### 9.2 iOS/Android Implementation

```swift
// iOS: Define colors in ColorSet
.colorSet {
  Color(red: 0.06, green: 0.56, blue: 0.92, opacity: 1) // Primary
  Appearance: Light, Dark, Any
  ColorSpace: sRGB
}

// Typography
let h1 = UIFont(name: "Inter-Bold", size: 36)
let body = UIFont(name: "Inter-Regular", size: 16)

// Spacing (pt, not px)
let spacing = [
  "xs": 4,
  "md": 16,
  "lg": 24,
]
```

### 9.3 Design System Export

```json
{
  "version": "2.0",
  "colors": {
    "primary": {
      "50": "#f0f9ff",
      "500": "#0ea5e9",
      "900": "#0c2d48"
    }
  },
  "typography": {
    "h1": {
      "fontSize": "36px",
      "fontWeight": 700,
      "lineHeight": 1.2
    }
  },
  "spacing": {
    "xs": "4px",
    "md": "16px"
  }
}
```

---

## X. Brand Asset Library Template

```
/brand-assets/
├─ /colors/
│  ├─ color-palette.pdf
│  ├─ color-values.json
│  └─ color-accessibility-report.pdf
├─ /logos/
│  ├─ /primary/
│  │  ├─ logo-horizontal.svg
│  │  ├─ logo-vertical.svg
│  │  └─ logo-icon.svg
│  ├─ /monochrome/
│  │  ├─ logo-black.svg
│  │  └─ logo-white.svg
│  └─ /favicon/
│     ├─ favicon-32x32.png
│     └─ favicon-16x16.png
├─ /typography/
│  ├─ type-scale.pdf
│  ├─ fonts/
│  │  ├─ Inter-Regular.woff2
│  │  ├─ Inter-Bold.woff2
│  │  └─ JetBrainsMono-Regular.woff2
│  └─ typography-guide.pdf
├─ /photography/
│  └─ /approved-collections/
│     ├─ people.zip
│     ├─ office.zip
│     └─ product-use.zip
├─ /illustrations/
│  ├─ empty-state-1.svg
│  ├─ empty-state-2.svg
│  └─ error-page.svg
├─ /icons/
│  ├─ icon-set-24px.zip
│  └─ icon-usage-guide.pdf
├─ /templates/
│  ├─ social-media-16x9.psd
│  ├─ presentation-16x9.ppt
│  └─ email-header-600x200.psd
└─ /guidelines/
   ├─ brand-guidelines.pdf
   ├─ design-system.json
   └─ voice-and-tone.pdf
```

---

## XI. Brand Compliance Checklist

- [ ] All official assets obtained from brand library
- [ ] No color deviations (Pantone/sRGB certified)
- [ ] Logo usage follows clearspace and sizing rules
- [ ] Typography uses approved fonts with proper licensing
- [ ] Photography consistent with approved style guide
- [ ] Illustrations match brand art direction
- [ ] Voice and tone guidelines followed in all copy
- [ ] Spacing and layout follow grid system
- [ ] Accessibility standards met (WCAG AA minimum)
- [ ] Multi-platform consistency verified
- [ ] Brand elements not modified or distorted
- [ ] Deprecated assets removed from templates

This guide ensures consistent, professional brand expression across all touchpoints.
