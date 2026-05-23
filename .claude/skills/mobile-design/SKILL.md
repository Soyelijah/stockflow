# Mobile Design System: Thinking + Implementation

> **Philosophy:** Touch-first. Battery-conscious. Platform-respectful. Offline-capable.
> **Core Principle:** Mobile is NOT a small desktop. THINK mobile constraints, IMPLEMENT responsive patterns, ASK platform choice.

---

## 🔧 Runtime Scripts

**Execute these for validation (don't read, just run):**

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/mobile_audit.py` | Mobile UX & Touch Audit + Responsive Coverage | `python scripts/mobile_audit.py <project_path>` |

---

## 🔴 MANDATORY: Read Reference Files Before Working!

**⛔ DO NOT start development until you read the relevant files:**

### Universal (Always Read)

| File | Content | Status |
|------|---------|--------|
| **[mobile-design-thinking.md](mobile-design-thinking.md)** | **⚠️ ANTI-MEMORIZATION: Forces thinking, prevents AI defaults** | **⬜ CRITICAL FIRST** |
| **[touch-psychology.md](touch-psychology.md)** | **Fitts' Law, gestures, haptics, thumb zone** | **⬜ CRITICAL** |
| **[mobile-performance.md](mobile-performance.md)** | **RN/Flutter performance, 60fps, memory** | **⬜ CRITICAL** |
| **[mobile-backend.md](mobile-backend.md)** | **Push notifications, offline sync, mobile API** | **⬜ CRITICAL** |
| **[mobile-testing.md](mobile-testing.md)** | **Testing pyramid, E2E, platform-specific** | **⬜ CRITICAL** |
| **[mobile-debugging.md](mobile-debugging.md)** | **Native vs JS debugging, Flipper, Logcat** | **⬜ CRITICAL** |
| [mobile-navigation.md](mobile-navigation.md) | Tab/Stack/Drawer, deep linking | ⬜ Read |
| [mobile-typography.md](mobile-typography.md) | System fonts, Dynamic Type, a11y | ⬜ Read |
| [mobile-color-system.md](mobile-color-system.md) | OLED, dark mode, battery-aware | ⬜ Read |
| [decision-trees.md](decision-trees.md) | Framework/state/storage selection | ⬜ Read |
| **[responsive-design.md](responsive-design.md)** | **Breakpoints, fluid layouts, responsive components** | **⬜ CRITICAL** |

> 🧠 **mobile-design-thinking.md is PRIORITY!** This file ensures AI thinks instead of using memorized patterns.

### Platform-Specific (Read Based on Target)

| Platform | File | Content | When to Read |
|----------|------|---------|--------------|
| **iOS** | [platform-ios.md](platform-ios.md) | Human Interface Guidelines, SF Pro, SwiftUI patterns | Building for iPhone/iPad |
| **Android** | [platform-android.md](platform-android.md) | Material Design 3, Roboto, Compose patterns | Building for Android |
| **Cross-Platform** | Both above | Platform divergence points | React Native / Flutter |

> 🔴 **If building for iOS → Read platform-ios.md FIRST!**
> 🔴 **If building for Android → Read platform-android.md FIRST!**
> 🔴 **If cross-platform → Read BOTH and apply conditional platform logic!**

---

## 🎯 Responsive Design Breakpoint System

### Universal Breakpoints (Mobile-First)

```
Mobile (xs)        320px—479px    (iPhone SE, small phones)
Mobile (sm)        480px—767px    (iPhone 12 mini to 8 Plus)
Tablet (md)        768px—1023px   (iPad, iPad mini)
Tablet (lg)        1024px—1365px  (iPad Pro 11", regular iPad landscape)
Desktop (xl)       1366px+        (iPad Pro landscape, web fallback)
```

### Concrete Implementation: React Native Responsive

**Using `useWindowDimensions` + `Platform.select`:**

```typescript
import { useWindowDimensions, Platform, StyleSheet } from 'react-native';

const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  return {
    isPhone: width < 480,
    isSmallPhone: width < 390,
    isTablet: width >= 768,
    isLandscape: width > height,
    breakpoint: width < 480 ? 'xs' :
                width < 768 ? 'sm' :
                width < 1024 ? 'md' : 'lg',
  };
};

export const responsive = {
  // Typography scales
  fontSize: {
    xs: { xs: 12, sm: 13, md: 14, lg: 16 },
    sm: { xs: 14, sm: 15, md: 16, lg: 18 },
    base: { xs: 16, sm: 17, md: 18, lg: 20 },
    lg: { xs: 18, sm: 19, md: 20, lg: 24 },
    xl: { xs: 20, sm: 22, md: 24, lg: 32 },
  },

  // Spacing (8px unit system)
  space: {
    xs: { xs: 4, sm: 6, md: 8, lg: 12 },
    sm: { xs: 8, sm: 10, md: 12, lg: 16 },
    md: { xs: 12, sm: 14, md: 16, lg: 24 },
    lg: { xs: 16, sm: 18, md: 24, lg: 32 },
    xl: { xs: 20, sm: 24, md: 32, lg: 40 },
  },

  // Component widths
  width: {
    container: { xs: '100%', sm: '100%', md: '90%', lg: '85%' },
    maxWidth: { xs: 320, sm: 480, md: 768, lg: 1024 },
  },
};

// Usage:
const MyComponent = () => {
  const { breakpoint } = useResponsive();

  const styles = StyleSheet.create({
    title: {
      fontSize: responsive.fontSize.xl[breakpoint],
      marginBottom: responsive.space.md[breakpoint],
    },
  });

  return <Text style={styles.title}>Hello</Text>;
};
```

### Concrete Implementation: Flutter Responsive

**Using `MediaQuery` + `LayoutBuilder`:**

```dart
import 'package:flutter/material.dart';

class ResponsiveHelper {
  static const Map<String, double> breakpoints = {
    'xs': 320,
    'sm': 480,
    'md': 768,
    'lg': 1024,
    'xl': 1366,
  };

  static String getBreakpoint(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width < 480) return 'xs';
    if (width < 768) return 'sm';
    if (width < 1024) return 'md';
    if (width < 1366) return 'lg';
    return 'xl';
  }

  static double getResponsiveValue(
    BuildContext context, {
    required double xs,
    required double sm,
    required double md,
    required double lg,
    double? xl,
  }) {
    final bp = getBreakpoint(context);
    return switch (bp) {
      'xs' => xs,
      'sm' => sm,
      'md' => md,
      'lg' => lg,
      _ => xl ?? lg,
    };
  }

  static bool isPhone(BuildContext context) =>
    MediaQuery.of(context).size.width < 480;

  static bool isTablet(BuildContext context) =>
    MediaQuery.of(context).size.width >= 768;

  static bool isLandscape(BuildContext context) =>
    MediaQuery.of(context).orientation == Orientation.landscape;
}

