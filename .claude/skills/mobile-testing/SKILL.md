# Mobile Application Testing Skill

## Overview

Mobile application testing requires a fundamentally different approach than web testing. This skill covers enterprise-grade testing strategies for both React Native and Flutter apps, encompassing functional testing, performance optimization, accessibility compliance, and production readiness.

---

## React Native Testing with Detox

### Setup and Configuration

```bash
# Install Detox CLI globally
npm install detox-cli --global

# Initialize Detox in your React Native project
detox init -r ios

# Install dependencies
npm install detox detox-cli detox-test-utils --save-dev

# Build for testing
detox build-framework-cache
detox build-ios-framework
detox build-ios
```

### Basic Test Structure

```javascript
// e2e/testApp.e2e.js
describe('Authentication Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  afterAll(async () => {
    await device.sendUserInteraction();
  });

  it('should complete login workflow', async () => {
    // Find element by testID
    await waitFor(element(by.id('emailInput')))
      .toBeVisible()
      .withTimeout(5000);

    // Type text
    await element(by.id('emailInput')).typeText('user@example.com');
    await element(by.id('passwordInput')).typeText('password123');

    // Tap button
    await element(by.text('Login')).multiTap(1);

    // Wait for navigation
    await waitFor(element(by.id('dashboardScreen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('dashboardScreen'))).toBeVisible();
  });

  it('should validate error messages', async () => {
    await element(by.id('emailInput')).typeText('invalid-email');
    await element(by.text('Login')).tap();

    await waitFor(element(by.text('Invalid email format')))
      .toBeVisible()
      .withTimeout(3000);

    await expect(element(by.text('Invalid email format'))).toBeVisible();
  });
});
```

### Advanced Detox Patterns

**Device Interactions:**
```javascript
// Scroll interactions
await waitFor(element(by.text('Item 10')))
  .toBeVisible()
  .whileElement(by.id('listView'))
  .scroll(500, 'down');

// Swipe gestures
await element(by.id('swipeCard')).swipe('left', 'fast', 0.5);

// Long press
await element(by.id('listItem')).longPress();

// Multiple taps
await element(by.text('Like')).multiTap(3);

// Type with options
await element(by.id('input')).typeText('Search term', true); // true = clear first
```

**Synchronization Strategies:**
```javascript
// Wait for loading indicator to disappear
await waitFor(element(by.id('loadingSpinner')))
  .not.toBeVisible()
  .withTimeout(10000);

// Custom synchronization
await device.disableSynchronization();
// Perform non-deterministic actions
await device.enableSynchronization();

// Wait for condition
await waitFor(element(by.id('result')))
  .toHaveToggleValue(true)
  .withTimeout(5000);
```

### Jest Unit Testing for React Native

```javascript
// __tests__/userService.test.js
import { formatPhoneNumber, validatePassword } from '../userService';

describe('User Service', () => {
  describe('formatPhoneNumber', () => {
    it('should format phone number correctly', () => {
      expect(formatPhoneNumber('1234567890')).toBe('(123) 456-7890');
      expect(formatPhoneNumber('12345')).toBe('12345');
    });

    it('should handle international formats', () => {
      expect(formatPhoneNumber('+1-234-567-8900')).toMatch(/\+1.*234/);
    });
  });

  describe('validatePassword', () => {
    it('should reject weak passwords', () => {
      expect(validatePassword('short')).toBe(false);
      expect(validatePassword('nouppercasehere')).toBe(false);
      expect(validatePassword('NoNumbers')).toBe(false);
    });

    it('should accept strong passwords', () => {
      expect(validatePassword('SecurePass123!')).toBe(true);
      expect(validatePassword('MyP@ssw0rd')).toBe(true);
    });
  });
});
```

---

## Flutter Widget Testing

### Setup

```bash
# Add dev dependencies to pubspec.yaml
dev_dependencies:
  flutter_test:
    sdk: flutter
  mockito: ^5.4.0
  mocktail: ^1.0.0

# Run tests
flutter test
```

### Widget Test Examples

