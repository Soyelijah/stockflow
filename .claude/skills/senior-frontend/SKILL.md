# Senior Frontend — Multi-Framework Expertise

Enterprise-grade toolkit for modern frontend development across React/Next.js, Vue/Nuxt, and Angular ecosystems. Includes framework detection, universal patterns, component scaffolding, state management, performance optimization, and framework-specific best practices.

## Quick Start

### Main Capabilities

This skill provides automated capabilities via three core scripts:

```bash
# Script 1: Framework-Aware Component Generator
python scripts/component_generator.py [options]

# Script 2: Universal Bundle Analyzer
python scripts/bundle_analyzer.py [options]

# Script 3: Framework Scaffolder
python scripts/frontend_scaffolder.py [options]
```

All scripts auto-detect your framework (React/Vue/Angular) and apply framework-specific patterns.

## Framework Detection & Setup

### Auto-Detection Logic

The skill automatically detects your framework based on:

```
React/Next.js: package.json contains "react", "next", "vite" + tsconfig.json
Vue/Nuxt:      package.json contains "vue", "nuxt", "vite" + tsconfig.json with "vue" compiler
Angular:       angular.json exists + package.json contains "@angular/core"
```

If auto-detection fails, use:
```bash
# Explicitly set framework
python scripts/framework_detector.py --framework=react
python scripts/framework_detector.py --framework=vue
python scripts/framework_detector.py --framework=angular
```

---

# REACT / NEXT.JS

## 1. Component Generator (React)

Automated scaffolding for React/Next.js components.

**Features:**
- Functional components (React hooks best practices)
- TypeScript support with strict types
- Composition API patterns
- Configurable template library (Shadcn, Headless UI, custom)
- Automatic barrel exports
- Storybook integration

**Usage:**
```bash
python scripts/component_generator.py react \
  --name=UserCard \
  --template=shadcn \
  --with-tests \
  --with-stories
```

### React Patterns Reference

Comprehensive guide in `references/react_patterns.md`:

**Hooks Best Practices:**
- `useState` for simple state
- `useReducer` for complex state
- `useEffect` dependency arrays
- Custom hooks for logic reuse
- `useCallback` + `useMemo` for optimization
- `useContext` for prop drilling avoidance
- `useRef` for DOM access
- `useLayoutEffect` for DOM mutations
- `useId` for unique identifiers
- `useTransition` + `useDeferredValue` for concurrent rendering (React 18+)

**Component Patterns:**
- Controlled vs uncontrolled components
- Render props pattern
- Higher-order components (HOCs)
- Compound components
- Container/Presenter pattern
- Suspense + Error boundaries

**State Management:**
- Zustand for lightweight global state
- React Query for server state
- Jotai for atomic state
- Recoil for complex dependencies
- Redux/Redux Toolkit for enterprise apps
- Context API for theme/auth (limit scope)

**Performance:**
- Code splitting with React.lazy + Suspense
- Image optimization (next/image, responsive srcSet)
- Bundle analysis with `@next/bundle-analyzer`
- Route-based code splitting
- Dynamic imports for heavy components
- Virtualization for long lists (react-window)
- Memoization patterns (React.memo, useMemo)

**Testing:**
```bash
# React Testing Library
npm install --save-dev @testing-library/react @testing-library/jest-dom

# Example test structure
describe('UserCard', () => {
  it('renders user name', () => {
    render(<UserCard user={{name: 'John'}} />);
    expect(screen.getByText('John')).toBeInTheDocument();
  });
});
```

**Anti-patterns to Avoid:**
- Putting all state at root level
- useEffect as constructor
- useCallback on every function
- Not handling cleanup in useEffect
- Inline object/array creation in deps
- Over-using Context for all global state

## 2. Next.js Optimization Guide

Workflow documentation in `references/nextjs_optimization_guide.md`:

