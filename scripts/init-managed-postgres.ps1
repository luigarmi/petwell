param(
  [string]$BaseUrl = $env:PETWELL_POSTGRES_BASE_URL
)

$ErrorActionPreference = "Stop"

if (-not $BaseUrl) {
  throw "Set PETWELL_POSTGRES_BASE_URL or pass -BaseUrl with an admin Postgres URL."
}

$databaseNames = @(
  "petwell_user",
  "petwell_pet",
  "petwell_ehr",
  "petwell_appointment",
  "petwell_billing",
  "petwell_telemed",
  "petwell_notification",
  "petwell_analytics"
)

$uri = [System.Uri]$BaseUrl
$builder = New-Object System.UriBuilder($uri)
$builder.Path = "/postgres"
$adminUrl = $builder.Uri.AbsoluteUri

foreach ($databaseName in $databaseNames) {
  Write-Host "Ensuring database $databaseName exists..."
  $sql = "SELECT 'CREATE DATABASE $databaseName' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$databaseName')\gexec"
  psql $adminUrl -v ON_ERROR_STOP=1 -c $sql
}

Write-Host "Managed Postgres databases are ready."