// Usage in widget:
class ResponsiveTitle extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final fontSize = ResponsiveHelper.getResponsiveValue(
      context,
      xs: 18,
      sm: 20,
      md: 24,
      lg: 32,
    );

    return Text(
      'Hello',
      style: TextStyle(fontSize: fontSize),
    );
  }
}

// Or with LayoutBuilder for container queries:
class ResponsiveCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isTight = constraints.maxWidth < 300;

        return Padding(
          padding: EdgeInsets.all(isTight ? 8 : 16),
          child: Column(
            children: [
              Text('Card content'),
            ],
          ),
        );
      },
    );
  }
}
```

### Concrete Implementation: Web/TypeScript Responsive (for reference)

```typescript
// Tailwind CSS breakpoints (common web standard)
export const breakpoints = {
  xs: '320px',  // @media (min-width: 320px)
  sm: '480px',  // @media (min-width: 480px)
  md: '768px',  // @media (min-width: 768px)
  lg: '1024px', // @media (min-width: 1024px)
  xl: '1366px', // @media (min-width: 1366px)
};

// TypeScript hook for responsive values
function useResponsive(width: number) {
  return {
    isPhone: width < 480,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1366,
    breakpoint: width < 480 ? 'xs' :
                width < 768 ? 'sm' :
                width < 1024 ? 'md' :
                width < 1366 ? 'lg' : 'xl',
  };
}

// CSS Grid responsive example
const ResponsiveGrid = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {/* 1 col on xs, 2 on sm, 3 on md, 4 on lg */}
  </div>
);

// Fluid typography
const fluidTypography = {
  h1: 'clamp(24px, 5vw, 48px)',      // Scales between 24px and 48px
  h2: 'clamp(20px, 4vw, 36px)',
  body: 'clamp(14px, 2vw, 18px)',
};
```

---

## 📐 Responsive Component Patterns

### 1. Adaptive Grid Layout (Mobile → Tablet → Desktop)

**React Native:**
```typescript
import { View, ScrollView, useWindowDimensions } from 'react-native';

