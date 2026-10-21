<#
.SYNOPSIS
  Installs the toolchain needed to build the CookCue Fire OS APK.

.DESCRIPTION
  Installs, in order:
    1. Temurin JDK 17
    2. Android command line tools
    3. Android SDK packages: platform-tools, platforms;android-35, build-tools;35.0.0
    4. Gradle 8.11.1

  Then sets JAVA_HOME, ANDROID_HOME, ANDROID_SDK_ROOT and PATH for the current
  user, and writes packaging/fireos-android/local.properties.

  The script is idempotent: each step is skipped when it is already in place,
  so it can be re-run to repair a half-finished install.

.PARAMETER JdkHome
  Where to install the JDK. Default: $env:USERPROFILE\.jdks\temurin-17

.PARAMETER SdkRoot
  Where to install the Android SDK. Default: $env:LOCALAPPDATA\Android\Sdk

.PARAMETER GradleHome
  Where to install Gradle. Default: C:\tools\gradle-8.11.1

.PARAMETER ToolsRoot
  Where to unpack the downloaded archives. Default: $env:USERPROFILE\Downloads\dl

.PARAMETER GradleVersion
  Gradle version to install. Default: 8.11.1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/setup-toolchain.ps1

.NOTES
  If PowerShell blocks the script, run it with:
    powershell -ExecutionPolicy Bypass -File scripts/setup-toolchain.ps1
