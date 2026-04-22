$ErrorActionPreference = 'Stop'

function Write-Info([string] $message) {
  Write-Host "[petwell-doctor] $message"
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker CLI is not installed or is not available in PATH.'
}

$service = Get-Service com.docker.service -ErrorAction SilentlyContinue
if ($null -ne $service) {
  Write-Info "Docker Desktop Service: $($service.Status)"
}

try {
  $context = docker context show 2>$null
  if ($LASTEXITCODE -eq 0 -and $context) {
    Write-Info "Docker context: $context"
  }
} catch {
  Write-Info 'Docker context could not be resolved.'
}

try {
  $versionOutput = docker version 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($versionOutput | Out-String)
  }

  Write-Info 'Docker engine is healthy.'
  $versionOutput
} catch {
  $details = $_.Exception.Message.Trim()
  throw "Docker engine is not healthy. Restart Docker Desktop and, if needed, run 'wsl --shutdown' before opening Docker Desktop again.`n`nLast docker error:`n$details"
}