```dart
// test/widgets/login_widget_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:myapp/screens/login_screen.dart';

void main() {
  group('LoginScreen', () => {
    testWidgets('should display email and password fields',
      (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(home: LoginScreen()));

      expect(find.byType(TextField), findsWidgets);
      expect(find.byKey(Key('emailField')), findsOneWidget);
      expect(find.byKey(Key('passwordField')), findsOneWidget);
    });

    testWidgets('should validate empty email field',
      (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(home: LoginScreen()));

      // Tap login button without entering email
      await tester.tap(find.byType(ElevatedButton));
      await tester.pump();

      expect(find.text('Email is required'), findsOneWidget);
    });

    testWidgets('should navigate to home on successful login',
      (WidgetTester tester) async {
      final mockAuthService = MockAuthService();
      when(() => mockAuthService.login(any(), any()))
        .thenAnswer((_) async => AuthResponse.success());

      await tester.pumpWidget(
        MaterialApp(
          home: LoginScreen(authService: mockAuthService),
        ),
      );

      await tester.enterText(find.byKey(Key('emailField')), 'test@test.com');
      await tester.enterText(find.byKey(Key('passwordField')), 'password');
      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
    });
  });
}
```

### Integration Testing

```dart
// test/integration_test/auth_flow_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:myapp/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Authentication Integration Test', () {
    testWidgets('Complete sign up and login flow',
      (WidgetTester tester) async {
      app.main();
      await tester.pumpAndSettle();

      // Navigate to sign up
      await tester.tap(find.text('Sign Up'));
      await tester.pumpAndSettle();

      // Fill sign up form
      await tester.enterText(
        find.byType(TextField).first,
        'newuser@example.com'
      );
      await tester.enterText(
        find.byType(TextField).at(1),
        'SecurePassword123!'
      );

      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle(Duration(seconds: 2));

      // Verify successful signup
      expect(find.text('Account created successfully'), findsOneWidget);
    });
  });
}
```

---

## Responsive Design Testing

### Multi-Device Testing Strategy

```javascript
// e2e/responsiveLayout.e2e.js
describe('Responsive Layout Testing', () => {
  const testConfigs = [
    { device: 'iphone8', width: 375, height: 667 },
    { device: 'iphone12', width: 390, height: 844 },
    { device: 'ipad', width: 1024, height: 1366 },
    { device: 'pixel5', width: 393, height: 851 },
  ];

  testConfigs.forEach(config => {
    describe(`Testing on ${config.device}`, () => {
      beforeAll(async () => {
        await device.setScreenSize({
          width: config.width,
          height: config.height
        });
      });

      it('should render navigation correctly', async () => {
        await waitFor(element(by.id('navigationMenu')))
          .toBeVisible()
          .withTimeout(5000);

        // On mobile: hamburger menu
        if (config.width < 600) {
          await expect(element(by.id('hamburgerMenu'))).toBeVisible();
          await expect(element(by.id('fullNavigation'))).not.toBeVisible();
        }
        // On tablet: full navigation
        else {
          await expect(element(by.id('fullNavigation'))).toBeVisible();
        }
      });

      it('should display grid layout correctly', async () => {
        const gridItems = await element(by.id('gridContainer'))
          .getAttributes();

        // Verify proper grid columns for device size
        const expectedColumns = config.width < 600 ? 1 : 2;
        // Verify grid structure maintains readability
        expect(gridItems).toBeDefined();
      });
    });
  });
});
```

### CSS Testing with React Native

```javascript
// __tests__/responsiveStyles.test.js
import { Dimensions } from 'react-native';
import { getResponsiveStyles } from '../styles/responsive';

describe('Responsive Styles', () => {
  it('should return mobile styles for small screens', () => {
    const mockDimensions = { width: 360, height: 640 };
    const styles = getResponsiveStyles(mockDimensions);

    expect(styles.containerPadding).toBe(12);
    expect(styles.fontSize).toBe(14);
    expect(styles.columns).toBe(1);
  });

  it('should return tablet styles for medium screens', () => {
    const mockDimensions = { width: 768, height: 1024 };
    const styles = getResponsiveStyles(mockDimensions);

    expect(styles.containerPadding).toBe(20);
    expect(styles.fontSize).toBe(16);
    expect(styles.columns).toBe(2);
  });
});
```

