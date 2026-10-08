[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "High")]
param(
  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$InputPath
)

$ErrorActionPreference = "Stop"
$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$containerId = docker compose ps -q db
if ($LASTEXITCODE -ne 0 -or -not $containerId) {
  throw "Could not find the running Compose database container."
}

if ($PSCmdlet.ShouldProcess("trading_journal database", "Replace database contents from $resolvedInput")) {
  $dumpName = "restore-" + [System.IO.Path]::GetFileName($resolvedInput)
  $containerPath = "/backups/$dumpName"
  docker cp $resolvedInput "$($containerId):$containerPath"
  if ($LASTEXITCODE -ne 0) {
    throw "Could not copy the backup into the database container."
  }

  docker compose exec -T db pg_restore --clean --if-exists --no-owner --no-acl --single-transaction -U trading -d trading_journal $containerPath
  $restoreExitCode = $LASTEXITCODE
  docker compose exec -T db rm -f $containerPath
  if ($LASTEXITCODE -ne 0) {
    throw "Restore copy remains at $containerPath in the database container."
  }
  if ($restoreExitCode -ne 0) {
    throw "PostgreSQL restore failed. Review the database before using the application."
  }

  Write-Output "Database contents were restored from $resolvedInput"
}