**App Router (Next.js 13+):**
```typescript
// app/layout.tsx - Server component by default
export default function RootLayout({children}: {children: React.ReactNode}) {
  return <html><body>{children}</body></html>
}

// app/page.tsx - Server component (default)
export default async function Page() {
  const data = await fetch('https://...');
  return <div>{data}</div>
}

// app/components/Counter.tsx - Client component
'use client'
import { useState } from 'react';
export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

**Pages Router (Legacy, still supported):**
```typescript
// pages/api/users.ts - API route
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ name: 'John' });
}

// pages/users/[id].tsx - Dynamic route
export async function getServerSideProps({params}: {params: {id: string}}) {
  return { props: {id: params.id}};
}
```

**Image Optimization:**
```typescript
import Image from 'next/image';

export default function Hero() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero"
      width={1200}
      height={600}
      priority // for LCP images
      sizes="(max-width: 768px) 100vw, 50vw"
    />
  );
}
```

**Font Optimization:**
```typescript
// app/layout.tsx
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

export default function RootLayout({children}) {
  return (
    <html className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

**Metadata + Open Graph:**
```typescript
// app/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My App',
  description: 'Generated by create next app',
  openGraph: {
    title: 'My App',
    description: 'Generated by create next app',
    images: [{ url: 'https://example.com/og.jpg' }],
  },
};
```

**Streaming & Progressive Rendering:**
```typescript
// app/page.tsx
import { Suspense } from 'react';
import { HeavyComponent } from './heavy';

export default function Page() {
  return (
    <>
      <FastComponent />
      <Suspense fallback={<div>Loading...</div>}>
        <HeavyComponent />
      </Suspense>
    </>
  );
}
```

**Middleware for auth/redirects:**
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token');
  if (!token && request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/protected/:path*'],
};
```

**ISR (Incremental Static Regeneration):**
```typescript
// app/blog/[slug]/page.tsx
export const revalidate = 3600; // revalidate every hour

export async function generateStaticParams() {
  const posts = await fetch('https://...').then(r => r.json());
  return posts.map(post => ({ slug: post.slug }));
}

export default async function Page({params}: {params: {slug: string}}) {
  const post = await fetch(`https://.../${params.slug}`);
  return <article>{post.content}</article>;
}
```

**Bundle Analysis:**
```bash
# Install analyzer
npm install --save-dev @next/bundle-analyzer

# In next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // config...
});

# Run
ANALYZE=true npm run build
```

## 3. React Frontend Best Practices

Technical reference in `references/frontend_best_practices.md`:

**TypeScript Configuration:**
```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@hooks/*": ["src/hooks/*"],
      "@services/*": ["src/services/*"]
    }
  }
}
```

**Project Structure:**
```
src/
├── components/
│   ├── ui/              # Shadcn/UI components
│   ├── layout/          # Layout components (Header, Footer, Sidebar)
│   ├── features/        # Feature-specific components
│   └── common/          # Reusable utilities
├── hooks/               # Custom hooks
├── services/            # API, auth, external services
├── contexts/            # React Context providers
├── stores/              # Zustand/Jotai/Recoil stores
├── lib/                 # Utilities, helpers
├── types/               # Global TypeScript types
├── styles/              # Global CSS/Tailwind
├── pages/               # Pages (if not using Next.js App Router)
├── App.tsx
└── main.tsx
```

**Tailwind CSS v4 (React):**
```javascript
// tailwind.config.js
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
      },
      backdropBlur: {
        'xl': '20px',
      }
    },
  },
  plugins: [],
};
```

```css
/* src/index.css */
@import "tailwindcss";

@layer base {
  :root {
    --color-primary: #3b82f6;
    --color-secondary: #8b5cf6;
  }
}

@layer components {
  .glass {
    @apply bg-white/10 backdrop-blur-md border border-white/20;
  }

  .btn-primary {
    @apply px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition;
  }
}
```

**API Integration with React Query:**
```typescript
// src/hooks/useUsers.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newUser) => api.post('/users', newUser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

**Security Best Practices:**
- Input validation (Zod, Yup, Valibot)
- XSS prevention (sanitize HTML with DOMPurify)
- CSRF tokens for form submissions
- Environment variables for sensitive data
- Content Security Policy headers
- Dependency scanning (Snyk, GitHub Dependabot)
- Regular npm audit