---

## Performance Testing on Mobile

### Memory Profiling

```javascript
// test/performance/memoryProfiling.test.js
import { performance } from 'perf_hooks';

describe('Memory Performance', () => {
  it('should not leak memory on repeated renders', async () => {
    const initialMemory = await device.getMemoryStats();

    // Perform repeated navigation cycles
    for (let i = 0; i < 10; i++) {
      await element(by.id('listItem')).tap();
      await element(by.id('backButton')).tap();
      await device.reloadReactNative();
    }

    const finalMemory = await device.getMemoryStats();
    const memoryIncrease = finalMemory.usedMemory - initialMemory.usedMemory;

    // Should not increase by more than 10MB
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
  });
});
```

### FPS and Rendering Metrics

```javascript
// Native module for FPS monitoring
// ios/FPSMonitor.swift
@objc class FPSMonitor: NSObject {
  private var displayLink: CADisplayLink?
  private var frameCount = 0
  private var lastTimestamp: CFTimeInterval = 0

  @objc func startMonitoring() {
    displayLink = CADisplayLink(
      target: self,
      selector: #selector(updateFrame)
    )
    displayLink?.add(to: .main, forMode: .common)
  }

  @objc func updateFrame() {
    frameCount += 1
    let currentTime = CACurrentMediaTime()

    if currentTime - lastTimestamp >= 1.0 {
      let fps = frameCount
      frameCount = 0
      lastTimestamp = currentTime

      NotificationCenter.default.post(
        name: NSNotification.Name("FPSUpdate"),
        object: ["fps": fps]
      )
    }
  }
}
```

### Battery and Network Metrics

```javascript
// e2e/batteryMetrics.e2e.js
describe('Battery and Network Performance', () => {
  it('should not consume excessive battery', async () => {
    const initialBattery = await device.getBatteryLevel();

    // Simulate heavy usage
    for (let i = 0; i < 5; i++) {
      await element(by.id('videoPlayer')).multiTap(1);
      await device.sendUserInteraction();
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const finalBattery = await device.getBatteryLevel();
    const batteryDrain = initialBattery - finalBattery;

    // 5 minute video playback should use < 5% battery
    expect(batteryDrain).toBeLessThan(5);
  });

  it('should handle network latency gracefully', async () => {
    await device.simulateSlowNetwork('3g');

    await element(by.id('loadDataButton')).tap();

    // Should show loading indicator
    await waitFor(element(by.id('loadingSpinner')))
      .toBeVisible()
      .withTimeout(5000);

    // Should display data once loaded
    await waitFor(element(by.id('dataContent')))
      .toBeVisible()
      .withTimeout(15000);

    await device.resetNetwork();
  });
});
```

---

## Accessibility Testing on Mobile

### WCAG Compliance Testing

```javascript
// e2e/accessibility.e2e.js
describe('Accessibility Compliance', () => {
  it('should have proper semantic hierarchy', async () => {
    await waitFor(element(by.id('screenContainer')))
      .toBeVisible()
      .withTimeout(5000);

    // Get accessibility label
    const header = element(by.id('pageHeader'));
    const attributes = await header.getAttributes();

    expect(attributes.label).toBe('Dashboard');
    expect(attributes.accessibilityLevel).toBe('header');
  });

  it('should support voice over navigation', async () => {
    // Enable accessibility features
    await device.enableAccessibility();

    // Navigate using accessibility focus
    await element(by.id('firstButton')).multiTap(1);
    await device.nextAccessibilityElement();

    const focused = element(by.id('secondButton'));
    await expect(focused).toHaveToggleValue(true);
  });

  it('should have sufficient color contrast', async () => {
    const element = await getElementScreenshot('textElement');
    const contrast = await analyzeColorContrast(element);

    // WCAG AA requires minimum 4.5:1 for normal text
    expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('should support text scaling', async () => {
    await device.setSystemUIFontSize(1.5);

    await waitFor(element(by.id('content')))
      .toBeVisible()
      .withTimeout(5000);

    // Text should still be readable
    const textSize = await getTextSize('mainText');
    expect(textSize).toBeGreaterThan(18);
  });
});
```

### Screen Reader Testing