const AdaptiveGrid = ({ items, itemWidth = 160 }) => {
  const { width } = useWindowDimensions();

  // Calculate columns dynamically
  const padding = 16;
  const availableWidth = width - padding * 2;
  const columns = Math.max(1, Math.floor(availableWidth / itemWidth));
  const itemSize = (availableWidth - (columns - 1) * 8) / columns; // 8px gap

  const rows = Math.ceil(items.length / columns);
  const itemsPerRow = items.reduce<typeof items[]>((acc, item, idx) => {
    const rowIdx = Math.floor(idx / columns);
    if (!acc[rowIdx]) acc[rowIdx] = [];
    acc[rowIdx].push(item);
    return acc;
  }, []);

  return (
    <ScrollView>
      {itemsPerRow.map((row, idx) => (
        <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          {row.map((item) => (
            <View key={item.id} style={{ width: itemSize }}>
              <GridItem item={item} />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
};
```

**Flutter:**
```dart
class AdaptiveGrid extends StatelessWidget {
  final List<Item> items;
  final double itemWidth;

  const AdaptiveGrid({
    required this.items,
    this.itemWidth = 160,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final padding = 16.0;
        final availableWidth = constraints.maxWidth - padding * 2;
        final columns = (availableWidth / itemWidth).floor().clamp(1, 10);
        final itemSize = (availableWidth - (columns - 1) * 8) / columns;

        return GridView.builder(
          padding: EdgeInsets.all(padding),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1,
          ),
          itemCount: items.length,
          itemBuilder: (context, index) {
            return GridItem(item: items[index]);
          },
        );
      },
    );
  }
}
```

### 2. Collapsible Navigation (Mobile Header Responsive)

**React Native:**
```typescript
const CollapsibleHeader = ({ title, subtitle, onScroll }) => {
  const scrollY = useSharedValue(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const HEADER_MAX_HEIGHT = 140;
  const HEADER_MIN_HEIGHT = 60;
  const COLLAPSE_THRESHOLD = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;

      runOnJS(setIsCollapsed)(
        event.contentOffset.y > COLLAPSE_THRESHOLD
      );
    },
  });

  const headerStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, COLLAPSE_THRESHOLD],
      [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
      Extrapolate.CLAMP,
    );

    const titleOpacity = interpolate(
      scrollY.value,
      [0, COLLAPSE_THRESHOLD / 2],
      [1, 0.7],
      Extrapolate.CLAMP,
    );

    return {
      height,
      opacity: titleOpacity,
    };
  });

  return (
    <Animated.View style={[styles.header, headerStyle]}>
      <Text style={styles.title}>{title}</Text>
      {!isCollapsed && <Text style={styles.subtitle}>{subtitle}</Text>}
    </Animated.View>
  );
};
```

**Flutter:**
```dart
class CollapsibleAppBar extends StatelessWidget {
  final String title;
  final String subtitle;

  const CollapsibleAppBar({
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 140,
          floating: false,
          pinned: true,
          flexibleSpace: FlexibleSpaceBar(
            title: Text(title),
            background: Container(
              color: Colors.blue,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(subtitle),
                ],
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Container(
            // Content below
          ),
        ),
      ],
    );
  }
}
```

### 3. Responsive Modal/Sheet

**React Native:**
```typescript
const ResponsiveSheet = ({ isVisible, onClose, children }) => {
  const { height } = useWindowDimensions();
  const isPhone = useResponsive().isPhone;

  // On phone: full screen, on tablet: centered modal
  const sheetHeight = isPhone ? height * 0.9 : height * 0.7;
  const sheetWidth = isPhone ? '100%' : Math.min(600, height * 0.8);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              width: sheetWidth,
              marginLeft: isPhone ? 0 : 'auto',
              marginRight: isPhone ? 0 : 'auto',
            },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={styles.handle}
          />
          {children}
        </View>
      </View>
    </Modal>
  );
};
```

### 4. Fluid Typography (Responsive Text Scaling)

**React Native:**
```typescript
const FluidText = ({ text, minSize = 14, maxSize = 24 }) => {
  const { width } = useWindowDimensions();

  // Scale linearly from xs to lg breakpoint
  const scale = (width - 320) / (1366 - 320); // 0 to 1
  const fontSize = minSize + (maxSize - minSize) * Math.max(0, Math.min(1, scale));

  return <Text style={{ fontSize }}>{text}</Text>;
};

// OR: Use context-aware sizes
const ResponsiveText = ({ text, variant = 'body' }) => {
  const { breakpoint } = useResponsive();
  const sizes = {
    body: { xs: 14, sm: 15, md: 16, lg: 18 },
    heading: { xs: 20, sm: 22, md: 24, lg: 32 },
  };

  return (
    <Text style={{ fontSize: sizes[variant][breakpoint] }}>
      {text}
    </Text>
  );
};
```

---

## 📱 Platform-Specific Components

### iOS Component Patterns (HIG Compliance)

**Touch Target: 44pt × 44pt minimum**

```swift
// SwiftUI
struct iOSButton: View {
  let action: () -> Void
  let label: String

  var body: some View {
    Button(action: action) {
      Text(label)
        .frame(minHeight: 44) // Minimum touch target
        .frame(maxWidth: .infinity)
    }
    .padding(.horizontal, 16)
  }
}

// UIKit
class IOSViewController: UIViewController {
  let button = UIButton(type: .system)

  override func viewDidLoad() {
    super.viewDidLoad()

    button.frame.size = CGSize(width: 44, height: 44) // Minimum
    button.addTarget(self, action: #selector(buttonTapped), for: .touchUpInside)
  }
}
```

### Android Component Patterns (Material Design 3)

**Touch Target: 48dp × 48dp minimum**

```kotlin
// Jetpack Compose
@Composable
fun AndroidButton(
  onClick: () -> Unit,
  label: String,
) {
  Button(
    onClick = onClick,
    modifier = Modifier
      .height(48.dp) // Material minimum
      .fillMaxWidth()
      .padding(horizontal = 16.dp),
  ) {
    Text(label)
  }
}

// XML Layout
<com.google.android.material.button.MaterialButton
  android:id="@+id/button"
  android:layout_width="match_parent"
  android:layout_height="48dp"
  android:layout_margin="16dp"
  android:text="Tap me" />
```

---

## 🎨 Touch Target Sizing Reference

### Exact Values

| Platform | Primary CTA | Secondary | Icon | Min Gap |
|----------|------------|-----------|------|---------|
| **iOS** | 44pt × 44pt | 40pt × 40pt | 36pt × 36pt | 8pt |
| **Android** | 48dp × 48dp | 44dp × 44dp | 40dp × 40dp | 8dp |
| **Web** | 44px × 44px | 40px × 40px | 36px × 36px | 8px |

### Implementation: Hit Area Expansion (Invisible Touch Zone)

**React Native:**
```typescript
const ExpandedTouchArea = ({ onPress, children }) => {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} // Expand touch zone
    >
      {children}
    </Pressable>
  );
};
```

**Flutter:**
```dart
class ExpandedTouchArea extends StatelessWidget {
  final VoidCallback onTap;
  final Widget child;