---

# VUE 3 / NUXT 3

## 1. Component Generator (Vue)

Automated scaffolding for Vue 3 components using Composition API.

**Features:**
- Composition API (script setup syntax)
- TypeScript with strict modes
- Pinia store generation
- Vue Router integration
- Automatic barrel exports
- Story generation (Storybook)
- Unit test scaffolding

**Usage:**
```bash
python scripts/component_generator.py vue \
  --name=UserCard \
  --template=primevue \
  --with-tests \
  --with-pinia
```

### Vue 3 Patterns Reference

**Composition API Best Practices:**

```typescript
// src/components/UserCard.vue
<template>
  <div class="card">
    <h2>{{ user.name }}</h2>
    <p>{{ user.email }}</p>
    <button @click="toggleActive">
      {{ isActive ? 'Active' : 'Inactive' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface User {
  id: number;
  name: string;
  email: string;
}

const props = defineProps<{
  user: User;
}>();

const emit = defineEmits<{
  update: [id: number, data: Partial<User>];
  delete: [id: number];
}>();

const isActive = ref(true);

const userEmail = computed(() => props.user.email?.toLowerCase());

const toggleActive = () => {
  isActive.value = !isActive.value;
};

const deleteUser = () => {
  emit('delete', props.user.id);
};
</script>

<style scoped>
.card {
  @apply p-4 rounded-lg border border-slate-200;
}
</style>
```

**Composables (Custom Hooks):**

```typescript
// src/composables/useUser.ts
import { ref, computed } from 'vue';

export function useUser(userId: number) {
  const user = ref(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchUser = async () => {
    loading.value = true;
    try {
      const response = await fetch(`/api/users/${userId}`);
      user.value = await response.json();
    } catch (e) {
      error.value = e as Error;
    } finally {
      loading.value = false;
    }
  };

  const userName = computed(() => user.value?.name || 'Unknown');

  return { user, loading, error, fetchUser, userName };
}

// Usage in component:
<script setup lang="ts">
import { useUser } from '@/composables/useUser';

const { user, loading, error, fetchUser } = useUser(123);

onMounted(fetchUser);
</script>
```

**Pinia State Management:**

```typescript
// src/stores/userStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useUserStore = defineStore('user', () => {
  const users = ref<User[]>([]);
  const loading = ref(false);

  const userCount = computed(() => users.value.length);

  const fetchUsers = async () => {
    loading.value = true;
    try {
      const response = await fetch('/api/users');
      users.value = await response.json();
    } finally {
      loading.value = false;
    }
  };

  const addUser = (user: User) => {
    users.value.push(user);
  };

  const removeUser = (id: number) => {
    users.value = users.value.filter(u => u.id !== id);
  };

  return { users, loading, userCount, fetchUsers, addUser, removeUser };
});

// Usage:
<script setup lang="ts">
import { useUserStore } from '@/stores/userStore';

const store = useUserStore();

onMounted(() => store.fetchUsers());
</script>
```

**Vue Router with TypeScript:**

```typescript
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/users/:id',
    name: 'UserDetail',
    component: () => import('@/views/UserDetail.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('@/views/Admin.vue'),
    meta: { requiresAuth: true, role: 'admin' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Route guard
router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('token');

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login');
  } else {
    next();
  }
});

export default router;
```

**Lifecycle Hooks vs Composition API:**

```typescript
// Old Options API (not recommended for new code)
export default {
  data() { return { count: 0 }; },
  mounted() { console.log('mounted'); },
  unmounted() { console.log('unmounted'); },
};

// New Composition API (recommended)
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const count = ref(0);

onMounted(() => console.log('mounted'));
onUnmounted(() => console.log('unmounted'));
</script>
```

**Refs and Reactivity:**

