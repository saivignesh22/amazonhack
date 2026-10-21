# Friction log

The tools and steps that got in the way while shipping CookCue, and what we did
about each one. Everything here was hit on a **Windows** development machine.

---

## 1. The Fire TV emulator is macOS only

Amazon and Google distribute the Fire TV emulator as a desktop application for
macOS. There is no Windows or Linux build.

**Impact:** there is no way to run a Fire OS image locally from a Windows
machine, so the app could not be exercised against a real Fire OS WebView
during development.

**Workaround:** we built the TV behaviour into the web layer instead. The focus
engine, the key handling and the Back stack are all plain JavaScript in the
web app, so they can be driven by real key events in headless Chrome over the
DevTools Protocol — which is what `npm run test:tv` does. The native shell is
deliberately thin (one Activity, one WebView) so that there is very little
left to test on a device.

**Still open:** the Fire OS WebView's own spatial navigation and the exact
remote key codes can only be confirmed on hardware. See
[`DEVICE_TEST.md`](DEVICE_TEST.md).

---

## 2. The Vega SDK toolchain is macOS/Ubuntu only

Amazon's newer Vega OS toolchain (`kepler`) ships only for macOS and Ubuntu.
There is no Windows build, and the challenge's own material points at Vega OS
as one of the two accepted targets.

**Impact:** with a Windows-only machine and no Vega device, choosing Vega OS
would have meant shipping code that had never been compiled.

**Decision:** we targeted **Fire OS** instead. The rules accept "Fire OS or
Vega OS", and Fire OS is buildable and testable here.

---

## 3. No JDK, no Android SDK, no Gradle

A clean Windows machine has none of the three. The Android Studio install is
several gigabytes and the command line tools need their own setup.

**Impact:** the first hour of the project was environment setup, not building.

**Workaround:** we wrote a resumable setup script
(`scripts/setup-toolchain.ps1`) that installs a Temurin JDK 17, the Android
command line tools with platform 35 and build-tools 35, and Gradle 8.11.1, and
then sets `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT` and `PATH` at the
user level. It can be re-run safely — each step is skipped if it already
completed.

**Sharp edge:** the script initially failed while accepting the SDK licences.
`sdkmanager --licenses < nul` answers "N" to every prompt, so the packages are
silently skipped and the install "succeeds" with nothing installed. The fix is
to pipe an actual stream of `y` characters in.

---

## 4. `sdkmanager` truncates when its output is piped

Reading `sdkmanager --list` through `Select-Object -First 25` closes the pipe
early, which kills the process — and the exit code 1 that comes back looks
like an SDK problem rather than a piping problem.

**Workaround:** redirect `sdkmanager` output to a file and read the file
afterwards. It is slower but it never lies to you.

---

## 5. The Gradle wrapper could not download Gradle

`gradlew` failed to fetch `gradle-8.11.1-bin.zip`:

```
java.net.SocketTimeoutException: Connect timed out
    at java.base/sun.nio.ch.NioSocketImpl.connect(NioSocketImpl.java:551)
```

`curl` to the same URL worked from the same machine at the same time, so this
is specific to the JVM's network stack in this environment, not a broken URL.

**Workaround:** we built with a locally installed Gradle 8.11.1 and committed
the wrapper files (`gradlew`, `gradlew.bat`, `gradle/wrapper/*`) so nobody else
has to install Gradle by hand. `gradle wrapper` itself fails for the same
reason (it validates the distribution URL over the network), so the wrapper
jar was taken from the installed distribution and the scripts from the
official Gradle repository.

The committed wrapper does work — the distribution just has to be in the
wrapper cache already. Seeding it by hand is a file copy:

```powershell
Copy-Item gradle-8.11.1-bin.zip `
  "$env:USERPROFILE\.gradle\wrapper\dists\gradle-8.11.1-bin\<hash>\gradle-8.11.1-bin.zip"