```javascript
// Manual testing checklist for screen readers
const screenReaderTestingChecklist = {
  "Content Labeling": [
    "All images have meaningful alt text",
    "Icon-only buttons have labels",
    "Form inputs have associated labels",
    "Interactive elements have clear purposes"
  ],
  "Navigation": [
    "Logical tab order through interactive elements",
    "Skip links to main content",
    "Screen reader can announce page sections",
    "Focus visible indicators present"
  ],
  "Form Accessibility": [
    "Error messages associated with fields",
    "Required fields marked",
    "Success messages announced",
    "Form instructions available"
  ],
  "Media": [
    "Videos have captions",
    "Audio has transcripts",
    "Alternative text for complex graphics",
    "Media controls are keyboard accessible"
  ]
};
```

---

## Push Notification Testing

### Test Notification Delivery

```javascript
// e2e/pushNotifications.e2e.js
describe('Push Notification System', () => {
  it('should receive and display notification', async () => {
    // Configure test device for notifications
    await device.requestPermissions({ notifications: 'YES' });

    // Trigger notification from backend
    await triggerPushNotification({
      title: 'Test Notification',
      body: 'This is a test message',
      data: { screen: 'inbox' }
    });

    // Wait for notification to appear
    await waitFor(element(by.text('Test Notification')))
      .toBeVisible()
      .withTimeout(10000);

    // Tap notification
    await element(by.text('Test Notification')).tap();

    // Verify navigation to correct screen
    await waitFor(element(by.id('inboxScreen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should handle notification payload correctly', async () => {
    const payload = {
      title: 'Order Update',
      body: 'Your order #12345 shipped',
      data: {
        orderId: '12345',
        screen: 'orders',
        action: 'viewOrder'
      }
    };

    await device.simulateReceiveNotification(payload);

    await waitFor(element(by.text('Order Update')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should not display notification when app focused', async () => {
    // Keep app in foreground
    await device.sendUserInteraction();

    await triggerPushNotification({
      title: 'Foreground Notification',
      body: 'Testing foreground behavior'
    });

    // Notification should be handled by app, not shown in system tray
    // Instead, in-app toast should display
    await waitFor(element(by.text('Foreground Notification')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

### Mock Notification Server

```javascript
// test/mockPushServer.js
class MockPushNotificationServer {
  constructor() {
    this.subscribers = [];
    this.deliveryLog = [];
  }

  async sendNotification(userId, notification) {
    const delivery = {
      userId,
      notification,
      sentAt: new Date(),
      status: 'pending'
    };

    this.deliveryLog.push(delivery);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    delivery.status = 'delivered';

    return {
      notificationId: Math.random().toString(36),
      deliveryTime: delivery.sentAt,
      status: 'delivered'
    };
  }

  async sendBatch(notifications) {
    return Promise.all(
      notifications.map(n =>
        this.sendNotification(n.userId, n.notification)
      )
    );
  }

  getDeliveryLog(userId) {
    return this.deliveryLog.filter(d => d.userId === userId);
  }
}