```typescript
<script setup lang="ts">
// Simple ref
const count = ref(0);

// Computed (automatic dependency tracking)
const doubled = computed(() => count.value * 2);

// Watch
const email = ref('');
watch(email, (newVal) => {
  console.log('Email changed to:', newVal);
});

// Reactive object
const user = reactive({
  name: 'John',
  age: 30,
});

// Shallow ref (for expensive objects)
const largeObject = shallowRef({ /* ... */ });
</script>
```

### Nuxt 3 Optimization

**App Structure:**

```
app.vue                    # Root component
app.config.ts             # App config
nuxt.config.ts            # Nuxt config
.nuxtignore              # Files to ignore

server/
├── api/                  # API routes
├── middleware/           # Server middleware
└── utils/                # Server utilities

app/
├── components/           # Auto-imported components
├── composables/          # Auto-imported composables
├── layouts/              # Layout components
├── middleware/           # Route middleware
├── pages/                # File-based routing
└── app.vue               # Root layout
```

**Routing with Nuxt:**

```typescript
// pages/index.vue (auto-routed as /)
<template>
  <div>
    <NuxtLink to="/about">About</NuxtLink>
  </div>
</template>

// pages/blog/[slug].vue (dynamic route: /blog/:slug)
<script setup lang="ts">
const route = useRoute();
const slug = route.params.slug;
</script>

// pages/[[path]].vue (catch-all route)
```

**Server API Routes:**

```typescript
// server/api/users/[id].ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  return {
    id,
    message: 'User retrieved',
  };
});
```

**Middleware & Auth:**

```typescript
// middleware/auth.ts
export default defineRouteMiddleware((to, from) => {
  const isAuthenticated = useAuth().isLoggedIn;

  if (to.meta.requiresAuth && !isAuthenticated) {
    return navigateTo('/login');
  }
});

// pages/admin.vue
<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
});
</script>
```

**SSR/Hybrid Rendering:**

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    // Cache for 1 hour
    '/': { cache: { maxAge: 60 * 60 } },
    // Prerender at build time
    '/sitemap.xml': { prerender: true },
    // SWR: stale-while-revalidate for 1 hour
    '/blog/**': { swr: 3600 },
    // ISR: regenerate in background if stale
    '/posts/**': { cache: { maxAge: 60, staleMaxAge: 3600 } },
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/sitemap.xml', '/rss.xml'],
    },
  },
});
```

**Image & Font Optimization:**

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/image'],

  image: {
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
});

// Usage
<template>
  <NuxtImg
    src="/image.jpg"
    width="200"
    height="200"
    alt="Description"
    preload
  />
</template>
```

**Testing Vue Components:**

```typescript
// tests/components/UserCard.spec.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import UserCard from '@/components/UserCard.vue';

describe('UserCard', () => {
  it('renders user name', () => {
    const wrapper = mount(UserCard, {
      props: {
        user: { id: 1, name: 'John', email: 'john@example.com' },
      },
    });
    expect(wrapper.text()).toContain('John');
  });

  it('emits delete event', async () => {
    const wrapper = mount(UserCard, {
      props: {
        user: { id: 1, name: 'John', email: 'john@example.com' },
      },
    });
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('delete')).toBeTruthy();
  });
});
```

---

# ANGULAR 18+

## 1. Component Generator (Angular)

Automated scaffolding for Angular standalone components with signals.

**Features:**
- Standalone components (no NgModules)
- Angular signals (reactive primitives)
- RxJS patterns (Observables, operators)
- Angular Material/PrimeNG integration
- Angular Testing fixtures
- Route configuration
- Dependency injection setup

**Usage:**
```bash
python scripts/component_generator.py angular \
  --name=UserCard \
  --template=material \
  --with-tests \
  --with-services
```

### Angular Patterns Reference

**Standalone Components with Signals (Angular 16+):**

```typescript
// src/app/components/user-card.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

interface User {
  id: number;
  name: string;
  email: string;
}

@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="card">
      <h2>{{ user().name }}</h2>
      <p>{{ user().email }}</p>
      <button mat-raised-button (click)="toggleActive()">
        {{ isActive() ? 'Active' : 'Inactive' }}
      </button>
      <button mat-raised-button color="warn" (click)="onDelete()">
        Delete
      </button>
    </div>
  `,
  styles: [`
    .card {
      padding: 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
    }
  `],
})
export class UserCardComponent {
  @Input({ required: true }) user = signal<User>(null!);
  @Output() delete = new EventEmitter<number>();