#>
[CmdletBinding()]
param(
  [string] $JdkHome,
  [string] $SdkRoot,
  [string] $GradleHome,
  [string] $ToolsRoot,
  [string] $GradleVersion = '8.11.1'
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$log = Join-Path $env:TEMP 'cookcue-setup-toolchain.log'

function Log($m) {
  $line = "$(Get-Date -Format HH:mm:ss)  $m"
  Write-Output $line
  Add-Content -Path $log -Value $line
}

# Run a native exe and return stdout+stderr as a single string. Native stderr
# must not be treated as a terminating error.
function Run-Native($exe, $argList) {
  $out = & $exe @argList 2>&1 | Out-String
  return $out
}

if (-not $JdkHome)   { $JdkHome   = Join-Path $env:USERPROFILE ".jdks\temurin-17" }
if (-not $SdkRoot)   { $SdkRoot   = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
if (-not $GradleHome) { $GradleHome = Join-Path 'C:\tools' "gradle-$GradleVersion" }
if (-not $ToolsRoot) { $ToolsRoot = Join-Path $env:USERPROFILE 'Downloads\dl' }

New-Item -ItemType Directory -Force -Path $ToolsRoot, (Split-Path -Parent $GradleHome), $SdkRoot, (Split-Path -Parent $JdkHome) | Out-Null

try {
  # ---------- 1. JDK 17 (Temurin) ----------
  $jdkZip = Join-Path $ToolsRoot 'temurin17.zip'
  if (-not (Test-Path $jdkZip)) {
    Log 'Downloading JDK 17...'
    curl.exe -sSL --retry 3 -o $jdkZip 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk'
  }
  if (-not (Test-Path (Join-Path $JdkHome 'bin\java.exe'))) {
    Log 'Extracting JDK...'
    Expand-Archive -Path $jdkZip -DestinationPath (Split-Path -Parent $JdkHome) -Force
    $ext = Get-ChildItem (Split-Path -Parent $JdkHome) -Directory |
           Where-Object { $_.Name -like 'jdk-17*' -and $_.FullName -ne $JdkHome } |
           Select-Object -First 1
    if ($ext) { Move-Item -Path $ext.FullName -Destination $JdkHome -Force }
  }
  if (-not (Test-Path (Join-Path $JdkHome 'bin\java.exe'))) { throw 'JDK extraction failed' }
  Log ('  java: ' + ((Run-Native (Join-Path $JdkHome 'bin\java.exe') @('-version')) -split "`n")[0])

  # ---------- 2. Android command line tools ----------
  $ctZip = Join-Path $ToolsRoot 'cmdline-tools.zip'
  if (-not (Test-Path $ctZip)) {
    Log 'Downloading Android command line tools...'
    curl.exe -sSL --retry 3 -o $ctZip 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'
  }
  $ctLatest = Join-Path $SdkRoot 'cmdline-tools\latest'
  if (-not (Test-Path (Join-Path $ctLatest 'bin\sdkmanager.bat'))) {
    Log 'Extracting cmdline-tools...'
    $ctTmp = Join-Path $ToolsRoot 'ct'
    if (Test-Path $ctTmp) { Remove-Item $ctTmp -Recurse -Force }
    Expand-Archive -Path $ctZip -DestinationPath $ctTmp -Force
    New-Item -ItemType Directory -Force -Path (Join-Path $SdkRoot 'cmdline-tools') | Out-Null
    if (Test-Path $ctLatest) { Remove-Item $ctLatest -Recurse -Force }
    Move-Item -Path (Join-Path $ctTmp 'cmdline-tools') -Destination $ctLatest
  }
  if (-not (Test-Path (Join-Path $ctLatest 'bin\sdkmanager.bat'))) { throw 'cmdline-tools extraction failed' }

  # ---------- 3. SDK packages ----------
  $env:JAVA_HOME = $JdkHome
  $env:ANDROID_HOME = $SdkRoot
  $env:ANDROID_SDK_ROOT = $SdkRoot
  $env:PATH = "$JdkHome\bin;$ctLatest\bin;$env:PATH"
  $sdkman = Join-Path $ctLatest 'bin\sdkmanager.bat'

  # The licences need a real stream of "y" answers. Piping from $null answers
  # "N" to every prompt and the packages are then silently skipped.
  # sdkmanager also writes warnings to stderr, which PowerShell turns into
  # error records, so it is run through cmd.exe with both streams redirected
  # to a file.
  $sdkLog = Join-Path $env:TEMP 'cookcue-sdkmanager.log'

  Log 'Accepting SDK licenses...'
  $yes = 1..40 | ForEach-Object { 'y' }
  $yes | & cmd.exe /c "`"$sdkman`" --sdk_root=`"$SdkRoot`" --licenses > `"$sdkLog`" 2>&1"

  Log 'Installing platform-tools, platforms;android-35, build-tools;35.0.0...'
  # sdkmanager dies with exit code 1 when its stdout pipe closes early, so the
  # output goes to a file instead of being piped through Select-Object.
  & cmd.exe /c "`"$sdkman`" --sdk_root=`"$SdkRoot`" platform-tools platforms;android-35 build-tools;35.0.0 > `"$sdkLog`" 2>&1"
  foreach ($line in (Get-Content $sdkLog -ErrorAction SilentlyContinue)) {
    if ($line -match 'Warning|rror|ailed|100%') { Log "  $line" }
  }

  foreach ($p in @('platform-tools\adb.exe', 'platforms\android-35\android.jar', 'build-tools\35.0.0\aapt2.exe')) {
    if (-not (Test-Path (Join-Path $SdkRoot $p))) { throw "SDK package missing: $p" }
  }
  Log 'SDK packages verified.'

  # ---------- 4. Gradle ----------
  $gZip = Join-Path $ToolsRoot "gradle-$GradleVersion-bin.zip"
  if (-not (Test-Path $gZip)) {
    Log "Downloading Gradle $GradleVersion..."
    curl.exe -sSL --retry 3 -o $gZip "https://services.gradle.org/distributions/gradle-$GradleVersion-bin.zip"
  }
  if (-not (Test-Path (Join-Path $GradleHome 'bin\gradle.bat'))) {
    Log 'Extracting Gradle...'
    Expand-Archive -Path $gZip -DestinationPath (Split-Path -Parent $GradleHome) -Force
  }
  if (-not (Test-Path (Join-Path $GradleHome 'bin\gradle.bat'))) { throw 'Gradle extraction failed' }
  Log ('  ' + ((Run-Native (Join-Path $GradleHome 'bin\gradle.bat') @('--version')) -split "`n" | Select-Object -First 4 | Out-String).Trim())

  # ---------- 5. Persist environment for the user ----------
  [Environment]::SetEnvironmentVariable('JAVA_HOME', $JdkHome, 'User')
  [Environment]::SetEnvironmentVariable('ANDROID_HOME', $SdkRoot, 'User')
  [Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $SdkRoot, 'User')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  foreach ($p in @("$JdkHome\bin", "$ctLatest\bin", "$GradleHome\bin", "$SdkRoot\platform-tools")) {
    if ($userPath -notlike "*$p*") { $userPath = ($userPath.TrimEnd(';') + ';' + $p) }
  }
  [Environment]::SetEnvironmentVariable('Path', $userPath, 'User')
  Log 'Environment variables set (JAVA_HOME, ANDROID_HOME, ANDROID_SDK_ROOT, PATH).'

  # ---------- 6. local.properties for the Android project ----------
  # Forward slashes only: backslashes are escape characters in .properties
  # files and the SDK path is then silently mangled.
  $propsDir = Join-Path $repoRoot 'packaging\fireos-android'
  if (Test-Path $propsDir) {
    $sdkDirUnix = $SdkRoot -replace '\\', '/'
    Set-Content -Path (Join-Path $propsDir 'local.properties') -Value "sdk.dir=$sdkDirUnix" -Encoding utf8
    Log "Wrote packaging/fireos-android/local.properties (sdk.dir=$sdkDirUnix)"
  }

  Log 'SETUP_COMPLETE'
  exit 0
} catch {
  Log "SETUP_FAILED: $($_.Exception.Message)"
  exit 1
}
