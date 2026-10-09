param(
  [string]$OutputPath = (Join-Path (Get-Location) ("backups\trading-journal-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".dump"))
)

$ErrorActionPreference = "Stop"
$containerId = docker compose ps -q db
if ($LASTEXITCODE -ne 0 -or -not $containerId) {
  throw "Could not find the running Compose database container."
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = [System.IO.Path]::GetDirectoryName($resolvedOutput)
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$dumpName = [System.IO.Path]::GetFileName($resolvedOutput)
$containerPath = "/backups/$dumpName"

docker compose exec -T db pg_dump --format=custom --no-owner --no-acl -U trading -d trading_journal -f $containerPath
if ($LASTEXITCODE -ne 0) {
  throw "PostgreSQL backup failed."
}

docker cp "$($containerId):$containerPath" $resolvedOutput
if ($LASTEXITCODE -ne 0) {
  throw "Could not copy the backup out of the database container; the temporary container copy remains at $containerPath."
}

docker compose exec -T db rm -f $containerPath
if ($LASTEXITCODE -ne 0) {
  throw "Backup was created at $resolvedOutput, but the temporary container copy could not be removed."
}

Write-Output "Database backup written to $resolvedOutput"