  isActive = signal(true);
  userEmail = computed(() => this.user().email?.toLowerCase());

  constructor() {
    // Effect for side effects when user changes
    effect(() => {
      console.log('User changed:', this.user());
    });
  }

  toggleActive() {
    this.isActive.update(value => !value);
  }

  onDelete() {
    this.delete.emit(this.user().id);
  }
}
```

**Services with RxJS (Observable-based):**

```typescript
// src/app/services/user.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';

interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = '/api/users';

  // Signal for current user
  currentUser = signal<User | null>(null);

  // Observable for list
  private users$ = new BehaviorSubject<User[]>([]);
  public users = this.users$.asObservable();

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl).pipe(
      tap(users => this.users$.next(users)),
      catchError(error => {
        console.error('Error fetching users:', error);
        return of([]);
      }),
    );
  }

  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`).pipe(
      tap(user => this.currentUser.set(user)),
    );
  }

  createUser(user: Omit<User, 'id'>): Observable<User> {
    return this.http.post<User>(this.apiUrl, user).pipe(
      tap(newUser => {
        const current = this.users$.value;
        this.users$.next([...current, newUser]);
      }),
    );
  }

  updateUser(id: number, user: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}`, user).pipe(
      tap(updatedUser => {
        const users = this.users$.value;
        const index = users.findIndex(u => u.id === id);
        if (index !== -1) {
          users[index] = updatedUser;
          this.users$.next([...users]);
        }
      }),
    );
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        const users = this.users$.value.filter(u => u.id !== id);
        this.users$.next(users);
      }),
    );
  }
}
```

**Standalone Component with RxJS (Signals + Observables):**

```typescript
// src/app/pages/user-list.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserService } from '../services/user.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, HttpClientModule, MatTableModule, MatProgressSpinnerModule],
  template: `
    <div>
      <h1>Users</h1>
      <mat-spinner *ngIf="loading()"></mat-spinner>
      <table *ngIf="!loading()" mat-table [dataSource]="users()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let element">{{ element.name }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
    </div>
  `,
})
export class UserListComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private destroy$ = new Subject<void>();

  users = signal<User[]>([]);
  loading = signal(false);
  displayedColumns = ['name'];

  ngOnInit() {
    this.loadUsers();
  }

  private loadUsers() {
    this.loading.set(true);
    this.userService.users
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.users.set(users);
        this.loading.set(false);
      });
    this.userService.getUsers().subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

**Angular Router with Standalone Components:**

```typescript
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home.component';
import { UserDetailComponent } from './pages/user-detail.component';
import { AdminComponent } from './pages/admin.component';
import { authGuard, roleGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'users/:id',
    component: UserDetailComponent,
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [authGuard, () => roleGuard('admin')],
  },
  { path: '**', redirectTo: '' },
];

// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes)],
});
```

**Route Guards with Dependency Injection:**

```typescript
// src/app/guards/auth.guard.ts
import { Injectable, inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
class AuthService {
  isAuthenticated() {
    return !!localStorage.getItem('token');
  }
}

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const roleGuard = (requiredRole: string): CanActivateFn => {
  return (route, state) => {
    const userRole = localStorage.getItem('user_role');
    if (userRole === requiredRole) return true;

    inject(Router).navigate(['/unauthorized']);
    return false;
  };
};
```

**Reactive Forms with Standalone Components:**

```typescript
// src/app/components/user-form.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <mat-form-field>
        <mat-label>Name</mat-label>
        <input matInput formControlName="name" />
      </mat-form-field>

      <mat-form-field>
        <mat-label>Email</mat-label>
        <input matInput formControlName="email" type="email" />
      </mat-form-field>

      <button mat-raised-button [disabled]="!form.valid">Submit</button>
    </form>
  `,
})
export class UserFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  form!: FormGroup;

  ngOnInit() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
    });
  }

  onSubmit() {
    if (this.form.valid) {
      console.log(this.form.value);
    }
  }
}
```

**Dependency Injection & Providers:**

```typescript
// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
  ],
};

// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig);
```

**HTTP Interceptors:**

```typescript
// src/app/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('auth_token');

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req);
};
```

**Testing Angular Components:**

```typescript
// src/app/components/user-card.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserCardComponent } from './user-card.component';

describe('UserCardComponent', () => {
  let component: UserCardComponent;
  let fixture: ComponentFixture<UserCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(UserCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render user name', () => {
    component.user.set({ id: 1, name: 'John', email: 'john@example.com' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('John');
  });

  it('should emit delete event', () => {
    spyOn(component.delete, 'emit');
    component.user.set({ id: 1, name: 'John', email: 'john@example.com' });
    component.onDelete();
    expect(component.delete.emit).toHaveBeenCalledWith(1);
  });
});
```

### Angular Performance Optimization

**OnPush Change Detection:**

```typescript
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-user-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div>{{ user.name }}</div>`,
})
export class UserCardComponent {
  @Input({ required: true }) user!: User;
}
```

**Lazy Loading Routes:**

```typescript
const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin.component').then(m => m.AdminComponent),
    canActivate: [adminGuard],
  },
];
```

**Change Detection Strategy & Signals:**

```typescript
import { Component, signal, computed, effect } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <p>Count: {{ count() }}</p>
      <p>Doubled: {{ doubled() }}</p>
    </div>
  `,
})
export class DashboardComponent {
  count = signal(0);
  doubled = computed(() => this.count() * 2);

  constructor() {
    effect(() => {
      console.log('Count changed to:', this.count());
    });
  }
}
```

---

# UNIVERSAL PATTERNS (All Frameworks)

## State Management Architecture

### Comparison Matrix

| Pattern | React | Vue | Angular | Use Case |
|---------|-------|-----|---------|----------|
| Local state | useState | ref | signal | Component-specific data |
| Global state | Zustand/Recoil | Pinia | NgRx | App-wide data (auth, theme) |
| Server state | React Query | VueQuery | NgRx | API responses, caching |
| Form state | React Hook Form | VeeValidate | Reactive Forms | Form handling |

### Implementation Examples

**Auth State (all frameworks):**

```typescript
// React (Zustand)
const useAuthStore = create(set => ({
  user: null,
  token: null,
  login: async (email, password) => {
    const response = await api.post('/login', {email, password});
    set({ user: response.user, token: response.token });
  },
}));

// Vue (Pinia)
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const token = ref(null);

  const login = async (email, password) => {
    const response = await fetch('/api/login', {...});
    user.value = response.user;
    token.value = response.token;
  };

  return { user, token, login };
});

// Angular (Signals)
@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<User | null>(null);
  token = signal<string | null>(null);

  login(email: string, password: string) {
    return this.http.post<{user: User, token: string}>('/api/login', {email, password})
      .pipe(
        tap(response => {
          this.user.set(response.user);
          this.token.set(response.token);
        })
      );
  }
}
```

## Component Architecture

### File-Based Routing (all frameworks)

```
app/
├── pages/
│   ├── index.tsx          # / (React/Next)
│   ├── users/
│   │   ├── index.tsx      # /users
│   │   └── [id].tsx       # /users/:id
│   └── admin/
│       └── [[...path]].tsx # /admin/* (catch-all)

// Vue/Nuxt structure is identical, just .vue files
// Angular uses routes in app.routes.ts (config-based)
```

### Component Naming Conventions

```
Feature-scoped components:
src/features/users/components/UserCard.tsx
src/features/users/components/UserForm.tsx
src/features/users/hooks/useUser.ts (React)
src/features/users/composables/useUser.ts (Vue)
src/features/users/services/user.service.ts (Angular)

Layout components:
src/components/layout/Header.tsx
src/components/layout/Sidebar.tsx
src/components/layout/Footer.tsx