module.exports = MockPushNotificationServer;
```

---

## Deep Link Testing

### Configure Deep Links

```javascript
// e2e/deepLinks.e2e.js
describe('Deep Link Navigation', () => {
  it('should navigate to product details via deep link', async () => {
    // Simulate deep link intent
    const deepLink = 'myapp://product/12345';
    await device.openURL(deepLink);

    await waitFor(element(by.id('productDetails')))
      .toBeVisible()
      .withTimeout(5000);

    // Verify correct product loaded
    await expect(element(by.text('Product ID: 12345'))).toBeVisible();
  });

  it('should handle malformed deep links gracefully', async () => {
    const invalidLink = 'myapp://invalid/path/format';
    await device.openURL(invalidLink);

    // Should stay on current screen or show error
    await expect(element(by.id('errorScreen')).or(by.id('homeScreen')))
      .toBeVisible();
  });

  it('should preserve navigation state with deep links', async () => {
    // Navigate through app normally
    await element(by.id('browseButton')).tap();
    await element(by.id('productItem')).tap();

    // Get navigation state
    const state = await device.getNavigationState();

    // Deep link to same screen
    const deepLink = 'myapp://product/12345';
    await device.openURL(deepLink);

    // Should handle navigation transition properly
    await waitFor(element(by.id('productDetails')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

### Link Validation

```javascript
// test/deepLinkValidator.js
class DeepLinkValidator {
  constructor(schemes) {
    this.schemes = schemes; // ['myapp', 'https']
    this.routes = new Map();
  }

  registerRoute(pattern, handler) {
    this.routes.set(pattern, handler);
  }

  validateLink(url) {
    const urlObj = new URL(url);

    // Check scheme
    if (!this.schemes.includes(urlObj.protocol.replace(':', ''))) {
      return {
        valid: false,
        error: `Unsupported scheme: ${urlObj.protocol}`
      };
    }

    // Check if route exists
    const routeFound = Array.from(this.routes.keys()).some(pattern => {
      return this.matchPattern(pattern, urlObj.pathname);
    });

    if (!routeFound) {
      return {
        valid: false,
        error: `No matching route for ${urlObj.pathname}`
      };
    }

    return { valid: true };
  }

  matchPattern(pattern, path) {
    const patternRegex = pattern.replace(/:\w+/g, '[^/]+');
    return new RegExp(`^${patternRegex}$`).test(path);
  }
}

module.exports = DeepLinkValidator;
```

---

## Offline Mode Testing

### Mock Network Conditions

```javascript
// e2e/offlineMode.e2e.js
describe('Offline Mode Functionality', () => {
  it('should display cached data when offline', async () => {
    // First, load data while online
    await device.setNetworkState('wifi');
    await element(by.id('loadDataButton')).tap();

    await waitFor(element(by.id('dataLoaded')))
      .toBeVisible()
      .withTimeout(5000);

    // Go offline
    await device.setNetworkState('none');

    // Reload app
    await device.reloadReactNative();

    // Should still display cached data
    await waitFor(element(by.id('dataLoaded')))
      .toBeVisible()
      .withTimeout(5000);

    // Offline indicator should be visible
    await expect(element(by.id('offlineBadge'))).toBeVisible();
  });

  it('should queue requests when offline', async () => {
    await device.setNetworkState('none');

    // Attempt to create new item
    await element(by.id('createButton')).tap();
    await element(by.id('titleInput')).typeText('New Item');
    await element(by.id('submitButton')).tap();

    // Should show queued status
    await waitFor(element(by.text('Queued')))
      .toBeVisible()
      .withTimeout(3000);

    // Go online
    await device.setNetworkState('wifi');

    // Should sync and show success
    await waitFor(element(by.text('Synced')))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should handle offline/online transitions gracefully', async () => {
    const transitions = [
      { state: 'wifi', duration: 2000 },
      { state: 'none', duration: 2000 },
      { state: 'cellular', duration: 2000 },
      { state: 'none', duration: 1000 }
    ];

    for (const transition of transitions) {
      await device.setNetworkState(transition.state);
      await new Promise(resolve => setTimeout(resolve, transition.duration));

      // App should remain functional
      await device.sendUserInteraction();
      await expect(element(by.id('appContent'))).toBeVisible();
    }
  });
});
```

---

## App Store Submission Checklist

### Pre-Submission Verification

```javascript
// scripts/appStoreSubmissionChecklist.js
const submissionChecklist = {
  "App Information": [
    "App name meets character limits (30 chars max)",
    "Subtitle provided and accurate (30 chars max)",
    "Keyword list includes relevant search terms",
    "Description is clear and highlights key features",
    "Support URL is valid and responsive",
    "Privacy Policy URL is valid and accessible",
    "Category selected appropriately"
  ],

  "Build Settings": [
    "App version number incremented (semantic versioning)",
    "Build number incremented",
    "Minimum iOS version set correctly (≥10.0 for most)",
    "Minimum Android API level set (≥21)",
    "All required capabilities configured",
    "Provisioning profile is valid and current",
    "Code signing certificate is valid"
  ],

  "Assets": [
    "App icon (1024x1024 required, no transparency)",
    "Launch screen/splash screen designed",
    "Screenshots for all screen sizes",
    "Preview video (optional but recommended)",
    "App Store Connect images have no rounded corners",
    "All images optimized for web"
  ],

  "Testing": [
    "Full regression testing on target devices",
    "Tested on minimum supported iOS/Android version",
    "Tested on latest iOS/Android version",
    "Tested on actual devices (not just simulator)",
    "All edge cases handled",
    "No console errors or warnings",
    "Loading time < 3 seconds on 4G",
    "No memory leaks detected",
    "Battery drain acceptable",
    "Accessibility features tested"
  ],

  "Code Quality": [
    "No third-party frameworks with GPL licenses",
    "No hardcoded secrets or API keys",
    "App doesn't access restricted APIs improperly",
    "Encryption properly declared (if applicable)",
    "No crash on startup",
    "All required permissions justified",
    "App runs without user account (public content)",
    "Proper error handling throughout"
  ],

  "Compliance": [
    "Terms of Service updated if needed",
    "GDPR compliance for EU users",
    "COPPA compliance if under-13 users (US)",
    "Age rating selected accurately",
    "Contact information provided",
    "Refund policy clearly stated"
  ],

  "iOS Specific": [
    "AppDelegate properly configured",
    "Info.plist has all required keys",
    "App URL scheme declared (if needed)",
    "Universal Links configured",
    "Background modes justified",
    "Notification categories configured",
    "Widget support (if applicable)",
    "Sign in with Apple implemented (if social login used)"
  ],

  "Android Specific": [
    "AndroidManifest.xml has required permissions",
    "App signed with release keystore",
    "minSdkVersion compatible with users",
    "targetSdkVersion is current or near-current",
    "No analytics in debug builds",
    "Content providers properly protected",
    "Services properly declared"
  ]
};
```

### Automated Pre-Submission Testing

```javascript
// scripts/preSubmissionTests.js
async function runPreSubmissionTests() {
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  // Test app startup
  try {
    await device.launchApp();
    results.passed.push('App launches successfully');
  } catch (e) {
    results.failed.push(`App launch failed: ${e.message}`);
  }

  // Test critical user flows
  const criticalFlows = [
    { name: 'Authentication', testFn: testAuthFlow },
    { name: 'Main Navigation', testFn: testNavigation },
    { name: 'Data Loading', testFn: testDataLoading },
    { name: 'Error Handling', testFn: testErrorHandling }
  ];

  for (const flow of criticalFlows) {
    try {
      await flow.testFn();
      results.passed.push(`${flow.name} flow works correctly`);
    } catch (e) {
      results.failed.push(`${flow.name} flow failed: ${e.message}`);
    }
  }

  // Check for console errors
  const consoleMessages = await device.getConsoleMessages();
  const errors = consoleMessages.filter(m => m.level === 'error');

  if (errors.length > 0) {
    results.warnings.push(`Found ${errors.length} console errors`);
  }

  // Check memory usage
  const memStats = await device.getMemoryStats();
  if (memStats.usedMemory > 500 * 1024 * 1024) {
    results.warnings.push('Memory usage exceeds 500MB');
  }

  return results;
}
```

---

## Best Practices Summary

1. **Test on Real Devices**: Always test on actual hardware before submission, not just simulators
2. **Test Multiple Orientations**: Portrait, landscape, split-screen (iPad)
3. **Network Conditions**: Test on WiFi, 4G, 3G, and offline modes
4. **Battery Impact**: Monitor battery drain during long sessions
5. **Accessibility**: Screen reader testing is mandatory, not optional
6. **Performance Baselines**: Establish and maintain FPS, memory, and load time targets
7. **Regression Testing**: Maintain regression test suite for each release
8. **Continuous Integration**: Automated testing on every commit
9. **User Feedback Loop**: Monitor crash reports and user feedback post-launch
10. **Security Testing**: Regular security audits, especially for authentication

---

## Resources

- Detox Official Documentation: https://wix.github.io/Detox/
- Flutter Testing Guide: https://flutter.dev/docs/testing
- Apple TestFlight Beta Testing: https://developer.apple.com/testflight/
- Google Play Testing: https://support.google.com/googleplay/android-developer
- WCAG Mobile Accessibility: https://www.w3.org/WAI/WCAG21/quickref/