  const ExpandedTouchArea({
    required this.onTap,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Semantics(
        enabled: true,
        onTap: onTap,
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          child: Container(
            alignment: Alignment.center,
            constraints: BoxConstraints(minHeight: 48, minWidth: 48),
            child: child,
          ),
        ),
      ),
    );
  }
}
```

---

## 🖼️ Responsive Images & Media

### Image Optimization Pattern

**React Native:**
```typescript
import { Image, useWindowDimensions } from 'react-native';

const ResponsiveImage = ({ source, width, height }) => {
  const { width: screenWidth } = useWindowDimensions();

  // Load appropriate resolution based on screen size
  const dpr = PixelRatio.get();
  const imageWidth = width * dpr;
  const imageHeight = height * dpr;

  // CDN URL pattern (Cloudinary, AWS CloudFront, etc.)
  const url = source.uri
    .replace('{width}', Math.ceil(imageWidth))
    .replace('{height}', Math.ceil(imageHeight))
    .replace('{dpr}', dpr);

  return (
    <Image
      source={{ uri: url }}
      style={{ width, height }}
      resizeMode="cover"
    />
  );
};

// Usage:
<ResponsiveImage
  source={{ uri: 'https://cdn.example.com/image-{width}x{height}-{dpr}x.webp' }}
  width={screenWidth - 32}
  height={200}
/>
```

### Web srcset Pattern (for reference)

```html
<picture>
  <source
    srcset="
      image-320w.webp 320w,
      image-480w.webp 480w,
      image-768w.webp 768w,
      image-1024w.webp 1024w
    "
    type="image/webp"
  />
  <img
    src="image-1024w.png"
    alt="Responsive image"
    loading="lazy"
  />
</picture>
```

### Lazy Loading (Intersection Observer pattern)

**React Native:**
```typescript
import { FlatList, Image } from 'react-native';

const LazyLoadImage = ({ source, index, visibleRange }) => {
  const shouldLoad = index >= visibleRange.from && index <= visibleRange.to;

  return shouldLoad ? (
    <Image
      source={source}
      style={{ width: 100, height: 100 }}
    />
  ) : (
    <View style={{ width: 100, height: 100, backgroundColor: '#f0f0f0' }} />
  );
};

const ImageList = ({ images }) => {
  const [visibleRange, setVisibleRange] = useState({ from: 0, to: 5 });

  const onViewableItemsChanged = ({ viewableItems }) => {
    const indices = viewableItems.map(({ index }) => index);
    setVisibleRange({
      from: Math.min(...indices),
      to: Math.max(...indices) + 2, // Preload next 2
    });
  };

  return (
    <FlatList
      data={images}
      renderItem={({ item, index }) => (
        <LazyLoadImage
          source={item}
          index={index}
          visibleRange={visibleRange}
        />
      )}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ minimumViewTime: 100, itemVisiblePercentThreshold: 50 }}
    />
  );
};
```

---

## 🔌 Offline-First Architecture

### Cache Strategy Pattern

**React Native:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private TTL_MS = 5 * 60 * 1000; // 5 minutes

  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.getFromCache<T>(key);
    if (cached) return cached;

    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      // Offline: return stale cache or throw
      const stale = await AsyncStorage.getItem(key);
      if (stale) return JSON.parse(stale);
      throw new Error('No network and no cache');
    }

    // Online: fetch and cache
    const data = await fetcher();
    await this.setCache(key, data);
    return data;
  }

  private async getFromCache<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.TTL_MS) {
      return cached.data as T;
    }

    // Check persistent storage
    const persistent = await AsyncStorage.getItem(key);
    if (persistent) {
      const data = JSON.parse(persistent) as T;
      this.cache.set(key, { data, timestamp: Date.now() });
      return data;
    }
    return null;
  }

  private async setCache<T>(key: string, data: T): Promise<void> {
    this.cache.set(key, { data, timestamp: Date.now() });
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }
}
```

### Optimistic Updates Pattern

```typescript
// Redux/Zustand action
const updateUserProfile = async (userId: string, updates: Partial<User>) => {
  const previousUser = store.getState().user;

  // 1. Optimistic update (immediate UI response)
  store.setState({ user: { ...previousUser, ...updates } });

  try {
    // 2. Server update
    const response = await api.updateUser(userId, updates);

    // 3. Confirm with server response
    store.setState({ user: response.data });
  } catch (error) {
    // 4. Rollback on failure
    store.setState({ user: previousUser });
    store.setState({ error: error.message });

    // 5. Queue for retry when online
    syncQueue.add({
      type: 'UPDATE_USER',
      payload: { userId, updates },
      timestamp: Date.now(),
    });
  }
};
```

