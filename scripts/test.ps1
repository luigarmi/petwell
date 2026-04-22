$ErrorActionPreference = 'Stop'

corepack pnpm test
& "$PSScriptRoot\docker-doctor.ps1"
& "$PSScriptRoot\check-stack-health.ps1" -Wait -TimeoutSeconds 90

corepack pnpm test:e2e:critical
