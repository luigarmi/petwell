param(
  [string] $GatewayBaseUrl = 'http://localhost/api',
  [int] $TimeoutSeconds = 180,
  [int] $PollIntervalSeconds = 5,
  [switch] $Wait
)

$ErrorActionPreference = 'Stop'

function Write-Info([string] $message) {
  Write-Host "[petwell-health] $message"
}

function Invoke-JsonRequest([string] $uri) {
  $response = & curl.exe -fsS --max-time 10 $uri 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($response | Out-String)
  }

  return ($response | Out-String) | ConvertFrom-Json
}

function Test-WebPage([string] $name, [string] $uri) {
  try {
    $statusCode = (& curl.exe -sS -o NUL -w "%{http_code}" --max-time 10 $uri 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
      throw $statusCode
    }

    if ([int] $statusCode -lt 200 -or [int] $statusCode -ge 400) {
      throw "Unexpected HTTP $statusCode"
    }

    return [PSCustomObject]@{
      name = $name
      status = 'up'
      url = $uri
    }
  } catch {
    return [PSCustomObject]@{
      name = $name
      status = 'down'
      url = $uri
      error = $_.Exception.Message
    }
  }
}

function Write-GatewaySummary($report) {
  Write-Info "Gateway readiness: status=$($report.status) ready=$($report.ready)"

  foreach ($check in $report.checks) {
    $details = @()
    $details += "status=$($check.status)"
    $details += "critical=$($check.critical)"
    $details += "latencyMs=$($check.latencyMs)"

    if ($check.error) {
      $details += "error=$($check.error)"
    }

    if ($check.details) {
      if ($check.details.upstreamService) {
        $details += "upstream=$($check.details.upstreamService)"
      }
      if ($null -ne $check.details.upstreamReady) {
        $details += "upstreamReady=$($check.details.upstreamReady)"
      }
    }

    Write-Info " - $($check.name): $($details -join ' ')"
  }
}

$readinessUri = "$GatewayBaseUrl/health/ready"
$livenessUri = "$GatewayBaseUrl/health/live"
$frontendChecks = @(
  @{ name = 'frontend-public-web'; url = 'http://localhost/' },
  @{ name = 'frontend-admin-web'; url = 'http://localhost/admin/login' }
)

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$lastFailure = 'Unknown stack health error.'

while ($true) {
  try {
    $gatewayReady = Invoke-JsonRequest $readinessUri
    $gatewayLive = Invoke-JsonRequest $livenessUri
    $frontendResults = @(
      $frontendChecks | ForEach-Object {
        Test-WebPage -name $_.name -uri $_.url
      }
    )

    if ($gatewayLive.status -ne 'ok') {
      throw "Gateway liveness returned status '$($gatewayLive.status)'."
    }

    $failedFrontends = @($frontendResults | Where-Object { $_.status -ne 'up' })
    if (-not $gatewayReady.ready -or $failedFrontends.Count -gt 0) {
      Write-GatewaySummary $gatewayReady
      foreach ($frontend in $frontendResults) {
        if ($frontend.status -eq 'up') {
          Write-Info " - $($frontend.name): status=up url=$($frontend.url)"
        } else {
          Write-Info " - $($frontend.name): status=down url=$($frontend.url) error=$($frontend.error)"
        }
      }

      if (-not $gatewayReady.ready) {
        $downChecks = @($gatewayReady.checks | Where-Object { $_.status -ne 'up' } | ForEach-Object { $_.name })
        $lastFailure = "Gateway readiness failed. Down checks: $($downChecks -join ', ')"
      } else {
        $failedNames = @($failedFrontends | ForEach-Object { $_.name })
        $lastFailure = "Frontend checks failed: $($failedNames -join ', ')"
      }
    } else {
      Write-GatewaySummary $gatewayReady
      foreach ($frontend in $frontendResults) {
        Write-Info " - $($frontend.name): status=up url=$($frontend.url)"
      }
      Write-Info 'Stack health is green.'
      exit 0
    }
  } catch {
    $lastFailure = $_.Exception.Message
    Write-Info "Health check attempt failed: $lastFailure"
  }

  if (-not $Wait -or (Get-Date) -ge $deadline) {
    throw "Stack health validation failed.`nLast error: $lastFailure"
  }

  Start-Sleep -Seconds $PollIntervalSeconds
}
