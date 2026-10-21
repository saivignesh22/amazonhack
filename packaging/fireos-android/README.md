# CookCue — Fire OS packaging

A deliberately thin native shell for the CookCue web app:

- one `Activity` (`MainActivity.java`),
- one `WebView` loading the production web build from the APK's assets via
  `WebViewAssetLoader` (`https://appassets.androidplatform.net/assets/www/`),
- the Android **Back** button bridged into the web app as
  `window.cookcue.handleBack()`.

No Google Play Services — Fire OS does not ship them. The only dependencies
are `androidx.appcompat` and `androidx.webkit`.

## Layout

```
packaging/fireos-android/
  app/build.gradle              the app module (copyWebAssets, signing)
  app/src/main/AndroidManifest.xml
  app/src/main/java/com/cookcue/firetv/MainActivity.java
  app/src/main/res/drawable/banner.png      320x180 leanback banner
  app/src/main/res/mipmap-*/ic_launcher.png app icons
  create-keystore.ps1           creates cookcue.keystore (one-off)
  local.properties              sdk.dir — generated, not committed
```

## Build

```powershell
# from the repository root
npm run build                    # web build -> dist/
cd packaging/fireos-android
powershell -File create-keystore.ps1   # one-off
gradlew assembleRelease
```

Or, from the repository root, `npm run apk:release` does all of it.

The APK is written to
`app/build/outputs/apk/release/app-release.apk`.

`local.properties` must use **forward slashes**:

```properties
sdk.dir=C:/Users/you/AppData/Local/Android/Sdk
```

The keystore is not committed. Without it the release build is produced
unsigned — use the debug APK in that case. The signing passwords can be
overridden with the `COOKCUE_STORE_PASSWORD`, `COOKCUE_KEY_ALIAS` and
`COOKCUE_KEY_PASSWORD` Gradle properties.

## Install

```bash
adb connect <fire-tv-ip>:5555
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.cookcue.firetv/.MainActivity
```

The full on-device checklist is in [`../../docs/DEVICE_TEST.md`](../../docs/DEVICE_TEST.md).
