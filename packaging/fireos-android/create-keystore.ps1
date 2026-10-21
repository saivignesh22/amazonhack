param(
    [string]$StorePassword = 'cookcue2026',
    [string]$KeyPassword = 'cookcue2026',
    [string]$Alias = 'cookcue',
    [string]$KeystorePath = (Join-Path $PSScriptRoot 'cookcue.keystore')
)

$ErrorActionPreference = 'Stop'

$javaHome = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User')
if (-not $javaHome) { $javaHome = $env:JAVA_HOME }
if (-not $javaHome) {
    $javaHome = Join-Path $env:USERPROFILE '.jdks\temurin-17'
}
$keytool = Join-Path $javaHome 'bin\keytool.exe'
if (-not (Test-Path $keytool)) {
    throw "keytool not found at $keytool. Set JAVA_HOME to a JDK 17 installation."
}

if (Test-Path $KeystorePath) {
    Write-Host "Keystore already exists: $KeystorePath"
    Write-Host 'Delete it first if you want to create a new one.'
    exit 0
}

& $keytool -genkeypair `
    -alias $Alias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -keystore $KeystorePath `
    -storepass $StorePassword `
    -keypass $KeyPassword `
    -dname 'CN=CookCue, OU=Hackathon, O=CookCue, L=Internet, S=NA, C=US'

if ($LASTEXITCODE -ne 0) { throw "keytool failed with exit code $LASTEXITCODE" }

Write-Host "Created keystore: $KeystorePath"
Write-Host "Alias: $Alias"