### Conflict Resolution (Last-Write-Wins with Timestamps)

```typescript
interface SyncedEntity {
  id: string;
  data: any;
  localVersion: number;
  serverVersion: number;
  lastModified: number; // Unix timestamp
}

const mergeConflict = (local: SyncedEntity, server: SyncedEntity) => {
  if (server.lastModified > local.lastModified) {
    // Server is newer
    return { ...server, localVersion: local.localVersion + 1 };
  } else if (local.lastModified > server.lastModified) {
    // Local is newer, keep local
    return local;
  } else {
    // Same timestamp: deterministic merge (compare IDs)
    return local.id > server.id ? local : server;
  }
};
```

---

## ⚡ Performance Budget & Concrete Targets

### Mobile Performance Metrics

| Metric | Target | How to Measure |
|--------|--------|---|
| **First Contentful Paint (FCP)** | < 1.5s | React Native Profiler, Lighthouse |
| **Time to Interactive (TTI)** | < 3s | DevTools, React Profiler |
| **Largest Contentful Paint (LCP)** | < 2.5s | Lighthouse, Sentry |
| **Cumulative Layout Shift (CLS)** | < 0.1 | Web only, but RN alternatives: jank monitoring |
| **Bundle Size** | < 200KB (gzipped) | `react-native-bundle-visualizer`, Metro |
| **Memory Usage** | < 50MB (idle) | Flipper, Xcode Instruments, Android Studio |
| **Frame Rate** | 60fps (or 120fps smooth scroll) | React Native Profiler, DevTools |
| **Time to App Ready** | < 2s (from app launch) | Custom instrumentation |

### Implementation: Performance Monitoring

**React Native:**
```typescript
import { PerformanceMonitor } from '@react-native-performance/core';

PerformanceMonitor.mark('app_start');

// ... app initialization ...

PerformanceMonitor.mark('app_ready');
PerformanceMonitor.measure('app_start', 'app_ready', (duration) => {
  if (duration > 2000) {
    console.warn(`Slow app startup: ${duration}ms`);
    analytics.track('perf_slow_startup', { duration });
  }
});

// Component render time tracking
const MyExpensiveComponent = () => {
  useEffect(() => {
    PerformanceMonitor.mark('expensive_render_start');
    return () => {
      PerformanceMonitor.mark('expensive_render_end');
      PerformanceMonitor.measure('expensive_render_start', 'expensive_render_end');
    };
  }, []);

  return <Text>Expensive content</Text>;
};
```

**Flutter:**
```dart
class PerformanceTracker {
  static final stopwatch = Stopwatch();

  static void startMeasure(String label) {
    stopwatch.reset();
    stopwatch.start();
  }

  static void endMeasure(String label, {int thresholdMs = 500}) {
    stopwatch.stop();
    final elapsed = stopwatch.elapsedMilliseconds;

    debugPrint('$label: ${elapsed}ms');

    if (elapsed > thresholdMs) {
      analytics.logEvent(
        name: 'perf_slow_operation',
        parameters: {
          'label': label,
          'duration_ms': elapsed,
        },
      );
    }
  }
}

// Usage:
@override
Widget build(BuildContext context) {
  PerformanceTracker.startMeasure('build_expensive_widget');

  final widget = ExpensiveWidget();

  PerformanceTracker.endMeasure('build_expensive_widget', thresholdMs: 300);

  return widget;
}
```

---

## 🔐 Security Patterns for Mobile

### Secure Storage

**React Native:**
```typescript
import * as SecureStore from 'expo-secure-store';

// CORRECT: Tokens in Secure Storage
const saveToken = async (token: string) => {
  await SecureStore.setItemAsync('auth_token', token);
};

const getToken = async () => {
  return await SecureStore.getItemAsync('auth_token');
};

// NEVER: Tokens in AsyncStorage (vulnerable)
// ❌ await AsyncStorage.setItem('token', token); // WRONG!
```

**Flutter:**
```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const storage = FlutterSecureStorage();

Future<void> saveToken(String token) async {
  await storage.write(
    key: 'auth_token',
    value: token,
    aOptions: _getAndroidOptions(),
    iOptions: _getIOSOptions(),
  );
}

AndroidOptions _getAndroidOptions() => const AndroidOptions(
  keyCipherAlgorithm: KeyCipherAlgorithm.RSA_ECB_OAEPwithSHA_256andMGF1Padding,
  storageCipherAlgorithm: StorageCipherAlgorithm.AES_GCM_NoPadding,
);

IOSOptions _getIOSOptions() => const IOSOptions(
  accessibility: KeychainAccessibility.first_available_when_unlocked_this_device_only,
);
```

---

## ⚠️ CRITICAL: ASK BEFORE ASSUMING (MANDATORY)

> **STOP! If the user's request is open-ended, DO NOT default to your favorites.**

### You MUST Ask If Not Specified:

