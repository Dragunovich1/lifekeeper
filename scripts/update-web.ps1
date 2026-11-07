<#
.SYNOPSIS
  LifeKeeper · Actualiza la WEB en el servidor Ubuntu desde tu PC con Windows (por SSH).

.DESCRIPTION
  Se conecta al servidor y ejecuta ahí ./scripts/update-web.sh, que:
    1) hace copia de la base de datos, 2) trae el código, 3) revisa el .env y el JWT_SECRET,
    4) reconstruye api, web y tts, 5) reinicia y verifica que responda.
  Antes de conectarse revisa que lo que querés publicar ya esté subido a GitHub.

.EXAMPLE
  .\scripts\update-web.ps1                  # actualiza todo
  .\scripts\update-web.ps1 -NoCache         # reconstruye las imágenes desde cero (más lento)
  .\scripts\update-web.ps1 -NoBackup        # sin copia de la base de datos
  .\scripts\update-web.ps1 -DryRun          # muestra qué haría, sin cambiar nada
  .\scripts\update-web.ps1 -Server 192.168.0.60 -User otro
#>
[CmdletBinding()]
param(
  [string]$Server = '192.168.0.52',
  [string]$User = 'dragunovich',
  [string]$RemotePath = '~/lifekeeper',
  [string]$Branch = 'claude/affectionate-brown-hsgmfd',
  [switch]$NoCache,
  [switch]$NoBackup,
  [switch]$DryRun,
  [switch]$SkipPushCheck
)

$ErrorActionPreference = 'Stop'
# Acentos bien en la consola de Windows
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

function Step($text) { Write-Host ""; Write-Host "> $text" -ForegroundColor Green }
function Info($text) { Write-Host "  $text" }
function Warn($text) { Write-Host "  ! $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host ""; Write-Host "X $text" -ForegroundColor Red; exit 1 }

# --- 1) Requisitos ----------------------------------------------------------------
Step "Revisando requisitos"
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  Fail "No encuentro 'ssh'. En Windows 10/11: Configuración > Aplicaciones > Características opcionales > Agregar 'Cliente OpenSSH'."
}
Info "ssh: OK  ->  $User@$Server"

# --- 2) ¿Está todo subido a GitHub? --------------------------------------------------
$root = Split-Path -Parent $PSScriptRoot
if (-not $SkipPushCheck -and (Get-Command git -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $root '.git'))) {
  Step "Revisando que tus cambios estén en GitHub"
  Push-Location $root
  # git escribe avisos por stderr; en PowerShell 5 eso cortaría el script con 'Stop', así que acá es no fatal
  $ErrorActionPreference = 'Continue'
  try {
    $null = git fetch origin $Branch 2>$null
    $local = (git rev-parse HEAD 2>$null)
    $remote = (git rev-parse "origin/$Branch" 2>$null)
    # 'cap sync' regenera estos archivos en cada compilación del APK: no cuentan como cambios tuyos
    $generated = @('android/app/capacitor.build.gradle', 'android/capacitor.settings.gradle')
    $dirty = @(git status --porcelain --untracked-files=no | Where-Object { $line = $_; -not ($generated | Where-Object { $line -like "*$_*" }) })
    if ($dirty.Count -gt 0) {
      $dirty | ForEach-Object { Info $_ }
      Warn "Tenés cambios locales sin commitear (arriba): el servidor solo recibe lo que está en GitHub."
    }
    if ($local -and $remote -and $local -ne $remote) {
      $ahead = (git rev-list --count "origin/$Branch..HEAD" 2>$null)
      if ([int]$ahead -gt 0) { Warn "Tenés $ahead commit(s) locales sin subir (git push). El servidor NO los va a tener." }
    }
    if ($dirty.Count -eq 0 -and $local -eq $remote) { Info "Todo subido. Versión: $((git rev-parse --short HEAD).Trim())" }
  } catch {
    Warn "No pude comparar con GitHub ($($_.Exception.Message)). Sigo igual."
  } finally {
    Pop-Location
    $ErrorActionPreference = 'Stop'
  }
}

# --- 3) Comando remoto -------------------------------------------------------------------
$flags = @()
if ($NoCache)  { $flags += '--no-cache' }
if ($NoBackup) { $flags += '--no-backup' }
if ($DryRun)   { $flags += '--dry-run' }
# Primero se trae la rama (si el servidor tiene una versión vieja, todavía no tiene scripts/update-web.sh)
$remoteCmd = "cd $RemotePath && git fetch origin $Branch && git checkout $Branch && git pull --ff-only origin $Branch && chmod +x scripts/update-web.sh && ./scripts/update-web.sh $Branch $($flags -join ' ')"

Step "Conectando al servidor y actualizando (puede pedirte la contraseña de $User)"
Info $remoteCmd
Write-Host ""

# -t: terminal interactivo (colores y, si hace falta, sudo). Se evita preguntar por la huella del host la primera vez.
& ssh -t -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "$User@$Server" $remoteCmd
$code = $LASTEXITCODE

Write-Host ""
if ($code -eq 0) {
  Write-Host "OK. Web actualizada." -ForegroundColor Green
  Write-Host "  Abrila en https://app.lifekeeper.lat y recargá con Ctrl+F5 para tomar los archivos nuevos." -ForegroundColor DarkGray
  Write-Host "  Si cambió el código del servidor (api), la app ya queda usando la versión nueva." -ForegroundColor DarkGray
} elseif ($code -eq 255) {
  Fail "No pude conectar con $Server. Revisá que estés en la misma red (Wi-Fi de casa), que el servidor esté prendido y que el usuario sea '$User'."
} else {
  Fail "El script del servidor terminó con error (código $code). Leé los mensajes de arriba; si no se entiende, pegámelos."
}