UI components:
src/components/ui/Button.tsx
src/components/ui/Input.tsx
src/components/ui/Modal.tsx
```

## Performance Optimization

### Bundle Size Analysis (all frameworks)

```bash
# React/Next.js
ANALYZE=true npm run build

# Vue/Nuxt
npm run build -- --report

# Angular
ng build --stats-json && webpack-bundle-analyzer dist/my-app/stats.json
```

### Code Splitting Strategy

```typescript
// React
const UserDetail = React.lazy(() => import('./pages/UserDetail'));
<Suspense fallback={<div>Loading...</div>}>
  <UserDetail />
</Suspense>

// Vue
const UserDetail = defineAsyncComponent(() => import('./pages/UserDetail.vue'));

// Angular
loadComponent: () => import('./pages/user-detail.component').then(m => m.UserDetailComponent)
```

### Image Optimization (all frameworks)

```typescript
// Use native HTML5 with modern formats
<picture>
  <source srcset="image.webp" type="image/webp" />
  <source srcset="image.jpg" type="image/jpeg" />
  <img src="image.jpg" loading="lazy" alt="Description" />
</picture>

// Or use framework-specific image components:
// React: <Image src="..." />
// Vue: <NuxtImg src="..." />
// Angular: Can use native <img> with CDK image directive
```

---

# FRAMEWORK MIGRATION PATTERNS

## React → Vue Migration

**State Management:**
```typescript
// React (Zustand) → Vue (Pinia)
// Zustand: create((set) => ({ state, actions }))
// Pinia:   defineStore((id, () => ({ state, actions }))
```

**Hooks → Composables:**
```typescript
// React useEffect → Vue onMounted/onUnmounted
// React useContext → Vue inject/provide
// React useCallback → Vue watchEffect
```

## React → Angular Migration

**State Management:**
```typescript
// React useState → Angular signal
// React Context → Angular Dependency Injection + Signals
// React useEffect → Angular ngOnInit/ngOnDestroy + effect()
```

**Component Props:**
```typescript
// React: <Component prop={value} />
// Angular: [prop]="value" or @Input() prop: Type
```

## Vue → Angular Migration

**Component API:**
```typescript
// Vue script setup → Angular standalone @Component
// Pinia store → Angular Service + Signals
// Composables → Angular Services with inject()
```

---

# Core Capabilities

## 1. Component Generator

Automated tool for generating production-ready components.

**Features:**
- Auto-detects framework (React/Vue/Angular)
- TypeScript with strict types
- Component-specific state management setup
- Integrated tests (Vitest/Jest/Jasmine)
- Storybook stories (if configured)
- Accessibility (ARIA, semantic HTML)
- Responsive design (Tailwind/Material)

**Usage:**
```bash
# React component
python scripts/component_generator.py react \
  --name=CardComponent \
  --template=shadcn \
  --with-tests \
  --with-stories

# Vue component
python scripts/component_generator.py vue \
  --name=CardComponent \
  --template=primevue \
  --with-pinia \
  --with-tests

# Angular component
python scripts/component_generator.py angular \
  --name=CardComponent \
  --template=material \
  --with-service \
  --with-tests
```

## 2. Bundle Analyzer

Comprehensive analysis and optimization tool.

**Features:**
- Deep bundle analysis (tree-shaking detection)
- Performance metrics (LCP, FID, CLS)
- Dependency graph visualization
- Optimization recommendations
- Code splitting analysis
- Framework-specific metrics

**Usage:**
```bash
python scripts/bundle_analyzer.py . --verbose --framework=react
python scripts/bundle_analyzer.py . --verbose --framework=vue
python scripts/bundle_analyzer.py . --verbose --framework=angular
```

## 3. Frontend Scaffolder

Advanced tooling for specialized tasks.

**Features:**
- Project initialization
- Framework-specific templates
- Integration with databases
- API client generation
- Environment configuration
- Docker setup

**Usage:**
```bash
python scripts/frontend_scaffolder.py init \
  --framework=react \
  --template=nextjs-app \
  --with-auth \
  --with-db=supabase