```

**Still open:** the first `./gradlew` run on a machine with a different
network path may still need a retry.

---

## 6. `local.properties` and backslashes

The Android SDK location goes in `local.properties`:

```properties
sdk.dir=C:\Users\you\AppData\Local\Android\Sdk
```

Java `.properties` files treat `\` as an escape character, so the path is
mangled and the build fails with a message that does not mention the path at
all:

```
* What went wrong:
Could not determine the dependencies of task ':app:lintVitalReportRelease'.
> java.io.IOException: The filename, directory name, or volume label syntax is incorrect
    at com.android.build.gradle.internal.SdkLocator$SdkLocationSource.validateSdkPath(SdkLocator.kt:242)
```

**Workaround:** always use forward slashes — `sdk.dir=C:/Users/you/AppData/Local/Android/Sdk`.
This is now documented in the README and in `local.properties` itself.

---

## 7. Duplicate Kotlin stdlib classes

Depending on `androidx.webkit` pulls `kotlin-stdlib` 1.8.22, while another
transitive dependency still references the old split artifact
`kotlin-stdlib-jdk8` 1.6.21. The build fails with a wall of
`Duplicate class kotlin.jvm.jdk8.JvmRepeatableKt`.

**Workaround:** align the artifacts with dependency constraints:

```gradle
constraints {
    implementation 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:1.8.22'
    implementation 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.8.22'
}
```

---

## 8. Fire OS does not ship Google Play Services

Fire TV devices run Fire OS, which does not include the Play Services. Any
dependency that pulls in Play Services will fail at runtime on a device, even
though it builds and passes every emulator test.

**Decision:** the native shell depends on nothing but `androidx.appcompat` and
`androidx.webkit`. No ads, no analytics, no Play Services, no Firebase. The
entire feature set is in the web app, which keeps the APK under 3 MB and
removes an entire class of device-only failures.

---

## 9. `npm` is blocked by the PowerShell execution policy

On Windows, `npm` resolves to `npm.ps1`, and a default execution policy
rejects it:

```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running
scripts is disabled on this system.
```

**Workaround:** use `npm.cmd` on Windows. It is mentioned in the README so the
next person does not lose twenty minutes to it. The same applies to
`powershell -ExecutionPolicy Bypass -File ...` for the scripts we ship.

---

## 10. A PowerShell sharp edge that cost us three files

While doing a bulk find-and-replace across the screens, a PowerShell hashtable
containing single-element arrays flattened the arrays into strings. The
replacement then ran as `.Replace("f", $null)` and stripped every `f` from
three source files — `AppHeader.jsx`, `AppShell.jsx` and `App.jsx` — turning
`function` into `runction` and `from` into `rrom`.

**Impact:** a broken build that looked like a syntax error in three unrelated
files.

**Workaround:** all three files were rewritten from scratch, and every
multi-file edit after that used the editor's targeted replace instead of a
PowerShell script. If you script edits on Windows, assert the match first
(`if (-not $text.Contains($old)) { throw }`) and never let a flattened array
reach a string method.

---

## Summary

| # | Friction | Fix | Still blocking? |
| --- | --- | --- | --- |
| 1 | Fire TV emulator is macOS only | Test the TV layer in headless Chrome over CDP | Hardware validation still open |
| 2 | Vega toolchain is macOS/Ubuntu only | Targeted Fire OS instead | No |
| 3 | No JDK / Android SDK / Gradle | Resumable setup script | No |
| 4 | `sdkmanager` breaks when piped | Redirect to a file | No |
| 5 | Gradle wrapper download times out | Build with a local Gradle, ship the wrapper | May need a retry elsewhere |
| 6 | `local.properties` backslashes | Use forward slashes, documented | No |
| 7 | Duplicate Kotlin stdlib classes | Dependency constraints | No |
| 8 | Fire OS has no Play Services | No Play Services dependencies | No |
| 9 | PowerShell blocks `npm.ps1` | Use `npm.cmd` | No |
| 10 | PowerShell array flattening | Targeted edits + assertions | No |
