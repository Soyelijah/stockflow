# Building the StockFlow Android APK

This document walks through generating an installable `.apk` of StockFlow that can
be sideloaded onto Android devices (sellers, drivers, customers) or eventually
uploaded to the Play Store.

The wrap uses [Capacitor](https://capacitorjs.com) (the successor to Cordova by the
Ionic team). It hosts the existing React + Vite PWA inside a native Android webview,
so we get an installable APK without rewriting the app in React Native or Flutter.

## One-time setup (Pierre's Mac)

These are already done per Pierre's report; documented here for future operators or
fresh clones.

### Required toolchain

| Tool | Version | Install command |
|---|---|---|
| Android Studio | Latest (Iguana / Koala / current) | Download from https://developer.android.com/studio |
| Android SDK Platforms | API 31–35 | Via Android Studio → SDK Manager |
| Android SDK Build-Tools | 33.x – 35.x | Via Android Studio → SDK Manager |
| JDK | **21** (Capacitor 7.6.x + AGP 8.x requirement) | `brew install openjdk@21` |
| `ANDROID_HOME` | `/Users/<you>/Library/Android/sdk` | Export in `~/.zshrc` / `~/.bashrc` |
| `JAVA_HOME` | Pointing to JDK 21 | Export in `~/.zshrc` / `~/.bashrc` |
| SDK licenses | Accepted | `sdkmanager --licenses` |

Sanity checks:

```bash
java -version          # should report 21.x
echo $ANDROID_HOME     # should print the sdk path
echo $JAVA_HOME        # should point to JDK 21, NOT 17 or 20
adb --version          # confirms platform-tools installed
```

If you have multiple JDKs installed (which is common — macOS often ships JDK 20,
Homebrew offers @17 + @21), set `JAVA_HOME` explicitly in your shell rc file:

```bash
# ~/.zshrc or ~/.bashrc
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
# (Apple Silicon path; Intel Mac uses /usr/local/opt/openjdk@21/...)
```