| Aspect | Ask | Why |
|--------|-----|-----|
| **Platform** | "iOS, Android, or both?" | Affects EVERY design decision |
| **Framework** | "React Native, Flutter, or native?" | Determines patterns and tools |
| **Navigation** | "Tab bar, drawer, or stack-based?" | Core UX decision |
| **State** | "What state management? (Zustand/Redux/Riverpod/BLoC?)" | Architecture foundation |
| **Offline** | "Does this need to work offline?" | Affects data strategy |
| **Target devices** | "Phone only, or tablet support?" | Layout complexity |
| **Performance targets** | "Any specific performance budgets?" | Determines optimization strategy |

### ⛔ AI MOBILE ANTI-PATTERNS (YASAK LİSTESİ)

> 🚫 **These are AI default tendencies that MUST be avoided!**

#### Performance Sins

| ❌ NEVER DO | Why It's Wrong | ✅ ALWAYS DO |
|-------------|----------------|--------------|
| **ScrollView for long lists** | Renders ALL items, memory explodes | Use `FlatList` / `FlashList` / `ListView.builder` |
| **Inline renderItem function** | New function every render, all items re-render | `useCallback` + `React.memo` |
| **Missing keyExtractor** | Index-based keys cause bugs on reorder | Unique, stable ID from data |
| **Skip getItemLayout** | Async layout = janky scroll | Provide when items have fixed height |
| **setState() everywhere** | Unnecessary widget rebuilds | Targeted state, `const` constructors |
| **Native driver: false** | Animations blocked by JS thread | `useNativeDriver: true` always |
| **console.log in production** | Blocks JS thread severely | Remove before release build |
| **Skip React.memo/const** | Every item re-renders on any change | Memoize list items ALWAYS |

#### Touch/UX Sins

| ❌ NEVER DO | Why It's Wrong | ✅ ALWAYS DO |
|-------------|----------------|--------------|
| **Touch target < 44px** | Impossible to tap accurately, frustrating | Minimum 44pt (iOS) / 48dp (Android) |
| **Spacing < 8px between targets** | Accidental taps on neighbors | Minimum 8-12px gap |
| **Gesture-only interactions** | Motor impaired users excluded | Always provide button alternative |
| **No loading state** | User thinks app crashed | ALWAYS show loading feedback |
| **No error state** | User stuck, no recovery path | Show error with retry option |
| **No offline handling** | Crash/block when network lost | Graceful degradation, cached data |
| **Ignore platform conventions** | Users confused, muscle memory broken | iOS feels iOS, Android feels Android |

#### Responsive Sins

| ❌ NEVER DO | Why It's Wrong | ✅ ALWAYS DO |
|-------------|----------------|--------------|
| **Fixed pixels everywhere** | Breaks on different screen sizes | Use responsive breakpoints & relative sizing |
| **Hardcoded font sizes** | Unreadable on smaller devices | Scale fonts with `useResponsive()` or MediaQuery |
| **Single column for tablets** | Wastes screen space, poor UX | Adaptive layouts with 2-3 columns |
| **No landscape support** | Rotation breaks layout | Test and support landscape orientation |
| **Images not optimized** | Huge bundle, slow loading | Use responsive image patterns, lazy loading |

#### Security Sins

| ❌ NEVER DO | Why It's Wrong | ✅ ALWAYS DO |
|-------------|----------------|--------------|
| **Token in AsyncStorage** | Easily accessible, stolen on rooted device | `SecureStore` / `Keychain` / `EncryptedSharedPreferences` |
| **Hardcode API keys** | Reverse engineered from APK/IPA | Environment variables, secure storage |
| **Skip SSL pinning** | MITM attacks possible | Pin certificates in production |
| **Log sensitive data** | Logs can be extracted | Never log tokens, passwords, PII |

#### Architecture Sins

| ❌ NEVER DO | Why It's Wrong | ✅ ALWAYS DO |
|-------------|----------------|--------------|
| **Business logic in UI** | Untestable, unmaintainable | Service layer separation |
| **Global state for everything** | Unnecessary re-renders, complexity | Local state default, lift when needed |
| **Deep linking as afterthought** | Notifications, shares broken | Plan deep links from day one |
| **Skip dispose/cleanup** | Memory leaks, zombie listeners | Clean up subscriptions, timers |

---

## 📱 Platform Decision Matrix

### When to Unify vs Diverge

```
                    UNIFY (same on both)          DIVERGE (platform-specific)
                    ───────────────────           ──────────────────────────
Business Logic      ✅ Always                     -
Data Layer          ✅ Always                     -
Core Features       ✅ Always                     -
Responsive Logic    ✅ Always                     -

Navigation          -                             ✅ iOS: edge swipe, Android: back button
Gestures            -                             ✅ Platform-native feel
Icons               -                             ✅ SF Symbols vs Material Icons
Touch Targets       -                             ✅ 44pt iOS vs 48dp Android (implement both)
Date Pickers        -                             ✅ Native pickers feel right
Modals/Sheets       -                             ✅ iOS: bottom sheet vs Android: dialog
Typography          -                             ✅ SF Pro vs Roboto (or custom)
Error Dialogs       -                             ✅ Platform conventions for alerts
```

