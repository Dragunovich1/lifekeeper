<#
.SYNOPSIS
  LifeKeeper · Recompila la app de Android (APK) en Windows.

.DESCRIPTION
  Hace todo el recorrido: trae lo último de git, instala dependencias, compila la web,
  sincroniza con Android, genera el APK con Gradle y lo copia a la carpeta "apk\" con fecha y hora.

.EXAMPLE
  .\scripts\build-apk.ps1                 # actualiza y compila
  .\scripts\build-apk.ps1 -SkipPull       # compila lo que tenés ahora (sin git pull)
  .\scripts\build-apk.ps1 -Install        # además lo instala en el celular conectado por USB (adb)
  .\scripts\build-apk.ps1 -Clean          # limpia la compilación anterior de Gradle
  .\scripts\build-apk.ps1 -Branch main    # otra rama
#>
[CmdletBinding()]
param(
  [string]$Branch = 'claude/affectionate-brown-hsgmfd',
  [switch]$SkipPull,
  [switch]$Install,
  [switch]$Clean,
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'

function Step($text) { Write-Host ""; Write-Host "> $text" -ForegroundColor Green }
function Info($text) { Write-Host "  $text" }
function Warn($text) { Write-Host "  ! $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host ""; Write-Host "X $text" -ForegroundColor Red; exit 1 }

# Ejecuta un comando externo y corta si falla (PowerShell no lo hace solo)
function Run {
  param([string]$Exe, [string[]]$Arguments)
  Write-Host "  $ $Exe $($Arguments -join ' ')" -ForegroundColor DarkGray
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) { Fail "Falló: $Exe $($Arguments -join ' ') (código $LASTEXITCODE)" }
}

# Siempre desde la raíz del proyecto (donde está package.json), aunque se llame desde otra carpeta
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Test-Path (Join-Path $root 'package.json'))) { Fail "No encuentro package.json en $root" }
Write-Host "Proyecto: $root"
Write-Host "Rama:     $Branch"

# --- 1) Requisitos -----------------------------------------------------------
Step "Revisando requisitos"
foreach ($cmd in 'git', 'node', 'npm') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Fail "Falta '$cmd'. Instalalo y volvé a correr el script." }
}
Info "git $(git --version | ForEach-Object { $_ -replace 'git version ', '' }) · node $(node --version) · npm $(npm --version)"

# Java: JAVA_HOME, o el que trae Android Studio
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
  $jbr = @(
    "$env:ProgramFiles\Android\Android Studio\jbr",
    "${env:ProgramFiles(x86)}\Android\Android Studio\jbr",
    "$env:LOCALAPPDATA\Programs\Android Studio\jbr"
  ) | Where-Object { Test-Path (Join-Path $_ 'bin\java.exe') } | Select-Object -First 1
  if ($jbr) { $env:JAVA_HOME = $jbr; Info "JAVA_HOME = $jbr (el de Android Studio)" }
  elseif (-not (Get-Command java -ErrorAction SilentlyContinue)) { Fail "No encuentro Java. Instalá Android Studio (trae Java) o definí JAVA_HOME." }
}
if ($env:JAVA_HOME) { $env:Path = "$(Join-Path $env:JAVA_HOME 'bin');$env:Path" }

# Android SDK
$sdk = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, "$env:LOCALAPPDATA\Android\Sdk") |
  Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $sdk) { Fail "No encuentro el Android SDK. Abrí Android Studio > More Actions > SDK Manager e instalalo." }
$env:ANDROID_HOME = $sdk
Info "Android SDK: $sdk"

if (-not (Test-Path (Join-Path $root 'android\gradlew.bat'))) {
  Fail "No existe android\gradlew.bat. Si es la primera vez, corré: npx cap add android"
}
# Gradle necesita saber dónde está el SDK
$localProps = Join-Path $root 'android\local.properties'
if (-not (Test-Path $localProps)) {
  "sdk.dir=" + ($sdk -replace '\\', '\\') | Set-Content -Path $localProps -Encoding ASCII
  Info "Creé android\local.properties"
}

# --- 2) Código ---------------------------------------------------------------
if ($SkipPull) {
  Step "Se omite git pull (-SkipPull)"
} else {
  Step "Trayendo la última versión de '$Branch'"
  $dirty = git status --porcelain --untracked-files=no
  if ($dirty) { git status --short; Fail "Tenés cambios locales sin guardar. Guardalos (git stash) o corré con -SkipPull." }
  Run 'git' @('fetch', 'origin', $Branch)
  Run 'git' @('checkout', $Branch)
  Run 'git' @('pull', '--ff-only', 'origin', $Branch)
}
$commit = (git rev-parse --short HEAD).Trim()
Info "Versión: $commit - $((git log -1 --pretty=%s).Trim())"

# --- 3) Web + sincronización con Android -------------------------------------
Step "Instalando dependencias"
Run 'npm' @('install', '--no-audit', '--no-fund')

Step "Compilando la web"
Run 'npm' @('run', 'build')

Step "Sincronizando con Android (plugins y archivos web)"
Run 'npx' @('cap', 'sync', 'android')

# --- 4) APK ------------------------------------------------------------------
Step "Generando el APK con Gradle (la primera vez puede tardar varios minutos)"
Push-Location (Join-Path $root 'android')
try {
  if ($Clean) { Run '.\gradlew.bat' @('clean') }
  Run '.\gradlew.bat' @('assembleDebug')
} finally {
  Pop-Location
}

$built = Join-Path $root 'android\app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $built)) { Fail "Gradle terminó pero no encuentro el APK en $built" }

$outDir = Join-Path $root 'apk'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$final = Join-Path $outDir "LifeKeeper-$commit-$stamp.apk"
Copy-Item $built $final -Force
Copy-Item $built (Join-Path $outDir 'LifeKeeper-latest.apk') -Force
$mb = [math]::Round((Get-Item $final).Length / 1MB, 1)

Write-Host ""
Write-Host "OK. APK listo ($mb MB):" -ForegroundColor Green
Write-Host "  $final"
Write-Host "  (siempre hay una copia en apk\LifeKeeper-latest.apk)"

# --- 5) Instalar en el celular (opcional) ------------------------------------
if ($Install) {
  Step "Instalando en el celular por USB"
  $adb = Join-Path $sdk 'platform-tools\adb.exe'
  if (-not (Test-Path $adb)) { Fail "No encuentro adb en $adb" }
  $devices = & $adb devices | Select-String -Pattern "`tdevice$"
  if (-not $devices) { Fail "No hay ningún celular conectado con la depuración USB activada (Ajustes > Opciones de desarrollador)." }
  Run $adb @('install', '-r', $final)
  Info "Instalado. Abrí LifeKeeper en el teléfono."
} elseif (-not $NoOpen) {
  Start-Process explorer.exe "/select,`"$final`""
}

Write-Host ""
Write-Host "Para instalarlo: pasalo al celular (cable, Drive, WhatsApp) y abrilo. Instalá encima de la versión anterior para conservar los datos locales." -ForegroundColor DarkGray
Write-Host "Si Android se queja de conflicto de firma, desinstalá la vieja ANTES exportando un backup cifrado desde la app." -ForegroundColor DarkGray