Or set per-command without polluting the shell:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home pnpm apk:debug
```

Why JDK 21 specifically: Capacitor 7.6.x ships with an Android Gradle Plugin (AGP)
that targets `sourceCompatibility = 21` in the generated Gradle config. Building with
JDK 17 fails with `error: invalid source release: 21`. AGP 8.x also rejects JDK 22+ at
the time of writing, so JDK 21 is the sweet spot.

### One-time Capacitor scaffolding

After cloning the repo and running `pnpm install`, generate the `/android` Gradle
project. This is run ONCE per fresh clone:

```bash
npx cap add android
```

This creates `/android/` with:
- `app/` — Gradle module for the StockFlow app (manifest, resources, build config)
- `build.gradle` — root-level build script
- `gradlew` — the wrapped Gradle binary

Commit the `/android` folder if you want all team members to share the same native
project state. (Currently gitignored — uncomment the entry in `.gitignore` to track.)

## Building the APK

### Debug APK (no signing, fastest, for development testing)

```bash
pnpm apk:debug
```

Steps under the hood:
1. `pnpm build` produces `/dist/` (Vite SPA + esbuild server bundle)
2. `npx cap sync` copies `/dist/*` into `/android/app/src/main/assets/public/`
3. `cd android && ./gradlew assembleDebug` builds the APK

Output: `/android/app/build/outputs/apk/debug/app-debug.apk` (~3–8 MB depending on assets).

### Release APK (signed, for distribution)

```bash
pnpm apk:release
```

**Prerequisite:** signing keystore. Generate once and configure in `/android/app/build.gradle`:

```bash
keytool -genkey -v -keystore stockflow-release.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias stockflow

# Store the password securely — losing it means losing the ability to update
# the app on Play Store.
```

Then add to `/android/gradle.properties` (gitignored — never commit):

```properties
RELEASE_STORE_FILE=../stockflow-release.jks
RELEASE_KEY_ALIAS=stockflow
RELEASE_STORE_PASSWORD=...
RELEASE_KEY_PASSWORD=...
```

And in `/android/app/build.gradle`, add a signing config and reference it in the
`release` build type. (Capacitor docs cover this in detail; see
https://capacitorjs.com/docs/android/deploying-to-google-play.)

## Installing on a connected device

1. Enable USB debugging on the phone (`Settings → About → tap Build Number 7×`,
   then `Settings → Developer Options → USB Debugging`).
2. Plug in via USB. The phone shows an "Allow USB debugging from this computer?"
   prompt — tap **Allow always**.
3. Confirm the device is recognized:
   ```bash
   adb devices
   # Expected output:
   # List of devices attached
   # UGKNRODMRGQCIZUO   device
   ```
4. Install the debug APK:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```
   Or, in one step (builds + deploys + launches):
   ```bash
   pnpm cap:android:run
   ```

## Opening the project in Android Studio

For interactive debugging, native config edits, or generating signed APKs from the IDE:

```bash
pnpm cap:android:open
```

This opens `/android` as a Gradle project in Android Studio.

## Live reload during development

Capacitor supports loading the dev server URL instead of bundled assets. Useful for
fast iteration without rebuilding the APK each time:

1. Start the Vite dev server on your Mac: `pnpm dev` (default port 3000).
2. Find your Mac's LAN IP: `ipconfig getifaddr en0` (e.g., `192.168.1.42`).
3. Edit `capacitor.config.ts` temporarily:
   ```ts
   server: {
     url: "http://192.168.1.42:3000",
     cleartext: true,  // allow HTTP for local LAN dev
     androidScheme: "https",
   }
   ```
4. `pnpm cap:android:run` — the phone loads the live dev server, hot reload works.
5. **Revert** the `server.url` line before building any release APK.

## Native plugin roadmap (Tier 3.1+)

Currently the wrap is "plain webview" — every web API the PWA uses works because
Capacitor's webview is a full Chromium. Future improvements:

| Plugin | What it replaces | Why |
|---|---|---|
| `@capacitor/push-notifications` | Web Service Worker FCM | Native FCM works while app is killed; web SW does not on Android. |
| `@capacitor/geolocation` | `navigator.geolocation` in DriverPWA | Better battery life + background tracking permission. |
| `@capacitor/preferences` | `localStorage` (via storage.ts helpers) | Native key-value persists across app reinstalls (with backup config). |
| `@capacitor/splash-screen` | Default white splash | Branded splash with StockFlow logo. |
| `@capacitor/status-bar` | n/a | Control the Android system status bar color (match indigo theme). |
| `@capacitor/keyboard` | n/a | Better keyboard handling in forms (POS especially). |

Add as needed in subsequent tiers. The wrap works without any of these.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Could not find any matches for com.android.tools.build:gradle:8.x.x` | Update Android Studio + retry. Capacitor 7 needs AGP 8.x. |
| `error: invalid source release: 21` | Your `JAVA_HOME` points to JDK 17 or earlier. Switch to JDK 21 (see Sanity checks above). |
| `Unsupported Java version` | Confirm `JAVA_HOME` points to JDK 21, not 17, 20, or 22+. |
| `INSTALL_FAILED_USER_RESTRICTED` (MIUI / Xiaomi) | Xiaomi blocks USB installs by default. On the phone: Settings → Additional settings → Developer options → enable BOTH `Install via USB` AND `USB debugging (Security settings)`. |
| Samsung "Install blocked" prompt | Tap More details → Install anyway. Or pre-enable Settings → Biometrics & security → Install unknown apps → toggle on for the file manager you use. |
| `adb: device unauthorized` | Tap "Allow always" on the phone dialog. If absent: toggle USB Debugging off/on in Developer Options. |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | The device has a newer version of the APK installed. `adb uninstall cl.stockflow.app` then reinstall. |
| Webview can't reach Firebase | Confirm `server.androidScheme: "https"` in capacitor.config.ts. |