### Quick Reference: Platform Defaults

| Element | iOS | Android |
|---------|-----|---------|
| **Primary Font** | SF Pro / SF Compact | Roboto |
| **Min Touch Target** | 44pt × 44pt | 48dp × 48dp |
| **Back Navigation** | Edge swipe left | System back button/gesture |
| **Bottom Tab Icons** | SF Symbols | Material Symbols |
| **Action Sheet** | UIActionSheet from bottom | Bottom Sheet / Dialog |
| **Progress** | Spinner | Linear progress (Material) |
| **Pull to Refresh** | Native UIRefreshControl | SwipeRefreshLayout |

---

## 🧠 Mobile UX Psychology (Quick Reference)

### Fitts' Law for Touch

```
Desktop: Cursor is precise (1px)
Mobile:  Finger is imprecise (~7mm contact area)

→ Touch targets MUST be 44-48px minimum
→ Important actions in THUMB ZONE (bottom of screen)
→ Destructive actions AWAY from easy reach
```

### Thumb Zone (One-Handed Usage)

```
┌─────────────────────────────┐
│      HARD TO REACH          │ ← Navigation, menu, back
│        (stretch)            │
├─────────────────────────────┤
│      OK TO REACH            │ ← Secondary actions
│       (natural)             │
├─────────────────────────────┤
│      EASY TO REACH          │ ← PRIMARY CTAs, tab bar
│    (thumb's natural arc)    │ ← Main content interaction
└─────────────────────────────┘
        [  HOME  ]
```

### Mobile-Specific Cognitive Load

| Desktop | Mobile Difference |
|---------|-------------------|
| Multiple windows | ONE task at a time |
| Keyboard shortcuts | Touch gestures |
| Hover states | NO hover (tap or nothing) |
| Large viewport | Limited space, scroll vertical |
| Stable attention | Interrupted constantly |

For deep dive: [touch-psychology.md](touch-psychology.md)

---

## ⚡ Performance Principles (Quick Reference)

### React Native Critical Rules

```typescript
// ✅ CORRECT: Memoized renderItem + React.memo wrapper
const ListItem = React.memo(({ item }: { item: Item }) => (
  <View style={styles.item}>
    <Text>{item.title}</Text>
  </View>
));

const renderItem = useCallback(
  ({ item }: { item: Item }) => <ListItem item={item} />,
  []
);

// ✅ CORRECT: FlatList with all optimizations
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}  // Stable ID, NOT index
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

### Flutter Critical Rules

```dart
// ✅ CORRECT: const constructors prevent rebuilds
class MyWidget extends StatelessWidget {
  const MyWidget({super.key}); // CONST!

  @override
  Widget build(BuildContext context) {
    return const Column( // CONST!
      children: [
        Text('Static content'),
        MyConstantWidget(),
      ],
    );
  }
}

// ✅ CORRECT: Targeted state with ValueListenableBuilder
ValueListenableBuilder<int>(
  valueListenable: counter,
  builder: (context, value, child) => Text('$value'),
  child: const ExpensiveWidget(), // Won't rebuild!
)
```

### Animation Performance

```
GPU-accelerated (FAST):     CPU-bound (SLOW):
├── transform               ├── width, height
├── opacity                 ├── top, left, right, bottom
└── (use these ONLY)        ├── margin, padding
                            └── (AVOID animating these)
```

For complete guide: [mobile-performance.md](mobile-performance.md)

---

## 📝 CHECKPOINT (MANDATORY Before Any Mobile Work)

> **Before writing ANY mobile code, you MUST complete this checkpoint:**

```
🧠 CHECKPOINT:

