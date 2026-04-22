$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\docker-doctor.ps1"

$services = @('user-service','pet-service','ehr-service','appointment-service','telemed-service','notification-service','billing-service','analytics-service')
foreach ($service in $services) {
  docker compose run --rm $service pnpm --filter "@petwell/$service" prisma:migrate:deploy
}