```

---

# Tech Stack

**Languages:** TypeScript, JavaScript, Python, Go, Swift, Kotlin

**Frontend Frameworks:**
- React 19 + Next.js 15
- Vue 3 + Nuxt 3
- Angular 18+

**Styling & Components:**
- Tailwind CSS v4
- Shadcn/UI (React)
- Vuetify 3 / PrimeVue (Vue)
- Angular Material / NGPrime (Angular)

**State Management:**
- React: Zustand, React Query, Recoil, Redux
- Vue: Pinia, VueQuery
- Angular: NgRx, Signals

**Testing:**
- React: Vitest, React Testing Library
- Vue: Vitest, Vue Test Utils
- Angular: Jasmine, Karma, TestBed

**Build Tools:**
- Vite (React, Vue)
- Webpack (Angular)
- Next.js (React + SSR/SSG)
- Nuxt (Vue + SSR/SSG)

**Backend & APIs:**
- Node.js, Express, GraphQL, REST APIs
- FastAPI, Django (Python)
- Database: PostgreSQL, Prisma, SQLAlchemy

**DevOps:** Docker, Kubernetes, Terraform, GitHub Actions, CircleCI

**Cloud:** AWS, GCP, Azure

---

# Best Practices Summary

## Code Quality
- Follow framework-specific style guides
- Write comprehensive tests (unit, integration, e2e)
- Document architectural decisions
- Use TypeScript strict mode
- Keep dependencies updated

## Performance
- Profile before optimizing
- Implement code splitting strategically
- Optimize images and fonts
- Monitor Core Web Vitals in production
- Use framework-specific performance tools

## Security
- Validate all inputs (client + server)
- Implement proper authentication
- Use environment variables for secrets
- Keep dependencies updated
- Run regular security audits (Snyk, npm audit)

## Accessibility
- Use semantic HTML
- Implement ARIA when needed
- Test with keyboard navigation
- Ensure color contrast compliance
- Use accessible form controls

## Maintainability
- Follow DRY principle
- Use clear, descriptive naming
- Keep components small and focused
- Document complex logic
- Use consistent code formatting

---

# Reference Documentation

Full technical guides available in `references/` directory:

- `references/react_patterns.md` - React/Next.js comprehensive patterns
- `references/vue_patterns.md` - Vue 3/Nuxt 3 comprehensive patterns
- `references/angular_patterns.md` - Angular 18+ comprehensive patterns
- `references/frontend_best_practices.md` - Universal frontend practices
- `references/performance_optimization.md` - Performance tuning across frameworks
- `references/testing_strategies.md` - Testing approaches per framework
- `references/migration_guides.md` - Framework-to-framework migration patterns

---

# Common Commands

```bash
# Development (framework-agnostic)
npm run dev               # Start dev server
npm run build             # Build for production
npm run test              # Run tests
npm run lint              # Lint code
npm run type-check        # TypeScript check

# Analysis
python scripts/bundle_analyzer.py .
python scripts/component_generator.py --help
python scripts/frontend_scaffolder.py --help

# Deployment
docker build -t app:latest .
docker-compose up -d
kubectl apply -f k8s/
```

---

# Troubleshooting

### Common Issues

**TypeScript errors:**
- Check tsconfig.json paths configuration
- Verify types are exported properly
- Use `npm install` to sync node_modules

**Performance issues:**
- Run bundle analyzer: `python scripts/bundle_analyzer.py .`
- Check for unnecessary renders (React DevTools Profiler)
- Review code splitting strategy

**Testing failures:**
- Verify test environment setup
- Check mocks for external dependencies
- Review error messages in test output

### Getting Help

- Review reference documentation in `references/`
- Check framework official documentation
- Review script output messages
- Consult error logs and console

---

# Resources

- React Docs: https://react.dev
- Vue Docs: https://vuejs.org
- Angular Docs: https://angular.io
- Next.js Docs: https://nextjs.org
- Nuxt Docs: https://nuxt.com
- TypeScript Docs: https://www.typescriptlang.org
- Tailwind CSS: https://tailwindcss.com