Platform:   [ iOS / Android / Both ]
Framework:  [ React Native / Flutter / SwiftUI / Kotlin ]
Files Read: [ List the skill files you've read ]
Responsive: [ Mobile-first / Tablet support / Desktop fallback ]

3 Principles I Will Apply:
1. _______________
2. _______________
3. _______________

Anti-Patterns I Will Avoid:
1. _______________
2. _______________
```

**Example:**
```
🧠 CHECKPOINT:

Platform:   iOS + Android (Cross-platform)
Framework:  React Native + Expo
Files Read: touch-psychology.md, mobile-performance.md, responsive-design.md, platform-ios.md, platform-android.md
Responsive: Mobile-first (xs: 320-479px) → Tablet support (md: 768-1023px)

3 Principles I Will Apply:
1. FlatList with React.memo + useCallback for all lists
2. useResponsive() hook with breakpoint-aware styling (xs/sm/md/lg)
3. 48px touch targets in Android, platform-specific navigation

Anti-Patterns I Will Avoid:
1. ScrollView for lists → FlatList
2. Inline renderItem → Memoized with useCallback
3. AsyncStorage for tokens → SecureStore
4. Fixed font sizes → Responsive scaling via breakpoints
5. Single-column layout for tablets → useResponsive() for adaptive grids
```

> 🔴 **Can't fill the checkpoint? → GO BACK AND READ THE SKILL FILES.**

---

## 🔧 Framework Decision Tree

```
WHAT ARE YOU BUILDING?
        │
        ├── Need OTA updates + rapid iteration + web team + responsive
        │   └── ✅ React Native + Expo (with useResponsive hooks)
        │
        ├── Need pixel-perfect custom UI + performance critical + responsive
        │   └── ✅ Flutter (with MediaQuery + LayoutBuilder)
        │
        ├── Deep native features + single platform focus
        │   ├── iOS only → SwiftUI (with adaptive layouts)
        │   └── Android only → Kotlin + Jetpack Compose (with responsive scaffolds)
        │
        ├── Existing RN codebase + new responsive features
        │   └── ✅ React Native (bare workflow + useWindowDimensions)
        │
        └── Enterprise + existing Flutter codebase + tablet support
            └── ✅ Flutter (with MediaQuery breakpoints)
```

For complete decision trees: [decision-trees.md](decision-trees.md)

---

## 📋 Pre-Development Checklist

### Before Starting ANY Mobile Project

- [ ] **Platform confirmed?** (iOS / Android / Both)
- [ ] **Framework chosen?** (RN / Flutter / Native)
- [ ] **Navigation pattern decided?** (Tabs / Stack / Drawer)
- [ ] **State management selected?** (Zustand / Redux / Riverpod / BLoC)
- [ ] **Offline requirements known?**
- [ ] **Deep linking planned from day one?**
- [ ] **Target devices defined?** (Phone / Tablet / Both)
- [ ] **Responsive breakpoints defined?** (xs/sm/md/lg/xl)
- [ ] **Touch target strategy planned?** (44pt iOS / 48dp Android)

### Before Every Screen

- [ ] **Touch targets ≥ 44-48px?**
- [ ] **Primary CTA in thumb zone?**
- [ ] **Loading state exists?**
- [ ] **Error state with retry exists?**
- [ ] **Offline handling considered?**
- [ ] **Platform conventions followed?**
- [ ] **Responsive layout for multiple screen sizes?**
- [ ] **Tablet layout tested?** (if supporting tablets)
- [ ] **Images optimized for responsive?** (srcset, lazy loading)

### Before Release

- [ ] **console.log removed?**
- [ ] **SecureStore for sensitive data?**
- [ ] **SSL pinning enabled?**
- [ ] **Lists optimized (memo, keyExtractor)?**
- [ ] **Memory cleanup on unmount?**
- [ ] **Tested on low-end devices?**
- [ ] **Accessibility labels on all interactive elements?**
- [ ] **Performance budget met?** (FCP < 1.5s, bundle < 200KB)
- [ ] **Responsive tested on xs/sm/md/lg breakpoints?**
- [ ] **Tablet landscape orientation tested?**
- [ ] **Offline-first flows tested?**

---

## 📚 Reference Files

For deeper guidance on specific areas:

| File | When to Use |
|------|-------------|
| [mobile-design-thinking.md](mobile-design-thinking.md) | **FIRST! Anti-memorization, forces context-based thinking** |
| [responsive-design.md](responsive-design.md) | **Responsive breakpoints, fluid layouts, container queries** |
| [touch-psychology.md](touch-psychology.md) | Understanding touch interaction, Fitts' Law, gesture design |
| [mobile-performance.md](mobile-performance.md) | Optimizing RN/Flutter, 60fps, memory/battery, performance budget |
| [platform-ios.md](platform-ios.md) | iOS-specific design, HIG compliance, 44pt touch targets |
| [platform-android.md](platform-android.md) | Android-specific design, Material Design 3, 48dp touch targets |
| [mobile-navigation.md](mobile-navigation.md) | Navigation patterns, deep linking |
| [mobile-typography.md](mobile-typography.md) | Type scale, system fonts, accessibility, responsive text |
| [mobile-color-system.md](mobile-color-system.md) | OLED optimization, dark mode, battery |
| [decision-trees.md](decision-trees.md) | Framework, state, storage decisions |

---

## 🎯 Quick Responsive Implementation Checklist

- [ ] **Breakpoint system defined**: xs (320), sm (480), md (768), lg (1024), xl (1366)
- [ ] **Touch targets**: 44pt iOS / 48dp Android minimum, 8px gaps
- [ ] **useResponsive hook**: Created with breakpoint detection
- [ ] **Fluid typography**: Scale with `clamp()` or breakpoint lookup
- [ ] **Adaptive grids**: Use column calculation or GridView with MediaQuery
- [ ] **Responsive images**: Implement srcset or CDN URL patterns
- [ ] **Offline cache**: Cache manager with TTL + sync queue
- [ ] **Performance monitoring**: Track FCP, TTI, bundle size
- [ ] **Secure storage**: Tokens in SecureStore, NOT AsyncStorage
- [ ] **Platform-specific**: Platform.select() for iOS vs Android divergence

---

> **Remember:** Mobile users are impatient, interrupted, and using imprecise fingers on small screens. Design and implement for the WORST conditions: bad network, one hand, bright sun, low battery, old device (2GB RAM). If it works there, it works everywhere.
>
> **Responsive design is not optional.** Implement breakpoints, test on xs/md/lg, and measure performance against your budget.
