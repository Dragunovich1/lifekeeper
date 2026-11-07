<#
.SYNOPSIS
  LifeKeeper · Evita que SSH se corte por inactividad ("client_loop: send disconnect: Connection reset").

.DESCRIPTION
  Agrega el servidor a tu archivo de configuración de SSH (%USERPROFILE%\.ssh\config) con señales de vida
  (ServerAliveInterval) para que la conexión no se caiga. Si ya estaba, lo actualiza sin duplicarlo.
  Hace una copia del archivo antes de tocarlo.

.EXAMPLE
  .\scripts\setup-ssh.ps1
  .\scripts\setup-ssh.ps1 -Server 192.168.0.60 -User otro
#>
[CmdletBinding()]
param(
  [string]$Server = '192.168.0.52',
  [string]$User = 'dragunovich'
)

$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:USERPROFILE '.ssh'
$cfg = Join-Path $dir 'config'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
if (-not (Test-Path $cfg)) { New-Item -ItemType File -Path $cfg | Out-Null }

$block = @"
# >>> LifeKeeper ($Server) >>>
Host $Server
  User $User
  ServerAliveInterval 30
  ServerAliveCountMax 6
  TCPKeepAlive yes
# <<< LifeKeeper ($Server) <<<
"@

$text = Get-Content -Raw -Path $cfg
if ($null -eq $text) { $text = '' }

Copy-Item $cfg "$cfg.bak" -Force
$pattern = "(?s)# >>> LifeKeeper \($([regex]::Escape($Server))\) >>>.*?# <<< LifeKeeper \($([regex]::Escape($Server))\) <<<"
if ($text -match $pattern) {
  $text = [regex]::Replace($text, $pattern, $block)
  Write-Host "Actualicé el bloque de $Server en $cfg" -ForegroundColor Green
} elseif ($text -match "(?m)^\s*Host\s+$([regex]::Escape($Server))\s*$") {
  Write-Host "Ya tenés un 'Host $Server' propio en $cfg. No lo toqué: agregale a mano ServerAliveInterval 30 y ServerAliveCountMax 6." -ForegroundColor Yellow
  exit 0
} else {
  $text = $text.TrimEnd() + "`r`n`r`n" + $block + "`r`n"
  Write-Host "Agregué $Server a $cfg" -ForegroundColor Green
}
Set-Content -Path $cfg -Value $text -Encoding ASCII
Write-Host "Listo. Desde ahora podés conectarte con:  ssh $Server   (ya no hace falta poner el usuario)"
Write-Host "Copia de seguridad: $cfg.bak" -ForegroundColor DarkGray
