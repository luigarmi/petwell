$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\docker-doctor.ps1"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$buildDefinitions = @(
  @{ service = 'api-gateway'; dockerfile = 'apps/api-gateway/Dockerfile'; image = 'pet_well-api-gateway' },
  @{ service = 'user-service'; dockerfile = 'apps/user-service/Dockerfile'; image = 'pet_well-user-service' },
  @{ service = 'pet-service'; dockerfile = 'apps/pet-service/Dockerfile'; image = 'pet_well-pet-service' },
  @{ service = 'ehr-service'; dockerfile = 'apps/ehr-service/Dockerfile'; image = 'pet_well-ehr-service' },
  @{ service = 'appointment-service'; dockerfile = 'apps/appointment-service/Dockerfile'; image = 'pet_well-appointment-service' },
  @{ service = 'billing-service'; dockerfile = 'apps/billing-service/Dockerfile'; image = 'pet_well-billing-service' },
  @{ service = 'telemed-service'; dockerfile = 'apps/telemed-service/Dockerfile'; image = 'pet_well-telemed-service' },
  @{ service = 'notification-service'; dockerfile = 'apps/notification-service/Dockerfile'; image = 'pet_well-notification-service' },
  @{ service = 'analytics-service'; dockerfile = 'apps/analytics-service/Dockerfile'; image = 'pet_well-analytics-service' },
  @{ service = 'frontend-public-web'; dockerfile = 'apps/frontend-public-web/Dockerfile'; image = 'pet_well-frontend-public-web' },
  @{ service = 'frontend-admin-web'; dockerfile = 'apps/frontend-admin-web/Dockerfile'; image = 'pet_well-frontend-admin-web' }
)

$previousComposeParallelLimit = $env:COMPOSE_PARALLEL_LIMIT
$env:COMPOSE_PARALLEL_LIMIT = '1'
$previousDockerBuildkit = $env:DOCKER_BUILDKIT
$previousComposeCliBuild = $env:COMPOSE_DOCKER_CLI_BUILD

function Reset-BuildEnvironment() {
  Remove-Item Env:DOCKER_BUILDKIT -ErrorAction SilentlyContinue
  Remove-Item Env:COMPOSE_DOCKER_CLI_BUILD -ErrorAction SilentlyContinue
}

function Invoke-ComposeBuild() {
  Reset-BuildEnvironment
  docker compose build
  return $LASTEXITCODE -eq 0
}

function Invoke-LegacyBuilds() {
  $env:DOCKER_BUILDKIT = '0'
  $env:COMPOSE_DOCKER_CLI_BUILD = '0'

  foreach ($definition in $buildDefinitions) {
    Write-Host "[petwell-up] Building $($definition.service) with legacy Docker builder."
    docker build -f $definition.dockerfile -t $definition.image $workspaceRoot
    if ($LASTEXITCODE -ne 0) {
      throw "Legacy docker build failed for $($definition.service)."
    }
  }
}

try {
  if (-not (Invoke-ComposeBuild)) {
    Write-Host '[petwell-up] docker compose build failed, falling back to sequential legacy builds.'
    Invoke-LegacyBuilds
  }

  Reset-BuildEnvironment
  docker compose up -d --no-build
  if ($LASTEXITCODE -ne 0) {
    throw 'docker compose up failed.'
  }

  & "$PSScriptRoot\check-stack-health.ps1" -Wait -TimeoutSeconds 240
} finally {
  if ($null -eq $previousComposeParallelLimit) {
    Remove-Item Env:COMPOSE_PARALLEL_LIMIT -ErrorAction SilentlyContinue
  } else {
    $env:COMPOSE_PARALLEL_LIMIT = $previousComposeParallelLimit
  }

  if ($null -eq $previousDockerBuildkit) {
    Remove-Item Env:DOCKER_BUILDKIT -ErrorAction SilentlyContinue
  } else {
    $env:DOCKER_BUILDKIT = $previousDockerBuildkit
  }

  if ($null -eq $previousComposeCliBuild) {
    Remove-Item Env:COMPOSE_DOCKER_CLI_BUILD -ErrorAction SilentlyContinue
  } else {
    $env:COMPOSE_DOCKER_CLI_BUILD = $previousComposeCliBuild
  }
}
