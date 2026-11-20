# Respaldo de la base de datos y de las imágenes de las preguntas (RNF-14).
# Uso:  powershell -ExecutionPolicy Bypass -File deploy\respaldo.ps1 -Destino "C:\Users\<usuario>\OneDrive\Respaldos\WebFranco"
# Conserva los últimos $Dias días. Restaurar: ver DESPLIEGUE.md, paso 8.
param(
  [string]$Destino = "$env:USERPROFILE\Respaldos\WebFranco",
  [int]$Dias = 14
)
$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot

$linea = Get-Content "$raiz\.env" | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $linea) { throw "No se encontró DATABASE_URL en $raiz\.env" }
$url = $linea -replace '^\s*DATABASE_URL\s*=\s*', ''

# pg_dump de la misma instalación que el servicio de PostgreSQL (puede estar en C: o en D:).
$servicio = Get-CimInstance Win32_Service -Filter "Name LIKE 'postgresql%'" | Select-Object -First 1
$pgDump = if ($servicio -and $servicio.PathName -match '^"?(.+?\\bin)\\pg_ctl\.exe') { Join-Path $Matches[1] 'pg_dump.exe' } else { (Get-Command pg_dump).Source }

New-Item -ItemType Directory -Force $Destino | Out-Null
$sello = Get-Date -Format 'yyyy-MM-dd_HHmm'
& $pgDump --format=custom --file="$Destino\bd-$sello.dump" --dbname=$url
if ($LASTEXITCODE -ne 0) { throw "pg_dump terminó con error ($LASTEXITCODE)" }

$imagenes = Get-ChildItem "$raiz\server\uploads" -File -ErrorAction SilentlyContinue
if ($imagenes) { Compress-Archive -Path $imagenes.FullName -DestinationPath "$Destino\imagenes-$sello.zip" -Force }

Get-ChildItem $Destino -File | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$Dias) } | Remove-Item
Write-Output "Respaldo listo: $Destino\bd-$sello.dump"
